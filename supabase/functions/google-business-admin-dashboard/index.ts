import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, x-client-info, content-type, x-supabase-api-version',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, 'Content-Type': 'application/json' },
});

async function requireAdmin(req: Request) {
  const authorization = req.headers.get('Authorization');
  if (!authorization) throw Object.assign(new Error('Session manquante'), { status: 401 });
  const token = authorization.replace(/^Bearer\\s+/i, '');
  const { data: { user }, error: userError } = await db.auth.getUser(token);
  if (userError || !user) throw Object.assign(new Error('Session invalide'), { status: 401 });
  const { data: profile, error } = await db.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (error) throw error;
  if (profile?.role !== 'admin') throw Object.assign(new Error('Accès réservé à l’administrateur'), { status: 403 });
  return user;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée' }, 405);
  try {
    await requireAdmin(req);
    const body = await req.json();
    const action = String(body?.action ?? 'load');

    if (action === 'map_location') {
      const locationId = String(body?.location_id ?? '');
      const establishmentId = body?.establishment_id == null || body.establishment_id === ''
        ? null : String(body.establishment_id);
      if (!locationId) return json({ success: false, error: 'location_id requis' }, 400);
      const { data: location, error: locationError } = await db.from('google_business_locations')
        .select('id').eq('id', locationId).maybeSingle();
      if (locationError) throw locationError;
      if (!location) return json({ success: false, error: 'Fiche Google introuvable' }, 404);
      if (establishmentId) {
        const { data: establishment, error: establishmentError } = await db.from('establishments')
          .select('id').eq('id', establishmentId).maybeSingle();
        if (establishmentError) throw establishmentError;
        if (!establishment) return json({ success: false, error: 'Établissement introuvable' }, 404);
      }
      const { error } = await db.from('google_business_locations')
        .update({ mapped_establishment_id: establishmentId, updated_at: new Date().toISOString() })
        .eq('id', locationId);
      if (error) throw error;
      return json({ success: true });
    }

    if (action !== 'load') return json({ success: false, error: 'Action inconnue' }, 400);

    // Never return OAuth access/refresh tokens or raw Google payloads to the browser.
    const [connectionResult, settingsResult] = await Promise.all([
      db.from('google_business_connections').select('id,establishment_id,status,last_sync_at,last_error'),
      db.from('google_business_settings').select('establishment_id,auto_reply_enabled,require_approval,auto_reply_language,auto_reply_tone'),
    ]);
    if (connectionResult.error) throw connectionResult.error;
    if (settingsResult.error) throw settingsResult.error;

    let locations: any[] = [];
    const mappedQuery = await db.from('google_business_locations')
      .select('id,connection_id,google_business_account_id,google_location_id,title,location_name,mapped_establishment_id,metadata');
    if (mappedQuery.error && /mapped_establishment_id|column .* does not exist|schema cache/i.test(mappedQuery.error.message)) {
      const legacyQuery = await db.from('google_business_locations')
        .select('id,connection_id,google_location_id,title,location_name')
        .not('connection_id', 'is', null);
      if (legacyQuery.error) throw legacyQuery.error;
      locations = (legacyQuery.data ?? []).map((location: any) => ({ ...location, google_business_account_id: null, mapped_establishment_id: null, metadata: null }));
    } else {
      if (mappedQuery.error) throw mappedQuery.error;
      locations = (mappedQuery.data ?? []).map((location: any) => ({
        id: location.id,
        connection_id: location.connection_id,
        google_business_account_id: location.google_business_account_id ?? null,
        google_location_id: location.google_location_id,
        title: location.title ?? null,
        location_name: location.location_name ?? null,
        mapped_establishment_id: location.mapped_establishment_id ?? null,
        metadata: location.metadata ?? null,
      }));
    }

    const locationIds = locations.map((location: any) => location.id);
    let reviews: any[] = [];
    if (locationIds.length) {
      const { data, error } = await db.from('google_business_reviews')
        .select('id,location_id,reviewer_display_name,star_rating,comment,owner_reply,review_created_at,owner_reply_updated_at,reply_draft,reply_status,reply_error,reply_generated_at,reply_published_at')
        .in('location_id', locationIds)
        .order('review_created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      reviews = data ?? [];
    }

    return json({
      success: true,
      connections: connectionResult.data ?? [],
      replySettings: settingsResult.data ?? [],
      locations,
      reviews,
    });
  } catch (error) {
    const status = Number((error as { status?: number })?.status ?? 500);
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('google-business-admin-dashboard:', message);
    return json({ success: false, error: message }, status);
  }
});
