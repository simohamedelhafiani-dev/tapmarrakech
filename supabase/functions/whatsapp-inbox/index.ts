import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const origin = Deno.env.get("KELYANI_APP_ORIGIN") ?? "";
const cors = {
  "Access-Control-Allow-Origin": origin,
  "Access-Control-Allow-Headers": "authorization, content-type, apikey, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    if (!origin || req.headers.get("origin") !== origin) return new Response("origin_not_allowed", { status: 403, headers: { "Vary": "Origin" } });
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!origin || req.headers.get("origin") !== origin) return json({ error: "origin_not_allowed" }, 403);
  const authorization = req.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey) return json({ error: "server_configuration_missing" }, 500);

  let body: { establishmentId?: string; conversationId?: string; limit?: number };
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > 32_000) return json({ error: "payload_too_large" }, 413);
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "invalid_json" }, 400);
    body = parsed;
  } catch { return json({ error: "invalid_json" }, 400); }
  const establishmentId = typeof body.establishmentId === "string" ? body.establishmentId.trim() : "";
  const conversationId = typeof body.conversationId === "string" ? body.conversationId.trim() : "";
  const limit = Number.isInteger(body.limit) ? Math.min(Math.max(Number(body.limit), 1), 100) : 50;
  if (!uuidPattern.test(establishmentId) || (conversationId && !uuidPattern.test(conversationId))) {
    return json({ error: "invalid_request_fields" }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: user, error: authError } = await userClient.auth.getUser();
  if (authError || !user.user) return json({ error: "unauthorized" }, 401);
  const { data: accessible, error: accessError } = await userClient.rpc("get_my_establishments");
  if (accessError || !Array.isArray(accessible) || !accessible.some((row: { id?: string }) => row?.id === establishmentId)) {
    return json({ error: "establishment_access_denied" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  if (conversationId) {
    const { data: conversation, error: conversationError } = await admin.from("whatsapp_conversations")
      .select("id,establishment_id,connection_id,customer_phone,customer_name,status,last_message_at,created_at")
      .eq("id", conversationId).eq("establishment_id", establishmentId).maybeSingle();
    if (conversationError) return json({ error: "conversation_lookup_failed" }, 500);
    if (!conversation) return json({ error: "conversation_not_found" }, 404);
    const { data: messages, error: messagesError } = await admin.from("whatsapp_messages")
      .select("id,provider_message_id,direction,message_type,body,delivery_status,created_at")
      .eq("conversation_id", conversationId).eq("establishment_id", establishmentId)
      .order("created_at", { ascending: false }).limit(200);
    if (messagesError) return json({ error: "messages_lookup_failed" }, 500);
    return json({ conversation, messages: (messages ?? []).reverse() });
  }

  const { data: conversations, error: listError } = await admin.from("whatsapp_conversations")
    .select("id,establishment_id,connection_id,customer_phone,customer_name,status,last_message_at,created_at")
    .eq("establishment_id", establishmentId).order("last_message_at", { ascending: false }).limit(limit);
  if (listError) return json({ error: "inbox_lookup_failed" }, 500);
  const ids = (conversations ?? []).map((c: { id: string }) => c.id);
  if (!ids.length) return json({ conversations: [] });

  const { data: lastMessages, error: lastMessagesError } = await admin.from("whatsapp_messages")
    .select("id,conversation_id,direction,message_type,body,delivery_status,created_at")
    .eq("establishment_id", establishmentId).in("conversation_id", ids)
    .order("created_at", { ascending: false }).limit(1000);
  if (lastMessagesError) return json({ error: "inbox_messages_lookup_failed" }, 500);
  const latestByConversation = new Map<string, unknown>();
  for (const message of lastMessages ?? []) {
    const key = (message as { conversation_id: string }).conversation_id;
    if (!latestByConversation.has(key)) latestByConversation.set(key, message);
  }

  // The global 1000-message cap can omit quieter conversations. Fetch the latest
  // message individually for any conversation not represented in that batch.
  const missingConversationIds = ids.filter((id) => !latestByConversation.has(id));
  const fallbackResults = await Promise.all(missingConversationIds.map(async (id) => {
    const { data, error } = await admin.from("whatsapp_messages")
      .select("id,conversation_id,direction,message_type,body,delivery_status,created_at")
      .eq("establishment_id", establishmentId).eq("conversation_id", id)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    return { id, data, error };
  }));
  if (fallbackResults.some((result) => result.error)) return json({ error: "inbox_messages_lookup_failed" }, 500);
  for (const result of fallbackResults) {
    if (result.data) latestByConversation.set(result.id, result.data);
  }

  return json({ conversations: (conversations ?? []).map((conversation: { id: string }) => ({
    ...conversation, last_message: latestByConversation.get(conversation.id) ?? null,
  })) });
});
