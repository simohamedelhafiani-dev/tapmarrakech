import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type ActivityEventType =
  | 'review'
  | 'loyalty_customer'
  | 'establishment';

export type ActivityEventMetadata = {
  rating?: number;
  reviewer_name?: string;
  customer_name?: string;
  comment?: string;
};

export type ActivityEvent = {
  id: string;
  type: ActivityEventType;
  created_at: string;
  establishment_id?: string;
  establishment_name?: string;
  title: string;
  description?: string;
  metadata?: ActivityEventMetadata;
};

type ReviewActivityRow = {
  id: string;
  establishment_id: string;
  rating: number;
  comment: string | null;
  name: string | null;
  created_at: string;
  establishment:
    | { name: string | null }
    | { name: string | null }[]
    | null;
};

type LoyaltyCustomerActivityRow = {
  id: string;
  establishment_id: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  establishment:
    | { name: string | null }
    | { name: string | null }[]
    | null;
};

type EstablishmentActivityRow = {
  id: string;
  name: string;
  created_at: string;
};

function getEstablishmentName(
  relation:
    | { name: string | null }
    | { name: string | null }[]
    | null
    | undefined
): string | undefined {
  if (Array.isArray(relation)) {
    return relation[0]?.name ?? undefined;
  }

  return relation?.name ?? undefined;
}

function getCustomerName(
  firstName: string | null,
  lastName: string | null
): string | undefined {
  const name = [firstName, lastName]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(' ');

  return name || undefined;
}

function mapReview(row: ReviewActivityRow): ActivityEvent {
  const establishmentName = getEstablishmentName(row.establishment);
  const reviewerName = row.name?.trim() || undefined;
  const rating = Number(row.rating);

  return {
    id: row.id,
    type: 'review',
    created_at: row.created_at,
    establishment_id: row.establishment_id,
    establishment_name: establishmentName,
    title: `Nouvel avis ${rating} étoile${rating > 1 ? 's' : ''}`,
    description: reviewerName
      ? `${reviewerName} a laissé un avis${establishmentName ? ` pour ${establishmentName}` : ''}`
      : `Un client a laissé un avis${establishmentName ? ` pour ${establishmentName}` : ''}`,
    metadata: {
      rating,
      reviewer_name: reviewerName,
      comment: row.comment?.trim() || undefined,
    },
  };
}

function mapLoyaltyCustomer(row: LoyaltyCustomerActivityRow): ActivityEvent {
  const establishmentName = getEstablishmentName(row.establishment);
  const customerName = getCustomerName(row.first_name, row.last_name);

  return {
    id: row.id,
    type: 'loyalty_customer',
    created_at: row.created_at,
    establishment_id: row.establishment_id,
    establishment_name: establishmentName,
    title: 'Nouveau client fidélité',
    description: customerName
      ? `${customerName} a rejoint le programme de fidélité${establishmentName ? ` de ${establishmentName}` : ''}`
      : `Un nouveau client a rejoint le programme de fidélité${establishmentName ? ` de ${establishmentName}` : ''}`,
    metadata: {
      customer_name: customerName,
    },
  };
}

function mapEstablishment(row: EstablishmentActivityRow): ActivityEvent {
  return {
    id: row.id,
    type: 'establishment',
    created_at: row.created_at,
    establishment_id: row.id,
    establishment_name: row.name,
    title: 'Nouvel établissement',
    description: `${row.name} a été ajouté à TapMarrakech`,
  };
}

function getCreatedAtTimestamp(value: string): number {
  const timestamp = Date.parse(value);

  if (Number.isNaN(timestamp)) {
    throw new Error(`Date created_at invalide: ${value}`);
  }

  return timestamp;
}

export function useRecentActivity() {
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        { data: reviewRows, error: reviewsError },
        { data: loyaltyRows, error: loyaltyError },
        { data: establishmentRows, error: establishmentsError },
      ] = await Promise.all([
        supabase
          .from('reviews')
          .select('id, establishment_id, rating, comment, name, created_at, establishment:establishments(name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('loyalty_customers')
          .select('id, establishment_id, first_name, last_name, created_at, establishment:establishments(name)')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('establishments')
          .select('id, name, created_at')
          .order('created_at', { ascending: false })
          .limit(5),
      ]);

      const queryError =
        reviewsError ?? loyaltyError ?? establishmentsError;

      if (queryError) {
        throw queryError;
      }

      const merged: ActivityEvent[] = [
        ...((reviewRows ?? []) as ReviewActivityRow[]).map(mapReview),
        ...((loyaltyRows ?? []) as LoyaltyCustomerActivityRow[]).map(
          mapLoyaltyCustomer
        ),
        ...((establishmentRows ?? []) as EstablishmentActivityRow[]).map(
          mapEstablishment
        ),
      ]
        .sort(
          (a, b) =>
            getCreatedAtTimestamp(b.created_at) -
            getCreatedAtTimestamp(a.created_at)
        )
        .slice(0, 10);

      const chronologicalDesc = merged.every((event, index, array) => {
        if (index === 0) return true;

        return (
          getCreatedAtTimestamp(array[index - 1].created_at) >=
          getCreatedAtTimestamp(event.created_at)
        );
      });

      console.log('[RecentActivity] Sort proof:', {
        chronologicalDesc,
        timestamps: merged.map((event) => ({
          id: event.id,
          type: event.type,
          created_at: event.created_at,
          timestamp: getCreatedAtTimestamp(event.created_at),
        })),
      });

      if (!chronologicalDesc) {
        throw new Error('Recent Activity: ordre chronologique invalide.');
      }

      console.log('[RecentActivity] ActivityEvent[] final:', merged);

      setActivities(merged);
    } catch (caughtError) {
      const normalizedError =
        caughtError instanceof Error
          ? caughtError
          : new Error('Impossible de charger l’activité récente.');

      console.error(
        '[RecentActivity] Erreur chargement activité:',
        normalizedError
      );

      setActivities([]);
      setError(normalizedError);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return {
    activities,
    loading,
    error,
    reload: load,
  };
}
