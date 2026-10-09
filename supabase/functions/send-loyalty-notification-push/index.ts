import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const anon = Deno.env.get('SUPABASE_ANON_KEY');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || 'BP6npYG0iStFDilI-plhetrxJ6msUZGBVgMDP9u7ytndT4QzjD1A2q9taxeRX5bEHCoDBjRYjOUXtd1t2ZuXCWA';
    if (!url || !anon || !service || !privateKey || !publicKey) {
      return json({ success: false, error: 'Configuration Web Push incomplète.' }, 503);
    }

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

    // Campaign tables are intentionally service-role-only under RLS, so load the row
    // with the service client and independently authorize the caller before any delivery.
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: campaign, error: campaignError } = await admin
      .from('loyalty_notification_campaigns')
      .select('id,establishment_id,title,message,type')
      .eq('id', campaignId)
      .maybeSingle();
    if (campaignError || !campaign) return json({ success: false, error: 'Campagne introuvable.' }, 404);

    const { data: establishments, error: accessError } = await userClient.rpc('get_my_establishments');
    const allowed = !accessError && (establishments ?? []).some(
      (item: Record<string, unknown>) => String(item.id ?? '') === String(campaign.establishment_id),
    );
    if (!allowed) return json({ success: false, error: 'Accès à cet établissement refusé.' }, 403);
    // card_url belongs to the push-subscription table, not loyalty_card_notifications.
    const { data: recipients, error: recipientError } = await admin
      .from('loyalty_card_notifications')
      .select('id,customer_id')
      .eq('campaign_id', campaignId)
      .eq('establishment_id', campaign.establishment_id);
    if (recipientError) return json({ success: false, error: 'Impossible de charger les destinataires.' }, 500);
    if (!recipients?.length) return json({ success: true, sent: 0, failed: 0, removed: 0, skipped: 0, total: 0 });

    const customerIds = [...new Set(recipients.map((row) => row.customer_id).filter(Boolean))];
    if (!customerIds.length) return json({ success: true, sent: 0, failed: 0, removed: 0, skipped: recipients.length, total: recipients.length });

    // Consent can be revoked after campaign creation, so re-check it immediately before delivery.
    let consentQuery = admin
      .from('loyalty_customers')
      .select('id')
      .eq('establishment_id', campaign.establishment_id)
      .eq('notification_consent', true);
    // Promotional offers require both notification and marketing consent.
    if (campaign.type === 'OFFER') consentQuery = consentQuery.eq('marketing_consent', true);
    const { data: optedInCustomers, error: consentError } = await consentQuery.in('id', customerIds);
    if (consentError) return json({ success: false, error: 'Impossible de vérifier le consentement des destinataires.' }, 500);
    const optedInIds = (optedInCustomers ?? []).map((row) => row.id);
    if (!optedInIds.length) {
      return json({ success: true, sent: 0, failed: 0, removed: 0, skipped: recipients.length, total: recipients.length, message: 'Aucun destinataire avec consentement actif.' });
    }

    const { data: subscriptions, error: subscriptionError } = await admin
      .from('loyalty_push_subscriptions')
      .select('id,customer_id,endpoint,p256dh,auth,card_url')
      .eq('establishment_id', campaign.establishment_id)
      .in('customer_id', optedInIds);
    if (subscriptionError) return json({ success: false, error: 'Impossible de charger les abonnements push.' }, 500);
    if (!subscriptions?.length) return json({ success: true, sent: 0, failed: 0, removed: 0, skipped: recipients.length, total: recipients.length, message: 'Aucun abonnement Web Push actif.' });

    webpush.setVapidDetails(Deno.env.get('VAPID_SUBJECT') || 'mailto:notifications@kelyani.com', publicKey, privateKey);

    // Atomic at-most-once campaign claim: concurrent/repeated invocations cannot resend this campaign.
    const { data: claimed, error: claimError } = await userClient.rpc('claim_loyalty_campaign_push_delivery', { p_campaign_id: campaignId });
    if (claimError) return json({ success: false, error: 'Impossible de réserver l’envoi. Vérifiez que la migration de protection anti-doublon est appliquée.' }, 503);
    if (claimed !== true) return json({ success: false, duplicate: true, error: 'Cette campagne a déjà été réservée pour un envoi. Aucun doublon n’a été envoyé.' }, 409);

    let sent = 0, failed = 0, removed = 0;
    for (const sub of subscriptions) {
      try {
        await webpush.sendNotification({
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }, JSON.stringify({
          title: campaign.title,
          body: campaign.message,
          icon: '/kelyani-logo.png',
          badge: '/kelyani-logo.png',
          tag: 'loyalty-campaign-' + campaign.id,
          renotify: true,
          data: { url: sub.card_url || '/loyalty', campaignId: campaign.id },
        }), { TTL: 86400, urgency: 'high' });
        sent++;
      } catch (error) {
        const statusCode = Number((error as { statusCode?: number })?.statusCode ?? 0);
        if (statusCode === 404 || statusCode === 410) {
          await admin.from('loyalty_push_subscriptions').delete().eq('id', sub.id);
          removed++;
        } else {
          failed++;
          console.error('Push delivery failed', { customerId: sub.customer_id, statusCode });
        }
      }
    }
    const deliveryStatus = failed === 0 ? 'COMPLETED' : (sent > 0 ? 'PARTIAL' : 'FAILED');
    const { error: finalizeError } = await admin
      .from('loyalty_notification_campaigns')
      .update({ push_delivery_status: deliveryStatus, push_delivery_finished_at: new Date().toISOString(), push_delivery_sent: sent, push_delivery_failed: failed, push_delivery_removed: removed })
      .eq('id', campaignId)
      .eq('push_delivery_status', 'PROCESSING');
    if (finalizeError) console.error('Could not finalize campaign push delivery status', { campaignId });
    return json({ success: sent > 0 && failed === 0, sent, failed, removed, skipped: Math.max(0, recipients.length - subscriptions.length), total: recipients.length, delivery_status: deliveryStatus });
  } catch (error) {
    console.error('Unexpected push function error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Erreur interne.' }, 500);
  }
});
