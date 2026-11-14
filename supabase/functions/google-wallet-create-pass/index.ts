import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function base64url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToBytes(pem: string): Uint8Array {
  const base64 = pem.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function signJwt(claims: Record<string, unknown>, privateKey: string): Promise<string> {
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify(claims))}`;
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBytes(privateKey),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = new Uint8Array(await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned),
  ));
  return `${unsigned}.${base64url(signature)}`;
}

function localized(value: string, language = "fr-FR") {
  return { defaultValue: { language, value } };
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ success: false, error: "Méthode non autorisée" }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const accessToken = typeof body.access_token === "string" ? body.access_token : "";
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(accessToken)) {
      return json({ success: false, error: "Lien de carte invalide" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const issuerId = Deno.env.get("GOOGLE_WALLET_ISSUER_ID") || Deno.env.get("WALLET_ISSUER_ID") || "";
    const serviceAccountRaw =
      Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") ||
      Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT") ||
      Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "";

    if (!supabaseUrl || !anonKey || !issuerId || !serviceAccountRaw) {
      return json({ success: false, error: "Configuration Wallet incomplète. Contactez l'établissement." }, 503);
    }

    let serviceAccount: { client_email?: string; private_key?: string };
    try {
      serviceAccount = JSON.parse(serviceAccountRaw);
    } catch {
      return json({ success: false, error: "Configuration du compte de service invalide" }, 503);
    }
    if (!serviceAccount.client_email || !serviceAccount.private_key) {
      return json({ success: false, error: "Compte de service incomplet" }, 503);
    }

    const publicClient = createClient(supabaseUrl, anonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const [{ data: cardRows, error: cardError }, { data: designRows }, { data: programRows }] = await Promise.all([
      publicClient.rpc("get_public_loyalty_card", { p_access_token: accessToken }),
      publicClient.rpc("get_public_loyalty_card_config", { p_access_token: accessToken }),
      publicClient.rpc("get_public_loyalty_program_context", { p_access_token: accessToken }),
    ]);

    if (cardError || !cardRows?.[0]) {
      return json({ success: false, error: "Carte de fidélité introuvable ou expirée" }, 404);
    }

    const card = cardRows[0];
    const design = designRows?.[0] ?? {};
    const program = programRows?.[0] ?? {};
    const issuer = issuerId.trim();
    const classSuffix = `kelyani_${String(card.establishment_id).replace(/-/g, "")}`;
    const objectSuffix = `client_${String(card.customer_id).replace(/-/g, "")}`;
    const classId = `${issuer}.${classSuffix}`;
    const objectId = `${issuer}.${objectSuffix}`;
    const establishmentName = String(card.establishment_name || "Programme fidélité");
    const clientName = [card.first_name, card.last_name].filter(Boolean).join(" ").slice(0, 60) || "Client KELYANI";
    const balance = Math.max(0, Number(card.points_balance || 0));
    const stamps = Math.max(0, Number(program.stamps_balance ?? card.stamps_balance ?? 0));
    const mode = String(program.program_type || "POINTS_REWARD");
    const progress = mode === "STAMP" ? `${stamps} / ${Number(program.stamp_goal || 10)} tampons` : `${balance.toLocaleString("fr-FR")} points`;
    const cardColor = /^#[0-9A-Fa-f]{6}$/.test(String(design.primary_color || "")) ? design.primary_color : "#172A25";
    const qrValue = `${supabaseUrl}/functions/v1/google-wallet-card-lookup?token=${encodeURIComponent(accessToken)}`;

    const genericClass = { id: classId };
    const genericObject = {
      id: objectId,
      classId,
      state: "ACTIVE",
      cardTitle: localized("KELYANI", "fr-FR"),
      header: localized(establishmentName, "fr-FR"),
      subheader: localized("Carte de fidélité", "fr-FR"),
      hexBackgroundColor: cardColor,
      barcode: { type: "QR_CODE", value: qrValue, alternateText: "Présentez ce QR code à l'établissement" },
      textModulesData: [
        { id: "customer", header: "Titulaire", body: clientName },
        { id: "progress", header: mode === "STAMP" ? "Tampons" : "Solde fidélité", body: progress },
        { id: "loyalty-number", header: "N° client", body: String(card.loyalty_number || "").slice(0, 40) },
      ],
      ...(card.establishment_logo_url && /^https:\/\//i.test(card.establishment_logo_url)
        ? { logo: { sourceUri: { uri: card.establishment_logo_url }, contentDescription: localized(`Logo ${establishmentName}`) } }
        : {}),
      ...(card.establishment_logo_url && /^https:\/\//i.test(card.establishment_logo_url)
        ? { wideLogo: { sourceUri: { uri: card.establishment_logo_url }, contentDescription: localized(`Logo ${establishmentName}`) } }
        : {}),
    };

    const now = Math.floor(Date.now() / 1000);
    const saveJwt = await signJwt({
      iss: serviceAccount.client_email,
      aud: "google",
      typ: "savetowallet",
      iat: now,
      origins: [],
      payload: {
        genericClasses: [genericClass],
        genericObjects: [genericObject],
      },
    }, serviceAccount.private_key);

    return json({
      success: true,
      save_url: `https://pay.google.com/gp/v/save/${saveJwt}`,
      pass_id: objectId,
      message: "Lien Google Wallet prêt. Le pass sera créé lorsque le client l'ajoutera à son Wallet.",
    });
  } catch (error) {
    console.error("google-wallet-create-pass failed", error instanceof Error ? error.message : "unknown error");
    return json({ success: false, error: "Impossible de préparer la carte Google Wallet pour le moment" }, 500);
  }
});
