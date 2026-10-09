import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const C = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...C, 'Content-Type': 'application/json' },
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: C });
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@kelyani.com';
    const publicKey = 'BP6npYG0iStFDilI-plhetrxJ6msUZGBVgMDP9u7ytndT4QzjD1A2q9taxeRX5bEHCoDBjRYjOUXtd1t2ZuXCWA';

    if (!url || !anon || !service || !privateKey) return json({ success: false, error: 'Configuration Web Push incomplète.' }, 503);

    const authorization = req.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ success: false, error: 'Session utilisateur manquante.' }, 401);

    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) return json({ success: false, error: 'Session utilisateur invalide.' }, 401);

    const body = await req.json();
    const campaignId = String(body.campaign_id ?? '').trim();
    if (!campaignId) return json({ success: false, error: 'campaign_id obligatoire.' }, 400);

    const { data: campaign, error: campaignError } = await userClient
      .from('loyalty_notification_campaigns')
      .select('id,establishment_id,title,message,type')
      .eq('id', campaignId)
      .maybeSingle();

    if (campaignError || !campaign) return json({ success: false, error: 'Campagne introuvable.' }, 404);

    const { data: establishments, error: establishmentError } = await userClient.rpc('get_my_establishments');
    if (establishmentError || !((establishments ?? []) as Array<Record<string, unknown>>).some((x) => String(x.id ?? '') === campaign.establishment_id)) {
      return json({ success: false, error: 'Accès à cet établissement refusé.' }, 403);
    }

    const adminClient = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });

    const { data: attempt, error: attemptInsertError } = await adminClient
      .from('loyalty_notification_push_attempts')
      .insert({ campaign_id: campaignId, establishment_id: campaign.establishment_id, triggered_by: authData.user.id, status: 'SENDING' })
      .select('id')
      .single();
    if (attemptInsertError || !attempt) {
      console.error('Unable to create push attempt record:', attemptInsertError);
      return json({ success: false, error: 'Impossible d’enregistrer la tentative Web Push.' }, 500);
    }
    const attemptId = attempt.id;
    const finishAttempt = async (values: Record<string, unknown>) => {
      const { error } = await adminClient.from('loyalty_notification_push_attempts').update({ ...values, completed_at: new Date().toISOString() }).eq('id', attemptId);
      if (error) console.error('Unable to finalize push attempt:', error);
    };

    const { data: recipients, error: recipientsError } = await adminClient
      .from('loyalty_card_notifications')
      .select('id,customer_id,card_url')
      .eq('campaign_id', campaignId)
      .eq('establishment_id', campaign.establishment_id);

    if (recipientsError) {
      await finishAttempt({ status: 'FAILED', error_summary: 'Impossible de charger les destinataires.' });
      return json({ success: false, error: 'Impossible de charger les destinataires.' }, 500);
    }
    if (!recipients?.length) {
      await finishAttempt({ status: 'NO_RECIPIENTS', sent: 0, failed: 0, removed: 0, skipped: 0, total: 0, push_subscribers: 0 });
      return json({ success: true, sent: 0, failed: 0, removed: 0, skipped: 0, total: 0, push_subscribers: 0 });
    }

    const customerIds = [...new Set(recipients.map((row) => row.customer_id).filter(Boolean))];

    const { data: subscriptions, error: subscriptionsError } = await adminClient
      .from('loyalty_push_subscriptions')
      .select('id,customer_id,endpoint,p256dh,auth,card_url')
      .eq('establishment_id', campaign.establishment_id)
      .in('customer_id', customerIds);

    if (subscriptionsError) {
      await finishAttempt({ status: 'FAILED', total: recipients.length, error_summary: 'Impossible de charger les abonnements Push.' });
      return json({ success: false, error: 'Impossible de charger les abonnements push.' }, 500);
    }
    if (!subscriptions?.length) {
      await finishAttempt({ status: 'NO_SUBSCRIBERS', sent: 0, failed: 0, removed: 0, skipped: recipients.length, total: recipients.length, push_subscribers: 0 });
      return json({ success: true, sent: 0, failed: 0, removed: 0, skipped: recipients.length, total: recipients.length, push_subscribers: 0 });
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);

    let sent = 0;
    let failed = 0;
    let removed = 0;
    let lastError = '';

    for (const subscription of subscriptions) {
      try {
        const recipient = recipients.find((row) => row.customer_id === subscription.customer_id);
        const targetUrl = recipient?.card_url || subscription.card_url || '/loyalty';

        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          JSON.stringify({
            title: campaign.title,
            body: campaign.message,
            icon: '/tapmarrakech-logo.png',
            badge: '/tapmarrakech-logo.png',
            tag: 'loyalty-campaign-' + campaign.id,
            renotify: true,
            data: { url: targetUrl, campaignId: campaign.id },
          }),
          { TTL: 86400, urgency: 'high' },
        );
        sent++;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0);
        if (statusCode === 404 || statusCode === 410) {
          await adminClient.from('loyalty_push_subscriptions').delete().eq('id', subscription.id);
          removed++;
        } else {
          failed++;
          lastError = error instanceof Error ? error.message : String(error);
        }
      }
    }

    const skipped = Math.max(0, recipients.length - subscriptions.length);
    const attemptStatus = sent > 0 && failed === 0 ? 'ACCEPTED_BY_PUSH_SERVICE' : sent > 0 ? 'PARTIAL' : failed > 0 ? 'FAILED' : 'NO_DELIVERIES';
    await finishAttempt({ status: attemptStatus, sent, failed, removed, skipped, total: recipients.length, push_subscribers: subscriptions.length, error_summary: lastError || null });

    return json({
      success: sent > 0 && failed === 0,
      sent,
      failed,
      removed,
      skipped,
      total: recipients.length,
      push_subscribers: subscriptions.length,
      ...(lastError ? { error: lastError } : {}),
    });
  } catch (error) {
    console.error(error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Erreur interne.' }, 500);
  }
});