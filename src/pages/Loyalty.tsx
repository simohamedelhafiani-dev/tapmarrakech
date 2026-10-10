import { useEffect, useMemo, useState } from 'react';
import {
  Gift,
  Plus,
  Search,
  Users,
  Star,
  Phone,
  Coins,
  X,
  CheckCircle2,
  LockKeyhole,
  Bell,
  QrCode,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import LoyaltyStudio from '@/components/loyalty/LoyaltyStudio';
import QRCode from 'qrcode';
import { sendLoyaltyNotificationPush } from '@/lib/loyaltyNotificationPush';

type Establishment = {
  id: string;
  name: string;
};

type LoyaltyCustomer = {
  id: string;
  establishment_id: string;
  phone: string;
  first_name: string;
  email?: string | null;
  interests?: string[] | null;
  marketing_consent?: boolean;
  notification_consent?: boolean;
  preferred_channel?: string | null;
  visit_frequency?: string | null;
  points_balance: number;
  total_points_earned: number;
  total_points_redeemed: number;
  visit_count: number;
  last_visit_at: string | null;
  created_at: string;
};

type LoyaltyProgramSettings = {
  points_per_currency: number;
  currency: string;
  enabled: boolean;
};

type LoyaltyReward = {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export default function Loyalty() {
  const { user } = useAuth();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');

  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [notificationTitle, setNotificationTitle] = useState('');
  const [notificationMessage, setNotificationMessage] = useState('');
  const [notificationType, setNotificationType] = useState<'INFO' | 'OFFER' | 'REWARD' | 'POINTS'>('INFO');
  const [notificationAudience, setNotificationAudience] = useState<'ALL' | 'INTEREST' | 'FREQUENCY' | 'POINTS' | 'VISITS' | 'CUSTOMER'>('ALL');
  const [notificationInterest, setNotificationInterest] = useState('');
  const [notificationFrequency, setNotificationFrequency] = useState('');
  const [notificationMinPoints, setNotificationMinPoints] = useState('');
  const [notificationMinVisits, setNotificationMinVisits] = useState('');
  const [notificationLastVisitDays, setNotificationLastVisitDays] = useState('');
  const [notificationCustomerId, setNotificationCustomerId] = useState('');
  const [notificationExpiresAt, setNotificationExpiresAt] = useState('');
  const [notificationSaving, setNotificationSaving] = useState(false);
  const [notificationHistory, setNotificationHistory] = useState<Array<{
    id: string; title: string; message: string; type: string; audience: Record<string, unknown> | null;
    recipient_count: number; status: string; created_at: string; expires_at: string | null;
  }>>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showNotificationHistory, setShowNotificationHistory] = useState(false);

  const [programSettings, setProgramSettings] =
    useState<LoyaltyProgramSettings>({
      points_per_currency: 1,
      currency: 'MAD',
      enabled: true,
    });

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showPoints, setShowPoints] =
    useState<LoyaltyCustomer | null>(null);
  const [showRewards, setShowRewards] =
    useState<LoyaltyCustomer | null>(null);
  const [recoveryQr, setRecoveryQr] = useState<{ url: string; name: string; expiresAt: string; customer: LoyaltyCustomer } | null>(null);
  const [recoveryLoading, setRecoveryLoading] = useState(false);

  const [selectedReward, setSelectedReward] =
    useState<LoyaltyReward | null>(null);

  const [showRewardCode, setShowRewardCode] = useState(false);
  const [rewardCode, setRewardCode] = useState('');

  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [pointsResponsibleCode, setPointsResponsibleCode] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'OTHER'>('CASH');

  useEffect(() => {
    loadEstablishments();
  }, [user]);

  useEffect(() => {
    if (establishmentId) {
      loadCustomers();
      loadProgramSettings();
      loadRewards();
      loadNotificationHistory();
    }
  }, [establishmentId]);

  async function loadEstablishments() {
    if (!user) return;

    setLoading(true);

    const { data, error } = await supabase
      .rpc('get_my_establishments');

    const establishmentsData = (data ?? []).map(
      (establishment: { id: string; name: string }) => ({
        id: establishment.id,
        name: establishment.name,
      })
    );

    if (!error) {
      setEstablishments(establishmentsData);

      if (establishmentsData.length > 0) {
        setEstablishmentId(establishmentsData[0].id);
      }
    } else {
      console.error('Erreur chargement établissements:', error);
    }

    setLoading(false);
  }

  async function loadCustomers() {
    if (!establishmentId) return;

    const { data, error } = await supabase
      .from('loyalty_customers')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false });

    if (!error) {
      setCustomers((data as LoyaltyCustomer[]) ?? []);
    } else {
      console.error('Erreur chargement clients:', error);
    }
  }

  async function loadProgramSettings() {
    if (!establishmentId) return;

    const { data, error } = await supabase
      .from('loyalty_settings')
      .select('points_per_currency, currency, enabled')
      .eq('establishment_id', establishmentId)
      .maybeSingle();

    if (!error && data) {
      setProgramSettings({
        points_per_currency: Number(data.points_per_currency ?? 1),
        currency: data.currency ?? 'MAD',
        enabled: data.enabled ?? true,
      });
    } else {
      setProgramSettings({
        points_per_currency: 1,
        currency: 'MAD',
        enabled: true,
      });
    }
  }

  async function loadRewards() {
    if (!establishmentId) return;

    const { data, error } = await supabase
      .from('loyalty_rewards')
      .select('*')
      .eq('establishment_id', establishmentId)
      .eq('active', true)
      .order('points_required', { ascending: true });

    if (!error) {
      setRewards((data as LoyaltyReward[]) ?? []);
    } else {
      console.error('Erreur chargement récompenses:', error);
      setRewards([]);
    }
  }

  async function loadNotificationHistory() {
    if (!establishmentId) {
      setNotificationHistory([]);
      return;
    }
    setHistoryLoading(true);
    const { data, error } = await supabase.rpc('get_loyalty_notification_campaign_history', {
      p_establishment_id: establishmentId,
      p_limit: 50,
    });
    setHistoryLoading(false);
    if (error) {
      console.error('Erreur historique notifications:', error);
      setNotificationHistory([]);
      return;
    }
    setNotificationHistory((data ?? []) as typeof notificationHistory);
  }

  function reuseNotification(campaign: (typeof notificationHistory)[number]) {
    setNotificationTitle(campaign.title);
    setNotificationMessage(campaign.message);
    setNotificationType(
      ['INFO', 'OFFER', 'REWARD', 'POINTS'].includes(campaign.type)
        ? campaign.type as 'INFO' | 'OFFER' | 'REWARD' | 'POINTS'
        : 'INFO'
    );
    // A re-publication is a new campaign; recipients and consent are recalculated.
    setNotificationAudience('ALL');
    setNotificationInterest('');
    setNotificationFrequency('');
    setNotificationMinPoints('');
    setNotificationMinVisits('');
    setNotificationLastVisitDays('');
    setNotificationCustomerId('');
    setNotificationExpiresAt('');
    setShowNotificationHistory(false);
    setShowNotificationModal(true);
  }

  const filteredCustomers = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return customers;

    return customers.filter(
      customer =>
        customer.first_name.toLowerCase().includes(value) ||
        customer.phone.toLowerCase().includes(value)
    );
  }, [customers, search]);

  const totalPoints = customers.reduce(
    (sum, customer) => sum + customer.points_balance,
    0
  );

  async function createRecoveryQr(customer: LoyaltyCustomer) {
    setRecoveryLoading(true);
    const { data, error } = await supabase.rpc('create_loyalty_card_recovery_session', {
      p_customer_id: customer.id,
    });
    setRecoveryLoading(false);

    if (error || !data?.[0]?.recovery_token) {
      alert(error?.message ?? 'Impossible de générer le QR de récupération.');
      return;
    }

    const recoveryToken = String(data[0].recovery_token);
    const expiresAt = String(data[0].expires_at);
    const url = `${window.location.origin}/loyalty/recover?token=${encodeURIComponent(recoveryToken)}`;

    setRecoveryQr({
      url: await QRCode.toDataURL(url, { width: 360, margin: 2 }),
      name: customer.first_name || 'Client',
      expiresAt,
      customer,
    });
  }

  async function createCustomer() {
    if (!establishmentId || !phone.trim()) return;

    setSaving(true);

    const cleanPhone = phone.trim();

    const { error } = await supabase
      .from('loyalty_customers')
      .insert({
        establishment_id: establishmentId,
        phone: cleanPhone,
        first_name: firstName.trim(),
      });

    if (error) {
      if (error.code === '23505') {
        alert('Un client avec ce numéro existe déjà.');
      } else {
        alert(error.message);
      }

      setSaving(false);
      return;
    }

    setFirstName('');
    setPhone('');
    setShowNewCustomer(false);

    await loadCustomers();

    setSaving(false);
  }

  async function addPoints() {
    if (!showPoints || !establishmentId) return;

    const purchaseAmount = Number(amount);
    const responsibleCode = pointsResponsibleCode.trim();

    if (!purchaseAmount || purchaseAmount <= 0) {
      alert('Veuillez saisir un montant valide.');
      return;
    }

    if (!programSettings.enabled) {
      alert(
        'Le programme de fidélité est actuellement désactivé pour cet établissement.'
      );
      return;
    }

    if (responsibleCode.length < 4) {
      alert('Le code responsable est obligatoire.');
      return;
    }

    const rate = Number(programSettings.points_per_currency);

    if (!Number.isFinite(rate) || rate <= 0) {
      alert(
        'Le taux de points est invalide. Vérifiez les paramètres du programme fidélité.'
      );
      return;
    }

    const points = Math.floor(purchaseAmount * rate);

    if (points <= 0) {
      alert(
        'Le montant est trop faible pour générer des points avec le taux actuel.'
      );
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.rpc('add_loyalty_points', {
      p_establishment_id: establishmentId,
      p_customer_id: showPoints.id,
      p_amount: purchaseAmount,
      p_invoice_number: invoiceNumber.trim() || null,
      p_responsible_code: responsibleCode,
      p_description: `Achat de ${purchaseAmount.toFixed(2)} ${programSettings.currency}`,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    const newBalance = Number(data ?? 0);

    setAmount('');
    setInvoiceNumber('');
    setPointsResponsibleCode('');
    setShowPoints(null);
    await loadCustomers();

    alert(`+${points} points ajoutés. Nouveau solde : ${newBalance} points.`);
  }

  const notificationEligibleCustomers = useMemo(() => {
    return customers.filter(customer => {
      if (!customer.notification_consent) return false;

      if (notificationAudience === 'INTEREST' && notificationInterest) {
        if (!(customer.interests ?? []).includes(notificationInterest)) return false;
      }

      if (notificationAudience === 'FREQUENCY' && notificationFrequency) {
        if (customer.visit_frequency !== notificationFrequency) return false;
      }

      if (notificationAudience === 'POINTS') {
        if (customer.points_balance < Number(notificationMinPoints || 0)) return false;
      }

      if (notificationAudience === 'VISITS') {
        if (customer.visit_count < Number(notificationMinVisits || 0)) return false;
        const days = Number(notificationLastVisitDays || 0);
        if (days > 0) {
          if (!customer.last_visit_at) return false;
          const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
          if (new Date(customer.last_visit_at).getTime() < cutoff) return false;
        }
      }

      if (notificationAudience === 'CUSTOMER' && customer.id !== notificationCustomerId) {
        return false;
      }

      return true;
    });
  }, [
    customers,
    notificationAudience,
    notificationInterest,
    notificationFrequency,
    notificationMinPoints,
    notificationMinVisits,
    notificationLastVisitDays,
    notificationCustomerId,
  ]);

  const notificationInterests = useMemo(() => {
    return Array.from(
      new Set(customers.flatMap(customer => customer.interests ?? []))
    ).sort();
  }, [customers]);

  async function createNotification() {
    if (!establishmentId || !notificationTitle.trim() || !notificationMessage.trim()) return;

    if (notificationAudience === 'CUSTOMER' && !notificationCustomerId) {
      alert('Sélectionnez un client.');
      return;
    }

    if (notificationEligibleCustomers.length === 0) {
      alert('Aucun client avec consentement notification ne correspond à ce ciblage.');
      return;
    }

    setNotificationSaving(true);

    const audience: Record<string, unknown> = {};

    if (notificationAudience === 'INTEREST' && notificationInterest) {
      audience.interests = [notificationInterest];
    }
    if (notificationAudience === 'FREQUENCY' && notificationFrequency) {
      audience.visit_frequency = notificationFrequency;
    }
    if (notificationAudience === 'POINTS') {
      audience.min_points = Math.max(0, Number(notificationMinPoints || 0));
    }
    if (notificationAudience === 'VISITS') {
      audience.min_visits = Math.max(0, Number(notificationMinVisits || 0));
      if (Number(notificationLastVisitDays || 0) > 0) {
        audience.last_visit_days = Math.max(0, Number(notificationLastVisitDays));
      }
    }
    if (notificationAudience === 'CUSTOMER') {
      audience.customer_ids = [notificationCustomerId];
    }

    const { data, error } = await supabase.rpc('create_loyalty_notification_campaign', {
      p_establishment_id: establishmentId,
      p_title: notificationTitle.trim(),
      p_message: notificationMessage.trim(),
      p_type: notificationType,
      p_expires_at: notificationExpiresAt ? new Date(notificationExpiresAt).toISOString() : null,
      p_audience: audience,
    });

    setNotificationSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const count = Number(result?.recipient_count ?? notificationEligibleCustomers.length);

    // Keep in-card notifications and deliver phone-level Web Push as a separate
    // best-effort step, so a push failure never rolls back the saved campaign.
    const campaignId = result?.campaign_id ? String(result.campaign_id) : '';
    const pushResult = campaignId
      ? await sendLoyaltyNotificationPush(campaignId)
      : { success: false, sent: 0, error: 'campaign_id manquant' };

    setNotificationTitle('');
    setNotificationMessage('');
    setNotificationType('INFO');
    setNotificationAudience('ALL');
    setNotificationInterest('');
    setNotificationFrequency('');
    setNotificationMinPoints('');
    setNotificationMinVisits('');
    setNotificationLastVisitDays('');
    setNotificationCustomerId('');
    setNotificationExpiresAt('');
    setShowNotificationModal(false);
    await loadNotificationHistory();
    alert(
      pushResult.success && pushResult.sent > 0
        ? `Notification publiée sur ${count} carte(s) fidélité. ${pushResult.sent} notification(s) système envoyée(s).`
        : `Notification publiée sur ${count} carte(s) fidélité. Les notifications système seront disponibles pour les clients ayant activé les notifications.`
    );
  }

  function selectReward(
    customer: LoyaltyCustomer,
    reward: LoyaltyReward
  ) {
    if (!reward.active) {
      alert('Cette récompense est inactive.');
      return;
    }

    if (customer.points_balance < reward.points_required) {
      alert(
        `Ce client ne possède pas assez de points. Il lui manque ${
          reward.points_required - customer.points_balance
        } points.`
      );
      return;
    }

    setSelectedReward(reward);
    setRewardCode('');
    setInvoiceNumber('');
    setInvoiceAmount('');
    setPaymentMethod('CASH');
    setShowRewardCode(true);
  }

  async function redeemReward() {
    if (!establishmentId) return;
    if (!showRewards) return;
    if (!selectedReward) return;

    const code = rewardCode.trim();
    const cleanInvoiceNumber = invoiceNumber.trim();
    const purchaseAmount = Number(invoiceAmount);

    if (!code) {
      alert('Veuillez saisir le code responsable.');
      return;
    }

    if (code.length < 4) {
      alert('Le code responsable doit contenir au moins 4 caractères.');
      return;
    }

    if (showRewards.points_balance < selectedReward.points_required) {
      alert('Ce client ne possède pas assez de points.');
      return;
    }

    if (!cleanInvoiceNumber) {
      alert('Le numéro de facture est obligatoire.');
      return;
    }

    if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) {
      alert('Veuillez saisir un montant de facture valide.');
      return;
    }

    setRedeeming(true);

    const { data, error } = await supabase.rpc(
      'redeem_loyalty_reward',
      {
        p_establishment_id: establishmentId,
        p_customer_id: showRewards.id,
        p_reward_id: selectedReward.id,
        p_reward_code: code,
        p_invoice_number: cleanInvoiceNumber,
        p_invoice_amount: purchaseAmount,
        p_payment_method: paymentMethod,
      }
    );

    if (error) {
      console.error('Erreur utilisation récompense:', error);
      alert(error.message);
      setRedeeming(false);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const newBalance = Number(result?.new_points_balance ?? 0);
    const rewardName = result?.reward_name ?? selectedReward.name;

    setInvoiceNumber('');
    setInvoiceAmount('');
    setPaymentMethod('CASH');
    setRewardCode('');
    setInvoiceNumber('');
    setInvoiceAmount('');
    setPaymentMethod('CASH');
    setSelectedReward(null);
    setShowRewardCode(false);
    setShowRewards(null);

    await loadCustomers();

    setRedeeming(false);

    alert(
      `Récompense utilisée avec succès !\n\n${rewardName}\nNouveau solde : ${newBalance} points.`
    );
  }

  function closeRewards() {
    if (redeeming) return;

    setRewardCode('');
    setSelectedReward(null);
    setShowRewardCode(false);
    setShowRewards(null);
  }

  function closeRewardCode() {
    if (redeeming) return;

    setRewardCode('');
    setSelectedReward(null);
    setShowRewardCode(false);
  }

  if (loading && establishments.length === 0) {
    return (
      <div className="h-72 animate-pulse rounded-2xl bg-ink/5" />
    );
  }

  return (
    <div>
      {/* HEADER */}
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Fidélité
          </p>

          <h1 className="mt-2 font-display text-4xl text-forest">
            Compte Fidélité
          </h1>

          <p className="mt-2 text-sm text-ink/50">
            Fidélisez vos clients grâce à leur numéro de téléphone.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setShowNotificationHistory(value => !value)}
            disabled={!establishmentId}
            className="flex items-center gap-2 rounded-xl border border-gold/30 bg-[#0D0D0D] px-4 py-2.5 text-xs font-semibold text-[#D4AF37] transition hover:bg-[#1b1b1b] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Bell size={16} />
            Historique notifications
          </button>
          <button
            onClick={() => setShowNotificationModal(true)}
            disabled={!establishmentId || !programSettings.enabled}
            className="flex items-center gap-2 rounded-xl border border-gold/30 bg-white px-4 py-2.5 text-xs font-semibold text-forest transition hover:bg-[#fdf9ef] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Bell size={16} />
            Notification carte
          </button>

          <button
            onClick={() => setShowNewCustomer(true)}
          disabled={!establishmentId || !programSettings.enabled}
          className="flex w-fit items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} />
            Nouveau client
          </button>
        </div>
      </div>

      {/* PROGRAM STATUS */}
      <div
        className={`mb-6 rounded-2xl border p-5 shadow-soft ${
          programSettings.enabled
            ? 'border-forest/10 bg-white'
            : 'border-red-200 bg-red-50'
        }`}
      >
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
              Programme fidélité
            </p>

            <p className="mt-1 text-sm font-medium text-forest">
              {programSettings.enabled
                ? 'Programme actif'
                : 'Programme désactivé'}
            </p>

            <p className="mt-1 text-xs text-ink/45">
              {programSettings.enabled
                ? `${programSettings.points_per_currency} point(s) par ${programSettings.currency}`
                : 'Aucun nouveau point ne peut être attribué.'}
            </p>
          </div>

          <div
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              programSettings.enabled
                ? 'bg-[#e5eee9] text-forest'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {programSettings.enabled ? 'ACTIF' : 'INACTIF'}
          </div>
        </div>
      </div>

      <LoyaltyStudio establishmentId={establishmentId} />

      {showNotificationHistory && (
        <section className="mb-6 rounded-2xl border border-[#D4AF37]/20 bg-[#0D0D0D] p-5 text-[#F5F5DC] shadow-soft">
          <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">Centre de notifications</p>
              <h2 className="mt-1 font-display text-2xl text-[#D4AF37]">Historique</h2>
              <p className="mt-1 text-xs text-[#F5F5DC]/55">Retrouvez vos campagnes et réutilisez un ancien message.</p>
            </div>
            <button type="button" onClick={() => setShowNotificationModal(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-2.5 text-xs font-bold text-[#0D0D0D] hover:bg-[#E1C27A]">
              <Plus size={15} /> Nouvelle notification
            </button>
          </div>
          {historyLoading ? (
            <div className="rounded-xl border border-white/10 p-6 text-sm text-[#F5F5DC]/60">Chargement de l’historique…</div>
          ) : notificationHistory.length === 0 ? (
            <div className="rounded-xl border border-white/10 p-6 text-sm text-[#F5F5DC]/60">Aucune notification publiée pour le moment.</div>
          ) : (
            <div className="space-y-3">
              {notificationHistory.map(campaign => (
                <article key={campaign.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-[#F5F5DC]">{campaign.title}</h3>
                        <span className="rounded-full border border-[#D4AF37]/30 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[#D4AF37]">{campaign.type}</span>
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-[#F5F5DC]/70">{campaign.message}</p>
                      <p className="mt-3 text-[11px] text-[#F5F5DC]/45">
                        Publiée le {new Date(campaign.created_at).toLocaleString('fr-FR')} · {campaign.recipient_count} destinataire(s) · {campaign.status}
                      </p>
                    </div>
                    <button type="button" onClick={() => reuseNotification(campaign)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-[#D4AF37]/40 px-3 py-2 text-xs font-semibold text-[#D4AF37] transition hover:bg-[#D4AF37]/10">
                      <Bell size={14} /> Réutiliser / republier
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ESTABLISHMENT */}
      {establishments.length > 1 && (
        <div className="mb-6 rounded-2xl border border-ink/5 bg-white p-5 shadow-soft">
          <label className="text-xs font-medium text-ink/50">
            Établissement
          </label>

          <select
            value={establishmentId}
            onChange={e => setEstablishmentId(e.target.value)}
            className="mt-2 w-full max-w-md rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm text-ink outline-none"
          >
            {establishments.map(establishment => (
              <option
                key={establishment.id}
                value={establishment.id}
              >
                {establishment.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Clients fidélité"
          value={customers.length}
          icon={Users}
        />

        <Stat
          label="Points en circulation"
          value={totalPoints}
          icon={Coins}
        />

        <Stat
          label="Clients actifs"
          value={
            customers.filter(
              customer => customer.visit_count > 0
            ).length
          }
          icon={Star}
        />

        <Stat
          label="Récompenses disponibles"
          value={rewards.length}
          icon={Gift}
        />
      </div>

      {/* CLIENTS */}
      <section className="mt-6 rounded-2xl border border-ink/5 bg-white shadow-soft">
        <div className="flex flex-col justify-between gap-4 border-b border-ink/5 p-5 md:flex-row md:items-center md:p-7">
          <div>
            <h2 className="font-display text-xl text-forest">
              Mes clients
            </h2>

            <p className="mt-1 text-xs text-ink/45">
              Recherchez un client par son prénom ou son numéro.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un client..."
              className="w-full rounded-xl border border-ink/10 bg-[#fafaf7] py-2.5 pl-9 pr-3 text-xs outline-none focus:border-gold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left">
            <thead>
              <tr className="border-b border-ink/5 text-[10px] uppercase tracking-wider text-ink/40">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Téléphone</th>
                <th className="px-6 py-4">Points</th>
                <th className="px-6 py-4">Visites</th>
                <th className="px-6 py-4">Dernière visite</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.map(customer => (
                <tr
                  key={customer.id}
                  className="border-b border-ink/5 last:border-0"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm text-forest">
                      {customer.first_name || 'Client'}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-xs text-ink/55">
                    <span className="inline-flex items-center gap-2">
                      <Phone size={13} />
                      {customer.phone}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className="rounded-full bg-[#f4ead3] px-3 py-1 text-xs font-semibold text-forest">
                      ⭐ {customer.points_balance}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-xs text-ink/55">
                    {customer.visit_count}
                  </td>

                  <td className="px-6 py-4 text-xs text-ink/45">
                    {customer.last_visit_at
                      ? new Date(
                          customer.last_visit_at
                        ).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          setAmount('');
                          setInvoiceNumber('');
                          setPointsResponsibleCode('');
                          setShowPoints(customer);
                        }}
                        disabled={!programSettings.enabled}
                        className="rounded-lg bg-forest px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Ajouter
                      </button>

                      <button
                        onClick={() => {
                          setShowRewards(customer);
                          setSelectedReward(null);
                          setRewardCode('');
                          setInvoiceNumber('');
                          setInvoiceAmount('');
                          setPaymentMethod('CASH');
                          setShowRewardCode(false);
                        }}
                        disabled={
                          !programSettings.enabled ||
                          rewards.length === 0
                        }
                        className="rounded-lg border border-gold/30 bg-[#fdf9ef] px-3 py-2 text-[11px] font-semibold text-forest transition hover:bg-[#f4ead3] disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        Récompenses
                      </button>
                      <button
                        type="button"
                        onClick={() => void createRecoveryQr(customer)}
                        disabled={recoveryLoading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-ink/10 px-3 py-2 text-[11px] font-semibold text-ink/60 transition hover:border-gold/40 hover:text-gold disabled:opacity-40"
                      >
                        <QrCode size={13} /> Récupérer
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!filteredCustomers.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16 text-center text-sm text-ink/40"
                  >
                    {search
                      ? 'Aucun client trouvé.'
                      : 'Aucun client fidélité pour le moment.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* CARD NOTIFICATION MODAL */}
      {showNotificationModal && (
        <Modal
          title="Notification sur la carte"
          onClose={() => setShowNotificationModal(false)}
        >
          <div className="space-y-4">
            <div className="rounded-xl bg-[#f7f7f3] p-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f4ead3] text-gold">
                  <Bell size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-forest">Message client</p>
                  <p className="mt-1 text-[11px] leading-5 text-ink/45">
                    La notification apparaîtra directement dans la carte fidélité du client.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">Ciblage</label>
              <select
                value={notificationAudience}
                onChange={e => setNotificationAudience(e.target.value as typeof notificationAudience)}
                className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-gold"
              >
                <option value="ALL">Tous les clients ayant accepté les notifications</option>
                <option value="INTEREST">Par centre d’intérêt</option>
                <option value="FREQUENCY">Par fréquence de visite</option>
                <option value="POINTS">Par solde de points</option>
                <option value="VISITS">Par visites / récence</option>
                <option value="CUSTOMER">Un client précis</option>
              </select>
            </div>

            {notificationAudience === 'INTEREST' && (
              <div>
                <label className="text-xs font-medium text-ink/60">Centre d’intérêt</label>
                <select
                  value={notificationInterest}
                  onChange={e => setNotificationInterest(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-gold"
                >
                  <option value="">Sélectionner</option>
                  {notificationInterests.map(interest => (
                    <option key={interest} value={interest}>{interest}</option>
                  ))}
                </select>
              </div>
            )}

            {notificationAudience === 'FREQUENCY' && (
              <div>
                <label className="text-xs font-medium text-ink/60">Fréquence de visite</label>
                <select
                  value={notificationFrequency}
                  onChange={e => setNotificationFrequency(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-gold"
                >
                  <option value="">Sélectionner</option>
                  <option value="WEEKLY">Hebdomadaire</option>
                  <option value="MONTHLY">Mensuelle</option>
                  <option value="OCCASIONAL">Occasionnelle</option>
                </select>
              </div>
            )}

            {notificationAudience === 'POINTS' && (
              <div>
                <label className="text-xs font-medium text-ink/60">Minimum de points</label>
                <input
                  type="number"
                  min="0"
                  value={notificationMinPoints}
                  onChange={e => setNotificationMinPoints(e.target.value)}
                  placeholder="100"
                  className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                />
              </div>
            )}

            {notificationAudience === 'VISITS' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-ink/60">Minimum de visites</label>
                  <input
                    type="number"
                    min="0"
                    value={notificationMinVisits}
                    onChange={e => setNotificationMinVisits(e.target.value)}
                    placeholder="3"
                    className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-ink/60">Vu il y a moins de (jours)</label>
                  <input
                    type="number"
                    min="0"
                    value={notificationLastVisitDays}
                    onChange={e => setNotificationLastVisitDays(e.target.value)}
                    placeholder="30"
                    className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                  />
                </div>
              </div>
            )}

            {notificationAudience === 'CUSTOMER' && (
              <div>
                <label className="text-xs font-medium text-ink/60">Client</label>
                <select
                  value={notificationCustomerId}
                  onChange={e => setNotificationCustomerId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-gold"
                >
                  <option value="">Sélectionner</option>
                  {customers.filter(c => c.notification_consent).map(customer => (
                    <option key={customer.id} value={customer.id}>
                      {customer.first_name || 'Client'} · {customer.phone}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="rounded-xl border border-ink/5 bg-[#f7f7f3] px-4 py-3 text-xs text-ink/55">
              <strong className="text-forest">{notificationEligibleCustomers.length}</strong> client(s) ciblé(s).
              <span className="ml-1">Seuls les clients ayant accepté les notifications recevront le message.</span>
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">Type</label>
              <select
                value={notificationType}
                onChange={e => setNotificationType(e.target.value as typeof notificationType)}
                className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-gold"
              >
                <option value="INFO">Information</option>
                <option value="OFFER">Offre</option>
                <option value="REWARD">Récompense</option>
                <option value="POINTS">Points</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">Titre</label>
              <input
                value={notificationTitle}
                onChange={e => setNotificationTitle(e.target.value)}
                maxLength={120}
                placeholder="Ex. Nouvelle offre disponible"
                className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">Message</label>
              <textarea
                value={notificationMessage}
                onChange={e => setNotificationMessage(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="Écrivez le message qui apparaîtra sur la carte..."
                className="mt-2 w-full resize-none rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">Expiration (facultative)</label>
              <input
                type="datetime-local"
                value={notificationExpiresAt}
                onChange={e => setNotificationExpiresAt(e.target.value)}
                className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </div>

            <button
              type="button"
              onClick={() => void createNotification()}
              disabled={notificationSaving || !notificationTitle.trim() || !notificationMessage.trim()}
              className="w-full rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {notificationSaving ? 'Publication...' : 'Publier sur la carte'}
            </button>
          </div>
        </Modal>
      )}

      {recoveryQr && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-[#242424] bg-[#111111] p-6 text-center shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">Récupération</p>
                <h2 className="mt-1 font-display text-xl text-[#D4AF37]">Carte de {recoveryQr.name}</h2>
              </div>
              <button type="button" onClick={() => setRecoveryQr(null)} className="rounded-full border border-[#242424] p-2 text-ink/50 hover:text-ink" aria-label="Fermer">×</button>
            </div>
            <div className="mx-auto mt-5 w-fit rounded-3xl bg-white p-3 shadow-sm">
              <img src={recoveryQr.url} alt="QR code de récupération de carte" className="h-64 w-64" />
            </div>
            <p className="mt-4 text-sm font-semibold text-[#D4AF37]">Le client scanne ce QR avec son téléphone</p>
            <p className="mt-1 text-xs leading-5 text-[#F5F5DC]/45">Ce QR est valable 5 minutes et ne peut être utilisé qu'une seule fois.</p>
            <p className="mt-3 text-[10px] font-medium text-gold">Expiration : {new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(new Date(recoveryQr.expiresAt))}</p>
            <button
              type="button"
              onClick={() => void createRecoveryQr(recoveryQr.customer)}
              disabled={recoveryLoading}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 py-3 text-xs font-bold text-[#0D0D0D] transition hover:bg-[#E1C27A] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <QrCode size={15} />
              {recoveryLoading ? 'Génération du nouveau lien…' : 'Régénérer le lien / QR code'}
            </button>
            <p className="mt-2 text-[10px] leading-4 text-[#F5F5DC]/35">L’ancien lien reste à usage unique. Générer un nouveau QR ne réutilise pas l’ancien jeton.</p>
          </div>
        </div>
      )}

      {/* NEW CUSTOMER MODAL */}
      {showNewCustomer && (
        <Modal
          title="Nouveau client"
          onClose={() => setShowNewCustomer(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink/60">
                Prénom
              </label>

              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Mohamed"
                className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">
                Numéro de téléphone *
              </label>

              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="06 XX XX XX XX"
                className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </div>

            <button
              onClick={createCustomer}
              disabled={saving || !phone.trim()}
              className="w-full rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {saving ? 'Création...' : 'Créer le compte fidélité'}
            </button>
          </div>
        </Modal>
      )}

      {/* ADD POINTS MODAL */}
      {showPoints && (
        <Modal
          title="Ajouter des points"
          onClose={() => setShowPoints(null)}
        >
          <div className="space-y-5">
            <div className="rounded-xl bg-[#f7f7f3] p-4">
              <p className="text-xs text-ink/45">Client</p>

              <p className="mt-1 font-semibold text-forest">
                {showPoints.first_name || 'Client'}
              </p>

              <p className="mt-1 text-xs text-ink/50">
                {showPoints.phone}
              </p>

              <p className="mt-3 text-sm font-semibold text-gold">
                ⭐ {showPoints.points_balance} points
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">
                Montant de l'achat
              </label>

              <div className="relative mt-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="250"
                  className="w-full rounded-xl border border-ink/10 px-4 py-3 pr-16 text-sm outline-none focus:border-gold"
                />

                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink/40">
                  {programSettings.currency}
                </span>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">
                Numéro de facture (optionnel)
              </label>
              <input
                value={invoiceNumber}
                onChange={e => setInvoiceNumber(e.target.value)}
                placeholder="FAC-2026-001"
                className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">
                Code responsable *
              </label>
              <input
                type="password"
                value={pointsResponsibleCode}
                onChange={e => setPointsResponsibleCode(e.target.value)}
                placeholder="Code de validation"
                className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-center text-lg tracking-[0.25em] outline-none focus:border-gold"
              />
            </div>

            <div className="rounded-xl bg-[#f7f7f3] p-4">
              <div className="flex justify-between text-xs text-ink/50">
                <span>Règle du programme</span>

                <strong className="text-forest">
                  {programSettings.points_per_currency} pt /{' '}
                  {programSettings.currency}
                </strong>
              </div>
            </div>

            {Number(amount) > 0 && (
              <div className="rounded-xl border border-gold/30 bg-[#f4ead3] p-4">
                <div className="flex justify-between text-xs">
                  <span>Points gagnés</span>

                  <strong>
                    +
                    {Math.floor(
                      Number(amount) *
                        programSettings.points_per_currency
                    )}
                  </strong>
                </div>

                <div className="mt-2 flex justify-between text-sm font-semibold text-forest">
                  <span>Nouveau solde</span>

                  <span>
                    {showPoints.points_balance +
                      Math.floor(
                        Number(amount) *
                          programSettings.points_per_currency
                      )}{' '}
                    points
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={addPoints}
              disabled={
                saving ||
                Number(amount) <= 0 ||
                !pointsResponsibleCode.trim() ||
                !programSettings.enabled
              }
              className="w-full rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {saving ? 'Validation...' : 'Valider les points'}
            </button>
          </div>
        </Modal>
      )}

      {/* REWARDS MODAL */}
      {showRewards && !showRewardCode && (
        <Modal
          title="Récompenses"
          onClose={closeRewards}
        >
          <div className="space-y-5">
            <div className="rounded-xl bg-[#f7f7f3] p-4">
              <p className="text-xs text-ink/45">Client</p>

              <p className="mt-1 font-semibold text-forest">
                {showRewards.first_name || 'Client'}
              </p>

              <p className="mt-1 text-xs text-ink/50">
                {showRewards.phone}
              </p>

              <div className="mt-3 flex items-center gap-2">
                <Coins size={15} className="text-gold" />

                <span className="text-sm font-semibold text-gold">
                  {showRewards.points_balance} points disponibles
                </span>
              </div>
            </div>

            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-gold">
                Récompenses disponibles
              </p>

              <div className="space-y-3">
                {rewards.map(reward => {
                  const canRedeem =
                    showRewards.points_balance >=
                    reward.points_required;

                  return (
                    <div
                      key={reward.id}
                      className="rounded-xl border border-ink/5 bg-[#fafaf7] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f4ead3] text-gold">
                          <Gift size={18} />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-forest">
                            {reward.name}
                          </p>

                          {reward.description && (
                            <p className="mt-1 text-xs leading-5 text-ink/45">
                              {reward.description}
                            </p>
                          )}

                          <p className="mt-2 text-xs font-semibold text-gold">
                            ⭐ {reward.points_required} points
                          </p>

                          {!canRedeem && (
                            <p className="mt-1 text-[11px] text-red-500">
                              Il manque{' '}
                              {reward.points_required -
                                showRewards.points_balance}{' '}
                              points
                            </p>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          selectReward(showRewards, reward)
                        }
                        disabled={!canRedeem || redeeming}
                        className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        <CheckCircle2 size={15} />

                        {canRedeem
                          ? 'Utiliser la récompense'
                          : 'Points insuffisants'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* REWARD CODE MODAL */}
      {showRewardCode &&
        showRewards &&
        selectedReward && (
          <Modal
            title="Validation de la récompense"
            onClose={closeRewardCode}
          >
            <div className="space-y-5">
              <div className="rounded-xl border border-gold/30 bg-[#fdf9ef] p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4ead3] text-gold">
                    <LockKeyhole size={18} />
                  </div>

                  <div>
                    <p className="font-semibold text-forest">
                      Code de validation
                    </p>

                    <p className="mt-1 text-xs text-ink/50">
                      Saisissez le code remis par le responsable.
                    </p>
                  </div>
                </div>
              </div>

              <div className="rounded-xl bg-[#f7f7f3] p-4">
                <p className="text-xs text-ink/45">
                  Récompense sélectionnée
                </p>

                <p className="mt-1 font-semibold text-forest">
                  {selectedReward.name}
                </p>

                <p className="mt-2 text-xs font-semibold text-gold">
                  ⭐ {selectedReward.points_required} points
                </p>
              </div>

              <div>
                <label className="text-xs font-medium text-ink/60">
                  Code récompense
                </label>

                <input
                  type="password"
                  value={rewardCode}
                  onChange={e => setRewardCode(e.target.value)}
                  placeholder="Entrez le code"
                  autoFocus
                  disabled={redeeming}
                  className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-center text-lg tracking-[0.25em] outline-none focus:border-gold disabled:opacity-50"
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      redeemReward();
                    }
                  }}
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink/60">
                  Numéro de facture *
                </label>
                <input
                  value={invoiceNumber}
                  onChange={e => setInvoiceNumber(e.target.value)}
                  placeholder="FAC-2026-001"
                  disabled={redeeming}
                  className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink/60">
                  Montant de la facture *
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={invoiceAmount}
                  onChange={e => setInvoiceAmount(e.target.value)}
                  placeholder="250"
                  disabled={redeeming}
                  className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold disabled:opacity-50"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-ink/60">
                  Mode de paiement
                </label>
                <select
                  value={paymentMethod}
                  onChange={e => setPaymentMethod(e.target.value as 'CASH' | 'CARD' | 'OTHER')}
                  disabled={redeeming}
                  className="mt-2 w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-gold disabled:opacity-50"
                >
                  <option value="CASH">Espèces</option>
                  <option value="CARD">Carte bancaire</option>
                  <option value="OTHER">Autre</option>
                </select>
              </div>

              <div className="rounded-xl bg-[#f7f7f3] p-4">
                <div className="flex justify-between text-xs">
                  <span className="text-ink/50">
                    Client
                  </span>

                  <strong className="text-forest">
                    {showRewards.first_name || 'Client'}
                  </strong>
                </div>

                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-ink/50">
                    Solde actuel
                  </span>

                  <strong className="text-gold">
                    {showRewards.points_balance} points
                  </strong>
                </div>

                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-ink/50">
                    Nouveau solde
                  </span>

                  <strong className="text-forest">
                    {showRewards.points_balance -
                      selectedReward.points_required}{' '}
                    points
                  </strong>
                </div>
              </div>

              <button
                type="button"
                onClick={redeemReward}
                disabled={
                  redeeming ||
                  !rewardCode.trim() ||
                  !invoiceNumber.trim() ||
                  Number(invoiceAmount) <= 0
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-40"
              >
                <CheckCircle2 size={16} />

                {redeeming
                  ? 'Validation...'
                  : 'Valider la récompense'}
              </button>
            </div>
          </Modal>
        )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink/50">
            {label}
          </p>

          <p className="mt-3 font-display text-3xl text-forest">
            {value}
          </p>
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e5eee9] text-forest">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl text-forest">
            {title}
          </h2>

          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-[#f7f7f3] text-ink/50"
          >
            <X size={17} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
