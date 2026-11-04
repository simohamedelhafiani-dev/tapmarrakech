import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  CalendarDays,
  Heart,
  Menu,
  MessageCircle,
  Repeat2,
  ScanLine,
  Star,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Establishment, Review } from '@/lib/types';
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

  const registrationChart = useMemo(() => {
    const today = new Date();
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);
    return Array.from({ length: 30 }, (_, index) => {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + index);
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);
      const count = loyaltyCustomers.filter((customer) => {
        const createdAt = new Date(customer.created_at);
        return createdAt >= day && createdAt < nextDay;
      }).length;
      return {
        date: day.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' }),
        inscriptions: count,
      };
    });
  }, [loyaltyCustomers]);

  const recentActivity = useMemo(() => [
    ...loyaltyCustomers.map((customer) => ({
      id: `customer-${customer.id}`,
      kind: 'customer' as const,
      title: 'Nouveau client inscrit',
      detail: [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Un client a rejoint votre programme',
      created_at: customer.created_at,
    })),
    ...loyaltyTransactions.map((transaction) => {
      const customer = loyaltyCustomers.find((item) => item.id === transaction.customer_id);
      const name = [customer?.first_name, customer?.last_name].filter(Boolean).join(' ');
      return {
        id: `visit-${transaction.id}`,
        kind: 'visit' as const,
        title: 'Visite fidélité enregistrée',
        detail: name || 'Un client a validé une visite',
        created_at: transaction.created_at,
      };
    }),
    ...reviews.map((review) => ({
      id: `review-${review.id}`,
      kind: 'review' as const,
      title: 'Nouvel avis reçu',
      detail: review.name || 'Un client a partagé son expérience',
      created_at: review.created_at,
    })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5), [loyaltyCustomers, loyaltyTransactions, reviews]);

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
            <div className="mt-4 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap">
              <a href="https://wa.me/212630359176?text=Bonjour%20KELYANI%2C%20j%E2%80%99ai%20besoin%20d%E2%80%99aide%20pour%20attribuer%20mon%20%C3%A9tablissement%20%C3%A0%20mon%20compte." target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#25D366] px-5 py-3 text-sm font-bold text-[#071B10] transition hover:bg-[#20BD5A]">
                <MessageCircle size={17} /> Contacter sur WhatsApp
              </a>
              <a href="tel:+212630359176" className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#C9A45C]/30 px-5 py-3 text-sm font-semibold text-[#E1C27A] hover:bg-[#C9A45C]/10">Appeler le +212 630 35 91 76</a>
              <a href="mailto:kelyani.support@gmail.com" className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-5 py-3 text-sm font-semibold text-[#F5F5DC]/75 hover:bg-white/5">Envoyer un e-mail <ArrowUpRight size={15} /></a>
            </div>
          </div>
          <button type="button" onClick={() => window.location.reload()} className="mt-6 inline-flex items-center justify-center rounded-xl border border-[#C9A45C]/30 px-5 py-3 text-xs font-bold text-[#E1C27A] hover:bg-[#C9A45C]/10">Actualiser mon espace</button>
        </section>
      </div>
    );
  }

  const formatCompactNumber = (value: number) => new Intl.NumberFormat('fr-FR', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  const formatGrowth = (value: number) => `${value > 0 ? '+' : ''}${value.toFixed(1)}%`;
  const firstName = profileName.trim().split(/\\s+/)[0] || 'à vous';

  return (
    <div className="kelyani-midnight-dashboard min-h-screen space-y-6 pb-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-semibold text-[#9B7620]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#D4AF37]" />
            Espace professionnel
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-[#0F172A] sm:text-3xl">
            Bonjour {firstName}, voici vos performances
          </h1>
          <p className="mt-2 text-sm text-[#737373]">
            Retrouvez en un coup d’œil la fidélité et l’activité de votre établissement.
          </p>
          <p className="mt-2 flex items-center gap-2 text-xs font-medium text-[#8A8A8A]">
            <CalendarDays size={14} />
            {new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date())}
          </p>
        </div>
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[230px]">
          {places.length > 1 && (
            <label className="text-xs font-medium text-[#737373]">
              Établissement
              <select value={selectedEstablishmentId ?? ''} onChange={(event) => changeEstablishment(event.target.value)} className="kelyani-light-select mt-1.5 h-11 w-full rounded-xl px-3 text-sm font-semibold text-[#1E293B]" aria-label="Établissement actif">
                {places.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
              </select>
            </label>
          )}
          {places.length === 1 && <p className="truncate text-sm font-semibold text-[#525252]">{places[0].name}</p>}
          {!isResponsible && (
            <Link to="/dashboard/establishments" className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#D4AF37] px-4 text-sm font-semibold text-[#0F172A] shadow-sm transition hover:bg-[#C29B2D]">
              Gérer les établissements <ArrowUpRight size={16} />
            </Link>
          )}
        </div>
      </section>

      <section aria-label="Indicateurs clés" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <article className="kelyani-light-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#737373]">Clients actifs</p>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#D4AF37]/10 text-[#A47C19]"><Users size={19} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-[#0F172A]">{dashboardStatsLoading ? '—' : formatCompactNumber(analytics.activeCustomers)}</p>
          <p className="mt-2 text-xs text-[#737373]">{formatGrowth(analytics.registrationGrowth)} d’inscriptions vs période précédente</p>
        </article>
        <article className="kelyani-light-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#737373]">Visites totales</p>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#D4AF37]/10 text-[#A47C19]"><Activity size={19} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-[#0F172A]">{dashboardStatsLoading ? '—' : formatCompactNumber(analytics.visits)}</p>
          <p className="mt-2 text-xs text-[#737373]">Visites enregistrées dans le programme</p>
        </article>
        <article className="kelyani-light-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#737373]">Taux de rétention</p>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#D4AF37]/10 text-[#A47C19]"><Repeat2 size={19} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-[#0F172A]">{dashboardStatsLoading ? '—' : `${analytics.returningRate.toFixed(1)}%`}</p>
          <p className="mt-2 text-xs text-[#737373]">{formatCompactNumber(analytics.returningCustomers)} clients revenus au moins deux fois</p>
        </article>
        <article className="kelyani-light-card rounded-2xl p-4 sm:p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-[#737373]">Revenu estimé</p>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#D4AF37]/10 text-[#A47C19]"><Wallet size={19} /></span>
          </div>
          <p className="mt-4 text-3xl font-bold tracking-tight text-[#0F172A]">{dashboardStatsLoading ? '—' : `${formatCompactNumber(analytics.currentRevenue)} DH`}</p>
          <p className="mt-2 text-xs text-[#737373]">Sur les 30 derniers jours</p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,.8fr)]">
        <article className="kelyani-light-card min-w-0 rounded-2xl p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#A47C19]">Acquisition</p>
              <h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Nouveaux clients</h2>
              <p className="mt-1 text-sm text-[#737373]">Inscriptions sur les 30 derniers jours</p>
            </div>
            <div className="rounded-xl bg-[#D4AF37]/10 px-3 py-2 text-right">
              <p className="text-xs text-[#737373]">Total période</p>
              <p className="text-lg font-bold text-[#0F172A]">{analytics.currentRegistrations}</p>
            </div>
          </div>
          <div className="mt-5 h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={registrationChart} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="kelyaniRegistrationsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#D4AF37" stopOpacity={0.28} />
                    <stop offset="95%" stopColor="#D4AF37" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EDEDED" vertical={false} />
                <XAxis dataKey="date" axisLine={false} tickLine={false} interval={4} tick={{ fill: '#8A8A8A', fontSize: 11 }} />
                <YAxis allowDecimals={false} axisLine={false} tickLine={false} width={32} tick={{ fill: '#8A8A8A', fontSize: 11 }} />
                <Tooltip contentStyle={{ background: '#FFFFFF', border: '1px solid #EEEEEE', borderRadius: 12, color: '#171717', fontSize: 12, boxShadow: '0 8px 24px rgba(0,0,0,.08)' }} />
                <Area type="monotone" dataKey="inscriptions" name="Nouveaux clients" stroke="#B58B25" strokeWidth={2.5} fill="url(#kelyaniRegistrationsFill)" activeDot={{ r: 4, strokeWidth: 0, fill: '#B58B25' }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="kelyani-light-card rounded-2xl p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#A47C19]">Accès rapide</p><h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Gagner du temps</h2></div>
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#D4AF37]/10 text-[#A47C19]"><ScanLine size={19} /></span>
          </div>
          <div className="mt-5 space-y-3">
            <Link to="/dashboard/loyalty" className="flex items-center gap-3 rounded-xl bg-[#D4AF37] p-3.5 text-[#0F172A] transition hover:bg-[#C29B2D]">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-black/10"><UserPlus size={19} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm">Ajouter un client</strong><span className="mt-0.5 block text-xs text-black/60">Inscrire un nouveau membre</span></span>
              <ArrowUpRight size={17} />
            </Link>
            <Link to="/employee" className="flex items-center gap-3 rounded-xl border border-[#EAEAEA] bg-white p-3.5 text-[#1E293B] transition hover:border-[#D4AF37]/60 hover:bg-[#FFFCF3]">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#D4AF37]/10 text-[#A47C19]"><ScanLine size={19} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm">Scanner un QR code</strong><span className="mt-0.5 block text-xs text-[#737373]">Valider une visite ou une récompense</span></span>
              <ArrowUpRight size={17} />
            </Link>
            <Link to="/dashboard/reviews" className="flex items-center gap-3 rounded-xl border border-[#EAEAEA] bg-white p-3.5 text-[#1E293B] transition hover:border-[#D4AF37]/60 hover:bg-[#FFFCF3]">
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-[#D4AF37]/10 text-[#A47C19]"><MessageCircle size={19} /></span>
              <span className="min-w-0 flex-1"><strong className="block text-sm">Gérer les avis</strong><span className="mt-0.5 block text-xs text-[#737373]">Suivre votre réputation Google</span></span>
              <ArrowUpRight size={17} />
            </Link>
          </div>
        </article>
      </section>

      <section className="kelyani-light-card rounded-2xl p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#A47C19]">En temps réel</p><h2 className="mt-1 text-lg font-semibold text-[#0F172A]">Activité récente</h2><p className="mt-1 text-sm text-[#737373]">Les cinq dernières interactions enregistrées</p></div>
          <Link to="/dashboard/loyalty" className="inline-flex items-center gap-1 text-sm font-semibold text-[#9B7620] hover:text-[#73550F]">Voir la fidélité <ArrowUpRight size={15} /></Link>
        </div>
        <div className="mt-4 divide-y divide-[#F0F0F0]">
          {recentActivity.length === 0 ? (
            <div className="py-10 text-center"><div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#D4AF37]/10 text-[#A47C19]"><Activity size={20} /></div><p className="mt-3 text-sm font-semibold text-[#404040]">Votre activité apparaîtra ici</p><p className="mt-1 text-xs text-[#8A8A8A]">Les nouvelles inscriptions, visites et interactions seront affichées automatiquement.</p></div>
          ) : recentActivity.map((event) => {
            const Icon = event.kind === 'customer' ? UserPlus : event.kind === 'visit' ? ScanLine : MessageCircle;
            return (
              <div key={event.id} className="flex items-center gap-3 py-3.5">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#D4AF37]/10 text-[#A47C19]"><Icon size={17} /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-[#1E293B]">{event.title}</p><p className="mt-0.5 truncate text-xs text-[#737373]">{event.detail}</p></div>
                <time className="shrink-0 text-[11px] text-[#8A8A8A]">{new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(event.created_at))}</time>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
