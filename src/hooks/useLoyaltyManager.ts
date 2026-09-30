import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type LoyaltyProgramType = 'POINTS' | 'STAMP';

export type LoyaltySettings = {
  program_type: LoyaltyProgramType;
  stamp_goal: number;
  stamp_reward_name: string | null;
  stamp_reward_description: string | null;
  discount_percent: number | null;
  discount_valid_days: number;
  points_per_currency: number;
  currency: string;
  enabled: boolean;
};

export type LoyaltyRewardType = 'GIFT' | 'DISCOUNT';

export type LoyaltyReward = {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
  created_at: string;
  updated_at: string;
  cost_mad?: number;
  reward_type?: LoyaltyRewardType | string;
  discount_percent?: number | null;
  discount_max_amount?: number | null;
  valid_days?: string[];
};

export type LoyaltyCustomer = {
  id: string;
  establishment_id: string;
  phone: string;
  first_name: string;
  last_name?: string | null;
  birth_date?: string | null;
  loyalty_number?: string | null;
  points_balance: number;
  total_points_earned: number;
  total_points_redeemed: number;
  visit_count: number;
  last_visit_at: string | null;
  created_at: string;
  updated_at?: string;
};

export type LoyaltyTransaction = {
  id: string;
  establishment_id: string;
  customer_id: string;
  employee_id: string | null;
  amount: number | null;
  points: number;
  type: string;
  description: string | null;
  transaction_reference: string | null;
  invoice_number: string | null;
  created_at: string;
};

export type LoyaltyCardDesign = {
  template_id: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  button_color: string;
  border_radius: number;
  design_config: Record<string, unknown>;
  published: boolean;
};

export type LoyaltyDesignPatch = Partial<
  Omit<LoyaltyCardDesign, 'published'>
>;

export type CreateLoyaltyRewardInput = {
  name: string;
  description?: string | null;
  points_required: number;
  reward_type?: LoyaltyRewardType;
  discount_percent?: number | null;
  discount_max_amount?: number | null;
};

export type UpdateLoyaltyRewardInput = CreateLoyaltyRewardInput & {
  active?: boolean;
};

export type LoyaltySettingsPatch = Partial<
  Omit<LoyaltySettings, 'program_type'>
> & {
  program_type?: LoyaltyProgramType;
};

const DEFAULT_SETTINGS: LoyaltySettings = {
  program_type: 'POINTS',
  stamp_goal: 10,
  stamp_reward_name: null,
  stamp_reward_description: null,
  discount_percent: null,
  discount_valid_days: 7,
  points_per_currency: 1,
  currency: 'MAD',
  enabled: true,
};

const DEFAULT_DESIGN: LoyaltyCardDesign = {
  template_id: 'luxury',
  primary_color: '#173D32',
  secondary_color: '#D3A84C',
  background_color: '#F7F7F3',
  text_color: '#173D32',
  button_color: '#173D32',
  border_radius: 24,
  design_config: {},
  published: false,
};

function firstRow<T>(data: T | T[] | null | undefined): T | null {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

function normalizeSettings(row: Partial<LoyaltySettings> | null): LoyaltySettings {
  if (!row) return { ...DEFAULT_SETTINGS };

  return {
    program_type:
      row.program_type === 'STAMP' ? 'STAMP' : 'POINTS',
    stamp_goal: Number(row.stamp_goal ?? DEFAULT_SETTINGS.stamp_goal),
    stamp_reward_name: row.stamp_reward_name ?? null,
    stamp_reward_description: row.stamp_reward_description ?? null,
    discount_percent:
      row.discount_percent == null ? null : Number(row.discount_percent),
    discount_valid_days: Number(
      row.discount_valid_days ?? DEFAULT_SETTINGS.discount_valid_days
    ),
    points_per_currency: Number(
      row.points_per_currency ?? DEFAULT_SETTINGS.points_per_currency
    ),
    currency: row.currency || DEFAULT_SETTINGS.currency,
    enabled: Boolean(row.enabled ?? DEFAULT_SETTINGS.enabled),
  };
}

function normalizeDesign(
  row: Partial<LoyaltyCardDesign> | null,
  published = false
): LoyaltyCardDesign {
  if (!row) return { ...DEFAULT_DESIGN, published };

  return {
    template_id: row.template_id || DEFAULT_DESIGN.template_id,
    primary_color: row.primary_color || DEFAULT_DESIGN.primary_color,
    secondary_color: row.secondary_color || DEFAULT_DESIGN.secondary_color,
    background_color: row.background_color || DEFAULT_DESIGN.background_color,
    text_color: row.text_color || DEFAULT_DESIGN.text_color,
    button_color: row.button_color || DEFAULT_DESIGN.button_color,
    border_radius: Number(
      row.border_radius ?? DEFAULT_DESIGN.border_radius
    ),
    design_config:
      row.design_config && typeof row.design_config === 'object'
        ? row.design_config
        : {},
    published,
  };
}

function designsEqual(
  left: LoyaltyCardDesign | null,
  right: LoyaltyCardDesign | null
) {
  if (!left || !right) return left === right;

  return (
    left.template_id === right.template_id &&
    left.primary_color === right.primary_color &&
    left.secondary_color === right.secondary_color &&
    left.background_color === right.background_color &&
    left.text_color === right.text_color &&
    left.button_color === right.button_color &&
    left.border_radius === right.border_radius &&
    JSON.stringify(left.design_config) === JSON.stringify(right.design_config)
  );
}

export function useLoyaltyManager(establishmentId: string | null) {
  const [settings, setSettings] = useState<LoyaltySettings>({
    ...DEFAULT_SETTINGS,
  });
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);

  const [publishedDesign, setPublishedDesign] =
    useState<LoyaltyCardDesign | null>(null);
  const [draftDesign, setDraftDesign] =
    useState<LoyaltyCardDesign | null>(null);
  const [initialDraftDesign, setInitialDraftDesign] =
    useState<LoyaltyCardDesign | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadVersionRef = useRef(0);

  const load = useCallback(async () => {
    if (!establishmentId) {
      setSettings({ ...DEFAULT_SETTINGS });
      setRewards([]);
      setCustomers([]);
      setTransactions([]);
      setPublishedDesign(null);
      setDraftDesign(null);
      setInitialDraftDesign(null);
      setError(null);
      return;
    }

    const loadVersion = ++loadVersionRef.current;
    setLoading(true);
    setError(null);

    try {
      const [
        settingsResult,
        rewardsResult,
        customersResult,
        transactionsResult,
        publishedDesignResult,
        builderDesignResult,
      ] = await Promise.all([
        supabase.rpc('get_loyalty_program_settings', {
          p_establishment_id: establishmentId,
        }),
        supabase
          .from('loyalty_rewards')
          .select('*')
          .eq('establishment_id', establishmentId)
          .order('points_required', { ascending: true }),
        supabase
          .from('loyalty_customers')
          .select('*')
          .eq('establishment_id', establishmentId)
          .order('created_at', { ascending: false }),
        supabase
          .from('loyalty_transactions')
          .select('*')
          .eq('establishment_id', establishmentId)
          .order('created_at', { ascending: false }),
        supabase.rpc('get_loyalty_card_config', {
          p_establishment_id: establishmentId,
        }),
        supabase.rpc('get_loyalty_card_builder_config', {
          p_establishment_id: establishmentId,
        }),
      ]);

      if (settingsResult.error) throw settingsResult.error;
      if (rewardsResult.error) throw rewardsResult.error;
      if (customersResult.error) throw customersResult.error;
      if (transactionsResult.error) throw transactionsResult.error;
      if (publishedDesignResult.error) throw publishedDesignResult.error;
      if (builderDesignResult.error) throw builderDesignResult.error;

      if (loadVersion !== loadVersionRef.current) return;

      const settingsRow = firstRow(settingsResult.data);
      const publishedRow = firstRow(publishedDesignResult.data);
      const builderRow = firstRow(builderDesignResult.data);

      const nextSettings = normalizeSettings(
        settingsRow as Partial<LoyaltySettings> | null
      );

      const nextPublishedDesign = normalizeDesign(
        publishedRow as Partial<LoyaltyCardDesign> | null,
        Boolean(publishedRow?.published)
      );

      // get_loyalty_card_builder_config() returns the existing draft when
      // present, otherwise it falls back to the published design/defaults.
      const nextDraftDesign = normalizeDesign(
        builderRow as Partial<LoyaltyCardDesign> | null,
        Boolean(builderRow?.published)
      );

      setSettings(nextSettings);
      setRewards((rewardsResult.data ?? []) as LoyaltyReward[]);
      setCustomers((customersResult.data ?? []) as LoyaltyCustomer[]);
      setTransactions((transactionsResult.data ?? []) as LoyaltyTransaction[]);
      setPublishedDesign(nextPublishedDesign);
      setDraftDesign(nextDraftDesign);
      setInitialDraftDesign(nextDraftDesign);
    } catch (cause) {
      if (loadVersion !== loadVersionRef.current) return;

      const message =
        cause instanceof Error
          ? cause.message
          : 'Impossible de charger le programme de fidélité.';

      setError(message);
      console.error('[LoyaltyManager] LOAD ERROR:', cause);
    } finally {
      if (loadVersion === loadVersionRef.current) {
        setLoading(false);
      }
    }
  }, [establishmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasDesignChanges = useMemo(
    () => !designsEqual(draftDesign, initialDraftDesign),
    [draftDesign, initialDraftDesign]
  );

  const updateDraftDesign = useCallback(
    (patch: LoyaltyDesignPatch) => {
      setDraftDesign(current => {
        const base = current ?? normalizeDesign(null, false);

        return {
          ...base,
          ...patch,
          design_config: patch.design_config
            ? { ...patch.design_config }
            : base.design_config,
          published: false,
        };
      });
    },
    []
  );

  const resetDraftDesign = useCallback(() => {
    const base =
      publishedDesign ??
      initialDraftDesign ??
      normalizeDesign(null, false);

    const reset = {
      ...base,
      design_config: { ...base.design_config },
      published: Boolean(publishedDesign?.published),
    };

    setDraftDesign(reset);
    setInitialDraftDesign(reset);
  }, [publishedDesign, initialDraftDesign]);

  const saveDraftDesign = useCallback(async () => {
    if (!establishmentId || !draftDesign) {
      throw new Error('Établissement ou design manquant.');
    }

    setSaving(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc(
        'save_loyalty_card_builder_config',
        {
          p_establishment_id: establishmentId,
          p_design_config: draftDesign.design_config,
          p_template_id: draftDesign.template_id,
          p_primary_color: draftDesign.primary_color,
          p_secondary_color: draftDesign.secondary_color,
          p_background_color: draftDesign.background_color,
          p_text_color: draftDesign.text_color,
          p_button_color: draftDesign.button_color,
          p_border_radius: draftDesign.border_radius,
          p_published: false,
        }
      );

      if (rpcError) throw rpcError;

      const savedDraft = { ...draftDesign, published: false };
      setDraftDesign(savedDraft);
      setInitialDraftDesign(savedDraft);

      return savedDraft;
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'Impossible d’enregistrer le brouillon Loyalty.';

      setError(message);
      console.error('[LoyaltyManager] SAVE DRAFT ERROR:', cause);
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [draftDesign, establishmentId]);

  const publishDesign = useCallback(async () => {
    if (!establishmentId || !draftDesign) {
      throw new Error('Établissement ou design manquant.');
    }

    setPublishing(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc(
        'save_loyalty_card_builder_config',
        {
          p_establishment_id: establishmentId,
          p_design_config: draftDesign.design_config,
          p_template_id: draftDesign.template_id,
          p_primary_color: draftDesign.primary_color,
          p_secondary_color: draftDesign.secondary_color,
          p_background_color: draftDesign.background_color,
          p_text_color: draftDesign.text_color,
          p_button_color: draftDesign.button_color,
          p_border_radius: draftDesign.border_radius,
          p_published: true,
        }
      );

      if (rpcError) throw rpcError;

      const published = { ...draftDesign, published: true };

      setPublishedDesign(published);
      setDraftDesign(published);
      setInitialDraftDesign(published);

      return published;
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'Impossible de publier le design Loyalty.';

      setError(message);
      console.error('[LoyaltyManager] PUBLISH DESIGN ERROR:', cause);
      throw cause;
    } finally {
      setPublishing(false);
    }
  }, [draftDesign, establishmentId]);

  const updateSettings = useCallback(
    (patch: LoyaltySettingsPatch) => {
      setSettings(current => ({
        ...current,
        ...patch,
      }));
    },
    []
  );

  const saveSettings = useCallback(async () => {
    if (!establishmentId) {
      throw new Error('Établissement manquant.');
    }

    setSaving(true);
    setError(null);

    try {
      const { error: rpcError } = await supabase.rpc(
        'save_loyalty_program_settings',
        {
          p_establishment_id: establishmentId,
          p_program_type: settings.program_type,
          p_stamp_goal: settings.stamp_goal,
          p_stamp_reward_name: settings.stamp_reward_name,
          p_stamp_reward_description: settings.stamp_reward_description,
          p_discount_percent: settings.discount_percent,
          p_discount_valid_days: settings.discount_valid_days,
          p_points_per_currency: settings.points_per_currency,
          p_currency: settings.currency,
          p_enabled: settings.enabled,
        }
      );

      if (rpcError) throw rpcError;
    } catch (cause) {
      const message =
        cause instanceof Error
          ? cause.message
          : 'Impossible d’enregistrer les paramètres Loyalty.';

      setError(message);
      console.error('[LoyaltyManager] SAVE SETTINGS ERROR:', cause);
      throw cause;
    } finally {
      setSaving(false);
    }
  }, [establishmentId, settings]);

  const createReward = useCallback(
    async (input: CreateLoyaltyRewardInput) => {
      if (!establishmentId) {
        throw new Error('Établissement manquant.');
      }

      const name = input.name.trim();

      if (!name) throw new Error('Le nom de la récompense est requis.');
      if (!Number.isInteger(input.points_required) || input.points_required <= 0) {
        throw new Error('Les points requis doivent être un entier supérieur à 0.');
      }

      setSaving(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc(
          'create_loyalty_reward',
          {
            p_establishment_id: establishmentId,
            p_name: name,
            p_description: input.description?.trim() || null,
            p_points_required: input.points_required,
            p_reward_type: input.reward_type ?? 'GIFT',
            p_discount_percent: input.discount_percent ?? null,
            p_discount_max_amount: input.discount_max_amount ?? null,
          }
        );

        if (rpcError) throw rpcError;

        await load();
        return data as string;
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'Impossible de créer la récompense.';

        setError(message);
        console.error('[LoyaltyManager] CREATE REWARD ERROR:', cause);
        throw cause;
      } finally {
        setSaving(false);
      }
    },
    [establishmentId, load]
  );

  const updateReward = useCallback(
    async (rewardId: string, input: UpdateLoyaltyRewardInput) => {
      const name = input.name.trim();

      if (!name) throw new Error('Le nom de la récompense est requis.');
      if (!Number.isInteger(input.points_required) || input.points_required <= 0) {
        throw new Error('Les points requis doivent être un entier supérieur à 0.');
      }

      setSaving(true);
      setError(null);

      try {
        const { error: rpcError } = await supabase.rpc(
          'update_loyalty_reward',
          {
            p_reward_id: rewardId,
            p_name: name,
            p_description: input.description?.trim() || null,
            p_points_required: input.points_required,
            p_reward_type: input.reward_type ?? 'GIFT',
            p_discount_percent: input.discount_percent ?? null,
            p_discount_max_amount: input.discount_max_amount ?? null,
            p_active: input.active ?? true,
          }
        );

        if (rpcError) throw rpcError;

        await load();
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'Impossible de modifier la récompense.';

        setError(message);
        console.error('[LoyaltyManager] UPDATE REWARD ERROR:', cause);
        throw cause;
      } finally {
        setSaving(false);
      }
    },
    [load]
  );

  const deleteReward = useCallback(
    async (rewardId: string) => {
      setSaving(true);
      setError(null);

      try {
        const { error: rpcError } = await supabase.rpc(
          'delete_loyalty_reward',
          {
            p_reward_id: rewardId,
          }
        );

        if (rpcError) throw rpcError;

        await load();
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'Impossible de désactiver la récompense.';

        setError(message);
        console.error('[LoyaltyManager] DELETE REWARD ERROR:', cause);
        throw cause;
      } finally {
        setSaving(false);
      }
    },
    [load]
  );

  const calculatePoints = useCallback(
    (amount: number) => {
      if (
        !Number.isFinite(amount) ||
        amount <= 0 ||
        !settings.enabled ||
        settings.program_type !== 'POINTS' ||
        settings.points_per_currency <= 0
      ) {
        return 0;
      }

      // Same rule as add_loyalty_points() in PostgreSQL.
      return Math.floor(amount * settings.points_per_currency);
    },
    [settings]
  );

  const addPoints = useCallback(
    async (params: {
      customerId: string;
      amount: number;
      invoiceNumber?: string | null;
      responsibleCode: string;
      description?: string | null;
    }) => {
      if (!establishmentId) {
        throw new Error('Établissement manquant.');
      }

      setSaving(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc(
          'add_loyalty_points',
          {
            p_establishment_id: establishmentId,
            p_customer_id: params.customerId,
            p_amount: params.amount,
            p_invoice_number: params.invoiceNumber ?? null,
            p_responsible_code: params.responsibleCode,
            p_description: params.description ?? null,
          }
        );

        if (rpcError) throw rpcError;

        await load();
        return Number(data);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'Impossible d’ajouter les points.';

        setError(message);
        console.error('[LoyaltyManager] ADD POINTS ERROR:', cause);
        throw cause;
      } finally {
        setSaving(false);
      }
    },
    [establishmentId, load]
  );

  const redeemReward = useCallback(
    async (params: {
      customerId: string;
      rewardId: string;
      responsibleCode: string;
      invoiceNumber: string;
      invoiceAmount: number;
      paymentMethod?: 'CASH' | 'CARD' | 'TRANSFER' | 'OTHER';
    }) => {
      if (!establishmentId) {
        throw new Error('Établissement manquant.');
      }

      setSaving(true);
      setError(null);

      try {
        const { data, error: rpcError } = await supabase.rpc(
          'redeem_loyalty_reward',
          {
            p_establishment_id: establishmentId,
            p_customer_id: params.customerId,
            p_reward_id: params.rewardId,
            p_reward_code: params.responsibleCode,
            p_invoice_number: params.invoiceNumber,
            p_invoice_amount: params.invoiceAmount,
            p_payment_method: params.paymentMethod ?? 'CASH',
          }
        );

        if (rpcError) throw rpcError;

        await load();
        return firstRow(data);
      } catch (cause) {
        const message =
          cause instanceof Error
            ? cause.message
            : 'Impossible d’utiliser la récompense.';

        setError(message);
        console.error('[LoyaltyManager] REDEEM REWARD ERROR:', cause);
        throw cause;
      } finally {
        setSaving(false);
      }
    },
    [establishmentId, load]
  );

  return {
    settings,
    rewards,
    customers,
    transactions,

    publishedDesign,
    draftDesign,
    hasDesignChanges,

    loading,
    saving,
    publishing,
    error,

    load,

    updateSettings,
    saveSettings,

    createReward,
    updateReward,
    deleteReward,

    calculatePoints,
    addPoints,
    redeemReward,

    updateDraftDesign,
    saveDraftDesign,
    resetDraftDesign,
    publishDesign,
  };
}
