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
const phonePattern = /^\+[1-9]\d{7,14}$/;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    if (!origin || req.headers.get("origin") !== origin) return new Response("origin_not_allowed", { status: 403, headers: { "Vary": "Origin" } });
    return new Response("ok", { headers: cors });
  }
  if (req.method !== "POST") return reply({ error: "method_not_allowed" }, 405);
  if (!origin || req.headers.get("origin") !== origin) return reply({ error: "origin_not_allowed" }, 403);

  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return reply({ error: "unauthorized" }, 401);
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const graphVersion = Deno.env.get("META_GRAPH_API_VERSION");
  if (!supabaseUrl || !anonKey || !serviceKey || !graphVersion) return reply({ error: "server_configuration_missing" }, 500);

  let body: { establishmentId?: string; to?: string; text?: string; requestId?: string };
  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > 32_000) return reply({ error: "payload_too_large" }, 413);
  try {
    const parsed = JSON.parse(rawBody);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return reply({ error: "invalid_json" }, 400);
    body = parsed;
  } catch { return reply({ error: "invalid_json" }, 400); }
  const establishmentId = typeof body.establishmentId === "string" ? body.establishmentId.trim() : "";
  const to = typeof body.to === "string" ? body.to.trim() : "";
  const textBody = typeof body.text === "string" ? body.text.trim() : "";
  const requestId = typeof body.requestId === "string" ? body.requestId.trim() : "";
  const customerPhone = to.replace(/^\+/, "");
  if (!uuidPattern.test(establishmentId) || !phonePattern.test(to) || !textBody || textBody.length > 4096 || !uuidPattern.test(requestId)) {
    return reply({ error: "invalid_request_fields" }, 400);
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: auth } },
  });
  const { data: user, error: authError } = await userClient.auth.getUser();
  if (authError || !user.user) return reply({ error: "unauthorized" }, 401);
  const { data: accessible, error: accessError } = await userClient.rpc("get_my_establishments");
  if (accessError || !Array.isArray(accessible) || !accessible.some((row: { id?: string }) => row?.id === establishmentId)) {
    return reply({ error: "establishment_access_denied" }, 403);
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data: connection, error: connectionError } = await admin.from("whatsapp_connections")
    .select("id,establishment_id,phone_number_id,access_token_secret_id,status")
    .eq("establishment_id", establishmentId).maybeSingle();
  if (connectionError) return reply({ error: "connection_lookup_failed" }, 500);
  if (!connection || connection.status !== "active") return reply({ error: "whatsapp_not_connected" }, 409);

  // Idempotency: reserve this client request before calling Meta. If a duplicate
  // request arrives, return its record instead of sending a second message.
  const { data: prior, error: priorError } = await admin.from("whatsapp_messages")
    .select("id,provider_message_id,delivery_status")
    .eq("client_request_id", requestId).eq("establishment_id", establishmentId).maybeSingle();
  if (priorError) return reply({ error: "idempotency_lookup_failed" }, 500);
  if (prior) {
    const pending = prior.delivery_status === "queued";
    return reply({ success: prior.delivery_status !== "failed", duplicate: true, pending, error: prior.delivery_status === "failed" ? "previous_attempt_failed" : undefined, messageId: prior.id, providerMessageId: prior.provider_message_id, status: prior.delivery_status }, pending ? 202 : 200);
  }

  const { data: conversation, error: conversationError } = await admin.from("whatsapp_conversations")
    .select("id").eq("connection_id", connection.id).eq("customer_phone", customerPhone).maybeSingle();
  if (conversationError) return reply({ error: "conversation_lookup_failed" }, 500);
  let conversationId = conversation?.id;
  if (!conversationId) {
    const { data: created, error: createError } = await admin.from("whatsapp_conversations")
      .insert({ connection_id: connection.id, establishment_id: establishmentId, customer_phone: customerPhone, status: "open", last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .select("id").single();
    if (createError || !created) {
      // If a parallel request created the conversation, safely recover it.
      const { data: raced, error: raceError } = await admin.from("whatsapp_conversations")
        .select("id").eq("connection_id", connection.id).eq("customer_phone", customerPhone).maybeSingle();
      if (raceError || !raced) return reply({ error: "conversation_create_failed" }, 500);
      conversationId = raced.id;
    } else conversationId = created.id;
  }

  const { data: queued, error: queueError } = await admin.from("whatsapp_messages").insert({
    establishment_id: establishmentId,
    conversation_id: conversationId,
    client_request_id: requestId,
    direction: "outbound",
    message_type: "text",
    body: textBody,
    delivery_status: "queued",
    raw_metadata: { recipient: customerPhone },
  }).select("id").single();
  if (queueError || !queued) {
    // Unique id conflict means another request already reserved this id. Never
    // proceed to provider send when reservation failed.
    if (queueError?.code === "23505") {
      const { data: duplicate } = await admin.from("whatsapp_messages").select("id,provider_message_id,delivery_status").eq("client_request_id", requestId).eq("establishment_id", establishmentId).maybeSingle();
      if (duplicate) {
        const pending = duplicate.delivery_status === "queued";
        return reply({ success: duplicate.delivery_status !== "failed", duplicate: true, pending, error: duplicate.delivery_status === "failed" ? "previous_attempt_failed" : undefined, messageId: duplicate.id, providerMessageId: duplicate.provider_message_id, status: duplicate.delivery_status }, pending ? 202 : 200);
      }
    }
    return reply({ error: "message_queue_failed" }, 500);
  }

  const { data: token, error: tokenError } = await admin.rpc("whatsapp_read_secret", { p_secret_id: connection.access_token_secret_id });
  const accessToken = typeof token === "string" ? token : "";
  if (tokenError || !accessToken) {
    await admin.from("whatsapp_messages").update({ delivery_status: "failed", raw_metadata: { recipient: customerPhone, error: "token_read_failed" } }).eq("id", queued.id);
    return reply({ error: "whatsapp_token_unavailable", messageId: queued.id }, 500);
  }

  const graphUrl = `https://graph.facebook.com/${graphVersion}/${connection.phone_number_id}/messages`;
  let providerResponse: Response;
  let providerData: Record<string, unknown>;
  try {
    providerResponse = await fetch(graphUrl, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: customerPhone, type: "text", text: { body: textBody } }),
      signal: AbortSignal.timeout(15_000),
    });
    providerData = await providerResponse.json().catch(() => ({}));
  } catch {
    // Network errors and timeouts are ambiguous: Meta may have accepted the
    // message before the connection failed. Keep it queued to prevent a retry
    // with a new request ID from silently duplicating the message.
    await admin.from("whatsapp_messages").update({ delivery_status: "queued", raw_metadata: { recipient: customerPhone, error: "provider_network_error", delivery_unknown: true } }).eq("id", queued.id);
    return reply({ error: "meta_request_outcome_unknown", pending: true, messageId: queued.id, status: "queued" }, 202);
  }

  if (!providerResponse.ok) {
    // Keep the provider error private; avoid persisting full response/token data.
    await admin.from("whatsapp_messages").update({ delivery_status: "failed", raw_metadata: { recipient: customerPhone, error_code: (providerData.error as Record<string, unknown> | undefined)?.code ?? null } }).eq("id", queued.id);
    return reply({ error: "meta_send_rejected", messageId: queued.id }, 502);
  }

  const messages = Array.isArray(providerData.messages) ? providerData.messages as Record<string, unknown>[] : [];
  const providerMessageId = typeof messages[0]?.id === "string" ? messages[0].id.trim() : "";
  if (!providerMessageId || providerMessageId.length > 512) {
    // A successful HTTP response without a usable provider ID is ambiguous:
    // Meta may have accepted the send, so don't mark it failed or retry it.
    return reply({ error: "meta_response_missing_message_id", messageId: queued.id }, 502);
  }
  const { error: finalizeError } = await admin.from("whatsapp_messages").update({
    provider_message_id: providerMessageId,
    delivery_status: "sent",
    raw_metadata: { recipient: customerPhone },
  }).eq("id", queued.id);
  if (finalizeError) return reply({ error: "message_sent_but_persistence_failed", messageId: queued.id }, 500);
  await admin.from("whatsapp_conversations").update({ last_message_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", conversationId);
  return reply({ success: true, messageId: queued.id, providerMessageId, status: "sent" });
});
