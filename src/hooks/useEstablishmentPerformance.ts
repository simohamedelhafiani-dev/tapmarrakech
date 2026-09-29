import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type EstablishmentPerformance = {
  establishment_id: string;
  establishment_name: string;
  reviews: number;
  average_rating: number;
  scans: number;
  loyalty_customers: number;
  visits: number;
};

type EstablishmentRow = {
  id: string;
  name: string | null;
};

type ReviewRow = {
  establishment_id: string;
  rating: number | null;
};

type ScanRow = {
  establishment_id: string;
  event_type: string | null;
};

type LoyaltyRow = {
  establishment_id: string;
  visit_count: number | null;
};

export function useEstablishmentPerformance() {
  const [performances, setPerformances] = useState<EstablishmentPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        establishmentsResult,
        reviewsResult,
        analyticsResult,
        loyaltyResult,
      ] = await Promise.all([
        supabase
          .from('establishments')
          .select('id, name')
          .order('created_at', { ascending: false }),
        supabase
          .from('reviews')
          .select('establishment_id, rating'),
        supabase
          .from('analytics_events')
          .select('establishment_id, event_type')
          .eq('event_type', 'page_view'),
        supabase
          .from('loyalty_customers')
          .select('establishment_id, visit_count'),
      ]);

      const firstError =
        establishmentsResult.error ||
        reviewsResult.error ||
        analyticsResult.error ||
        loyaltyResult.error;

      if (firstError) {
        throw firstError;
      }

      const establishments = (establishmentsResult.data ?? []) as EstablishmentRow[];
      const reviews = (reviewsResult.data ?? []) as ReviewRow[];
      const scans = (analyticsResult.data ?? []) as ScanRow[];
      const loyaltyCustomers = (loyaltyResult.data ?? []) as LoyaltyRow[];

      const reviewStats = new Map<
        string,
        { count: number; ratingSum: number; ratingCount: number }
      >();

      for (const review of reviews) {
        const current = reviewStats.get(review.establishment_id) ?? {
          count: 0,
          ratingSum: 0,
          ratingCount: 0,
        };

        current.count += 1;

        if (typeof review.rating === 'number') {
          current.ratingSum += review.rating;
          current.ratingCount += 1;
        }

        reviewStats.set(review.establishment_id, current);
      }

      const scanStats = new Map<string, number>();

      for (const scan of scans) {
        scanStats.set(
          scan.establishment_id,
          (scanStats.get(scan.establishment_id) ?? 0) + 1
        );
      }

      const loyaltyStats = new Map<
        string,
        { customers: number; visits: number }
      >();

      for (const customer of loyaltyCustomers) {
        const current = loyaltyStats.get(customer.establishment_id) ?? {
          customers: 0,
          visits: 0,
        };

        current.customers += 1;
        current.visits += Number(customer.visit_count ?? 0);

        loyaltyStats.set(customer.establishment_id, current);
      }

      const mapped: EstablishmentPerformance[] = establishments.map(
        (establishment) => {
          const reviewStat = reviewStats.get(establishment.id);
          const loyaltyStat = loyaltyStats.get(establishment.id);

          return {
            establishment_id: establishment.id,
            establishment_name: establishment.name?.trim() || 'Établissement',
            reviews: reviewStat?.count ?? 0,
            average_rating:
              reviewStat && reviewStat.ratingCount > 0
                ? Number(
                    (reviewStat.ratingSum / reviewStat.ratingCount).toFixed(2)
                  )
                : 0,
            scans: scanStats.get(establishment.id) ?? 0,
            loyalty_customers: loyaltyStat?.customers ?? 0,
            visits: loyaltyStat?.visits ?? 0,
          };
        }
      );

      console.log(
        '[EstablishmentPerformance] EstablishmentPerformance[] final:',
        mapped
      );

      setPerformances(mapped);
    } catch (caughtError) {
      const normalizedError =
        caughtError instanceof Error
          ? caughtError
          : new Error(
              'Impossible de charger les performances des établissements.'
            );

      console.error(
        '[EstablishmentPerformance] Erreur chargement performances:',
        normalizedError
      );

      setPerformances([]);
      setError(normalizedError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    performances,
    loading,
    error,
    reload: load,
  };
}
