import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getMessageDirection, mapDeliveryStatus, normalizePhone, toIsoTimestamp } from '../_shared/whatsapp-coexistence.ts';

const MAX_BODY_BYTES = 1_000_000;
const deliveryStatuses = new Set(['sent', 'delivered', 'read', 'failed']);
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function toHex(bytes: Uint8Array) {
  return [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function validSignature(rawBody: string, supplied: string, appSecret: string) {
  if (!appSecret || !supplied.startsWith('sha256=')) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(appSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(rawBody)));
  const expected = toHex(digest);
  const actual = supplied.slice(7);
  if (!/^[a-f0-9]{64}$/i.test(actual) || expected.length !== actual.length) return false;
  let mismatch = 0;
  for (let i = 0; i < expected.length; i += 1) mismatch |= expected.charCodeAt(i) ^ actual.charCodeAt(i);
  return mismatch === 0;
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function messageBody(message: Record<string, any>, type: string): string {
  switch (type) {
    case 'text': return String(message.text?.body ?? '');
    case 'button': return String(message.button?.text ?? '');
    case 'interactive': return String(message.interactive?.button_reply?.title ?? message.interactive?.list_reply?.title ?? '');
    case 'image':
    case 'video':
    case 'audio':
    case 'document':
    case 'sticker': return String(message[type]?.caption ?? message[type]?.filename ?? '');
    case 'location': return [message.location?.name, message.location?.address, message.location?.latitude, message.location?.longitude].filter(Boolean).join(' — ');
    case 'contacts': return (message.contacts ?? []).map((contact: any) => contact.name?.formatted_name ?? contact.phones?.[0]?.phone ?? 'Contact partagé').join(', ');
    case 'reaction': return String(message.reaction?.emoji ?? '');
    default: return '';
  }
}

async function findConnection(db: any, phoneNumberId: string) {
  const { data, error } = await db.from('whatsapp_connections')
    .select('id,establishment_id,status,display_phone_number')
    .eq('phone_number_id', phoneNumberId)
    .in('status', ['active', 'pending'])
    .maybeSingle();
  if (error) throw new Error('connection_lookup_failed');
  return data;
}

async function upsertConversation(db: any, connection: any, customerPhone: string, customerName: string | null, at: string) {
  const { data, error } = await db.rpc('upsert_whatsapp_conversation', {
    p_establishment_id: connection.establishment_id,
    p_connection_id: connection.id,
    p_customer_phone: customerPhone,
    p_customer_name: customerName,
    p_message_at: at,
  });
  if (error || typeof data !== 'string') throw new Error('conversation_write_failed');
  return data;
}

async function persistMessage(
  db: any,
  connection: any,
  message: Record<string, any>,
  customerPhone: string,
  direction: 'inbound' | 'outbound',
  metadata: Record<string, unknown>,
  contacts: Map<string, string>,
) {
  const providerMessageId = typeof message.id === 'string' ? message.id : '';
  const phone = normalizePhone(customerPhone);
  if (!providerMessageId || phone.length < 5 || phone.length > 32) return;
  const type = typeof message.type === 'string' ? message.type : 'unknown';
  const at = toIsoTimestamp(message.timestamp);
  let customerName = contacts.get(phone) ?? null;
  if (!customerName) {
    const { data: savedContact, error: contactLookupError } = await db.from('whatsapp_contacts')
      .select('customer_name')
      .eq('connection_id', connection.id)
      .eq('customer_phone', phone)
      .eq('active', true)
      .maybeSingle();
    if (contactLookupError) throw new Error('contact_lookup_failed');
    customerName = typeof savedContact?.customer_name === 'string' ? savedContact.customer_name : null;
  }
  const conversationId = await upsertConversation(db, connection, phone, customerName, at);
  const status = mapDeliveryStatus(message.history_context?.status, direction);
  const body = messageBody(message, type).slice(0, 50_000);
  const { error } = await db.from('whatsapp_messages').upsert({
    establishment_id: connection.establishment_id,
    conversation_id: conversationId,
    provider_message_id: providerMessageId,
    direction,
    message_type: type,
    body,
    delivery_status: status,
    raw_metadata: metadata,
  }, { onConflict: 'provider_message_id', ignoreDuplicates: true });
  if (error) throw new Error('message_write_failed');
}

async function processStatuses(db: any, connection: any, statuses: any[]) {
  for (const event of statuses) {
    const id = typeof event.id === 'string' ? event.id : '';
    const status = mapDeliveryStatus(event.status, 'outbound');
    if (!id || !deliveryStatuses.has(status)) continue;
    const { error } = await db.from('whatsapp_messages').update({
      delivery_status: status,
      raw_metadata: { status_timestamp: event.timestamp ?? null, recipient_id: event.recipient_id ?? null, errors: event.errors ?? null },
    }).eq('provider_message_id', id).eq('establishment_id', connection.establishment_id);
    if (error) throw new Error('status_update_failed');
  }
}

async function processHistory(db: any, connection: any, value: any, businessPhone: string) {
  for (const chunk of asArray(value.history)) {
    const meta = chunk.metadata ?? {};
    const phaseRaw = Number(meta.phase);
    const orderRaw = Number(meta.chunk_order);
    const phase = Number.isInteger(phaseRaw) && phaseRaw >= 0 && phaseRaw <= 2 ? phaseRaw : -1;
    const chunkOrder = Number.isInteger(orderRaw) && orderRaw >= 0 ? orderRaw : -1;
    const progressRaw = Number(meta.progress);
    const progress = Number.isInteger(progressRaw) ? Math.max(0, Math.min(100, progressRaw)) : 0;
    const errors = asArray(chunk.errors);
    const status = errors.length ? 'declined' : phase === 2 && progress === 100 ? 'completed' : 'received';
    const errorCode = Number(errors[0]?.code);
    const { error: chunkError } = await db.from('whatsapp_history_sync_chunks').upsert({
      establishment_id: connection.establishment_id,
      connection_id: connection.id,
      phase,
      chunk_order: chunkOrder,
      progress,
      status,
      error_code: Number.isInteger(errorCode) ? errorCode : null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'connection_id,phase,chunk_order' });
    if (chunkError) throw new Error('history_chunk_write_failed');

    for (const thread of asArray(chunk.threads)) {
      const threadPhone = normalizePhone(thread.id);
      if (!threadPhone) continue;
      for (const message of asArray(thread.messages)) {
        const direction = getMessageDirection(message, businessPhone);
        const customerPhone = direction === 'outbound' ? message.to : (message.from || threadPhone);
        await persistMessage(db, connection, message, String(customerPhone ?? threadPhone), direction, {
          source: 'coexistence_history',
          phase,
          chunk_order: chunkOrder,
          progress,
          history_status: message.history_context?.status ?? null,
        }, new Map());
      }
      for (const message of asArray(thread.message_echoes)) {
        await persistMessage(db, connection, message, String(message.to ?? threadPhone), 'outbound', {
          source: 'coexistence_history_echo',
          phase,
          chunk_order: chunkOrder,
          progress,
          history_status: message.history_context?.status ?? null,
        }, new Map());
      }
    }
  }
}

async function processContactSync(db: any, connection: any, events: any[]) {
  for (const event of events) {
    if (event.type !== 'contact') continue;
    const contact = event.contact ?? {};
    const phone = normalizePhone(contact.phone_number ?? contact.wa_id);
    if (phone.length < 5 || phone.length > 32) continue;
    const action = String(event.action ?? '').toLowerCase();
    if (action !== 'add' && action !== 'remove') continue;
    const eventAt = toIsoTimestamp(event.metadata?.timestamp);
    const name = action === 'add' ? String(contact.full_name ?? contact.first_name ?? '').trim().slice(0, 160) : null;
    const { data: applied, error } = await db.rpc('apply_whatsapp_contact_sync_event', {
      p_establishment_id: connection.establishment_id,
      p_connection_id: connection.id,
      p_customer_phone: phone,
      p_customer_name: name,
      p_active: action === 'add',
      p_event_at: eventAt,
    });
    if (error) throw new Error('contact_sync_write_failed');
    if (applied === true) {
      const { error: conversationError } = await db.from('whatsapp_conversations')
        .update({ customer_name: name, updated_at: new Date().toISOString() })
        .eq('connection_id', connection.id)
        .eq('customer_phone', phone);
      if (conversationError) throw new Error('contact_conversation_update_failed');
    }
  }
}

Deno.serve(async (req) => {
  const verifyToken = Deno.env.get('WHATSAPP_WEBHOOK_VERIFY_TOKEN') ?? '';
  const appSecret = Deno.env.get('WHATSAPP_APP_SECRET') ?? '';
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

  if (req.method === 'GET') {
    const url = new URL(req.url);
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');
    if (!verifyToken) return new Response('Webhook verification is not configured', { status: 503 });
    if (mode === 'subscribe' && token === verifyToken && challenge) {
      return new Response(challenge, { status: 200, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } });
    }
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  const contentLength = Number(req.headers.get('content-length') ?? 0);
  if (Number.isFinite(contentLength) && contentLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
  const rawBytes = new Uint8Array(await req.arrayBuffer());
  if (rawBytes.byteLength > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413);
  const rawBody = new TextDecoder().decode(rawBytes);
  if (!await validSignature(rawBody, req.headers.get('x-hub-signature-256') ?? '', appSecret)) return json({ error: 'invalid_signature' }, 401);
  if (!supabaseUrl || !serviceKey) return json({ error: 'server_configuration_invalid' }, 503);

  let payload: any;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    return json({ error: 'invalid_json' }, 400);
  }
  if (payload?.object !== 'whatsapp_business_account') return json({ ok: true, ignored: true });
  const db = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  try {
    for (const entry of asArray(payload.entry)) {
      for (const change of asArray(entry?.changes)) {
        const value = change?.value ?? {};
        const phoneNumberId = String(value.metadata?.phone_number_id ?? '');
        if (!phoneNumberId) continue;
        const connection = await findConnection(db, phoneNumberId);
        if (!connection) continue;

        if (change.field === 'messages') {
          await processStatuses(db, connection, asArray(value.statuses));
          const contacts = new Map<string, string>();
          for (const contact of asArray(value.contacts)) {
            const phone = normalizePhone(contact.wa_id);
            const name = String(contact.profile?.name ?? '').trim();
            if (phone && name) contacts.set(phone, name.slice(0, 160));
          }
          for (const message of asArray(value.messages)) {
            await persistMessage(db, connection, message, String(message.from ?? ''), 'inbound', {
              source: 'cloud_api',
              timestamp: message.timestamp ?? null,
              context: message.context ?? null,
              referral: message.referral ?? null,
            }, contacts);
          }
        } else if (change.field === 'smb_message_echoes') {
          for (const message of asArray(value.message_echoes)) {
            await persistMessage(db, connection, message, String(message.to ?? ''), 'outbound', {
              source: 'whatsapp_business_app',
              timestamp: message.timestamp ?? null,
            }, new Map());
          }
        } else if (change.field === 'history') {
          await processHistory(db, connection, value, String(value.metadata?.display_phone_number ?? connection.display_phone_number ?? ''));
        } else if (change.field === 'smb_app_state_sync') {
          await processContactSync(db, connection, asArray(value.state_sync));
        }
      }
    }
  } catch (error) {
    console.error('WhatsApp webhook processing failed', error);
    const message = error instanceof Error ? error.message : 'webhook_processing_failed';
    return json({ error: message }, 500);
  }

  return json({ ok: true });
});
