import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type EstablishmentProfile = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  business_type: string | null;
  ai_business_type_id: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  whatsapp_number: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  tiktok_url: string | null;
  description: string | null;
};

export type ProfileValidationErrors = Partial<
  Record<'name' | 'slug' | 'phone' | 'email' | 'website_url' | 'whatsapp_number' | 'instagram_url' | 'facebook_url' | 'tiktok_url' | 'description' | 'ai_business_type_id', string>
>;

export type SlugStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid' | 'error';

const PROFILE_FIELDS: (keyof EstablishmentProfile)[] = [
  'name',
  'slug',
  'logo_url',
  'business_type',
  'ai_business_type_id',
  'address',
  'city',
  'phone',
  'email',
  'website_url',
  'whatsapp_number',
  'instagram_url',
  'facebook_url',
  'tiktok_url',
  'description',
];

const EMPTY_TO_NULL = (value: string | null | undefined) => {
  const normalized = value?.trim() ?? '';
  return normalized === '' ? null : normalized;
};

const normalizeProfile = (row: Record<string, unknown>): EstablishmentProfile => ({
  id: String(row.id),
  name: String(row.name ?? ''),
  slug: String(row.slug ?? ''),
  logo_url: EMPTY_TO_NULL(row.logo_url as string | null),
  business_type: EMPTY_TO_NULL(row.business_type as string | null),
  ai_business_type_id: EMPTY_TO_NULL(row.ai_business_type_id as string | null),
  address: EMPTY_TO_NULL(row.address as string | null),
  city: EMPTY_TO_NULL(row.city as string | null),
  phone: EMPTY_TO_NULL(row.phone as string | null),
  email: EMPTY_TO_NULL(row.email as string | null),
  website_url: EMPTY_TO_NULL(row.website_url as string | null),
  whatsapp_number: EMPTY_TO_NULL(row.whatsapp_number as string | null),
  instagram_url: EMPTY_TO_NULL(row.instagram_url as string | null),
  facebook_url: EMPTY_TO_NULL(row.facebook_url as string | null),
  tiktok_url: EMPTY_TO_NULL(row.tiktok_url as string | null),
  description: EMPTY_TO_NULL(row.description as string | null),
});

const normalizeForComparison = (profile: EstablishmentProfile) =>
  PROFILE_FIELDS.reduce<Record<string, unknown>>((result, field) => {
    result[field] = profile[field];
    return result;
  }, {});

export const isValidSlug = (slug: string) =>
  /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);

const isValidPhone = (value: string) =>
  /^\+?[0-9][0-9 .()-]{6,19}$/.test(value.trim());

const isValidUrl = (value: string) => {
  try {
    const url = new URL(value.trim());
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
};

const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

export function validateEstablishmentProfile(
  profile: EstablishmentProfile
): ProfileValidationErrors {
  const errors: ProfileValidationErrors = {};

  if (!profile.name.trim()) {
    errors.name = 'Le nom est obligatoire.';
  } else if (profile.name.trim().length > 120) {
    errors.name = 'Le nom ne peut pas dépasser 120 caractères.';
  }

  if (!profile.slug.trim()) {
    errors.slug = 'Le slug est obligatoire.';
  } else if (!isValidSlug(profile.slug.trim())) {
    errors.slug = 'Le slug doit contenir uniquement des lettres minuscules, chiffres et tirets.';
  }

  if (profile.email && !isValidEmail(profile.email)) {
    errors.email = 'Adresse email invalide.';
  }

  for (const [field, label] of [
    ['phone', 'Téléphone'],
    ['whatsapp_number', 'WhatsApp'],
  ] as const) {
    const value = profile[field];
    if (value && !isValidPhone(value)) {
      errors[field] = `${label} invalide.`;
    }
  }

  for (const [field, label] of [
    ['website_url', 'Site web'],
    ['instagram_url', 'Instagram'],
    ['facebook_url', 'Facebook'],
    ['tiktok_url', 'TikTok'],
  ] as const) {
    const value = profile[field];
    if (value && !isValidUrl(value)) {
      errors[field] = `${label} : URL invalide.`;
    }
  }

  if (profile.description && profile.description.length > 2000) {
    errors.description = 'La description ne peut pas dépasser 2000 caractères.';
  }

  return errors;
}

export function useEstablishmentProfile(establishmentId: string | null) {
  const [profile, setProfile] = useState<EstablishmentProfile | null>(null);
  const [initialProfile, setInitialProfile] = useState<EstablishmentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [validationErrors, setValidationErrors] = useState<ProfileValidationErrors>({});
  const [slugStatus, setSlugStatus] = useState<SlugStatus>('idle');
  const [slugMessage, setSlugMessage] = useState('');
  const slugRequestRef = useRef(0);

  const loadProfile = useCallback(async () => {
    if (!establishmentId) {
      setProfile(null);
      setInitialProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: fetchError } = await supabase
      .from('establishments')
      .select('*')
      .eq('id', establishmentId)
      .maybeSingle();

    if (fetchError) {
      setError(fetchError);
      setProfile(null);
      setInitialProfile(null);
      setLoading(false);
      console.error('[EstablishmentProfile] fetch error:', fetchError);
      return;
    }

    if (!data) {
      const notFound = new Error('Établissement introuvable.');
      setError(notFound);
      setProfile(null);
      setInitialProfile(null);
      setLoading(false);
      return;
    }

    const normalized = normalizeProfile(data as Record<string, unknown>);
    setProfile(normalized);
    setInitialProfile(normalized);
    setValidationErrors({});
    setSlugStatus('idle');
    setSlugMessage('');
    setLoading(false);

    console.log('[EstablishmentProfile] FETCH SUCCESS:', {
      establishmentId,
      profile: normalized,
    });
  }, [establishmentId]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (!profile || !establishmentId) {
      setSlugStatus('idle');
      setSlugMessage('');
      return;
    }

    const slug = profile.slug.trim();
    if (!slug) {
      setSlugStatus('invalid');
      setSlugMessage('Le slug est obligatoire.');
      return;
    }

    if (!isValidSlug(slug)) {
      setSlugStatus('invalid');
      setSlugMessage('Minuscules, chiffres et tirets uniquement.');
      return;
    }

    if (initialProfile?.slug === slug) {
      setSlugStatus('available');
      setSlugMessage('Slug actuel.');
      return;
    }

    const requestId = ++slugRequestRef.current;
    setSlugStatus('checking');
    setSlugMessage('Vérification de disponibilité…');

    const timer = window.setTimeout(async () => {
      const { data, error: slugError } = await supabase
        .from('establishments')
        .select('id')
        .eq('slug', slug)
        .neq('id', establishmentId)
        .limit(1);

      if (requestId !== slugRequestRef.current) return;

      if (slugError) {
        setSlugStatus('error');
        setSlugMessage(slugError.message);
        return;
      }

      if ((data ?? []).length > 0) {
        setSlugStatus('taken');
        setSlugMessage('Ce slug est déjà utilisé.');
      } else {
        setSlugStatus('available');
        setSlugMessage('Slug disponible.');
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [profile?.slug, initialProfile?.slug, establishmentId]);

  const isDirty = useMemo(() => {
    if (!profile || !initialProfile) return false;
    return JSON.stringify(normalizeForComparison(profile)) !== JSON.stringify(normalizeForComparison(initialProfile));
  }, [profile, initialProfile]);

  const updateField = useCallback(
    <K extends keyof EstablishmentProfile>(field: K, value: EstablishmentProfile[K]) => {
      setProfile((current) => (current ? { ...current, [field]: value } : current));
      setError(null);
    },
    []
  );

  const updateProfile = useCallback(
    async (patch: Partial<EstablishmentProfile> = {}) => {
      if (!profile || !establishmentId) {
        return { success: false, error: new Error('Profil indisponible.') };
      }

      const nextProfile = { ...profile, ...patch };
      const errors = validateEstablishmentProfile(nextProfile);
      setValidationErrors(errors);

      if (Object.keys(errors).length > 0) {
        return { success: false, error: new Error('Le profil contient des champs invalides.') };
      }

      if (nextProfile.slug !== initialProfile?.slug && slugStatus !== 'available') {
        const slugError = new Error(
          slugStatus === 'taken'
            ? 'Ce slug est déjà utilisé.'
            : 'Le slug doit être vérifié avant son enregistrement.'
        );
        setValidationErrors((current) => ({ ...current, slug: slugError.message }));
        return { success: false, error: slugError };
      }

      setSaving(true);
      setError(null);

      let legacyBusinessType = nextProfile.business_type;

      if (nextProfile.ai_business_type_id) {
        const { data: businessType, error: businessTypeError } = await supabase
          .from('ai_business_types')
          .select('id, name')
          .eq('id', nextProfile.ai_business_type_id)
          .maybeSingle();

        if (businessTypeError || !businessType) {
          const syncError = businessTypeError ?? new Error('Type d’établissement IA introuvable.');
          setError(syncError);
          setSaving(false);
          return { success: false, error: syncError };
        }

        legacyBusinessType = businessType.name;
      } else {
        legacyBusinessType = null;
      }

      const payload = {
        name: nextProfile.name.trim(),
        slug: nextProfile.slug.trim(),
        logo_url: EMPTY_TO_NULL(nextProfile.logo_url),
        ai_business_type_id: nextProfile.ai_business_type_id,
        business_type: legacyBusinessType,
        address: EMPTY_TO_NULL(nextProfile.address),
        city: EMPTY_TO_NULL(nextProfile.city),
        phone: EMPTY_TO_NULL(nextProfile.phone),
        email: EMPTY_TO_NULL(nextProfile.email),
        website_url: EMPTY_TO_NULL(nextProfile.website_url),
        whatsapp_number: EMPTY_TO_NULL(nextProfile.whatsapp_number),
        instagram_url: EMPTY_TO_NULL(nextProfile.instagram_url),
        facebook_url: EMPTY_TO_NULL(nextProfile.facebook_url),
        tiktok_url: EMPTY_TO_NULL(nextProfile.tiktok_url),
        description: EMPTY_TO_NULL(nextProfile.description),
      };

      const { data, error: updateError } = await supabase
        .from('establishments')
        .update(payload)
        .eq('id', establishmentId)
        .select('*')
        .single();

      if (updateError) {
        setError(updateError);
        setSaving(false);
        console.error('[EstablishmentProfile] UPDATE ERROR:', updateError);
        return { success: false, error: updateError };
      }

      const normalized = normalizeProfile(data as Record<string, unknown>);
      setProfile(normalized);
      setInitialProfile(normalized);
      setValidationErrors({});
      setSaving(false);

      console.log('[EstablishmentProfile] UPDATE SUCCESS:', {
        establishmentId,
        profile: normalized,
      });

      return { success: true, profile: normalized };
    },
    [profile, establishmentId, initialProfile?.slug, slugStatus]
  );

  return {
    profile,
    loading,
    saving,
    error,
    validationErrors,
    slugStatus,
    slugMessage,
    isDirty,
    setField: updateField,
    updateProfile,
    reload: loadProfile,
    validate: () => (profile ? validateEstablishmentProfile(profile) : {}),
  };
}
