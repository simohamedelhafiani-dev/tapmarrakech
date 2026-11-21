import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const origin = Deno.env.get("KELYANI_APP_ORIGIN") ?? "";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const idPattern = /^[0-9]{5,32}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function graphGet(url: URL, token: string) {
  url.searchParams.set("access_token", token);
  const response = await fetch(url, { method: "GET" });
  const data = await response.json().catch(() => ({}));
  return { response, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!origin || req.headers.get("origin") !== origin) return reply({ error: "origin_not_allowed" }, 403);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return reply({ error: "unauthorized" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");
  const graphVersion = Deno.env.get("META_GRAPH_API_VERSION");
  if (!supabaseUrl || !anonKey || !serviceKey || !appId || !appSecret || !graphVersion) {
    return reply({ error: "server_configuration_missing" }, 500);
  }

  let body: { code?: string; establishmentId?: string; wabaId?: string; phoneNumberId?: string };
  try { body = await req.json(); } catch { return reply({ error: "invalid_json" }, 400); }
  const code = body.code?.trim();
  const establishmentId = body.establishmentId?.trim();
  const wabaId = body.wabaId?.trim();
  const phoneNumberId = body.phoneNumberId?.trim();
  if (!code || !establishmentId || !wabaId || !phoneNumberId) {
    return reply({ error: "code_establishment_waba_and_phone_required" }, 400);
  }
  if (!uuidPattern.test(establishmentId) || !idPattern.test(wabaId) || !idPattern.test(phoneNumberId)) {
    return reply({ error: "invalid_identifiers" }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return reply({ error: "unauthorized" }, 401);
  const { data: accessible, error: accessError } = await userClient.rpc("get_my_establishments");
  const hasAccess = Array.isArray(accessible) && accessible.some((row: { id?: string }) => row?.id === establishmentId);
  if (accessError || !hasAccess) return reply({ error: "establishment_access_denied" }, 403);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: establishment, error: establishmentError } = await admin.from("establishments")
    .select("id").eq("id", establishmentId).maybeSingle();
  if (establishmentError || !establishment) return reply({ error: "establishment_not_found" }, 404);

  // Exchange the short-lived Embedded Signup authorization code server-side only.
  const exchangeUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
  exchangeUrl.search = new URLSearchParams({ client_id: appId, client_secret: appSecret, code }).toString();
  const exchange = await fetch(exchangeUrl, { method: "GET" });
  const tokenData = await exchange.json().catch(() => ({}));
  const accessToken = typeof tokenData.access_token === "string" ? tokenData.access_token : "";
  if (!exchange.ok || !accessToken) return reply({ error: "meta_code_exchange_failed" }, 400);

  // Verify the WABA exists and is readable by the newly exchanged token.
  const wabaUrl = new URL(`https://graph.facebook.com/${graphVersion}/${wabaId}`);
  wabaUrl.searchParams.set("fields", "id,name,timezone_id");
  const wabaCheck = await graphGet(wabaUrl, accessToken);
  if (!wabaCheck.response.ok || String(wabaCheck.data.id ?? "") !== wabaId) {
    return reply({ error: "meta_waba_verification_failed" }, 403);
  }

  // Verify the submitted Phone Number ID is actually attached to that WABA.
  let phoneData: Record<string, unknown> | null = null;
  let nextUrl: URL | null = new URL(`https://graph.facebook.com/${graphVersion}/${wabaId}/phone_numbers`);
  nextUrl.searchParams.set("fields", "id,display_phone_number,verified_name,status");
  nextUrl.searchParams.set("limit", "100");
  for (let page = 0; page < 5 && nextUrl; page += 1) {
    const pageResult = await graphGet(nextUrl, accessToken);
    if (!pageResult.response.ok) return reply({ error: "meta_phone_numbers_verification_failed" }, 403);
    const items = Array.isArray(pageResult.data.data) ? pageResult.data.data : [];
    phoneData = items.find((item: { id?: string }) => String(item?.id ?? "") === phoneNumberId) ?? phoneData;
    const pagingNext = pageResult.data.paging?.next;
    nextUrl = typeof pagingNext === "string" ? new URL(pagingNext) : null;
  }
  if (!phoneData) return reply({ error: "phone_number_not_attached_to_waba" }, 403);

  // Never store provider access tokens in the connection table. Save to Supabase Vault
  // through the service-role-only wrapper, then keep only the Vault secret UUID.
  const { data: secretId, error: vaultError } = await admin.rpc("whatsapp_store_secret", {
    p_secret: accessToken,
    p_name: `whatsapp-access-${establishmentId}-${Date.now()}`,
  });
  if (vaultError || !secretId) return reply({ error: "secure_token_storage_failed" }, 500);

  const { error: saveError } = await admin.from("whatsapp_connections").upsert({
    establishment_id: establishmentId,
    waba_id: wabaId,
    phone_number_id: phoneNumberId,
    display_phone_number: phoneData.display_phone_number ?? null,
    business_name: phoneData.verified_name ?? wabaCheck.data.name ?? null,
    access_token_secret_id: secretId,
    status: "active",
    auto_reply_enabled: false,
    updated_at: new Date().toISOString(),
  }, { onConflict: "establishment_id" });
  if (saveError) {
    // The Vault entry is intentionally not exposed or deleted here; cleanup must be
    // performed using a Vault-aware administrative routine after safe confirmation.
    return reply({ error: "connection_save_failed" }, 500);
  }

  return reply({
    success: true,
    status: "active",
    verified: { waba: true, phone_number: true },
    phoneNumber: phoneData.display_phone_number ?? null,
    businessName: phoneData.verified_name ?? wabaCheck.data.name ?? null,
    message: "WhatsApp Business account and phone number verified and securely connected.",
  });
});
