import { useEffect, useMemo, useState } from 'react';
import { Bell, X, RotateCcw, History } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { sendLoyaltyNotificationPush } from '@/lib/loyaltyNotificationPush';

type Customer = {
  id: string;
  first_name: string;
  phone: string;
  interests: string[] | null;
  notification_consent: boolean;
  visit_frequency: string | null;
  points_balance: number;
  visit_count: number;
  last_visit_at: string | null;
};

type Audience = 'ALL' | 'INTEREST' | 'FREQUENCY' | 'POINTS' | 'VISITS' | 'CUSTOMER';
type NotificationType = 'INFO' | 'OFFER' | 'REWARD' | 'POINTS';
type Campaign = { id: string; title: string; message: string; type: NotificationType; audience: Record<string, unknown>; expires_at: string | null; recipient_count: number; status: string; created_at: string; last_push_status: string | null; last_push_at: string | null; last_push_sent: number | null; last_push_failed: number | null; last_push_skipped: number | null; last_push_total: number | null; last_push_error: string | null };

export default function LoyaltyNotificationsPanel({ establishmentId }: { establishmentId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState<Campaign[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);

  const [audience, setAudience] = useState<Audience>('ALL');
  const [interest, setInterest] = useState('');
  const [frequency, setFrequency] = useState('');
  const [minPoints, setMinPoints] = useState('');
  const [minVisits, setMinVisits] = useState('');
  const [lastVisitDays, setLastVisitDays] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [type, setType] = useState<NotificationType>('INFO');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const loadHistory = async () => {
    if (!establishmentId) { setHistory([]); setHistoryLoading(false); return; }
    setHistoryLoading(true);
    const { data, error } = await supabase.rpc('get_loyalty_notification_campaign_history', { p_establishment_id: establishmentId });
    if (error) {
      console.error('Erreur historique notifications:', error);
      setHistory([]);
    } else {
      setHistory((data ?? []) as Campaign[]);
    }
    setHistoryLoading(false);
  };

  useEffect(() => { void loadHistory(); }, [establishmentId]);

  const resendNotification = async (campaign: Campaign) => {
    if (resendingId) return;
    if (!window.confirm(`Renvoyer « ${campaign.title} » aux appareils ciblés lors de l’envoi initial ?`)) return;
    setResendingId(campaign.id);
    try {
      const result = await sendLoyaltyNotificationPush(campaign.id);
      if (result.success && result.sent > 0) {
        alert(`Push renvoyé à ${result.sent} appareil(s).`);
      } else if (result.push_subscribers === 0) {
        alert('Aucun abonnement Push actif parmi les destinataires initiaux.');
      } else {
        alert(`Le renvoi n’a pas été confirmé. ${result.errors?.[0]?.message || result.error || `${result.failed} échec(s).`}`);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Impossible de renvoyer la notification.');
    } finally {
      setResendingId(null);
      void loadHistory();
    }
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('loyalty_customers')
        .select('id,first_name,phone,interests,notification_consent,visit_frequency,points_balance,visit_count,last_visit_at')
        .eq('establishment_id', establishmentId)
        .order('created_at', { ascending: false });

      if (active) {
        if (error) {
          console.error('Erreur chargement clients notifications:', error);
          setCustomers([]);
        } else {
          setCustomers((data ?? []) as Customer[]);
        }
        setLoading(false);
      }
    };

    void load();
    return () => { active = false; };
  }, [establishmentId]);

  const eligibleCustomers = useMemo(() => customers.filter(customer => {
    if (!customer.notification_consent) return false;

    if (audience === 'INTEREST' && interest && !(customer.interests ?? []).includes(interest)) return false;
    if (audience === 'FREQUENCY' && frequency && customer.visit_frequency !== frequency) return false;
    if (audience === 'POINTS' && customer.points_balance < Number(minPoints || 0)) return false;

    if (audience === 'VISITS') {
      if (customer.visit_count < Number(minVisits || 0)) return false;
      const days = Number(lastVisitDays || 0);
      if (days > 0) {
        if (!customer.last_visit_at) return false;
        if (new Date(customer.last_visit_at).getTime() < Date.now() - days * 86400000) return false;
      }
    }

    if (audience === 'CUSTOMER' && customer.id !== customerId) return false;
    return true;
  }), [customers, audience, interest, frequency, minPoints, minVisits, lastVisitDays, customerId]);

  const interests = useMemo(
    () => Array.from(new Set(customers.flatMap(customer => customer.interests ?? []))).sort(),
    [customers]
  );

  const reset = () => {
    setAudience('ALL');
    setInterest('');
    setFrequency('');
    setMinPoints('');
    setMinVisits('');
    setLastVisitDays('');
    setCustomerId('');
    setType('INFO');
    setTitle('');
    setMessage('');
    setExpiresAt('');
  };

  const createNotification = async () => {
    if (!establishmentId || !title.trim() || !message.trim() || saving) return;

    if (audience === 'CUSTOMER' && !customerId) {
      alert('Sélectionnez un client.');
      return;
    }

    if (eligibleCustomers.length === 0) {
      alert('Aucun client éligible avec les notifications activées.');
      return;
    }

    setSaving(true);
    try {
      const target: Record<string, unknown> = {};

      if (audience === 'INTEREST' && interest) target.interests = [interest];
      if (audience === 'FREQUENCY' && frequency) target.visit_frequency = frequency;
      if (audience === 'POINTS') target.min_points = Math.max(0, Number(minPoints || 0));
      if (audience === 'VISITS') {
        target.min_visits = Math.max(0, Number(minVisits || 0));
        if (Number(lastVisitDays || 0) > 0) target.last_visit_days = Math.max(0, Number(lastVisitDays));
      }
      if (audience === 'CUSTOMER') target.customer_ids = [customerId];

      const { data, error } = await supabase.rpc('create_loyalty_notification_campaign', {
        p_establishment_id: establishmentId,
        p_title: title.trim(),
        p_message: message.trim(),
        p_type: type,
        p_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
        p_audience: target,
      });

      if (error) throw error;

      const result = Array.isArray(data) ? data[0] : data;
      const count = Number(result?.recipient_count ?? eligibleCustomers.length);
      const campaignId = result?.campaign_id ? String(result.campaign_id) : '';

      let pushResult: Awaited<ReturnType<typeof sendLoyaltyNotificationPush>> | null = null;

      if (campaignId) {
        pushResult = await sendLoyaltyNotificationPush(campaignId);
        console.log('Résultat Web Push KELYANI:', pushResult);
      }

      await loadHistory();
      reset();
      setOpen(false);

      if (!pushResult) {
        alert(`Notification publiée sur ${count} carte(s) fidélité. Le canal de notification système n'a pas pu être déclenché.`);
      } else if (pushResult.success && pushResult.sent > 0) {
        alert(
          `Notification publiée sur ${count} carte(s) fidélité. 📱 Push système envoyé à ${pushResult.sent} appareil(s).`
        );
      } else if (pushResult.push_subscribers === 0) {
        alert(
          `Notification publiée sur ${count} carte(s) fidélité, mais aucun abonnement de notification système actif n'a été trouvé.`
        );
      } else if (pushResult.failed > 0) {
        const detail =
          pushResult.errors?.[0]?.message ||
          pushResult.error ||
          'Erreur Web Push inconnue.';
        alert(
          `Notification publiée sur ${count} carte(s), mais le Push système a échoué.\\n\\n${detail}`
        );
      } else {
        alert(
          `Notification publiée sur ${count} carte(s) fidélité. Aucun Push système n'a été confirmé.`
        );
      }
    } catch (error) {
      console.error('Erreur notification fidélité:', error);
      alert(error instanceof Error ? error.message : 'Impossible de publier la notification.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="rounded-3xl border border-[#242424] bg-[#111111] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#C9A45C]/10 text-[#C9A45C]">
              <Bell size={18} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A45C]">Communication fidélité</p>
              <h3 className="mt-1 text-lg font-semibold text-white">Notifications clients</h3>
              <p className="mt-1 text-xs leading-5 text-white/45">
                Envoyez un message sur la carte et, si le client l’a autorisé, sur l’écran verrouillé du téléphone.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={loading || !establishmentId}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2.5 text-xs font-semibold text-[#0D0D0D] disabled:opacity-40"
          >
            <Bell size={15} />
            Nouvelle notification
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-white/55">{customers.length} clients</span>
          <span className="rounded-full bg-[#C9A45C]/10 px-3 py-1.5 text-[#C9A45C]">{customers.filter(c => c.notification_consent).length} notifications activées</span>
        </div>
      </div>

      <div className="rounded-3xl border border-[#242424] bg-[#111111] p-5">
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-white/[0.04] text-[#C9A45C]"><History size={17} /></div>
          <div>
            <h3 className="text-base font-semibold text-white">Historique des notifications</h3>
            <p className="text-xs text-white/45">Retrouvez les campagnes publiées et renvoyez un Push si nécessaire.</p>
          </div>
          <button type="button" onClick={() => void loadHistory()} className="ml-auto rounded-lg border border-white/10 px-3 py-2 text-xs text-white/65">Actualiser</button>
        </div>
        {historyLoading ? (
          <p className="py-5 text-center text-xs text-white/40">Chargement de l’historique…</p>
        ) : history.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-6 text-center text-xs text-white/40">Aucune notification publiée pour le moment.</p>
        ) : (
          <div className="space-y-3">
            {history.map(campaign => (
              <div key={campaign.id} className="rounded-2xl border border-white/[0.08] bg-black/20 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-white">{campaign.title}</p>
                      <span className="rounded-full bg-[#C9A45C]/10 px-2 py-1 text-[10px] text-[#C9A45C]">{campaign.type}</span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-xs leading-5 text-white/55">{campaign.message}</p>
                    <p className="mt-2 text-[10px] text-white/35">
                      Publiée le {new Date(campaign.created_at).toLocaleString('fr-FR')} · {campaign.recipient_count} destinataire(s) ciblé(s)
                      {campaign.expires_at ? ` · Expire le ${new Date(campaign.expires_at).toLocaleDateString('fr-FR')}` : ''}
                    </p>
                    <div className="mt-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-semibold uppercase tracking-wide text-white/40">Dernier résultat Web Push</span>
                        <span className={`rounded-full px-2 py-1 text-[10px] ${campaign.last_push_status === 'ACCEPTED_BY_PUSH_SERVICE' ? 'bg-emerald-500/10 text-emerald-300' : campaign.last_push_status === 'PARTIAL' ? 'bg-amber-500/10 text-amber-300' : campaign.last_push_status === 'FAILED' ? 'bg-red-500/10 text-red-300' : 'bg-white/[0.06] text-white/50'}`}>
                          {campaign.last_push_status === 'ACCEPTED_BY_PUSH_SERVICE' ? 'Accepté par le service Push' : campaign.last_push_status === 'PARTIAL' ? 'Partiellement accepté' : campaign.last_push_status === 'FAILED' ? 'Échec' : campaign.last_push_status === 'NO_SUBSCRIBERS' ? 'Aucun abonnement actif' : campaign.last_push_status === 'NO_RECIPIENTS' ? 'Aucun destinataire' : campaign.last_push_status === 'SENDING' ? 'En cours' : campaign.last_push_status === 'NO_DELIVERIES' ? 'Aucun envoi accepté' : campaign.last_push_status || 'Aucune tentative enregistrée'}
                        </span>
                      </div>
                      {campaign.last_push_at && <p className="mt-1 text-[10px] text-white/35">Tentative : {new Date(campaign.last_push_at).toLocaleString('fr-FR')}</p>}
                      {campaign.last_push_status && <p className="mt-1 text-[11px] text-white/55">Acceptés par le service : {campaign.last_push_sent ?? 0} · Échecs : {campaign.last_push_failed ?? 0} · Ignorés : {campaign.last_push_skipped ?? 0} · Abonnés ciblés : {campaign.last_push_total ?? campaign.recipient_count}</p>}
                      {campaign.last_push_error && <p className="mt-1 break-words text-[10px] text-red-300/80">Détail : {campaign.last_push_error}</p>}
                      <p className="mt-1 text-[10px] text-white/30">Ce résultat ne confirme pas la réception ni l’affichage sur le téléphone.</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => void resendNotification(campaign)} disabled={!!resendingId || campaign.status === 'CANCELLED'} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-[#C9A45C]/30 px-3 py-2 text-xs font-semibold text-[#C9A45C] disabled:opacity-40">
                    <RotateCcw size={13} />{resendingId === campaign.id ? 'Renvoi…' : 'Renvoyer le Push'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl border border-[#242424] bg-[#111111] p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#C9A45C]">Communication fidélité</p>
                <h2 className="mt-1 text-2xl font-semibold text-white">Nouvelle notification</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-9 w-9 place-items-center rounded-full bg-white/[0.04] text-white/50">
                <X size={17} />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-white/55">Ciblage</label>
                <select value={audience} onChange={e => setAudience(e.target.value as Audience)} className="mt-2 w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]">
                  <option value="ALL">Tous les clients ayant activé les notifications</option>
                  <option value="INTEREST">Par centre d’intérêt</option>
                  <option value="FREQUENCY">Par fréquence de visite</option>
                  <option value="POINTS">Par solde de points</option>
                  <option value="VISITS">Par visites / récence</option>
                  <option value="CUSTOMER">Un client précis</option>
                </select>
              </div>

              {audience === 'INTEREST' && (
                <select value={interest} onChange={e => setInterest(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]">
                  <option value="">Sélectionner un centre d’intérêt</option>
                  {interests.map(item => <option key={item} value={item}>{item}</option>)}
                </select>
              )}

              {audience === 'FREQUENCY' && (
                <select value={frequency} onChange={e => setFrequency(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]">
                  <option value="">Sélectionner une fréquence</option>
                  <option value="WEEKLY">Hebdomadaire</option>
                  <option value="MONTHLY">Mensuelle</option>
                  <option value="OCCASIONAL">Occasionnelle</option>
                </select>
              )}

              {audience === 'POINTS' && (
                <input type="number" min="0" value={minPoints} onChange={e => setMinPoints(e.target.value)} placeholder="Minimum de points" className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]" />
              )}

              {audience === 'VISITS' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input type="number" min="0" value={minVisits} onChange={e => setMinVisits(e.target.value)} placeholder="Minimum de visites" className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]" />
                  <input type="number" min="0" value={lastVisitDays} onChange={e => setLastVisitDays(e.target.value)} placeholder="Vu il y a moins de X jours" className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]" />
                </div>
              )}

              {audience === 'CUSTOMER' && (
                <select value={customerId} onChange={e => setCustomerId(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]">
                  <option value="">Sélectionner un client</option>
                  {customers.filter(c => c.notification_consent).map(customer => (
                    <option key={customer.id} value={customer.id}>{customer.first_name || 'Client'} · {customer.phone}</option>
                  ))}
                </select>
              )}

              <div className="rounded-xl border border-[#C9A45C]/15 bg-[#C9A45C]/5 px-4 py-3 text-xs text-white/55">
                <strong className="text-[#C9A45C]">{eligibleCustomers.length}</strong> client(s) recevront la notification sur leur carte.
              </div>

              <select value={type} onChange={e => setType(e.target.value as NotificationType)} className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]">
                <option value="INFO">Information</option>
                <option value="OFFER">Offre</option>
                <option value="REWARD">Récompense</option>
                <option value="POINTS">Points</option>
              </select>

              <input value={title} onChange={e => setTitle(e.target.value)} maxLength={120} placeholder="Titre" className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]" />
              <textarea value={message} onChange={e => setMessage(e.target.value)} maxLength={1000} rows={5} placeholder="Message qui apparaîtra sur la carte et dans la notification téléphone..." className="w-full resize-none rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]" />
              <input type="datetime-local" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="w-full rounded-xl border border-white/10 bg-[#0D0D0D] px-4 py-3 text-sm text-white outline-none focus:border-[#C9A45C]" />

              <button type="button" onClick={() => void createNotification()} disabled={saving || !title.trim() || !message.trim()} className="w-full rounded-xl bg-[#C9A45C] px-4 py-3 text-xs font-bold text-[#0D0D0D] disabled:opacity-40">
                {saving ? 'Publication…' : 'Publier la notification'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
