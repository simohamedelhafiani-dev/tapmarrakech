import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type RecentLoyaltyCustomer = {
  id: string;
  establishment_id: string;
  establishment_name: string;
  first_name: string;
  last_name: string | null;
  created_at: string;
  visit_count: number;
  last_visit_at: string | null;
};

type LoyaltyCustomerRow = {
  id: string;
  establishment_id: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  visit_count: number | null;
  last_visit_at: string | null;
  establishment:
    | { name: string | null }
    | { name: string | null }[]
    | null;
};

function getEstablishmentName(
  relation:
    | { name: string | null }
    | { name: string | null }[]
    | null
    | undefined
): string {
  if (Array.isArray(relation)) {
    return relation[0]?.name?.trim() || 'Établissement';
  }

  return relation?.name?.trim() || 'Établissement';
}

function getCustomerFirstName(value: string | null): string {
  return value?.trim() || 'Client';
}

function mapLoyaltyCustomer(row: LoyaltyCustomerRow): RecentLoyaltyCustomer {
  return {
    id: row.id,
    establishment_id: row.establishment_id,
    establishment_name: getEstablishmentName(row.establishment),
    first_name: getCustomerFirstName(row.first_name),
    last_name: row.last_name?.trim() || null,
    created_at: row.created_at,
    visit_count: Number(row.visit_count ?? 0),
    last_visit_at: row.last_visit_at,
  };
}

export function useRecentLoyaltyCustomers(limit = 10) {
  const [customers, setCustomers] = useState<RecentLoyaltyCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: queryError } = await supabase
        .from('loyalty_customers')
        .select(
          'id, establishment_id, first_name, last_name, created_at, visit_count, last_visit_at, establishment:establishments(name)'
        )
        .order('created_at', { ascending: false })
        .limit(limit);

      if (queryError) {
        throw queryError;
      }

      const mapped = ((data ?? []) as LoyaltyCustomerRow[]).map(
        mapLoyaltyCustomer
      );

      console.log('[RecentLoyaltyCustomers] RecentLoyaltyCustomer[] final:', mapped);

      setCustomers(mapped);
    } catch (caughtError) {
      const normalizedError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Impossible de charger les clients fidélité récents.');

      console.error(
        '[RecentLoyaltyCustomers] Erreur chargement clients récents:',
        normalizedError
      );

      setCustomers([]);
      setError(normalizedError);
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    customers,
    loading,
    error,
    reload: load,
  };
}
