import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Heart,
  Menu,
  MessageCircle,
  Users,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
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
import KelyaniMark from '@/components/brand/KelyaniMark';

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
    return <div className="h-72 animate-pulse rounded-[28px] border border-[#242424] bg-[#111111]" />;
  }

  if (!selectedEstablishmentId && !loading) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center px-4 py-10 text-white">
        <section className="w-full max-w-xl rounded-[28px] border border-[#C9A45C]/20 bg-[#0D0D0D] p-8 text-center shadow-xl">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[#C9A45C]/25 bg-[#C9A45C]/10 text-[#E1C27A]"><Menu size={27} /></div>
          <p className="mt-6 text-[10px] font-bold uppercase tracking-[0.24em] text-[#C9A45C]">Votre espace KELYANI</p>
          <h1 className="mt-3 font-display text-3xl text-[#F5F5DC]">Votre espace est presque prêt</h1>
          <p className="mx-auto mt-4 max-w-md text-sm leading-7 text-[#F5F5DC]/60">Aucun établissement ne vous a encore été attribué. Votre compte est bien créé ; un administrateur KELYANI doit associer votre établissement pour que vos données et vos outils apparaissent ici.</p>
          <div className="mt-7 rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4 text-left">
            <p className="text-xs font-semibold text-[#F5F5DC]">Que faire maintenant ?</p>
            <p className="mt-1 text-xs leading-6 text-[#F5F5DC]/50">Contactez votre administrateur ou l’équipe KELYANI pour demander l’attribution de votre établissement.</p>
            <div className="mt-3 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a href="mailto:kelyani.support@gmail.com" className="inline-flex items-center gap-2 text-sm font-semibold text-[#E1C27A]">Envoyer un e-mail <ArrowUpRight size={15} /></a>
              <a href="tel:+212630359176" className="inline-flex items-center gap-2 text-sm font-semibold text-[#E1C27A]">Appeler le +212 630 35 91 76</a>
            </div>
          </div>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex items-center justify-center rounded-xl border border-[#C9A45C]/30 px-5 py-3 text-xs font-bold text-[#E1C27A] hover:bg-[#C9A45C]/10">Actualiser mon espace</button>
        </section>
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6 pb-8 text-white">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-[#C9A45C]/20 bg-[radial-gradient(ellipse_at_top_right,rgba(201,164,92,0.13),transparent_42%),linear-gradient(135deg,#151515_0%,#090909_62%,#111111_100%)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] sm:rounded-[32px] sm:p-8 lg:p-9">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full border border-[#C9A45C]/15" /><div className="pointer-events-none absolute -bottom-36 left-[38%] h-72 w-72 rounded-full bg-[#C9A45C]/[0.035] blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-4 flex items-center gap-3">
                {selectedEstablishment?.logo_url ? <img src={selectedEstablishment.logo_url} alt={selectedEstablishment.name} onError={(event) => { event.currentTarget.onerror = null; event.currentTarget.src = '/kelyani-final.svg'; }} className="h-12 w-12 rounded-xl border border-[#242424] bg-[#050505] object-contain p-1" /> : <div className="grid h-12 w-12 place-items-center rounded-xl border border-[#242424] bg-[#050505]"><KelyaniMark size={28} /></div>}
                <div className="min-w-0 leading-none">
                  <p className="max-w-[260px] truncate text-lg font-semibold text-white">{selectedEstablishment?.name || 'Votre établissement'}</p>
                  <p className="mt-1 text-[7px] font-semibold uppercase tracking-[.22em] text-[#C9A45C]/60">ESPACE ÉTABLISSEMENT · KELYANI</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#C9A45C]/20 bg-[#C9A45C]/[0.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#E1C27A]">{roleLabel}</span>
                {establishmentName && <span className="truncate rounded-full border border-[#242424] bg-[#050505] px-2.5 py-1 text-[9px] font-semibold text-[#F5F5DC]/45">{establishmentName}</span>}
              </div>
              <h1 className="mt-4 max-w-3xl font-display text-3xl leading-[1.02] tracking-[-0.035em] text-white sm:text-5xl">Faites de chaque client <span className="text-[#C9A45C]">un client régulier.</span></h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-[#F5F5DC]/40">Bonjour {profileName || 'à vous'}. Votre activité, vos clients et vos avis — réunis dans une interface simple.</p>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              {places.length > 0 && <select value={selectedEstablishmentId ?? ''} onChange={(event) => changeEstablishment(event.target.value)} className="h-11 min-w-[210px] rounded-2xl border border-[#242424] bg-[#050505] px-3 text-xs font-semibold text-white outline-none focus:border-[#C9A45C]/55" aria-label="Établissement actif">{places.map((place) => <option className="bg-[#111111]" key={place.id} value={place.id}>{place.name}</option>)}</select>}
              {!isResponsible && <Link to="/dashboard/establishments" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#C9A45C] px-4 text-xs font-bold text-[#050505] hover:bg-[#E1C27A]">Gérer les établissements <ArrowUpRight size={15} /></Link>}
            </div>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
            {[
              { label: 'Avis', value: dashboardStatsLoading ? '—' : String(dashboardStats?.reviews_count ?? 0), icon: MessageCircle },
              { label: 'Note', value: dashboardStatsLoading ? '—' : String((dashboardStats?.average_rating ?? 0).toFixed(1)), icon: Star },
              { label: 'Clients', value: dashboardStatsLoading ? '—' : String(dashboardStats?.loyalty_customers_count ?? loyaltyCustomers.length), icon: Users },
              { label: 'Retour', value: dashboardStatsLoading ? '—' : String(analytics.returningRate.toFixed(0)) + '%', icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => <div key={label} className="group rounded-2xl border border-white/[0.07] bg-black/35 px-3.5 py-4 transition duration-200 hover:border-[#C9A45C]/25 hover:bg-black/50 sm:px-4 sm:py-5"><Icon size={15} className="text-[#C9A45C]" /><p className="mt-3 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{value}</p><p className="mt-1 text-[9px] font-semibold uppercase tracking-[0.15em] text-[#F5F5DC]/40">{label}</p></div>)}
          </div>
        </div>
      </section>

      <section aria-label="Indicateurs de performance" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:grid-cols-4">
        {[
          { label: 'Chiffre d’affaires', value: dashboardStatsLoading ? '—' : `${analytics.currentRevenue.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} DH`, detail: 'sur la période', icon: TrendingUp },
          { label: 'Visites clients', value: dashboardStatsLoading ? '—' : analytics.visits.toLocaleString('fr-FR'), detail: 'activité fidélité', icon: Users },
          { label: 'Clients actifs', value: dashboardStatsLoading ? '—' : analytics.activeCustomers.toLocaleString('fr-FR'), detail: `${analytics.activeRate.toFixed(0)}% de la base`, icon: Star },
          { label: 'Points utilisés', value: dashboardStatsLoading ? '—' : analytics.pointsRedeemed.toLocaleString('fr-FR'), detail: 'points consommés', icon: TrendingDown },
        ].map(({ label, value, detail, icon: Icon }) => (
          <article key={label} className="rounded-2xl border border-white/[0.07] bg-[#101010] p-4 transition hover:border-[#C9A45C]/25 sm:rounded-[22px] sm:p-5">
            <div className="flex items-center justify-between gap-2"><span className="text-[9px] font-semibold uppercase tracking-[0.13em] text-[#F5F5DC]/40 sm:text-[10px]">{label}</span><span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#C9A45C]/[0.09] text-[#C9A45C]"><Icon size={15} /></span></div>
            <p className="mt-4 text-xl font-semibold tracking-tight text-white sm:text-2xl">{value}</p>
            <p className="mt-1 text-[10px] text-[#F5F5DC]/35">{detail}</p>
          </article>
        ))}
      </section>

      <section aria-label="Analyses visuelles" className="grid gap-4 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,.7fr)]">
        <article className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[radial-gradient(ellipse_at_top_left,rgba(201,164,92,0.08),transparent_48%),linear-gradient(145deg,#141414,#090909)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)] sm:rounded-[28px] sm:p-6 lg:p-7">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Tendance</p><h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">Évolution des avis</h2><p className="mt-1 text-xs text-[#F5F5DC]/35">Avis positifs et avis à surveiller sur la période choisie</p></div>
            <div className="flex flex-wrap gap-3 pt-1"><span className="flex items-center gap-1.5 text-[10px] text-[#F5F5DC]/55"><span className="h-2 w-2 rounded-full bg-[#C9A45C]" />Positifs</span><span className="flex items-center gap-1.5 text-[10px] text-[#F5F5DC]/55"><span className="h-2 w-2 rounded-full bg-[#82796B]" />À surveiller</span></div>
          </div>
          <div className="mt-5 h-56 sm:h-64">
            <ResponsiveContainer width="100%" height="100%"><AreaChart data={chart} margin={{ top: 8, right: 4, left: -22, bottom: 0 }}>
              <defs><linearGradient id="kelyaniPositiveFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#C9A45C" stopOpacity={0.28} /><stop offset="95%" stopColor="#C9A45C" stopOpacity={0.01} /></linearGradient><linearGradient id="kelyaniNegativeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#82796B" stopOpacity={0.22} /><stop offset="95%" stopColor="#82796B" stopOpacity={0.01} /></linearGradient></defs>
              <CartesianGrid stroke="#FFFFFF" strokeOpacity={0.06} vertical={false} />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#F5F5DC', opacity: 0.42, fontSize: 10 }} />
              <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#F5F5DC', opacity: 0.32, fontSize: 9 }} width={28} />
              <Tooltip contentStyle={{ background: '#111111', border: '1px solid #34302A', borderRadius: 14, color: '#fff', fontSize: 12 }} />
              <Area type="monotone" dataKey="positive" name="Avis positifs" stroke="#C9A45C" strokeWidth={2.5} fill="url(#kelyaniPositiveFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
              <Area type="monotone" dataKey="negative" name="Avis à surveiller" stroke="#82796B" strokeWidth={2} fill="url(#kelyaniNegativeFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart></ResponsiveContainer>
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-4">
            <div><p className="text-[9px] uppercase tracking-wider text-[#F5F5DC]/35">Total avis</p><p className="mt-1 text-lg font-semibold text-white">{reviews.length.toLocaleString('fr-FR')}</p></div>
            <div><p className="text-[9px] uppercase tracking-wider text-[#F5F5DC]/35">Positifs</p><p className="mt-1 text-lg font-semibold text-[#D9B76B]">{reviews.filter((review) => review.rating >= 4).length.toLocaleString('fr-FR')}</p></div>
            <div><p className="text-[9px] uppercase tracking-wider text-[#F5F5DC]/35">À surveiller</p><p className="mt-1 text-lg font-semibold text-[#C7BBA7]">{reviews.filter((review) => review.rating <= 3).length.toLocaleString('fr-FR')}</p></div>
          </div>
        </article>
        <article className="flex flex-col overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(145deg,#141414,#090909)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)] sm:rounded-[28px] sm:p-6 lg:p-7">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Réputation</p><h2 className="mt-1 text-lg font-semibold text-white sm:text-xl">Répartition des avis</h2><p className="mt-1 text-xs text-[#F5F5DC]/35">Lecture rapide de la satisfaction client</p>
          <div className="relative mx-auto mt-3 h-52 w-full max-w-[280px]">
            <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Positifs', value: reviews.filter((review) => review.rating >= 4).length }, { name: 'À surveiller', value: reviews.filter((review) => review.rating <= 3).length }]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="67%" outerRadius="88%" paddingAngle={reviews.length ? 4 : 0} stroke="none" startAngle={90} endAngle={-270}>{[{ color: '#C9A45C' }, { color: '#5C554B' }].map((item, index) => <Cell key={index} fill={item.color} />)}</Pie><Tooltip contentStyle={{ background: '#111111', border: '1px solid #34302A', borderRadius: 12, color: '#fff', fontSize: 12 }} /></PieChart></ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-4xl font-semibold text-white">{reviews.length ? Math.round((reviews.filter((review) => review.rating >= 4).length / reviews.length) * 100) : 0}%</span><span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-[#F5F5DC]/40">positifs</span></div>
          </div>
          <div className="mt-auto space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"><span className="flex items-center gap-2 text-xs text-[#F5F5DC]/60"><span className="h-2.5 w-2.5 rounded-full bg-[#C9A45C]" />Avis positifs (4–5★)</span><strong className="text-sm text-white">{reviews.filter((review) => review.rating >= 4).length}</strong></div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"><span className="flex items-center gap-2 text-xs text-[#F5F5DC]/60"><span className="h-2.5 w-2.5 rounded-full bg-[#5C554B]" />Avis à surveiller (1–3★)</span><strong className="text-sm text-white">{reviews.filter((review) => review.rating <= 3).length}</strong></div>
          </div>
        </article>
      </section>

      <section aria-label="Performance du programme de fidélité" className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Customer intelligence</p><h2 className="mt-1 text-xl font-semibold tracking-tight text-white sm:text-2xl">La fidélité, en un regard</h2><p className="mt-1 text-xs text-[#F5F5DC]/40">Engagement, circulation des points et retour des clients</p></div>
          <span className="rounded-full border border-[#C9A45C]/20 bg-[#C9A45C]/[0.06] px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider text-[#E1C27A]">{selected.label}</span>
        </div>
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
          <article className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[radial-gradient(ellipse_at_top_left,rgba(201,164,92,0.08),transparent_48%),linear-gradient(145deg,#141414,#090909)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)] sm:rounded-[28px] sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#C9A45C]">Économie de fidélité</p><h3 className="mt-1 text-base font-semibold text-white sm:text-lg">Points gagnés vs utilisés</h3><p className="mt-1 text-xs text-[#F5F5DC]/35">Comprendre comment les récompenses circulent</p></div><div className="rounded-xl border border-[#C9A45C]/15 bg-[#C9A45C]/[0.08] p-2 text-[#C9A45C]"><Heart size={17} /></div></div>
            <div className="mt-5 h-56 sm:h-64">
              <ResponsiveContainer width="100%" height="100%"><BarChart data={[{ name: 'Points', gagnés: analytics.pointsEarned, utilisés: analytics.pointsRedeemed }]} barGap={18} barCategoryGap="35%" margin={{ top: 8, right: 4, left: -18, bottom: 0 }}>
                <defs><linearGradient id="kelyaniPointsEarned" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#E1C27A" /><stop offset="100%" stopColor="#9B7737" /></linearGradient><linearGradient id="kelyaniPointsUsed" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#81796B" /><stop offset="100%" stopColor="#49443C" /></linearGradient></defs>
                <CartesianGrid stroke="#FFFFFF" strokeOpacity={0.06} vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#F5F5DC', opacity: 0.4, fontSize: 10 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#F5F5DC', opacity: 0.3, fontSize: 9 }} width={36} />
                <Tooltip contentStyle={{ background: '#111111', border: '1px solid #34302A', borderRadius: 14, color: '#fff', fontSize: 12 }} />
                <Bar dataKey="gagnés" name="Points gagnés" fill="url(#kelyaniPointsEarned)" radius={[8,8,0,0]} maxBarSize={70} />
                <Bar dataKey="utilisés" name="Points utilisés" fill="url(#kelyaniPointsUsed)" radius={[8,8,0,0]} maxBarSize={70} />
              </BarChart></ResponsiveContainer>
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-white/[0.07] pt-4">
              <div className="rounded-xl bg-white/[0.025] p-3"><p className="flex items-center gap-2 text-[10px] text-[#F5F5DC]/45"><span className="h-2 w-2 rounded-full bg-[#C9A45C]" />Points gagnés</p><p className="mt-2 text-xl font-semibold text-white">{analytics.pointsEarned.toLocaleString('fr-FR')}</p></div>
              <div className="rounded-xl bg-white/[0.025] p-3"><p className="flex items-center gap-2 text-[10px] text-[#F5F5DC]/45"><span className="h-2 w-2 rounded-full bg-[#81796B]" />Points utilisés</p><p className="mt-2 text-xl font-semibold text-white">{analytics.pointsRedeemed.toLocaleString('fr-FR')}</p></div>
            </div>
          </article>
          <article className="flex flex-col overflow-hidden rounded-[24px] border border-white/[0.07] bg-[linear-gradient(145deg,#141414,#090909)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)] sm:rounded-[28px] sm:p-6">
            <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-[#C9A45C]">Engagement client</p><h3 className="mt-1 text-base font-semibold text-white sm:text-lg">Clients actifs</h3><p className="mt-1 text-xs text-[#F5F5DC]/35">Part de la base active sur la période</p></div><div className="rounded-xl border border-[#C9A45C]/15 bg-[#C9A45C]/[0.08] p-2 text-[#C9A45C]"><Users size={17} /></div></div>
            <div className="relative mx-auto mt-3 h-48 w-full max-w-[250px]">
              <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={[{ name: 'Actifs', value: Math.min(analytics.activeCustomers, loyaltyCustomers.length) }, { name: 'Autres clients', value: Math.max(0, loyaltyCustomers.length - analytics.activeCustomers) }]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="66%" outerRadius="88%" paddingAngle={loyaltyCustomers.length ? 4 : 0} stroke="none" startAngle={90} endAngle={-270}><Cell fill="#C9A45C" /><Cell fill="#403A32" /></Pie><Tooltip contentStyle={{ background: '#111111', border: '1px solid #34302A', borderRadius: 12, color: '#fff', fontSize: 12 }} /></PieChart></ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><span className="font-display text-4xl font-semibold text-white">{analytics.activeRate.toFixed(0)}%</span><span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-[#F5F5DC]/40">actifs</span></div>
            </div>
            <div className="mt-auto space-y-3">
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"><span className="flex items-center gap-2 text-xs text-[#F5F5DC]/60"><span className="h-2.5 w-2.5 rounded-full bg-[#C9A45C]" />Clients actifs</span><strong className="text-sm text-white">{analytics.activeCustomers.toLocaleString('fr-FR')}</strong></div>
              <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3.5 py-3"><span className="flex items-center gap-2 text-xs text-[#F5F5DC]/60"><span className="h-2.5 w-2.5 rounded-full bg-[#403A32]" />Clients à réactiver</span><strong className="text-sm text-white">{Math.max(0, loyaltyCustomers.length - analytics.activeCustomers).toLocaleString('fr-FR')}</strong></div>
              <div className="rounded-xl border border-[#C9A45C]/15 bg-[#C9A45C]/[0.05] p-3.5"><div className="flex items-center justify-between gap-3"><span className="text-[10px] text-[#F5F5DC]/50">Taux de retour</span><strong className="text-sm text-[#E1C27A]">{analytics.returningRate.toFixed(1)}%</strong></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]"><div className="h-full rounded-full bg-gradient-to-r from-[#9B7737] to-[#E1C27A]" style={{ width: `${Math.min(100, Math.max(0, analytics.returningRate))}%` }} /></div><p className="mt-2 text-[9px] text-[#F5F5DC]/35">{analytics.returningCustomers.toLocaleString('fr-FR')} clients sont revenus au moins deux fois</p></div>
            </div>
          </article>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.75fr)]">
        <section className="rounded-[24px] border border-white/[0.07] bg-[linear-gradient(145deg,#141414,#0D0D0D)] p-5 shadow-[0_16px_48px_rgba(0,0,0,0.18)] sm:rounded-[28px] sm:p-6 lg:p-7">
          <div className="flex items-center justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Activité</p><h2 className="mt-1 text-lg font-semibold text-white">Votre relation client</h2></div><select value={period} onChange={(event) => setPeriod(event.target.value)} className="h-9 rounded-xl border border-[#242424] bg-[#050505] px-3 text-[10px] font-semibold text-[#F5F5DC]/55 outline-none" aria-label="Période">{ranges.map((range) => <option className="bg-[#111111]" key={range.key} value={range.key}>{range.label}</option>)}</select></div>
          <div className="mt-6 h-56 sm:h-64"><ResponsiveContainer width="100%" height="100%"><BarChart data={chart} barGap={5}><CartesianGrid stroke="#242424" vertical={false} /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#F5F5DC', opacity: 0.3, fontSize: 10 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#F5F5DC', opacity: 0.2, fontSize: 9 }} width={28} /><Tooltip contentStyle={{ background: '#111111', border: '1px solid #242424', borderRadius: 14, color: '#fff' }} /><Bar dataKey="positive" stackId="reviews" fill="#C9A45C" radius={[4,4,0,0]} /><Bar dataKey="negative" stackId="reviews" fill="#6B6254" radius={[4,4,0,0]} /></BarChart></ResponsiveContainer></div>
        </section>
        <section className="rounded-[24px] border border-[#242424] bg-[#111111] p-5 sm:p-6">
          <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Fidélité</p><h2 className="mt-1 text-lg font-semibold text-white">Clients qui reviennent</h2></div><Heart size={18} className="text-[#C9A45C]" /></div>
          <div className="mt-6 rounded-2xl border border-[#C9A45C]/15 bg-[linear-gradient(135deg,rgba(201,164,92,0.08),rgba(5,5,5,0.8)_55%)] p-5 sm:p-6"><p className="text-[10px] text-[#F5F5DC]/35">Taux de retour</p><p className="mt-2 font-display text-4xl text-[#E1C27A]">{analytics.returningRate.toFixed(1)}%</p><p className="mt-2 text-xs leading-5 text-[#F5F5DC]/35">{analytics.returningCustomers} clients ont effectué au moins deux visites.</p></div>
          <div className="mt-3 grid grid-cols-2 gap-2.5"><div className="rounded-2xl bg-[#050505] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[#F5F5DC]/25">Visites</p><p className="mt-2 text-xl font-semibold text-white">{dashboardStatsLoading ? '—' : analytics.visits.toLocaleString('fr-FR')}</p></div><div className="rounded-2xl bg-[#050505] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[#F5F5DC]/25">Récompenses</p><p className="mt-2 text-xl font-semibold text-white">{redemptionsLoading ? '—' : analytics.currentRedemptions}</p></div></div>
          <Link to="/dashboard/loyalty" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-[#C9A45C]/25 text-[10px] font-bold text-[#E1C27A] hover:bg-[#C9A45C]/10">Ouvrir la fidélité <ArrowUpRight size={14} /></Link>
        </section>
      </div>


    </div>
  );
}
