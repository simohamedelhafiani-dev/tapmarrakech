import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type AdminOverviewV2Stats = {
  reviews: number;
  rating: number;
  loyaltyCustomers: number;
  analyticsEvents: number;
};

const INITIAL_STATS: AdminOverviewV2Stats | null = null;

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : Number(value ?? 0);
}

export function useAdminOverviewV2Stats() {
  const [stats, setStats] = useState<AdminOverviewV2Stats | null>(INITIAL_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc('get_dashboard_stats', {
          p_establishment_id: null,
          p_days: 30,
        });

        if (rpcError) throw rpcError;

        const row = Array.isArray(data) ? data[0] : data;
        if (!row) throw new Error('Aucune statistique retournée.');

        const nextStats: AdminOverviewV2Stats = {
          reviews: toNumber(row.reviews_count),
          rating: toNumber(row.average_rating),
          loyaltyCustomers: toNumber(row.loyalty_customers_count),
          analyticsEvents: toNumber(row.analytics_events_count),
        };

        if (!active) return;

        setStats(nextStats);
        console.log('[AdminOverviewV2] STATS WRITTEN', nextStats);
      } catch (loadError) {
        if (!active) return;

        const message =
          loadError instanceof Error
            ? loadError.message
            : 'Impossible de charger les statistiques.';

        setError(message);
        console.error('[AdminOverviewV2] LOAD ERROR', loadError);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  return { stats, loading, error };
}
