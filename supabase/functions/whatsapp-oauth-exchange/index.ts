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

  let body: { code?: string; establishmentId?: string; wabaId?: string; phoneNumberId?: string };
  try { body = await req.json(); } catch { return reply({ error: "invalid_json" }, 400); }
  const code = body.code?.trim();
  const establishmentId = body.establishmentId?.trim();
  if (!code || !establishmentId) return reply({ error: "code_and_establishment_required" }, 400);

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: establishment, error: ownerError } = await admin
    .from("establishments").select("id").eq("id", establishmentId).eq("user_id", userData.user.id).maybeSingle();
  if (ownerError || !establishment) return reply({ error: "establishment_access_denied" }, 403);

  const exchange = await fetch(`https://graph.facebook.com/${graphVersion}/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: appId, client_secret: appSecret, code }),
  });
  const tokenData = await exchange.json().catch(() => ({}));
  if (!exchange.ok || !tokenData.access_token) {
    return reply({ error: "meta_code_exchange_failed", details: tokenData.error?.message ?? "Meta token exchange failed" }, 400);
  }

  const expiresAt = tokenData.expires_in ? new Date(Date.now() + Number(tokenData.expires_in) * 1000).toISOString() : null;
  const { error: saveError } = await admin.from("whatsapp_connections").upsert({
    establishment_id: establishmentId,
    connected_by: userData.user.id,
    meta_access_token: tokenData.access_token,
    token_type: tokenData.token_type ?? null,
    token_expires_at: expiresAt,
    waba_id: body.wabaId ?? null,
    phone_number_id: body.phoneNumberId ?? null,
    status: "pending",
    updated_at: new Date().toISOString(),
  }, { onConflict: "establishment_id" });
  if (saveError) return reply({ error: "token_save_failed" }, 500);

  return reply({ success: true, status: "pending", message: "Token sécurisé enregistré. Identifiants WhatsApp Business à finaliser." });
});
