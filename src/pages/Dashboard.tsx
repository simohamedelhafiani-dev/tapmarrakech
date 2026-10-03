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

type DashboardStats = {
  period_days: number;
  reviews_count: number;
  average_rating: number;
  positive_reviews_count: number;
  negative_reviews_count: number;
  pending_reviews_count: number;
  loyalty_customers_count: number;
  returning_customers_count: number;
  active_customers_count: number;
  visits_total: number;
  points_balance_total: number;
  points_earned_total: number;
  points_redeemed_total: number;
  analytics_events_count: number;
  current_analytics_events_count: number;
  current_reviews_count: number;
  previous_reviews_count: number;
  review_growth: number;
  current_registrations_count: number;
  previous_registrations_count: number;
  registration_growth: number;
  returning_rate: number;
  active_rate: number;
  redemption_rate: number;
  current_revenue: number;
  previous_revenue: number;
  total_revenue: number;
  current_transactions_count: number;
  average_basket: number;
  current_redemptions_count: number;
  previous_redemptions_count: number;
  redemption_growth: number;
  points_redeemed_on_period: number;
  reward_value_on_period: number;
  redemption_revenue: number;
  reward_cost_on_period: number;
  net_contribution: number;
  real_roi: number | null;
  reward_efficiency: number;
  points_per_currency: number;
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

        <div
          className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}
        >
          <Icon size={18} />
        </div>
      </div>

      <p className="mt-4 text-[11px] text-ink/45">
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
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [dashboardStatsLoading, setDashboardStatsLoading] = useState(false);

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

    const loadDashboardStats = async () => {
      if (!selectedEstablishmentId) {
        if (active) setDashboardStats(null);
        return;
      }

      setDashboardStatsLoading(true);
      const { data, error } = await supabase.rpc('get_dashboard_stats', {
        p_establishment_id: selectedEstablishmentId,
        p_days: ranges.find((range) => range.key === period)?.days ?? 30,
      });

      if (!active) return;

      if (error) {
        console.error('Erreur statistiques dashboard:', error);
        setDashboardStats(null);
      } else {
        const row = Array.isArray(data) ? data[0] : data;
        setDashboardStats(row ? {
          period_days: Number(row.period_days ?? (ranges.find((range) => range.key === period)?.days ?? 30)),
          reviews_count: Number(row.reviews_count ?? 0),
          average_rating: Number(row.average_rating ?? 0),
          positive_reviews_count: Number(row.positive_reviews_count ?? 0),
          negative_reviews_count: Number(row.negative_reviews_count ?? 0),
          pending_reviews_count: Number(row.pending_reviews_count ?? 0),
          loyalty_customers_count: Number(row.loyalty_customers_count ?? 0),
          returning_customers_count: Number(row.returning_customers_count ?? 0),
          active_customers_count: Number(row.active_customers_count ?? 0),
          visits_total: Number(row.visits_total ?? 0),
          points_balance_total: Number(row.points_balance_total ?? 0),
          points_earned_total: Number(row.points_earned_total ?? 0),
          points_redeemed_total: Number(row.points_redeemed_total ?? 0),
          analytics_events_count: Number(row.analytics_events_count ?? 0),
          current_analytics_events_count: Number(row.current_analytics_events_count ?? 0),
          current_reviews_count: Number(row.current_reviews_count ?? 0),
          previous_reviews_count: Number(row.previous_reviews_count ?? 0),
          review_growth: Number(row.review_growth ?? 0),
          current_registrations_count: Number(row.current_registrations_count ?? 0),
          previous_registrations_count: Number(row.previous_registrations_count ?? 0),
          registration_growth: Number(row.registration_growth ?? 0),
          returning_rate: Number(row.returning_rate ?? 0),
          active_rate: Number(row.active_rate ?? 0),
          redemption_rate: Number(row.redemption_rate ?? 0),
          current_revenue: Number(row.current_revenue ?? 0),
          previous_revenue: Number(row.previous_revenue ?? 0),
          total_revenue: Number(row.total_revenue ?? 0),
          current_transactions_count: Number(row.current_transactions_count ?? 0),
          average_basket: Number(row.average_basket ?? 0),
          current_redemptions_count: Number(row.current_redemptions_count ?? 0),
          previous_redemptions_count: Number(row.previous_redemptions_count ?? 0),
          redemption_growth: Number(row.redemption_growth ?? 0),
          points_redeemed_on_period: Number(row.points_redeemed_on_period ?? 0),
          reward_value_on_period: Number(row.reward_value_on_period ?? 0),
          redemption_revenue: Number(row.redemption_revenue ?? 0),
          reward_cost_on_period: Number(row.reward_cost_on_period ?? 0),
          net_contribution: Number(row.net_contribution ?? 0),
          real_roi: row.real_roi === null || row.real_roi === undefined ? null : Number(row.real_roi),
          reward_efficiency: Number(row.reward_efficiency ?? 0),
          points_per_currency: Number(row.points_per_currency ?? 1),
        } : null);
      }

      setDashboardStatsLoading(false);
    };

    void loadDashboardStats();

    return () => { active = false; };
  }, [selectedEstablishmentId, period]);

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

  const positive = reviews.filter(
    (review) => review.rating >= 4
  ).length;

  const negative = reviews.filter(
    (review) => review.rating <= 3
  ).length;

  const pending = reviews.filter(
    (review) =>
      review.status === 'Nouveau' &&
      review.rating <= 3
  ).length;

  const average = reviews.length
    ? (
        reviews.reduce(
          (total, review) => total + review.rating,
          0
        ) / reviews.length
      ).toFixed(1)
    : '—';

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

    const source = dashboardStats;

    return {
      currentReviews: source ? source.current_reviews_count : currentReviews.length,
      reviewGrowth: source ? source.review_growth : growth(currentReviews.length, previousReviews.length),
      currentRegistrations: source ? source.current_registrations_count : currentRegistrations.length,
      registrationGrowth: source ? source.registration_growth : growth(currentRegistrations.length, previousRegistrations.length),
      returningRate: source ? source.returning_rate : (totalCustomers ? (returningCustomers / totalCustomers) * 100 : 0),
      activeRate: source ? source.active_rate : (totalCustomers ? (activeCustomers / totalCustomers) * 100 : 0),
      redemptionRate: source ? source.redemption_rate : (pointsEarned ? (pointsRedeemed / pointsEarned) * 100 : 0),
      visits: source ? source.visits_total : visits,
      returningCustomers: source ? source.returning_customers_count : returningCustomers,
      activeCustomers: source ? source.active_customers_count : activeCustomers,
      pointsEarned: source ? source.points_earned_total : pointsEarned,
      pointsRedeemed: source ? source.points_redeemed_total : pointsRedeemed,
      currentRevenue: source ? source.current_revenue : currentRevenue,
      previousRevenue: source ? source.previous_revenue : previousRevenue,
      revenueGrowth: source ? (source.previous_revenue === 0 ? (source.current_revenue > 0 ? 100 : 0) : ((source.current_revenue - source.previous_revenue) / source.previous_revenue) * 100) : growth(currentRevenue, previousRevenue),
      totalRevenue: source ? source.total_revenue : totalRevenue,
      currentTransactions: source ? source.current_transactions_count : currentTransactions.length,
      averageBasket: source ? source.average_basket : averageBasket,
      currentRedemptions: source ? source.current_redemptions_count : currentRedemptions.length,
      previousRedemptions: source ? source.previous_redemptions_count : previousRedemptions.length,
      redemptionGrowth: source ? source.redemption_growth : growth(currentRedemptions.length, previousRedemptions.length),
      pointsRedeemedOnPeriod: source ? source.points_redeemed_on_period : pointsRedeemedOnPeriod,
      rewardValueOnPeriod: source ? source.reward_value_on_period : rewardValueOnPeriod,
      previousRewardValue,
      redemptionRevenue: source ? source.redemption_revenue : redemptionRevenue,
      rewardEfficiency: source ? source.reward_efficiency : rewardEfficiency,
      rewardCostOnPeriod: source ? source.reward_cost_on_period : rewardCostOnPeriod,
      netContribution: source ? source.net_contribution : netContribution,
      realROI: source ? source.real_roi : realROI,
      topClients,
      periodDays: selected.days,
    }
  }, [reviews, loyaltyCustomers, loyaltyTransactions, loyaltyRedemptions, pointsPerCurrency, selected.days]);

  const isResponsible = role === 'responsible';

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
    <div className="min-h-screen space-y-5 pb-6">
      <section className="relative overflow-hidden rounded-[28px] border border-[#242424] bg-[#111111] p-5 sm:p-7">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-[#C9A45C]/10" />
        <div className="relative z-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#C9A45C]/20 bg-[#C9A45C]/[0.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#E1C27A]">${roleLabel}</span>
                {establishmentName && <span className="truncate rounded-full border border-[#242424] bg-[#050505] px-2.5 py-1 text-[9px] font-semibold text-[#F5F5DC]/45">{establishmentName}</span>}
              </div>
              <h1 className="mt-4 max-w-3xl font-display text-3xl leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl">Faites de chaque client <span className="text-[#C9A45C]">un client régulier.</span></h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#F5F5DC]/40">Bonjour ${profileName || "à vous"}. Votre activité, vos clients et vos avis — réunis dans une interface simple.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              {places.length > 0 && <select value={selectedEstablishmentId ?? ''} onChange={(event) => changeEstablishment(event.target.value)} className="h-11 min-w-[210px] rounded-2xl border border-[#242424] bg-[#050505] px-3 text-xs font-semibold text-white outline-none focus:border-[#C9A45C]/55" aria-label="Établissement actif">{places.map((place) => <option className="bg-[#111111]" key={place.id} value={place.id}>{place.name}</option>)}</select>}
              {!isResponsible && <Link to="/dashboard/establishments" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#C9A45C] px-4 text-xs font-bold text-[#050505] hover:bg-[#E1C27A]">Gérer les établissements <ArrowUpRight size={15} /></Link>}
            </div>
          </div>
          <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Avis', value: dashboardStatsLoading ? '—' : String(dashboardStats?.reviews_count ?? 0), icon: MessageCircle },
              { label: 'Note', value: dashboardStatsLoading ? '—' : String((dashboardStats?.average_rating ?? 0).toFixed(1)), icon: Star },
              { label: 'Clients', value: dashboardStatsLoading ? '—' : String(dashboardStats?.loyalty_customers_count ?? loyaltyCustomers.length), icon: Users },
              { label: 'Retour', value: dashboardStatsLoading ? '—' : String(analytics.returningRate.toFixed(0)) + '%', icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl border border-[#242424] bg-[#050505]/80 px-4 py-4"><Icon size={15} className="text-[#C9A45C]" /><p className="mt-3 text-xl font-semibold text-white">{value}</p><p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#F5F5DC]/25">{label}</p></div>)}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 px-1"><p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#C9A45C]">Actions</p><h2 className="mt-1 text-lg font-semibold text-white">Piloter votre établissement</h2></div>
        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[
            { label: 'Avis clients', detail: 'Répondre & analyser', to: '/dashboard/reviews', icon: MessageCircle },
            { label: 'Fidélité', detail: 'Clients & récompenses', to: '/dashboard/loyalty', icon: Heart },
            { label: 'Menu digital', detail: 'Menu & présentation', to: '/dashboard/menu', icon: Menu },
            { label: 'Analytics', detail: 'Comprendre les chiffres', to: '/dashboard/analytics', icon: BarChart3 },
          ].map(({ label, detail, to, icon: Icon }) => <Link key={label} to={to} className="group rounded-2xl border border-[#242424] bg-[#111111] p-4 transition hover:-translate-y-0.5 hover:border-[#C9A45C]/40"><div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#E1C27A]"><Icon size={18} /></span><ArrowUpRight size={15} className="text-[#F5F5DC]/20 group-hover:text-[#C9A45C]" /></div><p className="mt-5 text-sm font-semibold text-white">{label}</p><p className="mt-1 text-[10px] text-[#F5F5DC]/30">{detail}</p></Link>)}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <section className="rounded-[24px] border border-[#242424] bg-[#111111] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Activité</p><h2 className="mt-1 text-lg font-semibold text-white">Votre relation client</h2></div><select value={period} onChange={(event) => setPeriod(event.target.value)} className="h-9 rounded-xl border border-[#242424] bg-[#050505] px-3 text-[10px] font-semibold text-[#F5F5DC]/55 outline-none" aria-label="Période">{ranges.map((range) => <option className="bg-[#111111]" key={range.key} value={range.key}>{range.label}</option>)}</select></div>
          <div className="mt-6 h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} barGap={5}><CartesianGrid stroke="#242424" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#F5F5DC', opacity: 0.3, fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#F5F5DC', opacity: 0.2, fontSize: 9 }} width={28} /><Tooltip contentStyle={{ background: '#111111', border: '1px solid #242424', borderRadius: 14, color: '#fff' }} /><Bar dataKey="positive" stackId="reviews" fill="#C9A45C" radius={[4,4,0,0]} /><Bar dataKey="negative" stackId="reviews" fill="#6B6254" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
        </section>
        <section className="rounded-[24px] border border-[#242424] bg-[#111111] p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Fidélité</p><h2 className="mt-1 text-lg font-semibold text-white">Clients qui reviennent</h2></div><Heart size={18} className="text-[#C9A45C]" /></div>
          <div className="mt-6 rounded-2xl border border-[#242424] bg-[#050505] p-5"><p className="text-[10px] text-[#F5F5DC]/35">Taux de retour</p><p className="mt-2 font-display text-4xl text-[#E1C27A]">{analytics.returningRate.toFixed(1)}%</p><p className="mt-2 text-xs leading-5 text-[#F5F5DC]/35">{analytics.returningCustomers} clients ont effectué au moins deux visites.</p></div>
          <div className="mt-2 grid grid-cols-2 gap-2"><div className="rounded-2xl bg-[#050505] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[#F5F5DC]/25">Visites</p><p className="mt-2 text-xl font-semibold text-white">{dashboardStatsLoading ? '—' : analytics.visits.toLocaleString('fr-FR')}</p></div><div className="rounded-2xl bg-[#050505] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[#F5F5DC]/25">Récompenses</p><p className="mt-2 text-xl font-semibold text-white">{redemptionsLoading ? '—' : analytics.currentRedemptions}</p></div></div>
          <Link to="/dashboard/loyalty" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-[#C9A45C]/25 text-[10px] font-bold text-[#E1C27A] hover:bg-[#C9A45C]/10">Ouvrir la fidélité <ArrowUpRight size={14} /></Link>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-[24px] border border-[#242424] bg-[#111111] p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Derniers retours</p><h2 className="mt-1 text-lg font-semibold text-white">Ce que disent vos clients</h2></div><Link to="/dashboard/reviews" className="text-[10px] font-semibold text-[#C9A45C]">Voir tout</Link></div>
          <div className="mt-4 divide-y divide-[#242424]">{latest.length === 0 ? <div className="py-8 text-center text-xs text-[#F5F5DC]/25">Aucun avis pour le moment.</div> : latest.map((review) => <div key={review.id} className="flex gap-3 py-4"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#C9A45C]"><Star size={15} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-2"><Stars rating={review.rating} /><span className="text-[9px] text-[#F5F5DC]/25">{new Date(review.created_at).toLocaleDateString('fr-FR')}</span></div><span className="text-[9px] text-[#F5F5DC]/25">{review.status}</span></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-[#F5F5DC]/55">{review.comment || 'Avis sans commentaire.'}</p></div></div>)}</div>
        </section>
        <section className="rounded-[24px] border border-[#242424] bg-[#111111] p-5 sm:p-6"><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">KELYANI</p><h2 className="mt-1 font-display text-2xl leading-tight text-white">Faites de chaque client un client régulier.</h2><p className="mt-2 text-xs leading-5 text-[#F5F5DC]/35">Vos avis, votre fidélité et vos données réunis dans un seul espace.</p>{isResponsible && <div className="mt-5 rounded-2xl border border-[#242424] bg-[#050505] p-4"><div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[0.14em] text-[#F5F5DC]/25">Abonnement</p><p className="mt-1 text-sm font-semibold text-white">{subscriptionLoading ? 'Chargement…' : subscription?.plan_name || 'Aucun abonnement'}</p></div>{subscription && <span className="rounded-full bg-[#C9A45C]/10 px-2.5 py-1 text-[9px] font-bold text-[#E1C27A]">{subscription.subscription_status === 'trial' ? 'Essai' : 'Actif'}</span>}</div>{subscription && <p className="mt-3 text-[10px] text-[#F5F5DC]/30">Valable jusqu’au {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'}</p>}</div>}<div className="mt-5 grid grid-cols-2 gap-2"><Link to="/dashboard/menu" className="rounded-xl bg-[#C9A45C] px-3 py-3 text-center text-[10px] font-bold text-[#050505]">Menu digital</Link><Link to="/dashboard/loyalty" className="rounded-xl border border-[#242424] px-3 py-3 text-center text-[10px] font-bold text-[#F5F5DC]/60 hover:border-[#C9A45C]/40">Fidélité</Link></div></section>
      </div>
    </div>
  );
}
