import { supabase } from '@/lib/supabase';

export type SubscriptionAccess = {
  establishment_id: string;
  subscription_status: 'trial' | 'active' | string;
  plan_id: string;
  plan_name: string;
  features: string[];
};

export const FEATURE_LABELS = {
  publicPage: 'Page publique',
  reviews: 'Avis & réputation',
  contact: 'Contact',
  loyalty: 'Fidélité',
  menu: 'Menu',
  promotions: 'Promotions',
  analytics: 'Analytics',
  ai: 'Assistant IA',
  advanced: 'Gestion avancée',
} as const;

export type SubscriptionFeature = keyof typeof FEATURE_LABELS;

const FEATURE_ALIASES: Record<SubscriptionFeature, string[]> = {
  publicPage: ['Page publique'],
  reviews: ['Avis & réputation', 'Avis', 'Réputation'],
  contact: ['Contact'],
  loyalty: ['Fidélité', 'Programme fidélité'],
  menu: ['Menu'],
  promotions: ['Promotions', 'Promotion'],
  analytics: ['Analytics', 'Analytiques'],
  ai: ['Assistant IA', 'IA'],
  advanced: ['Gestion avancée'],
};

export function planHasFeature(
  access: SubscriptionAccess | null | undefined,
  feature: SubscriptionFeature
) {
  if (!access) return false;

  const normalized = new Set(
    (access.features ?? []).map((item) =>
      String(item).trim().toLowerCase()
    )
  );

  return FEATURE_ALIASES[feature].some((label) =>
    normalized.has(label.toLowerCase())
  );
}

export async function getMySubscriptionAccess(
  establishmentId?: string
): Promise<SubscriptionAccess[]> {
  const { data, error } = await supabase.rpc(
    'get_my_subscription_features'
  );

  if (error) {
    console.error(
      'Erreur chargement des droits abonnement:',
      error
    );
    return [];
  }

  const accesses = (data ?? []).map((row: unknown) => {
    const item = row as Record<string, unknown>;

    return {
    establishment_id: String(item.establishment_id ?? ''),
    subscription_status: String(item.subscription_status ?? ''),
    plan_id: item.plan_id ? String(item.plan_id) : null,
    plan_name: String(item.plan_name ?? ''),
    features: Array.isArray(item.features) ? item.features.map(String) : [],
    };
  });

  return establishmentId
    ? accesses.filter(
        (access: SubscriptionAccess) => access.establishment_id === establishmentId
      )
    : accesses;
}