import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const origin = Deno.env.get("KELYANI_APP_ORIGIN") ?? "";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
async function sha256(value: string) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value))));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    if (!origin || req.headers.get("origin") !== origin) return new Response("origin_not_allowed", { status: 403, headers: { "Vary": "Origin" } });
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!origin || req.headers.get("origin") !== origin) return reply({ error: "origin_not_allowed" }, 403);
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return reply({ error: "unauthorized" }, 401);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anon || !service) return reply({ error: "server_configuration_missing" }, 500);

  let body: Record<string, unknown>;
  try {
    const raw = await req.text();
    if (new TextEncoder().encode(raw).byteLength > 8_000) return reply({ error: "payload_too_large" }, 413);
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "invalid_json" }, 400);
    body = parsed;
  } catch { return reply({ error: "invalid_json" }, 400); }
  const establishmentId = typeof body.establishmentId === "string" ? body.establishmentId.trim() : "";
  if (!uuidPattern.test(establishmentId)) return reply({ error: "invalid_establishment_id" }, 400);

  const userClient = createClient(url, anon, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data: userData, error: authError } = await userClient.auth.getUser();
  if (authError || !userData.user) return reply({ error: "unauthorized" }, 401);
  const { data: establishments, error: accessError } = await userClient.rpc("get_my_establishments");
  if (accessError || !Array.isArray(establishments) || !establishments.some((row: { id?: string }) => row?.id === establishmentId)) {
    return reply({ error: "establishment_access_denied" }, 403);
  }

  // State is high entropy, returned only to this authenticated browser, and stored server-side hashed.
  const random = crypto.getRandomValues(new Uint8Array(32));
  const state = hex(random);
  const stateHash = await sha256(state);
  const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  const { error: insertError } = await admin.from("whatsapp_oauth_states").insert({
    nonce_hash: stateHash,
    user_id: userData.user.id,
    establishment_id: establishmentId,
    expires_at: expiresAt,
  });
  if (insertError) return reply({ error: "state_creation_failed" }, 500);
  return reply({ state, expiresAt });
});
