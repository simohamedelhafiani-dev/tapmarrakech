import { supabase } from '@/lib/supabase';

export type SubscriptionAccess = {
  establishment_id: string;
  subscription_status: 'trial' | 'active' | string;
  plan_id: string | null;
  plan_name: string;
  features: string[];
  plan_price_mad: number;
  plan_interval: string;
  current_period_end: string | null;
  trial_days: number;
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

export type SubscriptionTheme = {
  primary: string;
  primaryHover: string;
  accent: string;
  sidebar: string;
};

export function getSubscriptionTheme(access: SubscriptionAccess | null | undefined): SubscriptionTheme {
  // Trial keeps the standard TapMarrakech interface for every establishment.
  if (!access || access.subscription_status === 'trial') {
    return { primary: '#17352a', primaryHover: '#214c40', accent: '#c8a96b', sidebar: '#17352a' };
  }

  const name = access.plan_name.trim().toLowerCase();
  if (name === 'basic') {
    return { primary: '#2563eb', primaryHover: '#1d4ed8', accent: '#93c5fd', sidebar: '#1e3a8a' };
  }
  if (name === 'enterprise') {
    return { primary: '#111827', primaryHover: '#1f2937', accent: '#d4af37', sidebar: '#0b1220' };
  }
  return { primary: '#17352a', primaryHover: '#214c40', accent: '#c8a96b', sidebar: '#17352a' };
}

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
    const rawFeatures = item.features ?? item.plan_features ?? [];
    let features: string[] = [];

    if (Array.isArray(rawFeatures)) {
      features = rawFeatures.map(String);
    } else if (typeof rawFeatures === 'string') {
      try {
        const parsed = JSON.parse(rawFeatures);
        if (Array.isArray(parsed)) features = parsed.map(String);
      } catch {
        features = rawFeatures
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
      }
    }

    return {
      establishment_id: String(item.establishment_id ?? ''),
      subscription_status: String(item.subscription_status ?? ''),
      plan_id: item.plan_id ? String(item.plan_id) : null,
      plan_name: String(item.plan_name || item.name || ''),
      features,
      plan_price_mad: Number(item.plan_price_mad ?? item.price_mad ?? 0),
      plan_interval: String(item.plan_interval ?? item.interval ?? 'month'),
      current_period_end: item.current_period_end ? String(item.current_period_end) : null,
      trial_days: Number(item.trial_days ?? 0),
    };
  });

  return establishmentId
    ? accesses.filter(
        (access: SubscriptionAccess) => access.establishment_id === establishmentId
      )
    : accesses;
}