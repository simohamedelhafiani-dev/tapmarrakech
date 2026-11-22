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
  // Enforce the cap in UTF-8 bytes (not JavaScript UTF-16 code units).
  if (new TextEncoder().encode(raw).byteLength > 1_000_000) return json({ error: "payload_too_large" }, 413);
  if (!await validSignature(raw, req.headers.get("x-hub-signature-256"), appSecret)) {
    return json({ error: "invalid_signature" }, 401);
  }
  let payload: Record<string, unknown>;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return json({ error: "invalid_payload" }, 400);
    payload = parsed;
  } catch { return json({ error: "invalid_json" }, 400); }
  // Preflight limits are global to the webhook payload, not per entry/change.
  // Reject oversized batches before any database writes to avoid partial processing.
  if (payload.entry !== undefined && !Array.isArray(payload.entry)) return json({ error: "invalid_payload" }, 400);
  const entriesRaw = Array.isArray(payload.entry) ? payload.entry : [];
  if (entriesRaw.length > 100) return json({ error: "payload_too_large" }, 413);
  let totalChanges = 0;
  let totalMessages = 0;
  let totalStatuses = 0;
  for (const rawEntry of entriesRaw) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) continue;
    const entryChanges = (rawEntry as Record<string, unknown>).changes;
    if (!Array.isArray(entryChanges)) continue;
    totalChanges += entryChanges.length;
    if (totalChanges > 500) return json({ error: "payload_too_large" }, 413);
    for (const rawChange of entryChanges) {
      if (!rawChange || typeof rawChange !== "object" || Array.isArray(rawChange)) continue;
      const changeValue = (rawChange as Record<string, unknown>).value;
      if (!changeValue || typeof changeValue !== "object" || Array.isArray(changeValue)) continue;
      const valueRecord = changeValue as Record<string, unknown>;
      totalMessages += Array.isArray(valueRecord.messages) ? valueRecord.messages.length : 0;
      totalStatuses += Array.isArray(valueRecord.statuses) ? valueRecord.statuses.length : 0;
      if (totalMessages > 500 || totalStatuses > 500) return json({ error: "payload_too_large" }, 413);
    }
  }

  const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  const entries = entriesRaw;
  let accepted = 0;
  let processingFailures = 0;
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
    const changes = Array.isArray((entry as Record<string, unknown>).changes) ? ((entry as Record<string, unknown>).changes as unknown[]) : [];
    for (const change of changes) {
      if (!change || typeof change !== "object" || Array.isArray(change)) continue;
      const rawValue = (change as Record<string, unknown>).value;
      if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) continue;
      const value = rawValue as Record<string, unknown>;
      const metadata = value.metadata as Record<string, unknown> | undefined;
      const rawPhoneNumberId = metadata?.phone_number_id;
      const phoneNumberId = typeof rawPhoneNumberId === "string" ? rawPhoneNumberId.trim() : "";
      if (!/^\d{5,32}$/.test(phoneNumberId)) continue;
      const { data: connection, error: connectionError } = await admin.from("whatsapp_connections")
        .select("id,establishment_id,status")
        .eq("phone_number_id", phoneNumberId).maybeSingle();
      if (connectionError) { processingFailures += 1; continue; }
      if (!connection || connection.status !== "active") continue;

      const contacts = Array.isArray(value.contacts) ? (value.contacts as unknown[]).filter((c): c is Record<string, unknown> => !!c && typeof c === "object" && !Array.isArray(c)) : [];
      const messages = Array.isArray(value.messages) ? (value.messages as unknown[]) : [];
      for (const rawMessage of messages) {
        if (!rawMessage || typeof rawMessage !== "object" || Array.isArray(rawMessage)) continue;
        const message = rawMessage as Record<string, unknown>;
        const rawCustomerPhone = message.from;
        const rawProviderMessageId = message.id;
        const customerPhone = typeof rawCustomerPhone === "string" ? rawCustomerPhone.trim() : "";
        const providerMessageId = typeof rawProviderMessageId === "string" ? rawProviderMessageId.trim() : "";
        if (!/^\d{7,20}$/.test(customerPhone) || !providerMessageId || providerMessageId.length > 255) continue;
        const contact = contacts.find((c) => String((c.wa_id ?? "")) === customerPhone);
        const profile = contact?.profile as Record<string, unknown> | undefined;
        const customerName = typeof profile?.name === "string" ? profile.name : null;
        const rawType = message.type;
        const type = typeof rawType === "string" && rawType.length <= 64 ? rawType : "unknown";
        const rawText = message.text as Record<string, unknown> | undefined;
        const rawTextBody = rawText?.body;
        const messageBody = type === "text" && typeof rawTextBody === "string" ? rawTextBody.slice(0, 4096) : null;
        const rawTimestamp = message.timestamp;
        const parsedTimestamp = typeof rawTimestamp === "string" && /^\d{1,12}$/.test(rawTimestamp)
          ? Number(rawTimestamp)
          : typeof rawTimestamp === "number" && Number.isSafeInteger(rawTimestamp) && rawTimestamp >= 0
          ? rawTimestamp
          : NaN;
        // Bound epoch seconds to the supported Date range before ISO conversion.
        const messageTime = Number.isSafeInteger(parsedTimestamp) && parsedTimestamp > 0 && parsedTimestamp <= 253402300799
          ? new Date(parsedTimestamp * 1000).toISOString()
          : new Date().toISOString();
        const { data: existingConversation, error: findConversationError } = await admin.from("whatsapp_conversations")
          .select("id").eq("connection_id", connection.id).eq("customer_phone", customerPhone).maybeSingle();
        if (findConversationError) { processingFailures += 1; continue; }
        let conversation = existingConversation;
        if (conversation) {
          // Late webhook deliveries must not move the inbox timestamp backwards
          // or erase a name when Meta omits contact profile data.
          const conversationUpdate: Record<string, unknown> = {
            last_message_at: messageTime,
            updated_at: new Date().toISOString(),
          };
          if (customerName) conversationUpdate.customer_name = customerName;
          const { error: updateConversationError } = await admin.from("whatsapp_conversations")
            .update(conversationUpdate)
            .eq("id", conversation.id)
            .or("last_message_at.is.null,last_message_at.lte." + messageTime);
          if (updateConversationError) { processingFailures += 1; continue; }
        } else {
          const { data: createdConversation, error: createConversationError } = await admin.from("whatsapp_conversations")
            .insert({
              connection_id: connection.id,
              establishment_id: connection.establishment_id,
              customer_phone: customerPhone,
              customer_name: customerName,
              status: "open",
              last_message_at: messageTime,
              updated_at: new Date().toISOString(),
            })
            .select("id").single();
          if (createConversationError || !createdConversation) {
            // Concurrent webhook deliveries may race to create the same conversation.
            const { data: racedConversation, error: raceLookupError } = await admin.from("whatsapp_conversations")
              .select("id").eq("connection_id", connection.id).eq("customer_phone", customerPhone).maybeSingle();
            if (raceLookupError) processingFailures += 1;
            conversation = racedConversation;
            if (!conversation && !raceLookupError) processingFailures += 1;
          } else conversation = createdConversation;
        }
        if (!conversation) { processingFailures += 1; continue; }

        const { data: insertedRows, error: insertError } = await admin.from("whatsapp_messages").upsert({
          establishment_id: connection.establishment_id,
          conversation_id: conversation.id,
          provider_message_id: providerMessageId,
          direction: "inbound",
          message_type: type,
          body: messageBody,
          delivery_status: "received",
          raw_metadata: { timestamp: message.timestamp ?? null, type },
        }, { onConflict: "provider_message_id", ignoreDuplicates: true }).select("id");
        // Count only rows actually inserted, not duplicate webhook retries.
        if (insertError) processingFailures += 1;
        else if (Array.isArray(insertedRows)) accepted += insertedRows.length;
      }

      const statuses = Array.isArray(value.statuses) ? (value.statuses as unknown[]) : [];
      for (const rawStatus of statuses) {
        if (!rawStatus || typeof rawStatus !== "object" || Array.isArray(rawStatus)) continue;
        const status = rawStatus as Record<string, unknown>;
        const providerMessageId = typeof status.id === "string" ? status.id.trim() : "";
        const statusValue = typeof status.status === "string" ? status.status : "";
        const mapped = ["sent", "delivered", "read", "failed"].includes(statusValue)
          ? statusValue as "sent" | "delivered" | "read" | "failed"
          : null;
        if (!providerMessageId || !mapped) continue;
        // Prevent out-of-order Meta callbacks from downgrading message state.
        // Progression is queued -> sent -> delivered -> read; failed is only
        // accepted before delivery is confirmed.
        const allowedPrevious: Record<string, string[]> = {
          sent: ["queued"],
          delivered: ["queued", "sent"],
          read: ["queued", "sent", "delivered"],
          failed: ["queued", "sent"],
        };
        const previousStates = allowedPrevious[mapped];
        if (!previousStates) continue;
        const { error: statusUpdateError } = await admin.from("whatsapp_messages").update({ delivery_status: mapped })
          .eq("provider_message_id", providerMessageId)
          .eq("establishment_id", connection.establishment_id)
          .in("delivery_status", previousStates);
        if (statusUpdateError) processingFailures += 1;
      }
    }
  }
  // Return a retryable error when persistence fails; Meta can redeliver and
  // provider_message_id deduplication keeps successfully stored messages safe.
  if (processingFailures > 0) return json({ error: "webhook_processing_failed", processed: accepted }, 500);
  return json({ success: true, processed: accepted });
});
