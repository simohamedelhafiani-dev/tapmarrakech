import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type EstablishmentListItem = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  business_type: string | null;
  logo_url: string | null;
  created_at: string;
  subscription: {
    status: string;
    plan_name: string | null;
    price_mad: number | null;
    interval: string | null;
    current_period_end: string | null;
  } | null;
};

type EstablishmentRow = {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  business_type: string | null;
  logo_url: string | null;
  created_at: string;
};

type SubscriptionRow = {
  establishment_id: string;
  status: string;
  plan_id: string;
  current_period_end: string | null;
  created_at: string;
  plan:
    | {
        name: string | null;
        price_mad: number | null;
        interval: string | null;
      }
    | {
        name: string | null;
        price_mad: number | null;
        interval: string | null;
      }[]
    | null;
};

function getPlan(
  relation:
    | {
        name: string | null;
        price_mad: number | null;
        interval: string | null;
      }
    | {
        name: string | null;
        price_mad: number | null;
        interval: string | null;
      }[]
    | null
) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null;
  }

  return relation;
}

export function useEstablishments() {
  const [establishments, setEstablishments] = useState<EstablishmentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [establishmentsResult, subscriptionsResult] = await Promise.all([
        supabase
          .from('establishments')
          .select('id, name, slug, city, business_type, logo_url, created_at')
          .order('created_at', { ascending: false }),
        supabase
          .from('subscriptions')
          .select(
            'establishment_id, status, plan_id, current_period_end, created_at, plan:subscription_plans(name, price_mad, interval)'
          )
          .order('created_at', { ascending: false }),
      ]);

      if (establishmentsResult.error) {
        throw establishmentsResult.error;
      }

      if (subscriptionsResult.error) {
        throw subscriptionsResult.error;
      }

      const latestSubscriptionByEstablishment = new Map<string, SubscriptionRow>();

      for (const row of (subscriptionsResult.data ?? []) as SubscriptionRow[]) {
        if (!latestSubscriptionByEstablishment.has(row.establishment_id)) {
          latestSubscriptionByEstablishment.set(row.establishment_id, row);
        }
      }

      const mapped: EstablishmentListItem[] = (
        (establishmentsResult.data ?? []) as EstablishmentRow[]
      ).map((row) => {
        const subscriptionRow = latestSubscriptionByEstablishment.get(row.id);

        if (!subscriptionRow) {
          return {
            ...row,
            subscription: null,
          };
        }

        const plan = getPlan(subscriptionRow.plan);

        return {
          ...row,
          subscription: {
            status: subscriptionRow.status,
            plan_name: plan?.name ?? null,
            price_mad:
              subscriptionRow.status === 'active'
                ? Number(plan?.price_mad ?? 0)
                : plan?.price_mad != null
                  ? Number(plan.price_mad)
                  : null,
            interval: plan?.interval ?? null,
            current_period_end: subscriptionRow.current_period_end,
          },
        };
      });

      console.log('[Establishments] EstablishmentListItem[] final:', mapped);

      setEstablishments(mapped);
    } catch (caughtError) {
      const normalizedError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Impossible de charger les établissements.');

      console.error(
        '[Establishments] Erreur chargement établissements:',
        normalizedError
      );

      setEstablishments([]);
      setError(normalizedError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    establishments,
    loading,
    error,
    reload: load,
  };
}
