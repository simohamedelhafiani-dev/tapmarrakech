import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type AdminOverviewStats = {
  periodDays: number;
  reviewsCount: number;
  averageRating: number;
  positiveReviewsCount: number;
  negativeReviewsCount: number;
  pendingReviewsCount: number;
  loyaltyCustomersCount: number;
  returningCustomersCount: number;
  activeCustomersCount: number;
  visitsTotal: number;
  pointsBalanceTotal: number;
  pointsEarnedTotal: number;
  pointsRedeemedTotal: number;
  analyticsEventsCount: number;
  currentAnalyticsEventsCount: number;
  currentReviewsCount: number;
  previousReviewsCount: number;
  reviewGrowth: number;
  currentRegistrationsCount: number;
  previousRegistrationsCount: number;
  registrationGrowth: number;
  returningRate: number;
  activeRate: number;
  redemptionRate: number;
  currentRevenue: number;
  previousRevenue: number;
  totalRevenue: number;
  currentTransactionsCount: number;
  averageBasket: number;
  currentRedemptionsCount: number;
  previousRedemptionsCount: number;
  redemptionGrowth: number;
  pointsRedeemedOnPeriod: number;
  rewardValueOnPeriod: number;
  redemptionRevenue: number;
  rewardCostOnPeriod: number;
  netContribution: number;
  realRoi: number | null;
  rewardEfficiency: number;
  pointsPerCurrency: number;
};

type DashboardStatsRpcRow = {
  period_days: number | null;
  reviews_count: number | null;
  average_rating: number | null;
  positive_reviews_count: number | null;
  negative_reviews_count: number | null;
  pending_reviews_count: number | null;
  loyalty_customers_count: number | null;
  returning_customers_count: number | null;
  active_customers_count: number | null;
  visits_total: number | null;
  points_balance_total: number | null;
  points_earned_total: number | null;
  points_redeemed_total: number | null;
  analytics_events_count: number | null;
  current_analytics_events_count: number | null;
  current_reviews_count: number | null;
  previous_reviews_count: number | null;
  review_growth: number | null;
  current_registrations_count: number | null;
  previous_registrations_count: number | null;
  registration_growth: number | null;
  returning_rate: number | null;
  active_rate: number | null;
  redemption_rate: number | null;
  current_revenue: number | null;
  previous_revenue: number | null;
  total_revenue: number | null;
  current_transactions_count: number | null;
  average_basket: number | null;
  current_redemptions_count: number | null;
  previous_redemptions_count: number | null;
  redemption_growth: number | null;
  points_redeemed_on_period: number | null;
  reward_value_on_period: number | null;
  redemption_revenue: number | null;
  reward_cost_on_period: number | null;
  net_contribution: number | null;
  real_roi: number | null;
  reward_efficiency: number | null;
  points_per_currency: number | null;
};

const EMPTY_ADMIN_OVERVIEW_STATS: AdminOverviewStats = {
  periodDays: 30,
  reviewsCount: 0,
  averageRating: 0,
  positiveReviewsCount: 0,
  negativeReviewsCount: 0,
  pendingReviewsCount: 0,
  loyaltyCustomersCount: 0,
  returningCustomersCount: 0,
  activeCustomersCount: 0,
  visitsTotal: 0,
  pointsBalanceTotal: 0,
  pointsEarnedTotal: 0,
  pointsRedeemedTotal: 0,
  analyticsEventsCount: 0,
  currentAnalyticsEventsCount: 0,
  currentReviewsCount: 0,
  previousReviewsCount: 0,
  reviewGrowth: 0,
  currentRegistrationsCount: 0,
  previousRegistrationsCount: 0,
  registrationGrowth: 0,
  returningRate: 0,
  activeRate: 0,
  redemptionRate: 0,
  currentRevenue: 0,
  previousRevenue: 0,
  totalRevenue: 0,
  currentTransactionsCount: 0,
  averageBasket: 0,
  currentRedemptionsCount: 0,
  previousRedemptionsCount: 0,
  redemptionGrowth: 0,
  pointsRedeemedOnPeriod: 0,
  rewardValueOnPeriod: 0,
  redemptionRevenue: 0,
  rewardCostOnPeriod: 0,
  netContribution: 0,
  realRoi: null,
  rewardEfficiency: 0,
  pointsPerCurrency: 0,
};

function mapDashboardStatsRow(
  row: DashboardStatsRpcRow,
): AdminOverviewStats {
  return {
    periodDays: Number(row.period_days ?? 30),
    reviewsCount: Number(row.reviews_count ?? 0),
    averageRating: Number(row.average_rating ?? 0),
    positiveReviewsCount: Number(row.positive_reviews_count ?? 0),
    negativeReviewsCount: Number(row.negative_reviews_count ?? 0),
    pendingReviewsCount: Number(row.pending_reviews_count ?? 0),
    loyaltyCustomersCount: Number(row.loyalty_customers_count ?? 0),
    returningCustomersCount: Number(row.returning_customers_count ?? 0),
    activeCustomersCount: Number(row.active_customers_count ?? 0),
    visitsTotal: Number(row.visits_total ?? 0),
    pointsBalanceTotal: Number(row.points_balance_total ?? 0),
    pointsEarnedTotal: Number(row.points_earned_total ?? 0),
    pointsRedeemedTotal: Number(row.points_redeemed_total ?? 0),
    analyticsEventsCount: Number(row.analytics_events_count ?? 0),
    currentAnalyticsEventsCount: Number(
      row.current_analytics_events_count ?? 0,
    ),
    currentReviewsCount: Number(row.current_reviews_count ?? 0),
    previousReviewsCount: Number(row.previous_reviews_count ?? 0),
    reviewGrowth: Number(row.review_growth ?? 0),
    currentRegistrationsCount: Number(
      row.current_registrations_count ?? 0,
    ),
    previousRegistrationsCount: Number(
      row.previous_registrations_count ?? 0,
    ),
    registrationGrowth: Number(row.registration_growth ?? 0),
    returningRate: Number(row.returning_rate ?? 0),
    activeRate: Number(row.active_rate ?? 0),
    redemptionRate: Number(row.redemption_rate ?? 0),
    currentRevenue: Number(row.current_revenue ?? 0),
    previousRevenue: Number(row.previous_revenue ?? 0),
    totalRevenue: Number(row.total_revenue ?? 0),
    currentTransactionsCount: Number(
      row.current_transactions_count ?? 0,
    ),
    averageBasket: Number(row.average_basket ?? 0),
    currentRedemptionsCount: Number(
      row.current_redemptions_count ?? 0,
    ),
    previousRedemptionsCount: Number(
      row.previous_redemptions_count ?? 0,
    ),
    redemptionGrowth: Number(row.redemption_growth ?? 0),
    pointsRedeemedOnPeriod: Number(
      row.points_redeemed_on_period ?? 0,
    ),
    rewardValueOnPeriod: Number(row.reward_value_on_period ?? 0),
    redemptionRevenue: Number(row.redemption_revenue ?? 0),
    rewardCostOnPeriod: Number(row.reward_cost_on_period ?? 0),
    netContribution: Number(row.net_contribution ?? 0),
    realRoi:
      row.real_roi === null || row.real_roi === undefined
        ? null
        : Number(row.real_roi),
    rewardEfficiency: Number(row.reward_efficiency ?? 0),
    pointsPerCurrency: Number(row.points_per_currency ?? 0),
  };
}

export function useAdminOverviewStats(periodDays = 30) {
  const [stats, setStats] = useState<AdminOverviewStats>(
    EMPTY_ADMIN_OVERVIEW_STATS,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: rpcError } = await supabase.rpc(
        'get_dashboard_stats',
        {
          p_establishment_id: null,
          p_days: periodDays,
        },
      );

      if (rpcError) {
        throw rpcError;
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row) {
        throw new Error(
          'get_dashboard_stats n’a retourné aucune statistique.',
        );
      }

      const nextStats = mapDashboardStatsRow(
        row as DashboardStatsRpcRow,
      );

      console.log('[AdminOverview] SET STATS', nextStats);
      setStats(nextStats);
    } catch (loadError) {
      console.error(
        'Erreur chargement statistiques Overview Admin:',
        loadError,
      );

      const emptyStats = {
        ...EMPTY_ADMIN_OVERVIEW_STATS,
        periodDays,
      };

      console.log('[AdminOverview] SET STATS AFTER ERROR', emptyStats);
      setStats(emptyStats);

      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Impossible de charger les statistiques.',
      );
    } finally {
      console.log('[AdminOverview] LOADING COMPLETE');
      setLoading(false);
    }
  }, [periodDays]);

  useEffect(() => {
    console.log('[AdminOverview] HOOK MOUNT', { periodDays });

    void loadStats();

    return () => {
      console.log('[AdminOverview] HOOK UNMOUNT', { periodDays });
    };
  }, [loadStats, periodDays]);

  console.log('[AdminOverview] HOOK EFFECT INPUTS', {
    periodDays,
    loadStats,
  });

  console.log('[AdminOverview] RENDER', {
    loading,
    stats,
  });

  return {
    stats,
    loading,
    error,
    reload: loadStats,
  };
}
