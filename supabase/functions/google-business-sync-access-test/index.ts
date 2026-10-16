import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
const cid = Deno.env.get('GOOGLE_BUSINESS_CLIENT_ID') ?? '';
const secret = Deno.env.get('GOOGLE_BUSINESS_CLIENT_SECRET') ?? '';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  },
});

async function isAdmin(userId: string) {
  const { data, error } = await db.from('profiles').select('role').eq('id', userId).maybeSingle();
  if (error) throw error;
  return data?.role === 'admin';
}

async function refresh(refreshToken: string) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: cid,
    client_secret: secret,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description ?? 'Token refresh failed');
  return data;
}

async function api(path: string, token: string) {
  const response = await fetch('https://mybusiness.googleapis.com/v4/' + path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? 'Google Business Profile API error');
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS',
      },
    });
  }

  try {
    const authorization = req.headers.get('Authorization');
    if (!authorization) return json({ success: false, error: 'Session manquante' }, 401);

    const { data: { user }, error: userError } = await db.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
    if (userError || !user) return json({ success: false, error: 'Session invalide' }, 401);

    // This endpoint is intentionally admin-only. Check the same profile role as the
    // guard above, then verify the target establishment exists. Do not call the
    // auth.uid()-based RPC using the service-role client (auth.uid() would be NULL).
    if (!(await isAdmin(user.id))) return json({ success: false, error: 'Accès réservé à l’administrateur' }, 403);

    const body = await req.json();
    const establishmentId = String(body?.establishment_id ?? '');
    if (!establishmentId) return json({ success: false, error: 'establishment_id requis' }, 400);

    const { data: establishment, error: establishmentError } = await db
      .from('establishments')
      .select('id')
      .eq('id', establishmentId)
      .maybeSingle();
    if (establishmentError) throw establishmentError;
    if (!establishment) return json({ success: false, error: 'Établissement introuvable' }, 404);

    const { data: connection, error: connectionError } = await db
      .from('google_business_connections')
      .select('*')
      .eq('establishment_id', establishmentId)
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return json({ success: false, error: 'Google Business Profile non connecté' }, 404);

    let token = connection.access_token;
    if (!token || !connection.token_expires_at || new Date(connection.token_expires_at).getTime() < Date.now() + 120000) {
      const refreshed = await refresh(connection.refresh_token);
      token = refreshed.access_token;
      const { error: updateError } = await db.from('google_business_connections').update({
        access_token: token,
        token_expires_at: new Date(Date.now() + Number(refreshed.expires_in ?? 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
        status: 'active',
        last_error: null,
      }).eq('id', connection.id);
      if (updateError) throw updateError;
    }

    const accounts = await api('accounts', token);
    let locations = 0;
    let reviews = 0;

    for (const account of accounts.accounts ?? []) {
      const accountId = String(account.name ?? '').replace(/^accounts\//, '');
      const result = await api(`accounts/${accountId}/locations?pageSize=100`, token);

      for (const location of result.locations ?? []) {
        const googleLocationId = String(location.name ?? '').replace(/^locations\//, '');
        const { data: row, error: locationError } = await db.from('google_business_locations').upsert({
          connection_id: connection.id,
          google_account_id: accountId,
          google_location_id: googleLocationId,
          location_name: location.name,
          title: location.title ?? null,
          metadata: location,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'google_location_id' }).select('id').single();
        if (locationError) throw locationError;
        if (!row) continue;
        locations++;

        const reviewResult = await api(`accounts/${accountId}/locations/${googleLocationId}/reviews?pageSize=50`, token);
        for (const review of reviewResult.reviews ?? []) {
          const { error: reviewError } = await db.from('google_business_reviews').upsert({
            location_id: row.id,
            google_review_name: review.name,
            reviewer_display_name: review.reviewer?.displayName ?? null,
            reviewer_is_anonymous: !!review.reviewer?.isAnonymous,
            star_rating: review.starRating ?? null,
            comment: review.comment ?? null,
            review_created_at: review.createTime ?? null,
            review_updated_at: review.updateTime ?? null,
            owner_reply: review.reviewReply?.comment ?? null,
            owner_reply_updated_at: review.reviewReply?.updateTime ?? null,
            raw_payload: review,
            last_synced_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }, { onConflict: 'google_review_name' });
          if (reviewError) throw reviewError;
          reviews++;
        }
      }
    }

    const { error: syncUpdateError } = await db.from('google_business_connections').update({
      last_sync_at: new Date().toISOString(),
      status: 'active',
      last_error: null,
      updated_at: new Date().toISOString(),
    }).eq('id', connection.id);
    if (syncUpdateError) throw syncUpdateError;

    return json({ success: true, locations, reviews });
  } catch (error) {
    console.error('google-business-sync-access-test:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Erreur serveur' }, 500);
  }
});
