import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const verifyToken = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ?? '';
const appSecret = Deno.env.get('WHATSAPP_APP_SECRET') ?? '';
const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function validSignature(rawBody: string, supplied: string) {
  if (!appSecret || !supplied.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(appSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const expected = toHex(digest);
  const actual = supplied.slice(7);
  if (expected.length !== actual.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return mismatch === 0;
}

function messageBody(message: any, type: string): string {
  switch (type) {
    case 'text':
      return String(message.text?.body ?? '');
    case 'button':
      return String(message.button?.text ?? '');
    case 'interactive':
      return String(message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? '');
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'sticker':
      return String(message[type]?.caption ?? message[type]?.filename ?? '');
    case 'location':
      return [message.location?.name, message.location?.address,
        message.location?.latitude, message.location?.longitude].filter(Boolean).join(' — ');
    case 'contacts':
      return (message.contacts ?? []).map((contact: any) =>
        contact.name?.formatted_name ?? contact.phones?.[0]?.phone ?? 'Contact partagé'
      ).join(', ');
    case 'reaction':
      return String(message.reaction?.emoji ?? '');
    default:
      return '';
  }
}

const deliveryStatuses = new Set(['sent', 'delivered', 'read', 'failed']);

Deno.serve(async (req) => {
  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (!verifyToken) return new Response('Webhook verification is not configured', { status: 503 });
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const rawBody = await req.text();
  const signature = req.headers.get('x-hub-signature-256') ?? '';
  if (!await validSignature(rawBody, signature)) return json({ error: 'invalid_signature' }, 401);

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }

  if (payload?.object !== 'whatsapp_business_account') return json({ ok: true, ignored: true });

  for (const entry of payload.entry ?? []) {
    for (const change of entry.changes ?? []) {
      if (change.field !== 'messages') continue;
      const value = change.value ?? {};
      const phoneNumberId = String(value.metadata?.phone_number_id ?? '');
      if (!phoneNumberId) continue;

      const { data: connection, error: connectionError } = await db
        .from('whatsapp_connections')
        .select('id,establishment_id,status')
        .eq('phone_number_id', phoneNumberId)
        .in('status', ['active', 'pending'])
        .maybeSingle();
      if (connectionError) {
        console.error('WhatsApp connection lookup failed', connectionError);
        return json({ error: 'connection_lookup_failed' }, 500);
      }
      if (!connection) continue;

      // Coexistence can emit messages sent from the WhatsApp Business app as well as
      // inbound customer messages. Status events are handled independently below.
      for (const statusEvent of value.statuses ?? []) {
        const providerMessageId = String(statusEvent.id ?? '');
        const status = String(statusEvent.status ?? '');
        if (!providerMessageId || !deliveryStatuses.has(status)) continue;
        const { error } = await db
          .from('whatsapp_messages')
          .update({
            delivery_status: status,
            raw_metadata: {
              status_timestamp: statusEvent.timestamp ?? null,
              recipient_id: statusEvent.recipient_id ?? null,
              errors: statusEvent.errors ?? null,
            },
          })
          .eq('provider_message_id', providerMessageId)
          .eq('establishment_id', connection.establishment_id);
        if (error) {
          console.error('WhatsApp delivery status update failed', error);
          return json({ error: 'status_update_failed' }, 500);
        }
      }

      const contacts = new Map<string, string>();
      for (const contact of value.contacts ?? []) {
        const phone = String(contact.wa_id ?? '');
        const name = String(contact.profile?.name ?? '').trim();
        if (phone && name) contacts.set(phone, name);
      }

      for (const message of value.messages ?? []) {
        const customerPhone = String(message.from ?? '');
        const providerMessageId = String(message.id ?? '');
        if (!customerPhone || !providerMessageId) continue;
        const messageType = String(message.type ?? 'unknown');
        const body = messageBody(message, messageType);
        const timestamp = Number(message.timestamp ?? 0);
        const messageAt = Number.isFinite(timestamp) && timestamp > 0
          ? new Date(timestamp * 1000).toISOString()
          : new Date().toISOString();
        const customerName = contacts.get(customerPhone);

        const conversationPayload: Record<string, unknown> = {
          establishment_id: connection.establishment_id,
          connection_id: connection.id,
          customer_phone: customerPhone,
          last_message_at: messageAt,
          updated_at: new Date().toISOString(),
        };
        if (customerName) conversationPayload.customer_name = customerName;

        const { data: conversation, error: conversationError } = await db
          .from('whatsapp_conversations')
          .upsert(conversationPayload, {
            onConflict: 'connection_id,customer_phone',
            defaultToNull: false,
          })
          .select('id')
          .single();
        if (conversationError || !conversation) {
          console.error('WhatsApp conversation upsert failed', conversationError);
          return json({ error: 'conversation_write_failed' }, 500);
        }

        const { error: messageError } = await db.from('whatsapp_messages').upsert({
          establishment_id: connection.establishment_id,
          conversation_id: conversation.id,
          provider_message_id: providerMessageId,
          direction: 'inbound',
          message_type: messageType,
          body,
          delivery_status: 'received',
          raw_metadata: {
            timestamp: message.timestamp ?? null,
            context: message.context ?? null,
            referral: message.referral ?? null,
            message_from_business_app: Boolean(message.context?.from),
          },
        }, { onConflict: 'provider_message_id', ignoreDuplicates: true });
        if (messageError) {
          console.error('WhatsApp message insert failed', messageError);
          return json({ error: 'message_write_failed' }, 500);
        }
      }
    }
  }

  return json({ ok: true });
});
