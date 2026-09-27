import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type AdminOverviewStats = {
  reviews: number;
  averageRating: number;
  loyaltyCustomers: number;
  analyticsEvents: number;
};

type StatsState = {
  status: 'loading' | 'success' | 'error';
  data: AdminOverviewStats | null;
  error: string | null;
};

const INITIAL_STATE: StatsState = {
  status: 'loading',
  data: null,
  error: null,
};

function numberValue(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function useAdminOverviewStatsV2() {
  const [state, setState] = useState<StatsState>(INITIAL_STATE);

  useEffect(() => {
    let mounted = true;

    console.log('[AdminOverviewV2] MOUNT');

    const loadStats = async () => {
      console.log('[AdminOverviewV2] NETWORK START');

      try {
        const { data, error } = await supabase.rpc(
          'get_dashboard_stats',
          {
            p_establishment_id: null,
            p_days: 30,
          },
        );

        console.log('[AdminOverviewV2] NETWORK RESPONSE', {
          hasData: Boolean(data),
          error,
        });

        if (error) throw error;

        const row = Array.isArray(data) ? data[0] : data;

        if (!row) {
          throw new Error('Aucune statistique retournée.');
        }

        const nextData: AdminOverviewStats = {
          reviews: numberValue(row.reviews_count),
          averageRating: numberValue(row.average_rating),
          loyaltyCustomers: numberValue(row.loyalty_customers_count),
          analyticsEvents: numberValue(row.analytics_events_count),
        };

        console.log('[AdminOverviewV2] DATA RECEIVED', nextData);

        if (!mounted) {
          console.log('[AdminOverviewV2] COMPONENT NO LONGER MOUNTED');
          return;
        }

        const nextState: StatsState = {
          status: 'success',
          data: nextData,
          error: null,
        };

        console.log('[AdminOverviewV2] STATE WRITE', nextState);

        setState(nextState);

        console.log('[AdminOverviewV2] STATE WRITE COMPLETE');
      } catch (loadError) {
        if (!mounted) {
          return;
        }

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger les statistiques.';

        const nextState: StatsState = {
          status: 'error',
          data: null,
          error: message,
        };

        console.log('[AdminOverviewV2] STATE ERROR WRITE', nextState);

        setState(nextState);
      }
    };

    void loadStats();

    return () => {
      console.log('[AdminOverviewV2] UNMOUNT');
      mounted = false;
    };
  }, []);

  console.log('[AdminOverviewV2] RENDER STATE', state);

  return state;
}
