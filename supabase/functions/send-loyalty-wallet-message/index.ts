// Sends a loyalty notification campaign to the Google Wallet passes of its recipients
// (loyaltyObject.addMessage with TEXT_AND_NOTIFY). Only runs when a KELYANI admin has
// switched the Google Wallet channel on for the establishment, which requires the
// Enterprise pack (checked again here through get_loyalty_notification_channels).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const C = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...C, "Content-Type": "application/json" } });

function base64url(value: Uint8Array | string): string {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function walletAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${base64url(JSON.stringify({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/wallet_object.issuer",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }))}`;
  const der = Uint8Array.from(atob(privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "")), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = new Uint8Array(await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(unsigned)));
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${unsigned}.${base64url(signature)}` }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== "string") throw new Error("Authentification Google Wallet impossible.");
  return payload.access_token;
}

const API = "https://walletobjects.googleapis.com/walletobjects/v1";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: C });
  if (req.method !== "POST") return json({ success: false, error: "Méthode non autorisée." }, 405);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const issuerId = (Deno.env.get("GOOGLE_WALLET_ISSUER_ID") || Deno.env.get("WALLET_ISSUER_ID") || "").trim();
    const serviceAccountRaw = Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT_JSON") || Deno.env.get("GOOGLE_WALLET_SERVICE_ACCOUNT") || Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON") || "";
    if (!url || !anon || !service) return json({ success: false, error: "Configuration Supabase incomplète." }, 503);

    const authorization = req.headers.get("Authorization");
    if (!authorization?.startsWith("Bearer ")) return json({ success: false, error: "Session utilisateur manquante." }, 401);
    const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ success: false, error: "Session utilisateur invalide." }, 401);

    const body = await req.json().catch(() => ({}));
    const campaignId = String(body.campaign_id ?? "").trim();
    if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return json({ success: false, error: "campaign_id obligatoire." }, 400);

    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: campaign } = await admin.from("loyalty_notification_campaigns").select("id,establishment_id,title,message,expires_at").eq("id", campaignId).maybeSingle();
    if (!campaign) return json({ success: false, error: "Campagne introuvable." }, 404);

    // The user's own session decides access: staff of the establishment or a KELYANI admin.
    const { data: channels, error: channelsError } = await userClient.rpc("get_loyalty_notification_channels", { p_establishment_id: campaign.establishment_id });
    if (channelsError) return json({ success: false, error: "Accès à cet établissement refusé." }, 403);
    if (!channels?.google_wallet) return json({ success: true, channel: "google_wallet", enabled: false, sent: 0, skipped: 0, failed: 0 });
    if (!issuerId || !serviceAccountRaw) return json({ success: false, error: "Configuration Google Wallet incomplète." }, 503);

    let serviceAccount: { client_email?: string; private_key?: string };
    try { serviceAccount = JSON.parse(serviceAccountRaw); } catch { return json({ success: false, error: "Compte de service Google Wallet invalide." }, 503); }
    if (!serviceAccount.client_email || !serviceAccount.private_key) return json({ success: false, error: "Compte de service Google Wallet incomplet." }, 503);

    const { data: recipients } = await admin.from("loyalty_card_notifications").select("customer_id").eq("campaign_id", campaignId).eq("establishment_id", campaign.establishment_id);
    const customerKeys = new Set((recipients ?? []).map((row) => String(row.customer_id ?? "").replace(/-/g, "")).filter(Boolean));
    if (!customerKeys.size) return json({ success: true, channel: "google_wallet", enabled: true, sent: 0, skipped: 0, failed: 0, passes: 0 });

    const { data: catalog } = await admin.from("loyalty_wallet_design_catalog").select("google_class_id").eq("establishment_id", campaign.establishment_id).not("google_class_id", "is", null);
    const classIds = [...new Set((catalog ?? []).map((row) => String(row.google_class_id)).filter(Boolean))];
    if (!classIds.length) return json({ success: true, channel: "google_wallet", enabled: true, sent: 0, skipped: customerKeys.size, failed: 0, passes: 0 });

    const token = await walletAccessToken(serviceAccount.client_email, serviceAccount.private_key);
    const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
    // Object ids follow google-wallet-create-pass: <issuer>.kelyani_<establishment>_<customer>_<design>.
    const prefix = `${issuerId}.kelyani_${String(campaign.establishment_id).replace(/-/g, "")}_`;
    const objectIds: string[] = [];
    for (const classId of classIds) {
      let pageToken = "";
      for (let page = 0; page < 25; page++) {
        const listUrl = `${API}/loyaltyObject?classId=${encodeURIComponent(classId)}&maxResults=200${pageToken ? `&token=${encodeURIComponent(pageToken)}` : ""}`;
        const response = await fetch(listUrl, { headers });
        if (!response.ok) break;
        const data = await response.json().catch(() => ({}));
        for (const object of (data.resources ?? []) as Array<{ id?: string; state?: string }>) {
          const id = String(object.id ?? "");
          if (!id.startsWith(prefix) || (object.state && object.state !== "ACTIVE")) continue;
          const customerKey = id.slice(prefix.length).split("_")[0];
          if (customerKeys.has(customerKey)) objectIds.push(id);
        }
        pageToken = String(data.pagination?.nextPageToken ?? "");
        if (!pageToken) break;
      }
    }

    const start = new Date();
    const end = campaign.expires_at ? new Date(campaign.expires_at) : new Date(start.getTime() + 7 * 86400000);
    let sent = 0, failed = 0, lastError = "";
    for (const objectId of objectIds) {
      const response = await fetch(`${API}/loyaltyObject/${encodeURIComponent(objectId)}/addMessage`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          message: {
            // A resend needs a new id: Google rejects a message id already on the pass.
            id: `campaign_${String(campaign.id).replace(/-/g, "")}_${start.getTime()}`,
            header: String(campaign.title).slice(0, 80),
            body: String(campaign.message).slice(0, 500),
            messageType: "TEXT_AND_NOTIFY",
            displayInterval: { start: { date: start.toISOString() }, end: { date: end.toISOString() } },
          },
        }),
      });
      if (response.ok) sent++;
      else {
        failed++;
        const detail = await response.json().catch(() => ({}));
        lastError = String(detail?.error?.message ?? `HTTP ${response.status}`);
      }
    }

    const passHolders = new Set(objectIds.map((id) => id.slice(prefix.length).split("_")[0])).size;
    return json({
      success: failed === 0,
      channel: "google_wallet",
      enabled: true,
      sent,
      failed,
      passes: objectIds.length,
      skipped: Math.max(0, customerKeys.size - passHolders),
      ...(lastError ? { error: lastError } : {}),
    });
  } catch (error) {
    console.error(error);
    return json({ success: false, error: error instanceof Error ? error.message : "Erreur interne." }, 500);
  }
});
