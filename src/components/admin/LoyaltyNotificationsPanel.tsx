import { useEffect, useMemo, useState } from 'react';
import { Bell, X } from 'lucide-react';
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

export default function LoyaltyNotificationsPanel({ establishmentId }: { establishmentId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

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

      if (campaignId) {
        const push = await sendLoyaltyNotificationPush(campaignId);
        if (push.failed > 0) {
          console.warn('Push delivery partiellement échouée:', push);
        }
      }

      reset();
      setOpen(false);
      alert(`Notification publiée sur ${count} carte(s) fidélité. Les clients ayant activé les notifications recevront également la notification système.`);
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
