// Mirrors a Smart Marketing notification to the customer's Google Wallet pass when the
// establishment has the Google Wallet channel on (admin switch, Enterprise pack only).
// Best effort: a Wallet failure never fails the in-app notification already created.
// deno-lint-ignore-file no-explicit-any
type Admin = any;

const API = 'https://walletobjects.googleapis.com/walletobjects/v1';

function base64url(value: Uint8Array | string): string {
  const bytes = typeof value === 'string' ? new TextEncoder().encode(value) : value;
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

async function walletAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const unsigned = `${base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${base64url(JSON.stringify({
    iss: clientEmail, scope: 'https://www.googleapis.com/auth/wallet_object.issuer',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }))}`;
  const der = Uint8Array.from(atob(privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, '')), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned)));
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${base64url(signature)}` }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || typeof payload.access_token !== 'string') throw new Error('Google Wallet auth failed');
  return payload.access_token;
}

export function createWalletDelivery(admin: Admin) {
  const issuerId = (Deno.env.get('GOOGLE_WALLET_ISSUER_ID') || Deno.env.get('WALLET_ISSUER_ID') || '').trim();
  const raw = Deno.env.get('GOOGLE_WALLET_SERVICE_ACCOUNT_JSON') || Deno.env.get('GOOGLE_WALLET_SERVICE_ACCOUNT') || Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON') || '';
  let token: Promise<string> | null = null;
  // establishment id -> customer key (uuid without dashes) -> pass object ids; null = channel off.
  const passes = new Map<string, Map<string, string[]> | null>();

  const getToken = () => {
    if (!token) {
      const account = JSON.parse(raw) as { client_email?: string; private_key?: string };
      if (!account.client_email || !account.private_key) throw new Error('Google Wallet service account incomplete');
      token = walletAccessToken(account.client_email, account.private_key);
    }
    return token;
  };

  async function passesFor(establishmentId: string): Promise<Map<string, string[]> | null> {
    if (passes.has(establishmentId)) return passes.get(establishmentId)!;
    let result: Map<string, string[]> | null = null;
    if (issuerId && raw) {
      const [{ data: channel }, { data: included }] = await Promise.all([
        admin.from('loyalty_notification_channels').select('google_wallet').eq('establishment_id', establishmentId).maybeSingle(),
        admin.rpc('loyalty_wallet_channels_included', { p_establishment_id: establishmentId }),
      ]);
      if (channel?.google_wallet && included === true) {
        result = new Map();
        const { data: catalog } = await admin.from('loyalty_wallet_design_catalog').select('google_class_id').eq('establishment_id', establishmentId).not('google_class_id', 'is', null);
        const headers = { Authorization: `Bearer ${await getToken()}` };
        const prefix = `${issuerId}.kelyani_${establishmentId.replace(/-/g, '')}_`;
        for (const classId of new Set<string>((catalog ?? []).map((row: { google_class_id: string }) => String(row.google_class_id)))) {
          let pageToken = '';
          for (let page = 0; page < 25; page++) {
            const response = await fetch(`${API}/loyaltyObject?classId=${encodeURIComponent(classId)}&maxResults=200${pageToken ? `&token=${encodeURIComponent(pageToken)}` : ''}`, { headers });
            if (!response.ok) break;
            const data = await response.json().catch(() => ({}));
            for (const object of (data.resources ?? []) as Array<{ id?: string; state?: string }>) {
              const id = String(object.id ?? '');
              if (!id.startsWith(prefix) || (object.state && object.state !== 'ACTIVE')) continue;
              const customerKey = id.slice(prefix.length).split('_')[0];
              result.set(customerKey, [...(result.get(customerKey) ?? []), id]);
            }
            pageToken = String(data.pagination?.nextPageToken ?? '');
            if (!pageToken) break;
          }
        }
      }
    }
    passes.set(establishmentId, result);
    return result;
  }

  /** Returns the number of Wallet passes that accepted the message (0 when the channel is off). */
  return async function deliver(establishmentId: string, customerId: string, messageId: string, title: string, body: string): Promise<number> {
    try {
      const map = await passesFor(establishmentId);
      const objectIds = map?.get(customerId.replace(/-/g, '')) ?? [];
      if (!objectIds.length) return 0;
      const headers = { Authorization: `Bearer ${await getToken()}`, 'Content-Type': 'application/json' };
      const start = new Date();
      const end = new Date(start.getTime() + 7 * 86400000);
      let delivered = 0;
      for (const objectId of objectIds) {
        const response = await fetch(`${API}/loyaltyObject/${encodeURIComponent(objectId)}/addMessage`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ message: {
            id: `smart_${messageId.replace(/-/g, '')}`,
            header: title.slice(0, 80),
            body: body.slice(0, 500),
            messageType: 'TEXT_AND_NOTIFY',
            displayInterval: { start: { date: start.toISOString() }, end: { date: end.toISOString() } },
          } }),
        });
        if (response.ok) delivered++;
        else console.error('Google Wallet smart message failed', response.status);
      }
      return delivered;
    } catch (error) {
      console.error('Google Wallet smart delivery error', error instanceof Error ? error.message : error);
      return 0;
    }
  };
}
