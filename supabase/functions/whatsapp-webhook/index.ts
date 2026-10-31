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
        .eq('status', 'active')
        .maybeSingle();
      if (connectionError) {
        console.error('WhatsApp connection lookup failed', connectionError);
        return json({ error: 'connection_lookup_failed' }, 500);
      }
      if (!connection) continue;

      const contacts = new Map<string, string>();
      for (const contact of value.contacts ?? []) {
        const phone = String(contact.wa_id ?? '');
        if (phone) contacts.set(phone, String(contact.profile?.name ?? ''));
      }

      for (const message of value.messages ?? []) {
        const customerPhone = String(message.from ?? '');
        const providerMessageId = String(message.id ?? '');
        if (!customerPhone || !providerMessageId) continue;
        const messageType = String(message.type ?? 'unknown');
        const body = messageType === 'text'
          ? String(message.text?.body ?? '')
          : messageType === 'button'
            ? String(message.button?.text ?? '')
            : messageType === 'interactive'
              ? String(message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? '')
              : '';

        const { data: conversation, error: conversationError } = await db
          .from('whatsapp_conversations')
          .upsert({
            establishment_id: connection.establishment_id,
            connection_id: connection.id,
            customer_phone: customerPhone,
            customer_name: contacts.get(customerPhone) ?? null,
            last_message_at: new Date(Number(message.timestamp ?? 0) * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'connection_id,customer_phone' })
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
          raw_metadata: { timestamp: message.timestamp ?? null },
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
