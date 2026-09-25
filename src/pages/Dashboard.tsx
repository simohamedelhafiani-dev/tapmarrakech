import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  ExternalLink,
  Globe2,
  Heart,
  Menu,
  QrCode,
  Settings,
  Sparkles,
  Wifi,
  CheckCircle2,
  Coins,
  Gift,
  MessageCircle,
  Users,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Establishment, Review } from '@/lib/types';
import { Stars } from '@/components/Stars';
import { getMySubscriptionAccess, type SubscriptionAccess } from '@/lib/subscriptionAccess';

type LoyaltyCustomer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  points_balance: number | null;
  total_points_earned: number | null;
  total_points_redeemed: number | null;
  visit_count: number | null;
  created_at: string;
  last_visit_at: string | null;
};

type LoyaltyTransaction = {
  id: string;
  establishment_id: string;
  customer_id: string;
  employee_id: string | null;
  points: number | null;
  amount: number | null;
  description: string | null;
  type: string;
  invoice_number: string | null;
  created_at: string;
};

type LoyaltyRedemption = {
  id: string;
  establishment_id: string;
  customer_id: string;
  reward_id: string;
  employee_id: string | null;
  points_used: number | null;
  invoice_number: string | null;
  invoice_amount: number | null;
  discount_amount: number | null;
  amount_paid: number | null;
  payment_method: string | null;
  redemption_type: string | null;
  reward_cost_mad: number | null;
  created_at: string;
};

const ranges = [
  {
    key: '7d',
    label: '7 derniers jours',
    days: 7,
  },
  {
    key: '30d',
    label: '30 derniers jours',
    days: 30,
  },
  {
    key: '3m',
    label: '3 mois',
    days: 90,
  },
  {
    key: '6m',
    label: '6 mois',
    days: 180,
  },
  {
    key: '12m',
    label: '12 mois',
    days: 365,
  },
];

function Stat({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Star;
  accent: string;
}) {
  return (
    <div className="tm-stat rounded-2xl border border-ink/5 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink/50">
            {label}
          </p>

          <p className="tm-stat-value mt-3 font-display text-3xl text-forest">
            {value}
          </p>
        </div>

        <div
          className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}
        >
          <Icon size={18} />
        </div>
      </div>

      <p className="tm-stat-detail mt-4 text-[11px] text-ink/45">
        {detail}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { user, role } = useAuth();

  const [places, setPlaces] = useState<Establishment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loyaltyCustomers, setLoyaltyCustomers] = useState<LoyaltyCustomer[]>([]);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loyaltyRedemptions, setLoyaltyRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [pointsPerCurrency, setPointsPerCurrency] = useState(1);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [profileName, setProfileName] = useState<string>('');
  const [period, setPeriod] = useState('30d');
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionAccess | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(false);
  const [serverAnalytics, setServerAnalytics] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    let active = true;

    const loadSubscription = async () => {
      if (!selectedEstablishmentId) {
        if (active) setSubscription(null);
        return;
      }

      setSubscriptionLoading(true);
      const accesses = await getMySubscriptionAccess(selectedEstablishmentId);

      if (active) {
        setSubscription(accesses[0] ?? null);
        setSubscriptionLoading(false);
      }
    };

    void loadSubscription();

    return () => {
      active = false;
    };
  }, [selectedEstablishmentId]);

  useEffect(() => {
    if (!user) {
      setPlaces([]);
      setReviews([]);
      setProfileName('');
      setSelectedEstablishmentId(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);

      try {
        /*
         * Charger le profil
         */
        const { data: profile, error: profileError } =
          await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) {
          console.error(
            'Erreur chargement profil:',
            profileError
          );
        }

        setProfileName(
          profile?.name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Utilisateur'
        );

        /*
         * Charger les établissements accessibles
         *
         * ADMIN :
         * → tous les établissements
         *
         * RESPONSABLE :
         * → uniquement ses établissements rattachés
         */
        const {
          data: establishments,
          error: establishmentsError,
        } = await supabase.rpc('get_my_establishments');

        if (establishmentsError) {
          console.error(
            'Erreur chargement établissements:',
            establishmentsError
          );

          setPlaces([]);
          setReviews([]);
          setSelectedEstablishmentId(null);
          setLoading(false);
          return;
        }

        const accessiblePlaces =
          (establishments ?? []) as Establishment[];

        setPlaces(accessiblePlaces);

        /*
         * Restaurer l'établissement sélectionné.
         *
         * Si aucun choix n'a encore été enregistré, on utilise
         * le premier établissement accessible.
         *
         * Si l'ancien choix n'existe plus ou n'est plus accessible,
         * on revient automatiquement au premier établissement.
         */
        const storageKey = `tapmarrakech:selected-establishment:${user.id}`;
        const storedId = window.localStorage.getItem(storageKey);

        const validStoredPlace = accessiblePlaces.find(
          (place) => place.id === storedId
        );

        const nextId =
          validStoredPlace?.id ??
          accessiblePlaces[0]?.id ??
          null;

        setSelectedEstablishmentId(nextId);

        if (nextId) {
          window.localStorage.setItem(storageKey, nextId);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.error(
          'Erreur inattendue dashboard:',
          error
        );

        setPlaces([]);
        setReviews([]);
        setSelectedEstablishmentId(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, role]);

  /*
   * Charger uniquement les avis de l'établissement sélectionné.
   *
   * Cette séparation est importante pour que les statistiques,
   * le graphique et les derniers retours correspondent toujours
   * à l'établissement actuellement choisi.
   */
  useEffect(() => {
    let active = true;

    const loadReviews = async () => {
      if (!selectedEstablishmentId) {
        setReviews([]);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from('reviews')
        .select(
          '*, establishment:establishments(name)'
        )
        .eq('establishment_id', selectedEstablishmentId)
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Erreur chargement avis:',
          error
        );

        if (active) {
          setReviews([]);
        }

        return;
      }

      if (active) {
        setReviews((data as Review[]) ?? []);
      }
    };

    loadReviews();

    return () => {
      active = false;
    };
  }, [selectedEstablishmentId]);

  useEffect(() => {
    let active = true;

    const loadLoyalty = async () => {
      if (!selectedEstablishmentId) {
        setLoyaltyCustomers([]);
        setLoyaltyTransactions([]);
        setLoyaltyRedemptions([]);
        return;
      }

      setLoyaltyLoading(true);

      const { data, error } = await supabase
        .from('loyalty_customers')
        .select(
          'id, first_name, last_name, phone, points_balance, total_points_earned, total_points_redeemed, visit_count, created_at, last_visit_at'
        )
        .eq('establishment_id', selectedEstablishmentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement fidélité:', error);
        if (active) setLoyaltyCustomers([]);
      } else if (active) {
        setLoyaltyCustomers((data as LoyaltyCustomer[]) ?? []);
      }

      if (active) setLoyaltyLoading(false);
    };

    loadLoyalty();

    return () => {
      active = false;
    };
  }, [selectedEstablishmentId]);

  useEffect(() => {
    let active = true;

    const loadLoyaltySettings = async () => {
      if (!selectedEstablishmentId) {
        setPointsPerCurrency(1);
        return;
      }

      const { data, error } = await supabase
        .from('loyalty_settings')
        .select('points_per_currency')
        .eq('establishment_id', selectedEstablishmentId)
        .maybeSingle();

      if (error) {
        console.error('Erreur chargement paramètres fidélité:', error);
        if (active) setPointsPerCurrency(1);
      } else if (active) {
        setPointsPerCurrency(Number(data?.points_per_currency || 1));
      }
    };

    loadLoyaltySettings();

    return () => {
      active = false;
    };
  }, [selectedEstablishmentId]);

  useEffect(() => {
    let active = true;

    const loadLoyaltyTransactions = async () => {
      if (!selectedEstablishmentId) {
        setLoyaltyTransactions([]);
        return;
      }

      setTransactionsLoading(true);

      const { data, error } = await supabase
        .from('loyalty_transactions')
        .select('id, establishment_id, customer_id, employee_id, points, amount, description, type, invoice_number, created_at')
        .eq('establishment_id', selectedEstablishmentId)
        .eq('type', 'EARN')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement transactions fidélité:', error);
        if (active) setLoyaltyTransactions([]);
      } else if (active) {
        setLoyaltyTransactions((data as LoyaltyTransaction[]) ?? []);
      }

      if (active) setTransactionsLoading(false);
    };

    loadLoyaltyTransactions();

    return () => {
      active = false;
    };
  }, [selectedEstablishmentId]);

  useEffect(() => {
    let active = true;

    const loadLoyaltyRedemptions = async () => {
      if (!selectedEstablishmentId) {
        setLoyaltyRedemptions([]);
        return;
      }

      setRedemptionsLoading(true);

      const { data, error } = await supabase
        .from('loyalty_redemptions')
        .select('id, establishment_id, customer_id, reward_id, employee_id, points_used, invoice_number, invoice_amount, discount_amount, amount_paid, payment_method, redemption_type, reward_cost_mad, created_at')
        .eq('establishment_id', selectedEstablishmentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement récompenses utilisées:', error);
        if (active) setLoyaltyRedemptions([]);
      } else if (active) {
        setLoyaltyRedemptions((data as LoyaltyRedemption[]) ?? []);
      }

      if (active) setRedemptionsLoading(false);
    };

    loadLoyaltyRedemptions();

    return () => {
      active = false;
    };
  }, [selectedEstablishmentId]);

  const selected =
    ranges.find((range) => range.key === period) ??
    ranges[0];

  const chart = useMemo(() => {
    const now = new Date();
    const bucketDays = Math.max(1, Math.ceil(selected.days / 7));

    return Array.from({ length: 7 }, (_, index) => {
      const end = new Date(now);
      end.setDate(now.getDate() - (6 - index) * bucketDays);

      const start = new Date(end);
      start.setDate(end.getDate() - bucketDays);

      const rows = reviews.filter((review) => {
        const date = new Date(review.created_at);
        return date >= start && date <= end;
      });

      return {
        name: selected.days <= 7 ? `${index + 1}` : `P${index + 1}`,
        total: rows.length,
        positive: rows.filter((review) => review.rating >= 4).length,
        negative: rows.filter((review) => review.rating <= 3).length,
      };
    });
  }, [reviews, selected.days]);

  const latest = reviews.slice(0, 4);

  const analytics = useMemo(() => {
    const now = new Date();
    const currentStart = new Date(now);
    currentStart.setDate(currentStart.getDate() - selected.days);
    const previousStart = new Date(currentStart);

    const currentReviews = reviews.filter((review) => new Date(review.created_at) >= currentStart);
    const previousReviews = reviews.filter((review) => {
      const date = new Date(review.created_at);
      return date >= previousStart && date < currentStart;
    });

    const currentRegistrations = loyaltyCustomers.filter((customer) => new Date(customer.created_at) >= currentStart);
    const previousRegistrations = loyaltyCustomers.filter((customer) => {
      const date = new Date(customer.created_at);
      return date >= previousStart && date < currentStart;
    });

    const totalCustomers = loyaltyCustomers.length;
    const returningCustomers = loyaltyCustomers.filter((customer) => Number(customer.visit_count || 0) >= 2).length;
    const activeCustomers = loyaltyCustomers.filter((customer) => {
      if (!customer.last_visit_at) return false;
      return new Date(customer.last_visit_at) >= currentStart;
    }).length;
    const pointsEarned = loyaltyCustomers.reduce((sum, customer) => sum + Number(customer.total_points_earned || 0), 0);
    const pointsRedeemed = loyaltyCustomers.reduce((sum, customer) => sum + Number(customer.total_points_redeemed || 0), 0);
    const visits = loyaltyCustomers.reduce((sum, customer) => sum + Number(customer.visit_count || 0), 0);

    const currentTransactions = loyaltyTransactions.filter((transaction) => new Date(transaction.created_at) >= currentStart);
    const previousTransactions = loyaltyTransactions.filter((transaction) => {
      const date = new Date(transaction.created_at);
      return date >= previousStart && date < currentStart;
    });

    const currentRevenue = currentTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const previousRevenue = previousTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const totalRevenue = loyaltyTransactions.reduce((sum, transaction) => sum + Number(transaction.amount || 0), 0);
    const averageBasket = currentTransactions.length ? currentRevenue / currentTransactions.length : 0;

    const currentRedemptions = loyaltyRedemptions.filter((redemption) => new Date(redemption.created_at) >= currentStart);
    const previousRedemptions = loyaltyRedemptions.filter((redemption) => {
      const date = new Date(redemption.created_at);
      return date >= previousStart && date < currentStart;
    });

    const pointsRedeemedOnPeriod = currentRedemptions.reduce(
      (sum, redemption) => sum + Number(redemption.points_used || 0),
      0
    );
    const previousPointsRedeemedOnPeriod = previousRedemptions.reduce(
      (sum, redemption) => sum + Number(redemption.points_used || 0),
      0
    );

    const rewardValueOnPeriod = pointsPerCurrency > 0
      ? pointsRedeemedOnPeriod / pointsPerCurrency
      : 0;

    const previousRewardValue = pointsPerCurrency > 0
      ? previousPointsRedeemedOnPeriod / pointsPerCurrency
      : 0;

    const redemptionRevenue = currentRedemptions.reduce(
      (sum, redemption) => sum + Number(redemption.amount_paid ?? redemption.invoice_amount ?? 0),
      0
    );

    const rewardCostOnPeriod = currentRedemptions.reduce(
      (sum, redemption) => sum + Number(redemption.reward_cost_mad || 0),
      0
    );

    const netContribution = redemptionRevenue - rewardCostOnPeriod;
    const realROI = rewardCostOnPeriod > 0
      ? (netContribution / rewardCostOnPeriod) * 100
      : null;

    const rewardEfficiency = rewardValueOnPeriod > 0
      ? redemptionRevenue / rewardValueOnPeriod
      : 0;

    const customerMap = new Map(
      loyaltyCustomers.map((customer) => [customer.id, customer])
    );

    const topClients = Array.from(
      currentTransactions.reduce((map, transaction) => {
        const existing = map.get(transaction.customer_id) ?? {
          customerId: transaction.customer_id,
          revenue: 0,
          visits: 0,
          points: 0,
        };

        existing.revenue += Number(transaction.amount || 0);
        existing.visits += 1;
        existing.points += Number(transaction.points || 0);
        map.set(transaction.customer_id, existing);
        return map;
      }, new Map<string, { customerId: string; revenue: number; visits: number; points: number }>())
      .values()
    )
      .map((item) => ({
        ...item,
        customer: customerMap.get(item.customerId),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    const growth = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return ((current - previous) / previous) * 100;
    };

    return {
      currentReviews: currentReviews.length,
      reviewGrowth: growth(currentReviews.length, previousReviews.length),
      currentRegistrations: currentRegistrations.length,
      registrationGrowth: growth(currentRegistrations.length, previousRegistrations.length),
      returningRate: totalCustomers ? (returningCustomers / totalCustomers) * 100 : 0,
      activeRate: totalCustomers ? (activeCustomers / totalCustomers) * 100 : 0,
      redemptionRate: pointsEarned ? (pointsRedeemed / pointsEarned) * 100 : 0,
      visits,
      returningCustomers,
      activeCustomers,
      pointsEarned,
      pointsRedeemed,
      currentRevenue,
      previousRevenue,
      revenueGrowth: growth(currentRevenue, previousRevenue),
      totalRevenue,
      currentTransactions: currentTransactions.length,
      averageBasket,
      currentRedemptions: currentRedemptions.length,
      previousRedemptions: previousRedemptions.length,
      redemptionGrowth: growth(currentRedemptions.length, previousRedemptions.length),
      pointsRedeemedOnPeriod,
      rewardValueOnPeriod,
      previousRewardValue,
      redemptionRevenue,
      rewardEfficiency,
      rewardCostOnPeriod,
      netContribution,
      realROI,
      topClients,
      periodDays: selected.days,
    };
  }, [reviews, loyaltyCustomers, loyaltyTransactions, loyaltyRedemptions, pointsPerCurrency, selected.days]);

  useEffect(() => {
    let active = true;

    const loadServerStats = async () => {
      if (!selectedEstablishmentId) {
        setServerAnalytics(null);
        return;
      }

      const days = ranges.find((range) => range.key === period)?.days ?? 30;
      const { data, error } = await supabase.rpc('get_dashboard_program_stats', {
        p_establishment_id: selectedEstablishmentId,
        p_days: days,
      });

      if (!active) return;

      if (error) {
        console.error('Erreur statistiques dashboard:', error);
        setServerAnalytics(null);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      setServerAnalytics({
        totalReviews: Number(row?.reviews_count ?? 0),
        averageRating: Number(row?.average_rating ?? 0),
        positive: Number(row?.positive_reviews ?? 0),
        negative: Number(row?.negative_reviews ?? 0),
        pending: Number(row?.pending_negative_reviews ?? 0),
        currentReviews: Number(row?.current_reviews ?? 0),
        reviewGrowth: Number(row?.review_growth ?? 0),
        currentRegistrations: Number(row?.current_registrations ?? 0),
        registrationGrowth: Number(row?.registration_growth ?? 0),
        returningRate: Number(row?.returning_rate ?? 0),
        returningCustomers: Number(row?.returning_customers ?? 0),
        activeRate: Number(row?.active_rate ?? 0),
        activeCustomers: Number(row?.active_customers ?? 0),
        redemptionRate: Number(row?.redemption_rate ?? 0),
        pointsEarned: Number(row?.points_earned ?? 0),
        pointsRedeemed: Number(row?.points_redeemed ?? 0),
        visits: Number(row?.visits ?? 0),
        currentRevenue: Number(row?.current_revenue ?? 0),
        previousRevenue: Number(row?.previous_revenue ?? 0),
        revenueGrowth: Number(row?.revenue_growth ?? 0),
        totalRevenue: Number(row?.total_revenue ?? 0),
        currentTransactions: Number(row?.current_transactions ?? 0),
        averageBasket: Number(row?.average_basket ?? 0),
        currentRedemptions: Number(row?.current_redemptions ?? 0),
        previousRedemptions: Number(row?.previous_redemptions ?? 0),
        redemptionGrowth: Number(row?.redemption_growth ?? 0),
        pointsRedeemedOnPeriod: Number(row?.points_redeemed_on_period ?? 0),
        rewardValueOnPeriod: Number(row?.reward_value_on_period ?? 0),
        previousRewardValue: Number(row?.previous_reward_value ?? 0),
        redemptionRevenue: Number(row?.redemption_revenue ?? 0),
        rewardEfficiency: Number(row?.reward_efficiency ?? 0),
        rewardCostOnPeriod: Number(row?.reward_cost_on_period ?? 0),
        netContribution: Number(row?.net_contribution ?? 0),
        realROI: row?.real_roi == null ? 0 : Number(row.real_roi),
      });
    };

    void loadServerStats();

    return () => {
      active = false;
    };
  }, [selectedEstablishmentId, period]);

  const isResponsible = role === 'responsible';

  const displayAnalytics = {
    ...analytics,
    ...(serverAnalytics ?? {}),
  };


  const selectedEstablishment =
    places.find(
      (place) => place.id === selectedEstablishmentId
    ) ?? null;

  const establishmentName = selectedEstablishment?.name ?? null;

  const changeEstablishment = (establishmentId: string) => {
    setSelectedEstablishmentId(establishmentId);

    if (user?.id) {
      const storageKey = `tapmarrakech:selected-establishment:${user.id}`;
      window.localStorage.setItem(
        storageKey,
        establishmentId
      );
    }

    window.dispatchEvent(
      new CustomEvent('tapmarrakech:establishment-changed', {
        detail: {
          establishmentId,
        },
      })
    );
  };

  const roleLabel =
    role === 'admin'
      ? 'Administrateur'
      : role === 'responsible'
        ? 'Responsable'
        : role === 'employee'
          ? 'Employé'
          : 'Compte';

  if (loading) {
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
            {roleLabel}
          </p>

          {places.length > 0 && (
            <div className="mt-3">
              <label
                htmlFor="dashboard-establishment"
                className="sr-only"
              >
                Établissement actif
              </label>

              <select
                id="dashboard-establishment"
                value={selectedEstablishmentId ?? ''}
                onChange={(event) =>
                  changeEstablishment(event.target.value)
                }
                className="max-w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-forest shadow-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              >
                {places.map((place) => (
                  <option
                    key={place.id}
                    value={place.id}
                  >
                    {place.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isResponsible && establishmentName && (
            <p className="mt-2 text-lg font-semibold text-forest">
              {establishmentName}
            </p>
          )}

          <h1 className="mt-2 font-display text-4xl text-forest">
            Bonjour {profileName} 👋
          </h1>

          <p className="mt-2 text-sm text-ink/50">
            {establishmentName
              ? `Voici ce qui se passe dans votre établissement ${establishmentName}.`
              : 'Voici ce qui se passe dans vos établissements.'}
          </p>
        </div>

        {!isResponsible && (
          <Link
            to="/dashboard/establishments"
            className="flex w-fit items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-xs font-semibold text-forest transition hover:border-gold"
          >
            Gérer mes établissements
            <ArrowUpRight size={15} />
          </Link>
        )}
      </div>

      {isResponsible && (
        <section className="mb-8 overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-soft">
          <div className="flex flex-col justify-between gap-5 p-5 md:flex-row md:items-center md:p-7">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Mon abonnement</p>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <h2 className="font-display text-2xl text-forest">
                  {subscriptionLoading ? 'Chargement…' : subscription?.plan_name || 'Aucun abonnement'}
                </h2>
                {!subscriptionLoading && subscription && (
                  <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${
                    subscription.subscription_status === 'trial'
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {subscription.subscription_status === 'trial' ? 'Période d’essai' : 'Actif'}
                  </span>
                )}
              </div>
              <p className="mt-2 text-sm text-ink/45">
                {subscription
                  ? subscription.subscription_status === 'trial'
                    ? `Essai de ${subscription.trial_days} jours · jusqu’au ${subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'}`
                    : `${subscription.plan_price_mad.toLocaleString('fr-FR')} MAD / ${subscription.plan_interval === 'year' ? 'an' : 'mois'} · jusqu’au ${subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'}`
                  : 'Aucun pack n’est actuellement attribué à cet établissement.'}
              </p>
            </div>

            <div className="min-w-[180px] rounded-xl bg-[#f7f7f3] px-4 py-3 text-right">
              <p className="text-[10px] uppercase tracking-[0.12em] text-ink/35">Fonctionnalités</p>
              <p className="mt-1 text-sm font-semibold text-forest">
                {subscription ? subscription.features.length : 0} activées
              </p>
            </div>
          </div>
        </section>

      )}

      {/* ACCÈS RAPIDES */}

      <section className="mb-8 rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              Navigation
            </p>
            <h2 className="mt-1 font-display text-2xl text-forest">
              Accès rapides
            </h2>
            <p className="mt-1 text-xs text-ink/45">
              Toutes les fonctions principales de l’établissement sélectionné.
            </p>
          </div>
          {establishmentName && (
            <span className="rounded-full bg-[#f7f7f3] px-3 py-1.5 text-[10px] font-semibold text-forest">
              {establishmentName}
            </span>
          )}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: 'Établissement', description: 'Profil, logo et informations', to: '/dashboard/establishments', icon: Building2 },
            { label: 'Avis clients', description: 'Avis, réponses et suivi', to: '/dashboard/reviews', icon: MessageCircle },
            { label: 'Analyse IA', description: 'Comprendre les retours clients', to: '/dashboard/reviews', icon: Sparkles },
            { label: 'Analytics', description: 'Performance et indicateurs', to: '/dashboard/analytics', icon: BarChart3 },
            { label: 'Fidélité', description: 'Clients, points et récompenses', to: '/dashboard/loyalty', icon: Heart },
            { label: 'Équipe', description: 'Responsables et employés', to: '/dashboard/establishments', icon: Users },
            { label: 'Menu digital', description: 'Catégories, plats et tarifs', to: '/dashboard/menu', icon: Menu },
            { label: 'Wi-Fi', description: 'Accès Wi-Fi de l’établissement', to: '/dashboard/establishments', icon: Wifi },
            { label: 'Promotions', description: 'Offres et promotions', to: '/dashboard/establishments', icon: Gift },
            { label: 'Paramètres fidélité', description: 'Règles, points et récompenses', to: '/dashboard/loyalty/settings', icon: Settings },
            { label: 'Page publique', description: 'Voir la page client', to: establishmentName && selectedEstablishmentId ? `/r/${places.find((p) => p.id === selectedEstablishmentId)?.slug ?? ''}` : '/dashboard/establishments', icon: Globe2, external: true },
            { label: 'QR Code', description: 'Accéder aux supports clients', to: '/dashboard/establishments', icon: QrCode },
          ].map((shortcut) => {
            const Icon = shortcut.icon;
            return (
              <Link
                key={shortcut.label}
                to={shortcut.to}
                target={shortcut.external ? '_blank' : undefined}
                rel={shortcut.external ? 'noreferrer' : undefined}
                className="group flex min-h-[92px] items-start gap-3 rounded-xl border border-ink/5 bg-[#fdfdfb] p-4 transition hover:-translate-y-0.5 hover:border-gold/40 hover:bg-white hover:shadow-sm"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e5eee9] text-forest transition group-hover:bg-[#f4ead3] group-hover:text-gold">
                  <Icon size={18} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-forest">
                    {shortcut.label}
                    {shortcut.external && <ExternalLink size={12} className="text-ink/30" />}
                  </span>
                  <span className="mt-1 block text-[11px] leading-4 text-ink/45">
                    {shortcut.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* STATISTIQUES */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Avis reçus"
          value={displayAnalytics.totalReviews}
          detail="Depuis le début"
          icon={MessageCircle}
          accent="bg-[#f4ead3] text-gold"
        />

        <Stat
          label="Note moyenne"
          value={displayAnalytics.totalReviews ? displayAnalytics.averageRating.toFixed(1) : '—'}
          detail="Sur 5 étoiles"
          icon={Star}
          accent="bg-[#e5eee9] text-forest"
        />

        <Stat
          label="Avis positifs"
          value={positive}
          detail={
            reviews.length
              ? `${Math.round(
                  (positive / reviews.length) * 100
                )}% du total`
              : 'Pas encore de données'
          }
          icon={TrendingUp}
          accent="bg-[#e5eee9] text-forest"
        />

        <Stat
          label="Retours négatifs"
          value={displayAnalytics.negative}
          detail="Notes de 1 à 3 étoiles"
          icon={TrendingDown}
          accent="bg-[#f4ead3] text-gold"
        />

        <Stat
          label="À traiter"
          value={displayAnalytics.pending}
          detail="Retours en attente"
          icon={CheckCircle2}
          accent="bg-[#f4e4e1] text-[#a15c50]"
        />
      </div>

      {/* PILOTAGE DU PROGRAMME */}

      <section className="mt-6 rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#e5eee9] text-forest">
                <BarChart3 size={17} />
              </div>
              <div>
                <h2 className="font-display text-xl text-forest">Pilotage du programme</h2>
                <p className="text-xs text-ink/45">Les chiffres clés pour mesurer le développement de votre programme.</p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="hidden rounded-lg bg-[#f7f7f3] px-3 py-2 text-[11px] font-semibold text-ink/50 sm:inline-block">
              Comparaison avec la période précédente
            </span>
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="rounded-lg border border-ink/10 bg-[#fafaf7] px-3 py-2 text-xs font-semibold text-ink/65 outline-none focus:border-forest"
              aria-label="Choisir la période d'analyse"
            >
              {ranges.map((range) => (
                <option key={range.key} value={range.key}>
                  {range.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-ink/5 bg-[#f7f7f3] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-ink/50">Nouveaux clients</p>
              <Users size={17} className="text-forest" />
            </div>
            <p className="mt-3 font-display text-3xl text-forest">{loyaltyLoading ? '—' : displayAnalytics.currentRegistrations}</p>
            <p className="mt-2 text-xs text-ink/40">inscriptions sur la période sélectionnée</p>
            <div className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-forest">
              <TrendingUp size={14} />
              {loyaltyLoading ? '—' : `${displayAnalytics.registrationGrowth >= 0 ? '+' : ''}${displayAnalytics.registrationGrowth.toFixed(1)} %`}
              <span className="font-normal text-ink/35">vs période précédente</span>
            </div>
          </div>

          <div className="rounded-2xl border border-ink/5 bg-[#f7f7f3] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-ink/50">Taux de retour</p>
              <TrendingUp size={17} className="text-forest" />
            </div>
            <p className="mt-3 font-display text-3xl text-forest">{loyaltyLoading ? '—' : `${displayAnalytics.returningRate.toFixed(1)} %`}</p>
            <p className="mt-2 text-xs text-ink/40">clients ayant effectué au moins 2 visites</p>
            <p className="mt-4 text-xs font-semibold text-ink/55">{loyaltyLoading ? '—' : `${displayAnalytics.returningCustomers} clients concernés`}</p>
          </div>

          <div className="rounded-2xl border border-ink/5 bg-[#f7f7f3] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-ink/50">Clients actifs</p>
              <CheckCircle2 size={17} className="text-forest" />
            </div>
            <p className="mt-3 font-display text-3xl text-forest">{loyaltyLoading ? '—' : `${displayAnalytics.activeRate.toFixed(1)} %`}</p>
            <p className="mt-2 text-xs text-ink/40">ayant visité l’établissement pendant la période sélectionnée</p>
            <p className="mt-4 text-xs font-semibold text-ink/55">{loyaltyLoading ? '—' : `${displayAnalytics.activeCustomers} clients actifs`}</p>
          </div>

          <div className="rounded-2xl border border-ink/5 bg-[#f7f7f3] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-medium text-ink/50">Utilisation des points</p>
              <Coins size={17} className="text-gold" />
            </div>
            <p className="mt-3 font-display text-3xl text-forest">{loyaltyLoading ? '—' : `${displayAnalytics.redemptionRate.toFixed(1)} %`}</p>
            <p className="mt-2 text-xs text-ink/40">part des points gagnés déjà utilisés</p>
            <p className="mt-4 text-xs font-semibold text-ink/55">{loyaltyLoading ? '—' : `${displayAnalytics.pointsRedeemed.toLocaleString('fr-FR')} / ${displayAnalytics.pointsEarned.toLocaleString('fr-FR')} pts`}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-forest p-5 text-white">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Visites cumulées</p>
            <p className="mt-2 font-display text-3xl">{loyaltyLoading ? '—' : displayAnalytics.visits.toLocaleString('fr-FR')}</p>
            <p className="mt-1 text-xs text-white/45">visites enregistrées dans le programme</p>
          </div>
          <div className="rounded-2xl border border-ink/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">CA fidélité cumulé</p>
            <p className="mt-2 font-display text-3xl text-forest">{transactionsLoading ? '—' : `${displayAnalytics.totalRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH`}</p>
            <p className="mt-1 text-xs text-ink/40">depuis le début des transactions enregistrées</p>
          </div>
          <div className="rounded-2xl border border-ink/5 p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Avis sur la période</p>
            <p className="mt-2 font-display text-3xl text-forest">{displayAnalytics.currentReviews}</p>
            <p className="mt-1 text-xs text-ink/40">{displayAnalytics.reviewGrowth >= 0 ? '+' : ''}{displayAnalytics.reviewGrowth.toFixed(1)} % vs la période précédente</p>
          </div>
          <div className="rounded-2xl border border-gold/20 bg-[#fdf9ef] p-5">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">Chiffre généré</p>
              <TrendingUp size={17} className="text-gold" />
            </div>
            <p className="mt-2 font-display text-3xl text-forest">
              {transactionsLoading ? '—' : `${displayAnalytics.currentRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH`}
            </p>
            <p className="mt-1 text-xs text-ink/45">CA généré par les achats fidélité sur la période sélectionnée</p>
            <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="font-semibold text-forest">
                {transactionsLoading ? '—' : `${displayAnalytics.revenueGrowth >= 0 ? '+' : ''}${displayAnalytics.revenueGrowth.toFixed(1)} %`}
              </span>
              <span className="text-ink/35">vs la période précédente</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3 border-t border-gold/10 pt-3">
              <div>
                <p className="text-[10px] text-ink/35">Transactions</p>
                <p className="mt-1 text-sm font-semibold text-forest">{transactionsLoading ? '—' : displayAnalytics.currentTransactions}</p>
              </div>
              <div>
                <p className="text-[10px] text-ink/35">Panier moyen</p>
                <p className="mt-1 text-sm font-semibold text-forest">{transactionsLoading ? '—' : `${displayAnalytics.averageBasket.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH`}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROI FIDÉLITÉ */}

      <section className="mt-6 rounded-2xl border border-gold/20 bg-[#fdf9ef] p-5 shadow-soft md:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              ROI fidélité
            </p>
            <h2 className="mt-1 font-display text-2xl text-forest">
              Valeur créée par le programme
            </h2>
            <p className="mt-1 text-xs text-ink/45">
              Mesure l’activité commerciale associée aux clients fidélité et aux récompenses utilisées.
            </p>
          </div>
          <div className="rounded-xl border border-gold/20 bg-white px-4 py-3 text-right">
            <p className="text-[10px] uppercase tracking-[0.12em] text-ink/35">ROI réel des récompenses</p>
            <p className="mt-1 font-display text-2xl text-forest">
              {redemptionsLoading
                ? '—'
                : displayAnalytics.realROI === null
                  ? '—'
                  : `${displayAnalytics.realROI.toFixed(0)} %`}
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl bg-white p-5">
            <p className="text-xs font-medium text-ink/50">Récompenses utilisées</p>
            <p className="mt-3 font-display text-3xl text-forest">
              {redemptionsLoading ? '—' : displayAnalytics.currentRedemptions}
            </p>
            <p className="mt-2 text-xs text-ink/40">
              {redemptionsLoading
                ? '—'
                : `${displayAnalytics.redemptionGrowth >= 0 ? '+' : ''}${displayAnalytics.redemptionGrowth.toFixed(1)} % vs période précédente`}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5">
            <p className="text-xs font-medium text-ink/50">Points consommés</p>
            <p className="mt-3 font-display text-3xl text-forest">
              {redemptionsLoading ? '—' : displayAnalytics.pointsRedeemedOnPeriod.toLocaleString('fr-FR')}
            </p>
            <p className="mt-2 text-xs text-ink/40">sur la période sélectionnée</p>
          </div>

          <div className="rounded-2xl bg-white p-5">
            <p className="text-xs font-medium text-ink/50">Valeur des points</p>
            <p className="mt-3 font-display text-3xl text-forest">
              {redemptionsLoading
                ? '—'
                : `${displayAnalytics.rewardValueOnPeriod.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH`}
            </p>
            <p className="mt-2 text-xs text-ink/40">
              équivalent monétaire selon le barème de points
            </p>
          </div>

          <div className="rounded-2xl bg-forest p-5 text-white">
            <p className="text-xs font-medium text-white/55">CA lié aux récompenses</p>
            <p className="mt-3 font-display text-3xl">
              {redemptionsLoading
                ? '—'
                : `${displayAnalytics.redemptionRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH`}
            </p>
            <p className="mt-2 text-xs text-white/45">
              montant payé lors des utilisations
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5">
            <p className="text-xs font-medium text-ink/50">Coût réel des récompenses</p>
            <p className="mt-3 font-display text-3xl text-forest">
              {redemptionsLoading
                ? '—'
                : `${displayAnalytics.rewardCostOnPeriod.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH`}
            </p>
            <p className="mt-2 text-xs text-ink/40">coût enregistré au moment de chaque utilisation</p>
          </div>

          <div className="rounded-2xl bg-[#f4ead3] p-5">
            <p className="text-xs font-medium text-ink/50">Contribution nette</p>
            <p className="mt-3 font-display text-3xl text-forest">
              {redemptionsLoading
                ? '—'
                : `${displayAnalytics.netContribution.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH`}
            </p>
            <p className="mt-2 text-xs text-ink/40">CA récompenses − coût réel des récompenses</p>
          </div>
        </div>

        <div className="mt-5 rounded-xl border border-gold/15 bg-white px-4 py-3 text-xs leading-5 text-ink/50">
          <strong className="text-forest">ROI réel :</strong> calculé sur les utilisations enregistrées avec leur coût réel :
          <strong className="text-forest"> (CA lié aux récompenses − coût des récompenses) ÷ coût des récompenses</strong>.
          Les anciennes utilisations créées avant l'activation du coût peuvent afficher un coût de 0 DH.
        </div>
      </section>

      {/* FIDÉLITÉ */}

      <section className="mt-6 rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#f4ead3] text-gold">
                <Gift size={17} />
              </div>
              <div>
                <h2 className="font-display text-xl text-forest">Fidélité</h2>
                <p className="text-xs text-ink/45">Suivez vos clients fidèles et l’activité du programme.</p>
              </div>
            </div>
          </div>

          <Link
            to="/dashboard/loyalty"
            className="flex w-fit items-center gap-2 rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-2.5 text-xs font-semibold text-forest transition hover:border-gold"
          >
            Gérer la fidélité
            <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Stat
            label="Clients fidélité"
            value={loyaltyLoading ? '—' : loyaltyCustomers.length}
            detail="Clients inscrits"
            icon={Users}
            accent="bg-[#e5eee9] text-forest"
          />

          <Stat
            label="Nouveaux inscrits"
            value={
              loyaltyLoading
                ? '—'
                : loyaltyCustomers.filter((customer) => {
                    const date = new Date(customer.created_at);
                    const sevenDaysAgo = new Date();
                    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                    return date >= sevenDaysAgo;
                  }).length
            }
            detail="Sur les 7 derniers jours"
            icon={Gift}
            accent="bg-[#f4ead3] text-gold"
          />

          <Stat
            label="Points en circulation"
            value={
              loyaltyLoading
                ? '—'
                : loyaltyCustomers.reduce(
                    (sum, customer) => sum + Number(customer.points_balance || 0),
                    0
                  )
            }
            detail="Solde total des clients"
            icon={Coins}
            accent="bg-[#e5eee9] text-forest"
          />

          <Stat
            label="Visites enregistrées"
            value={
              loyaltyLoading
                ? '—'
                : loyaltyCustomers.reduce(
                    (sum, customer) => sum + Number(customer.visit_count || 0),
                    0
                  )
            }
            detail="Total des visites fidélité"
            icon={CheckCircle2}
            accent="bg-[#f4ead3] text-gold"
          />
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.35fr_1fr]">
          <div className="rounded-2xl bg-[#f7f7f3] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-forest">Activité du programme</h3>
                <p className="mt-1 text-xs text-ink/40">Points gagnés et utilisés par vos clients.</p>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white p-4">
                <p className="text-[11px] text-ink/45">Points gagnés</p>
                <p className="mt-2 font-display text-2xl text-forest">
                  {loyaltyLoading
                    ? '—'
                    : loyaltyCustomers.reduce(
                        (sum, customer) => sum + Number(customer.total_points_earned || 0),
                        0
                      )}
                </p>
              </div>
              <div className="rounded-xl bg-white p-4">
                <p className="text-[11px] text-ink/45">Points utilisés</p>
                <p className="mt-2 font-display text-2xl text-forest">
                  {loyaltyLoading
                    ? '—'
                    : loyaltyCustomers.reduce(
                        (sum, customer) => sum + Number(customer.total_points_redeemed || 0),
                        0
                      )}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl bg-[#f7f7f3] p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-sm font-semibold text-forest">Derniers inscrits</h3>
                <p className="mt-1 text-xs text-ink/40">Les 5 clients les plus récents.</p>
              </div>
              <Link
                to="/dashboard/loyalty"
                className="text-xs font-semibold text-gold"
              >
                Tout voir
              </Link>
            </div>

            <div className="mt-5 space-y-3">
              {loyaltyLoading ? (
                <p className="py-5 text-center text-sm text-ink/35">Chargement...</p>
              ) : loyaltyCustomers.length ? (
                loyaltyCustomers.slice(0, 5).map((customer) => (
                  <div
                    key={customer.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-forest">
                        {[customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Client'}
                      </p>
                      <p className="mt-1 text-[11px] text-ink/40">
                        Inscrit le {new Date(customer.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-gold">{customer.points_balance} pts</p>
                      <p className="mt-1 text-[10px] text-ink/35">{customer.visit_count ?? 0} visite{(customer.visit_count ?? 0) > 1 ? 's' : ''}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="py-7 text-center">
                  <Users className="mx-auto text-ink/15" size={24} />
                  <p className="mt-2 text-sm text-ink/40">Aucun client fidélité pour le moment.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* GRAPHIQUE + DERNIERS AVIS */}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-display text-xl text-forest">
                Avis reçus par semaine
              </h2>

              <p className="mt-1 text-xs text-ink/45">
                Volume et sentiment de vos retours
              </p>
            </div>


          </div>

          <div className="mt-8 h-64">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={chart}
                barGap={5}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#edf0eb"
                />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#9ca89f',
                    fontSize: 11,
                  }}
                />

                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#9ca89f',
                    fontSize: 11,
                  }}
                />

                <Tooltip
                  cursor={{
                    fill: '#f7f7f3',
                  }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #edf0eb',
                    fontSize: 12,
                  }}
                />

                <Bar
                  dataKey="positive"
                  name="Positifs"
                  fill="#c8a96b"
                  radius={[4, 4, 0, 0]}
                />

                <Bar
                  dataKey="negative"
                  name="Négatifs"
                  fill="#17352a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex gap-5 text-xs text-ink/50">
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-gold" />
              Positifs
            </span>

            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-forest" />
              Négatifs
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl text-forest">
                Derniers retours
              </h2>

              <p className="mt-1 text-xs text-ink/45">
                Les avis les plus récents
              </p>
            </div>

            <Link
              to="/dashboard/reviews"
              className="text-xs font-semibold text-gold"
            >
              Tout voir
            </Link>
          </div>

          <div className="mt-6 space-y-5">
            {latest.length ? (
              latest.map((review) => (
                <div
                  key={review.id}
                  className="border-b border-ink/5 pb-4 last:border-0"
                >
                  <div className="flex justify-between">
                    <Stars rating={review.rating} />

                    <span className="text-[10px] text-ink/35">
                      {new Date(
                        review.created_at
                      ).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink/65">
                    {review.comment ||
                      'Avis positif sans commentaire'}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-ink/40">
                Vos premiers avis apparaîtront ici.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* BAS DE PAGE */}

      <div className="mt-6 rounded-2xl bg-forest p-6 text-white md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              {isResponsible
                ? 'Votre établissement'
                : 'Votre réseau'}
            </p>

            <h2 className="mt-2 font-display text-2xl">
              {establishmentName ||
                `${places.length} établissement${
                  places.length > 1 ? 's' : ''
                } connecté${
                  places.length > 1 ? 's' : ''
                }`}
            </h2>

            <p className="mt-1 text-sm text-white/50">
              Mesurez chaque expérience, au même endroit.
            </p>
          </div>

          <Link
            to="/dashboard/analytics"
            className="flex w-fit items-center gap-2 rounded-xl bg-gold px-4 py-3 text-xs font-semibold text-forest transition hover:bg-[#d5b878]"
          >
            Explorer les analytics
            <BarChart3 size={15} />
          </Link>
        </div>
      </div>

      <footer className="mt-10 pb-4 text-center text-xs font-medium text-ink/35">by Tap Marrakech</footer>
    </div>
  );
}
