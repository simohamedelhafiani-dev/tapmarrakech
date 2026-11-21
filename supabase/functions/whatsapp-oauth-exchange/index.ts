import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("KELYANI_APP_ORIGIN") ?? "",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return reply({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const appId = Deno.env.get("META_APP_ID");
  const appSecret = Deno.env.get("META_APP_SECRET");
  const origin = Deno.env.get("KELYANI_APP_ORIGIN");
  const graphVersion = Deno.env.get("META_GRAPH_API_VERSION");
  if (!supabaseUrl || !anonKey || !serviceKey || !appId || !appSecret || !origin || !graphVersion) {
    return reply({ error: "server_configuration_missing" }, 500);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return reply({ error: "unauthorized" }, 401);

  // Match the dashboard's server-owned access rule. This permits assigned
  // responsible users without trusting a client-provided user_id.
  const { data: accessibleEstablishments, error: accessError } = await userClient.rpc("get_my_establishments");

  let body: { code?: string; establishmentId?: string; wabaId?: string; phoneNumberId?: string };
  try { body = await req.json(); } catch { return reply({ error: "invalid_json" }, 400); }
  const code = body.code?.trim();
  const establishmentId = body.establishmentId?.trim();
  const wabaId = body.wabaId?.trim();
  const phoneNumberId = body.phoneNumberId?.trim() || null;
  if (!code || !establishmentId || !wabaId) return reply({ error: "code_establishment_and_waba_required" }, 400);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(establishmentId)
    || !/^\d{5,32}$/.test(wabaId)
    || (phoneNumberId && !/^\d{5,32}$/.test(phoneNumberId))) {
    return reply({ error: "invalid_establishment_or_whatsapp_id" }, 400);
  }
  const hasAccess = Array.isArray(accessibleEstablishments)
    && accessibleEstablishments.some((row: { id?: string }) => row?.id === establishmentId);
  if (accessError || !hasAccess) return reply({ error: "establishment_access_denied" }, 403);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: establishment, error: establishmentError } = await admin
    .from("establishments").select("id").eq("id", establishmentId).maybeSingle();
  if (establishmentError || !establishment) return reply({ error: "establishment_not_found" }, 404);

  const tokenUrl = new URL(`https://graph.facebook.com/${graphVersion}/oauth/access_token`);
  tokenUrl.search = new URLSearchParams({ client_id: appId, client_secret: appSecret, code }).toString();
  const exchange = await fetch(tokenUrl, { method: "GET" });
  const tokenData = await exchange.json().catch(() => ({}));
  if (!exchange.ok || !tokenData.access_token) {
    return reply({ error: "meta_code_exchange_failed" }, 400);
  }

  const expiresAt = tokenData.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString() : null;
  const { error: saveError } = await admin.from("whatsapp_connections").upsert({
    establishment_id: establishmentId,
    connected_by: userData.user.id,
    meta_access_token: tokenData.access_token,
    token_type: tokenData.token_type ?? null,
    token_expires_at: expiresAt,
    waba_id: wabaId,
    phone_number_id: phoneNumberId,
    status: "pending",
    updated_at: new Date().toISOString(),
  }, { onConflict: "establishment_id" });
  if (saveError) return reply({ error: "token_save_failed" }, 500);

  return reply({ success: true, status: "pending", message: phoneNumberId
    ? "Compte et numéro WhatsApp enregistrés. Les étapes d’activation Meta restent à finaliser."
    : "Compte WhatsApp enregistré. Ajoutez un numéro dans Meta pour finaliser l’activation." });
});

