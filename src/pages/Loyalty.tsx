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
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { defaultLoyaltyDesignConfig } from '@/components/LoyaltyCardVisual';
import { LoyaltyExperience } from '@/components/loyalty/LoyaltyExperience';
import { useAuth } from '@/contexts/AuthContext';
import LoyaltyCardRecoveryQr from '@/components/LoyaltyCardRecoveryQr';
import { DataLoadError } from '@/components/DataLoadError';

type Establishment = {
  id: string;
  name: string;
};

type LoyaltyCustomer = {
  id: string;
  establishment_id: string;
  phone: string;
  first_name: string;
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

type LoyaltyCardDesign = {
  template_id: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  button_color: string;
  border_radius: number;
  design_config: typeof defaultLoyaltyDesignConfig & { wallpaper_library?: string[] };
  published: boolean;
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
  const { user, loading: authLoading } = useAuth();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');

  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltyStats, setLoyaltyStats] = useState({
    customersCount: 0,
    pointsInCirculation: 0,
    activeCustomersCount: 0,
    rewardsCount: 0,
  });
  const [showPublishedCard, setShowPublishedCard] = useState(false);
  const [loyaltyDesign, setLoyaltyDesign] = useState<LoyaltyCardDesign>({
    template_id: 'luxury',
    primary_color: '#173D32',
    secondary_color: '#D3A84C',
    background_color: '#F7F7F3',
    text_color: '#173D32',
    button_color: '#173D32',
    border_radius: 24,
    design_config: defaultLoyaltyDesignConfig,
    published: false,
  });

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [redeeming, setRedeeming] = useState(false);

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
    if (authLoading || !user) return;
    void loadEstablishments();
  }, [authLoading, user]);

  useEffect(() => {
    if (establishmentId) {
      loadCustomers();
      loadProgramSettings();
      loadRewards();
      loadLoyaltyStats();
      loadPublishedCard();
    }
  }, [establishmentId]);

  async function loadEstablishments() {
    if (!user) return;

    setLoading(true);
    setLoadError('');

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
        const selectedKey = user?.id
          ? `tapmarrakech:selected-establishment:${user.id}`
          : null;
        const selectedId = selectedKey
          ? window.localStorage.getItem(selectedKey)
          : null;
        const selectedEstablishment = selectedId
          ? establishmentsData.find((item) => item.id === selectedId)
          : null;

        setEstablishmentId(
          selectedEstablishment?.id ?? establishmentsData[0].id
        );
      }
    } else {
      console.error('Erreur chargement établissements:', error);
      setLoadError('Impossible de charger les établissements.');
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
      setLoadError('Impossible de charger les clients fidélité.');
    }
  }

  async function loadLoyaltyStats() {
    if (!establishmentId) return;

    const { data, error } = await supabase.rpc('get_loyalty_dashboard_stats', {
      p_establishment_id: establishmentId,
    });

    if (error) {
      console.error('Erreur chargement statistiques fidélité:', error);
      setLoadError('Impossible de charger les statistiques fidélité.');
      setLoyaltyStats({
        customersCount: 0,
        pointsInCirculation: 0,
        activeCustomersCount: 0,
        rewardsCount: 0,
      });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    setLoyaltyStats({
      customersCount: Number(row?.customers_count ?? 0),
      pointsInCirculation: Number(row?.points_in_circulation ?? 0),
      activeCustomersCount: Number(row?.active_customers_count ?? 0),
      rewardsCount: Number(row?.rewards_count ?? 0),
    });
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
      if (error) setLoadError('Impossible de charger les paramètres fidélité.');
      setProgramSettings({
        points_per_currency: 1,
        currency: 'MAD',
        enabled: true,
      });
    }
  }

  async function loadPublishedCard() {
    if (!establishmentId) return;

    const { data, error } = await supabase.rpc('get_responsible_loyalty_card_config', {
      p_establishment_id: establishmentId,
    });

    if (error) {
      console.error('Erreur chargement carte fidélité publiée:', error);
      setLoadError('Impossible de charger la carte fidélité publiée.');
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return;

    setLoyaltyDesign({
      template_id: row.template_id ?? 'luxury',
      primary_color: row.primary_color ?? '#173D32',
      secondary_color: row.secondary_color ?? '#D3A84C',
      background_color: row.background_color ?? '#F7F7F3',
      text_color: row.text_color ?? '#173D32',
      button_color: row.button_color ?? '#173D32',
      border_radius: Number(row.border_radius ?? 24),
      design_config: {
        ...defaultLoyaltyDesignConfig,
        ...(row.design_config ?? {}),
      },
      published: Boolean(row.published),
    });
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
      setLoadError('Impossible de charger les récompenses fidélité.');
      setRewards([]);
    }
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
      {loadError && <DataLoadError message={loadError} onRetry={() => void loadEstablishments()} />}
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

        <div className="flex flex-wrap items-center gap-3">
          {establishmentId && (
            <LoyaltyCardRecoveryQr
              establishmentId={establishmentId}
              establishmentName={establishments.find((item) => item.id === establishmentId)?.name ?? 'Établissement'}
            />
          )}
          {establishmentId && (
            <button
              type="button"
              onClick={() => setShowPublishedCard(true)}
              className="flex w-fit items-center gap-2 rounded-xl border border-gold/30 bg-white px-4 py-2.5 text-xs font-semibold text-forest transition hover:bg-[#fdf9ef]"
            >
              <Gift size={16} />
              Voir la carte publiée
            </button>
          )}
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

      {/* PUBLISHED CARD PREVIEW */}
      {showPublishedCard && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5">
          <div className="max-h-[92vh] w-full max-w-[520px] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
                  Carte fidélité
                </p>
                <h2 className="mt-1 font-display text-2xl text-forest">
                  Version publiée
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPublishedCard(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-[#f7f7f3] text-ink/50"
              >
                <X size={17} />
              </button>
            </div>

            {!loyaltyDesign.published ? (
              <div className="rounded-2xl border border-dashed border-ink/10 bg-[#f7f7f3] p-8 text-center">
                <p className="font-semibold text-forest">Aucune carte publiée</p>
                <p className="mt-2 text-sm text-ink/45">
                  L’administrateur doit publier une version de la carte pour qu’elle apparaisse ici.
                </p>
              </div>
            ) : (
              <LoyaltyExperience
                config={{
                  type: loyaltyDesign.design_config.card_mode === 'STAMP' ? 'STAMP' : 'POINTS',
                  businessType: loyaltyDesign.design_config.business_type || 'restaurant',
                  establishmentName: establishments.find(item => item.id === establishmentId)?.name || 'Établissement',
                  logoUrl: loyaltyDesign.design_config.logo_url || null,
                  coverImageUrl:
                    loyaltyDesign.design_config.background_image_url ||
                    loyaltyDesign.design_config.wallpaper_library?.[0] ||
                    null,
                  primaryColor: loyaltyDesign.primary_color,
                  secondaryColor: loyaltyDesign.secondary_color,
                  backgroundColor: loyaltyDesign.background_color,
                  textColor: loyaltyDesign.text_color,
                  borderRadius: loyaltyDesign.border_radius,
                  customerName: 'Aperçu client',
                  pointsBalance: 720,
                  pointsGoal: Math.max(1000, rewards[rewards.length - 1]?.points_required ?? 1000),
                  visits: 6,
                  visitGoal: 10,
                  rewardName: loyaltyDesign.design_config.rewardName || rewards[0]?.name || 'Cadeau fidélité',
                  rewardDescription: loyaltyDesign.design_config.rewardDescription || rewards[0]?.description || null,
                  rewards: rewards.map(reward => ({
                    id: reward.id,
                    name: reward.name,
                    description: reward.description,
                    points_required: reward.points_required,
                    reward_type: 'GIFT',
                    discount_percent: null,
                    discount_max_amount: null,
                  })),
                  intro: loyaltyDesign.design_config.front_subtitle,
                  qrValue: '',
                  templateId: loyaltyDesign.template_id,
                  published: true,
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Clients fidélité"
          value={loyaltyStats.customersCount}
          icon={Users}
        />

        <Stat
          label="Points en circulation"
          value={loyaltyStats.pointsInCirculation}
          icon={Coins}
        />

        <Stat
          label="Clients actifs"
          value={loyaltyStats.activeCustomersCount}
          icon={Star}
        />

        <Stat
          label="Récompenses disponibles"
          value={loyaltyStats.rewardsCount}
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
