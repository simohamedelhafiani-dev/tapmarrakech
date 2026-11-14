import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

function pemToBytes(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function base64url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
async function googleToken(email: string, privateKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({
    iss: email, scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600,
  }))}`;
  const key = await crypto.subtle.importKey("pkcs8", pemToBytes(privateKey), { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64url(signature)}` }),
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok || !body.access_token) throw new Error("Authentification Google Wallet impossible.");
  return String(body.access_token);
}
const localized = (value: string) => ({ defaultValue: { language: "fr-FR", value } });
const validHex = (value: unknown, fallback: string) => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Méthode non autorisée" }, 405);
  try {
    const authorization = request.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ success: false, error: "Session requise" }, 401);
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const issuerId = (Deno.env.get("GOOGLE_WALLET_ISSUER_ID") || Deno.env.get("WALLET_ISSUER_ID") || "").trim();
    const serviceAccountRaw = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") || Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "";
    if (!supabaseUrl || !serviceRoleKey || !issuerId || !serviceAccountRaw) return json({ success: false, error: "Configuration Wallet incomplète sur Staging." }, 503);

    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: authError } = await admin.auth.getUser(authorization.slice(7));
    if (authError || !user) return json({ success: false, error: "Session invalide" }, 401);
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if (profile?.role !== "admin") return json({ success: false, error: "Action réservée à l'Admin KELYANI." }, 403);

    const body = await request.json().catch(() => ({}));
    const establishmentId = typeof body.establishment_id === "string" ? body.establishment_id : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(establishmentId)) return json({ success: false, error: "Établissement invalide." }, 400);

    const [{ data: place, error: placeError }, { data: designRow, error: designError }] = await Promise.all([
      admin.from("establishments").select("id,name,logo_url").eq("id", establishmentId).maybeSingle(),
      admin.from("loyalty_card_designs").select("design_config").eq("establishment_id", establishmentId).maybeSingle(),
    ]);
    if (placeError || !place) return json({ success: false, error: "Établissement introuvable." }, 404);
    if (designError) return json({ success: false, error: "Impossible de charger le design Wallet." }, 500);

    const config = (designRow?.design_config && typeof designRow.design_config === "object" ? designRow.design_config : {}) as Record<string, unknown>;
    const wallet = (config.wallet_design && typeof config.wallet_design === "object" ? config.wallet_design : {}) as Record<string, unknown>;
    const classSuffix = `kelyani_${establishmentId.replace(/-/g, "")}`;
    const classId = `${issuerId}.${classSuffix}`;
    const logoUrl = typeof wallet.logoUrl === "string" && wallet.logoUrl.startsWith("https://")
      ? wallet.logoUrl
      : typeof place.logo_url === "string" && place.logo_url.startsWith("https://")
        ? place.logo_url
        : "https://www.kelyani.com/kelyani-wallet-logo.png";
    const classBody = {
      id: classId,
      issuerName: "KELYANI",
      programName: String(wallet.cardTitle || place.name || "KELYANI").slice(0, 20),
      programLogo: { sourceUri: { uri: logoUrl }, contentDescription: localized("Logo du programme de fidélité") },
      hexBackgroundColor: validHex(wallet.backgroundColor, "#050505"),
      homepageUri: { uri: "https://www.kelyani.com", description: "Découvrir KELYANI" },
      reviewStatus: "UNDER_REVIEW",
    };

    const serviceAccount = JSON.parse(serviceAccountRaw) as { client_email?: string; private_key?: string };
    if (!serviceAccount.client_email || !serviceAccount.private_key) return json({ success: false, error: "Compte de service Google incomplet." }, 503);
    const token = await googleToken(serviceAccount.client_email, serviceAccount.private_key);
    const endpoint = `https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass/${encodeURIComponent(classId)}`;
    const getResponse = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}` } });
    let result: Record<string, unknown>;
    let created = false;
    if (getResponse.status === 404) {
      const insertResponse = await fetch("https://walletobjects.googleapis.com/walletobjects/v1/loyaltyClass", {
        method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(classBody),
      });
      result = await insertResponse.json().catch(() => ({}));
      if (!insertResponse.ok) {
        return json({ success: false, stage: "class_create", google_status: insertResponse.status, error: (result as any)?.error?.message || "Google a refusé la création de la classe." }, 502);
      }
      created = true;
    } else {
      const current = await getResponse.json().catch(() => ({}));
      if (!getResponse.ok) return json({ success: false, stage: "class_read", google_status: getResponse.status, error: (current as any)?.error?.message || "Impossible de lire la classe Google." }, 502);
      const patch = {
        issuerName: classBody.issuerName,
        programName: classBody.programName,
        programLogo: classBody.programLogo,
        hexBackgroundColor: classBody.hexBackgroundColor,
        homepageUri: classBody.homepageUri,
        reviewStatus: "UNDER_REVIEW",
      };
      const patchResponse = await fetch(endpoint, {
        method: "PATCH", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      result = await patchResponse.json().catch(() => ({}));
      if (!patchResponse.ok) return json({ success: false, stage: "class_update", google_status: patchResponse.status, error: (result as any)?.error?.message || "Google a refusé la mise à jour de la classe." }, 502);
    }

    const nextWallet = { ...wallet, googleClassId: classId, googleClassStatus: String(result.reviewStatus || "UNDER_REVIEW") };
    const { error: saveError } = await admin.from("loyalty_card_designs").update({
      design_config: { ...config, wallet_design: nextWallet },
    }).eq("establishment_id", establishmentId);
    if (saveError) return json({ success: false, stage: "persist", error: "Classe créée mais identifiant non enregistré dans KELYANI. Relancez la synchronisation." }, 500);

    return json({
      success: true, class_id: classId, review_status: String(result.reviewStatus || "UNDER_REVIEW"),
      created, message: created
        ? "Classe Wallet créée pour cet établissement. Elle doit maintenant être approuvée par Google avant l'émission des cartes."
        : "Design synchronisé avec la classe Wallet de cet établissement. Google peut demander une nouvelle validation.",
    });
  } catch (error) {
    console.error("google-wallet-admin-sync-class failed", error instanceof Error ? error.message : "unknown error");
    return json({ success: false, error: "Impossible de synchroniser le design Wallet." }, 500);
  }
});
