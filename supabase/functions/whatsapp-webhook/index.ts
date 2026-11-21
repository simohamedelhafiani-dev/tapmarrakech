import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json" },
});
const hex = (bytes: Uint8Array) => Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
const constantTimeEqual = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
};
async function validSignature(raw: string, signature: string | null, appSecret: string) {
  if (!signature?.startsWith("sha256=")) return false;
  const supplied = signature.slice(7).toLowerCase();
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(appSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(raw));
  return constantTimeEqual(hex(new Uint8Array(digest)), supplied);
}

Deno.serve(async (req) => {
  if (req.method === "GET") {
    const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN");
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    if (mode === "subscribe" && verifyToken && token && constantTimeEqual(token, verifyToken) && challenge) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return json({ error: "webhook_verification_failed" }, 403);
  }
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const appSecret = Deno.env.get("META_APP_SECRET");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!appSecret || !supabaseUrl || !serviceKey) return json({ error: "server_configuration_missing" }, 500);

  const raw = await req.text();
  if (raw.length > 1_000_000) return json({ error: "payload_too_large" }, 413);
  if (!await validSignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return json({ error: "invalid_signature" }, 401);
  }
  let payload: Record<string, unknown>;
  try { payload = JSON.parse(raw); } catch { return json({ error: "invalid_json" }, 400); }
  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const entries = Array.isArray(payload.entry) ? payload.entry : [];
  let accepted = 0;
  for (const entry of entries) {
    const changes = Array.isArray((entry as Record<string, unknown>).changes) ? (entry as Record<string, unknown>).changes as unknown[] : [];
    for (const change of changes) {
      const value = (change as Record<string, unknown>).value as Record<string, unknown> | undefined;
      if (!value) continue;
      const metadata = value.metadata as Record<string, unknown> | undefined;
      const phoneNumberId = String(metadata?.phone_number_id ?? "");
      if (!phoneNumberId) continue;
      const { data: connection, error: connectionError } = await admin.from("whatsapp_connections")
        .select("id,establishment_id,status")
        .eq("phone_number_id", phoneNumberId).maybeSingle();
      if (connectionError || !connection || connection.status !== "active") continue;

      const contacts = Array.isArray(value.contacts) ? value.contacts as Record<string, unknown>[] : [];
      const messages = Array.isArray(value.messages) ? value.messages as Record<string, unknown>[] : [];
      for (const message of messages) {
        const customerPhone = String(message.from ?? "").trim();
        const providerMessageId = String(message.id ?? "").trim();
        if (!customerPhone || !providerMessageId) continue;
        const contact = contacts.find((c) => String((c.wa_id ?? "")) === customerPhone);
        const profile = contact?.profile as Record<string, unknown> | undefined;
        const customerName = typeof profile?.name === "string" ? profile.name : null;
        const type = String(message.type ?? "unknown");
        const messageBody = type === "text" ? String((message.text as Record<string, unknown> | undefined)?.body ?? "") : null;
        const { data: conversation, error: conversationError } = await admin.from("whatsapp_conversations")
          .upsert({
            connection_id: connection.id,
            establishment_id: connection.establishment_id,
            customer_phone: customerPhone,
            customer_name: customerName,
            status: "open",
            last_message_at: new Date(Number(message.timestamp ?? 0) * 1000 || Date.now()).toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: "connection_id,customer_phone" })
          .select("id").single();
        if (conversationError || !conversation) continue;

        const { error: insertError } = await admin.from("whatsapp_messages").upsert({
          establishment_id: connection.establishment_id,
          conversation_id: conversation.id,
          provider_message_id: providerMessageId,
          direction: "inbound",
          message_type: type,
          body: messageBody,
          delivery_status: "received",
          raw_metadata: { timestamp: message.timestamp ?? null, type },
        }, { onConflict: "provider_message_id", ignoreDuplicates: true });
        if (!insertError) accepted++;
      }

      const statuses = Array.isArray(value.statuses) ? value.statuses as Record<string, unknown>[] : [];
      for (const status of statuses) {
        const providerMessageId = String(status.id ?? "");
        const statusValue = String(status.status ?? "");
        const mapped = ["sent", "delivered", "read", "failed"].includes(statusValue) ? statusValue : null;
        if (!providerMessageId || !mapped) continue;
        await admin.from("whatsapp_messages").update({ delivery_status: mapped })
          .eq("provider_message_id", providerMessageId);
      }
    }
  }
  return json({ success: true, processed: accepted });
});
