import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

export type AdminOverviewEvolutionPoint = {
  date: string;
  count: number;
};

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
  realRoi: number;
  rewardEfficiency: number;
  pointsPerCurrency: number;

  reviewsEvolution: AdminOverviewEvolutionPoint[];
  scansEvolution: AdminOverviewEvolutionPoint[];
};

export type AdminOverviewStatsState = {
  status: 'loading' | 'success' | 'error';
  data: AdminOverviewStats | null;
  error: string | null;
};

type DashboardStatsRpcRow = Record<string, unknown>;

type AdminOverviewEvolutionRpcResult = {
  reviewsEvolution?: unknown;
  scansEvolution?: unknown;
};

const INITIAL_STATE: AdminOverviewStatsState = {
  status: 'loading',
  data: null,
  error: null,
};

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function evolutionValue(value: unknown): AdminOverviewEvolutionPoint[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') {
        return null;
      }

      const row = item as Record<string, unknown>;

      return {
        date: String(row.date ?? ''),
        count: numberValue(row.count),
      };
    })
    .filter(
      (item): item is AdminOverviewEvolutionPoint =>
        item !== null && item.date.length > 0,
    );
}

function mapDashboardStatsRow(
  row: DashboardStatsRpcRow,
  evolution: AdminOverviewEvolutionRpcResult,
): AdminOverviewStats {
  return {
    periodDays: numberValue(row.period_days),

    reviewsCount: numberValue(row.reviews_count),
    averageRating: numberValue(row.average_rating),
    positiveReviewsCount: numberValue(row.positive_reviews_count),
    negativeReviewsCount: numberValue(row.negative_reviews_count),
    pendingReviewsCount: numberValue(row.pending_reviews_count),

    loyaltyCustomersCount: numberValue(row.loyalty_customers_count),
    returningCustomersCount: numberValue(row.returning_customers_count),
    activeCustomersCount: numberValue(row.active_customers_count),
    visitsTotal: numberValue(row.visits_total),

    pointsBalanceTotal: numberValue(row.points_balance_total),
    pointsEarnedTotal: numberValue(row.points_earned_total),
    pointsRedeemedTotal: numberValue(row.points_redeemed_total),

    analyticsEventsCount: numberValue(row.analytics_events_count),
    currentAnalyticsEventsCount: numberValue(
      row.current_analytics_events_count,
    ),

    currentReviewsCount: numberValue(row.current_reviews_count),
    previousReviewsCount: numberValue(row.previous_reviews_count),
    reviewGrowth: numberValue(row.review_growth),

    currentRegistrationsCount: numberValue(
      row.current_registrations_count,
    ),
    previousRegistrationsCount: numberValue(
      row.previous_registrations_count,
    ),
    registrationGrowth: numberValue(row.registration_growth),

    returningRate: numberValue(row.returning_rate),
    activeRate: numberValue(row.active_rate),
    redemptionRate: numberValue(row.redemption_rate),

    currentRevenue: numberValue(row.current_revenue),
    previousRevenue: numberValue(row.previous_revenue),
    totalRevenue: numberValue(row.total_revenue),
    currentTransactionsCount: numberValue(
      row.current_transactions_count,
    ),
    averageBasket: numberValue(row.average_basket),

    currentRedemptionsCount: numberValue(
      row.current_redemptions_count,
    ),
    previousRedemptionsCount: numberValue(
      row.previous_redemptions_count,
    ),
    redemptionGrowth: numberValue(row.redemption_growth),

    pointsRedeemedOnPeriod: numberValue(
      row.points_redeemed_on_period,
    ),
    rewardValueOnPeriod: numberValue(row.reward_value_on_period),
    redemptionRevenue: numberValue(row.redemption_revenue),
    rewardCostOnPeriod: numberValue(row.reward_cost_on_period),
    netContribution: numberValue(row.net_contribution),
    realRoi: numberValue(row.real_roi),
    rewardEfficiency: numberValue(row.reward_efficiency),
    pointsPerCurrency: numberValue(row.points_per_currency),

    reviewsEvolution: evolutionValue(evolution.reviewsEvolution),
    scansEvolution: evolutionValue(evolution.scansEvolution),
  };
}

export function useAdminOverviewStats(periodDays = 30) {
  const [state, setState] =
    useState<AdminOverviewStatsState>(INITIAL_STATE);

  useEffect(() => {
    let mounted = true;

    const loadStats = async () => {
      console.log('[AdminOverview] NETWORK START', { periodDays });

      try {
        const [kpiResult, evolutionResult] = await Promise.all([
          supabase.rpc('get_dashboard_stats', {
            p_establishment_id: null,
            p_days: periodDays,
          }),
          supabase.rpc('get_admin_overview_evolution', {
            p_days: periodDays,
          }),
        ]);

        console.log('[AdminOverview] NETWORK RESPONSE', {
          kpiError: kpiResult.error,
          evolutionError: evolutionResult.error,
          hasKpiData: Boolean(kpiResult.data),
          hasEvolutionData: Boolean(evolutionResult.data),
        });

        console.log('[OverviewEvolution] RPC result:', {
          reviewsEvolution: evolutionResult.data?.reviewsEvolution,
          scansEvolution: evolutionResult.data?.scansEvolution,
          reviewsPoints: evolutionResult.data?.reviewsEvolution?.length,
          scansPoints: evolutionResult.data?.scansEvolution?.length,
          scansTotal: evolutionResult.data?.scansEvolution?.reduce(
            (sum: number, point: { count?: number }) =>
              sum + Number(point.count || 0),
            0,
          ),
        });

        if (kpiResult.error) {
          throw kpiResult.error;
        }

        if (evolutionResult.error) {
          throw evolutionResult.error;
        }

        const kpiRow = Array.isArray(kpiResult.data)
          ? kpiResult.data[0]
          : kpiResult.data;

        if (!kpiRow) {
          throw new Error('Aucune statistique KPI retournée.');
        }

        if (!evolutionResult.data) {
          throw new Error(
            'Aucune évolution temporelle retournée.',
          );
        }

        const nextData = mapDashboardStatsRow(
          kpiRow as DashboardStatsRpcRow,
          evolutionResult.data as AdminOverviewEvolutionRpcResult,
        );

        console.log('[AdminOverview] DATA RECEIVED', nextData);

        if (!mounted) {
          console.log('[AdminOverview] COMPONENT NO LONGER MOUNTED');
          return;
        }

        const nextState: AdminOverviewStatsState = {
          status: 'success',
          data: nextData,
          error: null,
        };

        console.log('[AdminOverview] STATE WRITE', nextState);

        setState(nextState);

        console.log('[AdminOverview] STATE WRITE COMPLETE');
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger les statistiques.';

        const nextState: AdminOverviewStatsState = {
          status: 'error',
          data: null,
          error: message,
        };

        console.log('[AdminOverview] STATE ERROR WRITE', nextState);

        setState(nextState);
      }
    };

    void loadStats();

    return () => {
      mounted = false;
    };
  }, [periodDays]);

  return state;
}
