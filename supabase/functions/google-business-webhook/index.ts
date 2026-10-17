// Google Business Profile Pub/Sub webhook.
// Security invariant: no webhook processing (and especially no publication) without a configured secret.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const url = Deno.env.get('SUPABASE_URL')!;
const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const secret = Deno.env.get('GOOGLE_BUSINESS_PUBSUB_SECRET') ?? '';
const cid = Deno.env.get('GOOGLE_BUSINESS_CLIENT_ID') ?? '';
const clientSecret = Deno.env.get('GOOGLE_BUSINESS_CLIENT_SECRET') ?? '';
const db = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });

async function refresh(refreshToken: string) {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: cid,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
  });
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error_description ?? 'Google token refresh failed');
  return data;
}

function ratingNumber(value: unknown) {
  const map: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };
  const raw = String(value ?? '').toUpperCase();
  return map[raw] ?? Number(raw || 0);
}

async function generateReply(comment: string, rating: string, language: string, tone: string) {
  const { data: settings, error: settingsError } = await db.from('ai_global_settings')
    .select('provider,model,api_key,enabled').eq('id', true).maybeSingle();
  if (settingsError) throw settingsError;
  const provider = String(settings?.provider ?? '').trim().toLowerCase();
  const model = String(settings?.model ?? '').trim();
  const key = String(settings?.api_key ?? '').trim();
  if (settings?.enabled !== true || provider !== 'openai' || !model || !key) {
    throw new Error('La configuration IA globale est désactivée ou incomplète. Vérifiez Admin → Configuration IA.');
  }
  const prompt = `Rédige une réponse courte à un avis Google. Langue: ${language || 'français'}. Ton: ${tone || 'professionnel et chaleureux'}. Note: ${rating}. Avis: ${comment}. Réponds dans la langue de l'avis si elle est identifiable. Ne mentionne aucune récompense, aucun point, aucune promotion ni contrepartie. N'invente aucun fait. Maximum 70 mots.`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, input: prompt, max_output_tokens: 180 }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message ?? 'Génération IA impossible');
  const nestedText = Array.isArray(data?.output)
    ? data.output.flatMap((item: any) => Array.isArray(item?.content) ? item.content.map((part: any) => part?.text ?? '') : []).join('\n').trim()
    : '';
  const reply = String(data?.output_text ?? nestedText).trim();
  if (!reply) throw new Error('OpenAI n’a renvoyé aucun texte.');
  return reply;
}

Deno.serve(async (req) => {
  try {
    if (!secret) {
      console.error('GOOGLE_BUSINESS_PUBSUB_SECRET is not configured; refusing webhook processing.');
      return json({ ok: false, error: 'Webhook secret not configured' }, 503);
    }

    const suppliedSecret = new URL(req.url).searchParams.get('secret') ?? '';
    if (suppliedSecret.length !== secret.length || suppliedSecret !== secret) {
      return json({ ok: false, error: 'unauthorized' }, 401);
    }

    if (req.method !== 'POST') return json({ ok: false, error: 'method_not_allowed' }, 405);
    const body = await req.json().catch(() => ({}));
    const msg = body?.message;
    if (!msg) return json({ ok: true });

    let payload: any = {};
    try {
      payload = msg.data
        ? JSON.parse(atob(String(msg.data).replace(/-/g, '+').replace(/_/g, '/')))
        : {};
    } catch (error) {
      console.warn('Ignoring invalid Pub/Sub message payload:', error);
      return json({ ok: true, ignored: true });
    }

    const reviewName = String(payload?.review_name ?? '');
    if (!reviewName) return json({ ok: true });
    const parts = reviewName.split('/');
    const accountIndex = parts.indexOf('accounts');
    const locationIndex = parts.indexOf('locations');
    const accountId = accountIndex >= 0 ? parts[accountIndex + 1] : '';
    const locationId = locationIndex >= 0 ? parts[locationIndex + 1] : '';
    const reviewId = parts[parts.length - 1] ?? '';
    if (!accountId || !locationId || !reviewId) return json({ ok: true });

    const { data: loc, error: locationError } = await db
      .from('google_business_locations')
      .select('id,connection_id,mapped_establishment_id')
      .eq('google_account_id', accountId)
      .eq('google_location_id', locationId)
      .maybeSingle();
    if (locationError) throw locationError;
    if (!loc) return json({ ok: true });

    const { data: connection, error: connectionError } = await db
      .from('google_business_connections')
      .select('*')
      .eq('id', loc.connection_id)
      .maybeSingle();
    if (connectionError) throw connectionError;
    if (!connection) return json({ ok: true });

    let token = connection.access_token;
    if (!token || !connection.token_expires_at || new Date(connection.token_expires_at).getTime() < Date.now() + 120000) {
      const refreshed = await refresh(connection.refresh_token);
      token = refreshed.access_token;
      const { error } = await db.from('google_business_connections').update({
        access_token: token,
        token_expires_at: new Date(Date.now() + Number(refreshed.expires_in ?? 3600) * 1000).toISOString(),
        status: 'active',
        last_error: null,
        updated_at: new Date().toISOString(),
      }).eq('id', connection.id);
      if (error) throw error;
    }

    const googleResponse = await fetch(
      `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${encodeURIComponent(reviewId)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const review = await googleResponse.json();
    if (!googleResponse.ok) throw new Error(review?.error?.message ?? 'Google review fetch failed');

    const { data: existing, error: existingError } = await db
      .from('google_business_reviews')
      .select('id,reply_status,owner_reply,reply_draft')
      .eq('google_review_name', String(review.name ?? reviewName))
      .maybeSingle();
    if (existingError) throw existingError;

    const now = new Date().toISOString();
    const { data: stored, error: storeError } = await db.from('google_business_reviews').upsert({
      location_id: loc.id,
      google_review_name: review.name ?? reviewName,
      reviewer_display_name: review.reviewer?.displayName ?? null,
      reviewer_is_anonymous: !!review.reviewer?.isAnonymous,
      star_rating: review.starRating ?? null,
      comment: review.comment ?? null,
      review_created_at: review.createTime ?? null,
      review_updated_at: review.updateTime ?? null,
      owner_reply: review.reviewReply?.comment ?? null,
      owner_reply_updated_at: review.reviewReply?.updateTime ?? null,
      raw_payload: review,
      last_synced_at: now,
      updated_at: now,
    }, { onConflict: 'google_review_name' }).select('id').single();
    if (storeError) throw storeError;

    const { data: settings, error: settingsError } = await db
      .from('google_business_settings')
      .select('auto_reply_enabled,require_approval,auto_reply_min_rating,auto_reply_language,auto_reply_tone,auto_reply_activated_at')
      .eq('establishment_id', connection.establishment_id)
      .maybeSingle();
    if (settingsError) throw settingsError;

    // A webhook event may update an existing review; never treat that as a new review.
    const createdAt = review.createTime ? new Date(review.createTime).getTime() : 0;
    const activatedAt = settings?.auto_reply_activated_at ? new Date(settings.auto_reply_activated_at).getTime() : 0;
    const threshold = Math.max(1, Math.min(5, Number(settings?.auto_reply_min_rating ?? 4)));
    const rating = ratingNumber(review.starRating);
    const hasComment = Boolean(String(review.comment ?? '').trim());
    const hasGoogleReply = Boolean(String(review.reviewReply?.comment ?? '').trim());
    const isNewReview = !existing;
    const afterActivation = activatedAt > 0 && createdAt > 0 && createdAt >= activatedAt;

    // Publish only new positive reviews when autonomous replies are enabled and approval is disabled.
    // Negative/below-threshold reviews are never published automatically.
    const shouldAutoPublish = isNewReview &&
      afterActivation &&
      settings?.auto_reply_enabled === true &&
      settings?.require_approval === false &&
      rating >= threshold &&
      !hasGoogleReply &&
      hasComment &&
      Boolean(stored?.id);

    if (!shouldAutoPublish) return json({ ok: true, review_id: stored?.id ?? null, auto_reply: 'skipped' });

    try {
      const reply = await generateReply(
        String(review.comment),
        String(review.starRating ?? ''),
        String(settings?.auto_reply_language ?? 'fr'),
        String(settings?.auto_reply_tone ?? 'professional_warm'),
      );
      const generatedAt = new Date().toISOString();
      const { error: draftError } = await db.from('google_business_reviews').update({
        reply_draft: reply,
        reply_status: 'ready_to_publish',
        reply_error: null,
        reply_generated_at: generatedAt,
        updated_at: generatedAt,
      }).eq('id', stored.id);
      if (draftError) throw draftError;

      const endpoint = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}/reviews/${encodeURIComponent(reviewId)}/reply`;
      const publishResponse = await fetch(endpoint, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: reply }),
      });
      const raw = await publishResponse.text();
      let published: any = {};
      try { published = raw ? JSON.parse(raw) : {}; } catch { /* Google may return an empty response body. */ }
      if (!publishResponse.ok) throw new Error(published?.error?.message ?? raw.slice(0, 300) ?? 'Google reply failed');

      const publishedAt = new Date().toISOString();
      const { error: updateError } = await db.from('google_business_reviews').update({
        owner_reply: reply,
        owner_reply_updated_at: publishedAt,
        reply_published_at: publishedAt,
        reply_status: 'published',
        reply_error: null,
        last_synced_at: publishedAt,
        raw_payload: published,
        updated_at: publishedAt,
      }).eq('id', stored.id);
      if (updateError) throw updateError;
      return json({ ok: true, review_id: stored.id, auto_reply: 'published' });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Google reply failed';
      await db.from('google_business_reviews').update({
        reply_status: 'failed',
        reply_error: message,
        updated_at: new Date().toISOString(),
      }).eq('id', stored.id);
      throw error;
    }
  } catch (error) {
    console.error('google-business-webhook:', error);
    return json({ ok: false, error: error instanceof Error ? error.message : 'Webhook error' }, 500);
  }
});
