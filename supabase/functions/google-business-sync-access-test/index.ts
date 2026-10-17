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
  let endpoint: string;
  if (path === 'accounts') {
    endpoint = 'https://mybusinessaccountmanagement.googleapis.com/v1/accounts';
  } else if (path.startsWith('accounts/') && path.includes('/locations?')) {
    const [resourcePath, query = ''] = path.split('?');
    const accountId = resourcePath.split('/')[1];
    const params = new URLSearchParams(query);
    params.delete('pageSize');
    params.set('readMask', 'name,title,storeCode');
    params.set('pageSize', '100');
    endpoint = `https://mybusinessbusinessinformation.googleapis.com/v1/accounts/${accountId}/locations?${params.toString()}`;
  } else {
    endpoint = 'https://mybusiness.googleapis.com/v4/' + path;
  }
  const response = await fetch(endpoint, { headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } });
  const raw = await response.text();
  let data: any;
  try { data = JSON.parse(raw); } catch {
    throw new Error(`Google API a renvoyé du contenu non JSON (HTTP ${response.status}) pour ${endpoint}.`);
  }
  if (!response.ok) throw new Error(data?.error?.message ?? `Google Business Profile API HTTP ${response.status}`);
  return data;
}

function ratingNumber(value: unknown) {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const raw = String(value ?? '').toUpperCase();
  return map[raw] ?? Number(raw || 0);
}

async function generateReply(comment: string, stars: string, language: string, tone: string) {
  const { data: settings, error: settingsError } = await db.from('ai_global_settings')
    .select('provider,model,api_key,enabled').eq('id', true).maybeSingle();
  if (settingsError) throw settingsError;
  const provider = String(settings?.provider ?? '').trim().toLowerCase();
  const model = String(settings?.model ?? '').trim();
  const key = String(settings?.api_key ?? '').trim();
  if (settings?.enabled !== true || provider !== 'openai' || !model || !key) {
    throw new Error('La configuration IA globale est désactivée ou incomplète. Vérifiez Admin → Configuration IA.');
  }
  const prompt = `Rédige une réponse courte à un avis Google. Langue: ${language || 'français'}. Ton: ${tone || 'professionnel et chaleureux'}. Note: ${stars}. Avis: ${comment}. N'invente aucun fait, ne mentionne aucune récompense ni contrepartie. Maximum 70 mots.`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 180 }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? 'Génération IA impossible');
  const nestedText = Array.isArray(data?.output) ? data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content.map((part: any) => part?.text ?? '') : []).join('\\n').trim() : '';
  const reply = String(data.output_text ?? nestedText).trim();
  if (!reply) throw new Error('OpenAI n’a renvoyé aucun texte. Aucun brouillon n’a été enregistré.');
  return reply;
}

async function publishGeneratedReply(review: any, location: any, connection: any, token: string, reply: string) {
  const accountId = String(location.google_account_id || connection.google_account_id || '');
  const locationId = String(location.google_location_id || '');
  const reviewId = String(review.google_review_name || '').split('/').pop() || '';
  if (!accountId || !locationId || !reviewId) throw new Error('Mapping Google incomplet pour publier la réponse.');
  const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${encodeURIComponent(reviewId)}/reply`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ comment: reply }),
  });
  const raw = await response.text();
  let data: any = {};
  try { data = JSON.parse(raw); } catch { /* Google may return an empty body */ }
  if (!response.ok) throw new Error(data?.error?.message || raw.slice(0, 300) || 'Publication Google impossible');
  const now = new Date().toISOString();
  const { error } = await db.from('google_business_reviews').update({
    reply_draft: reply, reply_status: 'published', reply_error: null,
    reply_generated_at: now, reply_published_at: now, owner_reply: reply,
    owner_reply_updated_at: now, last_synced_at: now, raw_payload: data, updated_at: now,
  }).eq('id', review.id);
  if (error) throw error;
}

Deno.serve(async (req: Request) => {
  let activeConnectionId: string | null = null;
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
    const cronSecret = Deno.env.get('KELYANI_CRON_SECRET') ?? '';
    const suppliedCronSecret = req.headers.get('x-kelyani-cron-secret') ?? '';
    let diff = suppliedCronSecret.length ^ cronSecret.length;
    for (let i = 0; i < Math.max(suppliedCronSecret.length, cronSecret.length); i++) {
      diff |= (suppliedCronSecret.charCodeAt(i) || 0) ^ (cronSecret.charCodeAt(i) || 0);
    }
    const isCronCall = !!cronSecret && diff === 0;

    if (!isCronCall) {
      const authorization = req.headers.get('Authorization');
      if (!authorization) return json({ success: false, error: 'Session manquante' }, 401);
      const { data: { user }, error: userError } = await db.auth.getUser(authorization.replace(/^Bearer\s+/i, ''));
      if (userError || !user) return json({ success: false, error: 'Session invalide' }, 401);
      if (!(await isAdmin(user.id))) return json({ success: false, error: 'Accès réservé à l’administrateur' }, 403);
    }

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
    activeConnectionId = connection.id;

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
        }, { onConflict: 'google_location_id' }).select('id,mapped_establishment_id').single();
        if (locationError) throw locationError;
        if (!row) continue;
        locations++;

        const reviewResult = await api(`accounts/${accountId}/locations/${googleLocationId}/reviews?pageSize=50`, token);
        // Reviews may be synced for diagnostics, but AI replies are only allowed after an
        // administrator explicitly maps this Google location to a Kelyani establishment.
        let replySettings: any = null;
        if (row.mapped_establishment_id) {
          const { data, error: replySettingsError } = await db.from('google_business_settings')
            .select('auto_reply_enabled,require_approval,auto_reply_min_rating,auto_reply_language,auto_reply_tone,auto_reply_activated_at')
            .eq('establishment_id', row.mapped_establishment_id).maybeSingle();
          if (replySettingsError) throw replySettingsError;
          replySettings = data;
        }
        // First activation establishes a cutoff: the initial sync must never treat
        // the establishment's historical Google reviews as new reviews to answer.
        let autoReplyActivatedAt = replySettings?.auto_reply_activated_at ?? null;
        if (replySettings?.auto_reply_enabled === true && !autoReplyActivatedAt) {
          autoReplyActivatedAt = new Date().toISOString();
          const { error: activationError } = await db.from('google_business_settings')
            .update({ auto_reply_activated_at: autoReplyActivatedAt, updated_at: autoReplyActivatedAt })
            .eq('establishment_id', establishmentId)
            .is('auto_reply_activated_at', null);
          if (activationError) throw activationError;
        }
        for (const review of reviewResult.reviews ?? []) {
          const googleReviewName = String(review.name ?? '');
          const { data: existing, error: existingError } = await db.from('google_business_reviews')
            .select('id,reply_status,owner_reply,reply_draft')
            .eq('google_review_name', googleReviewName).maybeSingle();
          if (existingError) throw existingError;
          const { data: savedReview, error: reviewError } = await db.from('google_business_reviews').upsert({
            location_id: row.id,
            google_review_name: googleReviewName,
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
          }, { onConflict: 'google_review_name' }).select('id').single();
          if (reviewError) throw reviewError;
          reviews++;
          const isNewReview = !existing;
          const reviewCreatedAt = review.createTime ? new Date(review.createTime).getTime() : 0;
          const afterAutoReplyActivation = !!autoReplyActivatedAt && reviewCreatedAt >= new Date(autoReplyActivatedAt).getTime();
          const threshold = Math.max(1, Math.min(5, Number(replySettings?.auto_reply_min_rating ?? 4)));
          const reviewRating = ratingNumber(review.starRating);
          // The rating threshold is authoritative for autonomous mode: reviews at or
          // above the configured threshold auto-publish when auto replies are enabled.
          // Reviews below the threshold always get a draft for human approval.
          const shouldAutoPublish = isNewReview && afterAutoReplyActivation && replySettings?.auto_reply_enabled === true &&
            replySettings?.require_approval === false && reviewRating >= threshold &&
            !review.reviewReply?.comment && Boolean(review.comment?.trim());
          if (shouldAutoPublish && savedReview) {
            try {
              const draft = await generateReply(String(review.comment), String(review.starRating ?? ''), String(replySettings.auto_reply_language ?? 'fr'), String(replySettings.auto_reply_tone ?? 'professional_warm'));
              const now = new Date().toISOString();
              const { error: draftError } = await db.from('google_business_reviews').update({
                reply_draft: draft, reply_status: 'ready_to_publish', reply_error: null,
                reply_generated_at: now, updated_at: now,
              }).eq('id', savedReview.id);
              if (draftError) throw draftError;
              await publishGeneratedReply({ ...review, id: savedReview.id }, {
                google_account_id: accountId, google_location_id: googleLocationId,
              }, connection, token, draft);
            } catch (autoReplyError) {
              const message = autoReplyError instanceof Error ? autoReplyError.message : 'Erreur de réponse automatique';
              await db.from('google_business_reviews').update({
                reply_status: 'failed', reply_error: message, updated_at: new Date().toISOString(),
              }).eq('id', savedReview.id);
              console.error('Auto-reply failed for review', savedReview.id, message);
            }
          } else if (isNewReview && afterAutoReplyActivation && replySettings?.auto_reply_enabled === true &&
            !review.reviewReply?.comment && reviewRating > 0 && Boolean(review.comment?.trim()) && savedReview &&
            (replySettings?.require_approval === true || reviewRating < threshold)) {
            try {
              const draft = await generateReply(String(review.comment), String(review.starRating ?? ''), String(replySettings.auto_reply_language ?? 'fr'), String(replySettings.auto_reply_tone ?? 'professional_warm'));
              const now = new Date().toISOString();
              const { error: draftError } = await db.from('google_business_reviews').update({
                reply_draft: draft, reply_status: 'pending_approval', reply_error: null,
                reply_generated_at: now, updated_at: now,
              }).eq('id', savedReview.id);
              if (draftError) throw draftError;
            } catch (draftError) {
              const message = draftError instanceof Error ? draftError.message : 'Impossible de générer le brouillon';
              await db.from('google_business_reviews').update({
                reply_status: 'failed', reply_error: message, updated_at: new Date().toISOString(),
              }).eq('id', savedReview.id);
              console.error('Pending reply draft failed for review', savedReview.id, message);
            }
          }
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
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    console.error('google-business-sync-access-test:', error);
    if (activeConnectionId) {
      const { error: statusError } = await db.from('google_business_connections').update({
        status: 'error', last_error: message, updated_at: new Date().toISOString(),
      }).eq('id', activeConnectionId);
      if (statusError) console.error('Impossible de sauvegarder last_error Google Business:', statusError);
    }
    return json({ success: false, error: message }, 500);
  }
});
