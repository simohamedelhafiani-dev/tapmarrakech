import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type LoyaltyProgramType = 'STAMP' | 'POINTS_REWARD' | 'POINTS_DISCOUNT';

export type LoyaltyProgramSettings = {
  programType: LoyaltyProgramType;
  stampGoal: number;
  stampRewardName: string | null;
  stampRewardDescription: string | null;
  pointsPerCurrency: number;
  discountPointsThreshold: number;
  discountPercent: number | null;
  discountValidDays: number;
  enabled: boolean;
};

export type LoyaltyReferralBonusType = 'POINTS' | 'STAMP' | 'REDUCTION';

export type LoyaltyReferralConfig = {
  enabled: boolean;
  referrer_bonus_type: LoyaltyReferralBonusType;
  referrer_bonus_value: number;
  referee_bonus_type: LoyaltyReferralBonusType;
  referee_bonus_value: number;
  max_referrals: number | null;
  /** Legacy fields kept for backward compatibility with older clients. */
  referrer_bonus_points: number;
  referee_bonus_points: number;
};

export type LoyaltyReferralConfigState = {
  draftConfig: LoyaltyReferralConfig;
  publishedConfig: LoyaltyReferralConfig;
};

export type LoyaltyReferralStats = {
  acquiredCount: number;
};

export type ProcessReferralResult = {
  referralId: string;
  status: 'pending' | 'completed';
  referrerPoints: number;
  refereePoints: number;
};

const DEFAULT_REFERRAL_CONFIG: LoyaltyReferralConfig = {
  enabled: false,
  referrer_bonus_type: 'POINTS',
  referrer_bonus_value: 50,
  referee_bonus_type: 'POINTS',
  referee_bonus_value: 0,
  max_referrals: null,
  referrer_bonus_points: 50,
  referee_bonus_points: 0,
};

function normalizeBonusType(value: unknown): LoyaltyReferralBonusType {
  return value === 'STAMP' || value === 'REDUCTION' ? value : 'POINTS';
}

function normalizeConfig(value: unknown): LoyaltyReferralConfig {
  const raw =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};

  const referrerType = normalizeBonusType(raw.referrer_bonus_type);
  const refereeType = normalizeBonusType(raw.referee_bonus_type);
  const referrerValue = Math.max(
    0,
    Number.isFinite(Number(raw.referrer_bonus_value))
      ? Number(raw.referrer_bonus_value)
      : Number(raw.referrer_bonus_points ?? DEFAULT_REFERRAL_CONFIG.referrer_bonus_value),
  );
  const refereeValue = Math.max(
    0,
    Number.isFinite(Number(raw.referee_bonus_value))
      ? Number(raw.referee_bonus_value)
      : Number(raw.referee_bonus_points ?? DEFAULT_REFERRAL_CONFIG.referee_bonus_value),
  );
  const rawLimit = raw.max_referrals;
  const maxReferrals =
    rawLimit === null || rawLimit === undefined || rawLimit === ''
      ? null
      : Math.max(0, Math.floor(Number(rawLimit)));

  return {
    enabled: raw.enabled === true,
    referrer_bonus_type: referrerType,
    referrer_bonus_value: referrerValue,
    referee_bonus_type: refereeType,
    referee_bonus_value: refereeValue,
    max_referrals: Number.isFinite(maxReferrals as number) ? maxReferrals : null,
    referrer_bonus_points: referrerType === 'POINTS' ? Math.floor(referrerValue) : 0,
    referee_bonus_points: refereeType === 'POINTS' ? Math.floor(refereeValue) : 0,
  };
}

/**
 * Technical loyalty manager for the referral engine.
 *
 * This hook contains no UI. It is the client adapter around the referral RPCs.
 */
export function useLoyaltyManager(establishmentId?: string) {
  const generateReferralCode = useCallback(async (customerId: string) => {
    if (!customerId) throw new Error('Customer ID is required');

    const { data, error } = await supabase.rpc(
      'generate_loyalty_referral_code',
      { p_customer_id: customerId },
    );

    if (error) throw error;
    if (!data) throw new Error('Referral code was not generated');

    return String(data);
  }, []);

  const processReferral = useCallback(
    async (code: string, newCustomerId: string): Promise<ProcessReferralResult> => {
      if (!code?.trim()) throw new Error('Referral code is required');
      if (!newCustomerId) throw new Error('New customer ID is required');

      const { data, error } = await supabase.rpc('process_loyalty_referral', {
        p_code: code.trim(),
        p_new_customer_id: newCustomerId,
      });

      if (error) throw error;

      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.referral_id) throw new Error('Referral processing returned no result');

      return {
        referralId: String(row.referral_id),
        status: row.status === 'completed' ? 'completed' : 'pending',
        referrerPoints: Number(row.referrer_points ?? 0),
        refereePoints: Number(row.referee_points ?? 0),
      };
    },
    [],
  );

  const getProgramSettings = useCallback(async (): Promise<LoyaltyProgramSettings> => {
    if (!establishmentId) throw new Error('Establishment ID is required');

    const { data, error } = await supabase.rpc('get_loyalty_program_settings', {
      p_establishment_id: establishmentId,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    const rawType = row?.program_type;
    const programType: LoyaltyProgramType =
      rawType === 'STAMP'
        ? 'STAMP'
        : rawType === 'POINTS_DISCOUNT' || rawType === 'DISCOUNT'
          ? 'POINTS_DISCOUNT'
          : 'POINTS_REWARD';

    return {
      programType,
      stampGoal: Math.min(10, Math.max(1, Number(row?.stamp_goal ?? 10))),
      stampRewardName: row?.stamp_reward_name ?? null,
      stampRewardDescription: row?.stamp_reward_description ?? null,
      pointsPerCurrency: Math.max(0.01, Number(row?.points_per_currency ?? 1)),
      discountPointsThreshold: Math.max(1, Number(row?.discount_points_threshold ?? 1000)),
      discountPercent: row?.discount_percent != null ? Number(row.discount_percent) : null,
      discountValidDays: Math.max(1, Number(row?.discount_valid_days ?? 7)),
      enabled: Boolean(row?.enabled ?? true),
    };
  }, [establishmentId]);


  const saveProgramSettings = useCallback(
    async (settings: {
      programType: LoyaltyProgramType;
      stampGoal?: number;
      stampRewardName?: string | null;
      stampRewardDescription?: string | null;
      discountPercent?: number | null;
      discountValidDays?: number;
      pointsPerCurrency?: number;
      currency?: string;
      enabled?: boolean;
      discountPointsThreshold?: number;
    }) => {
      if (!establishmentId) throw new Error('Establishment ID is required');

      const programType = settings.programType;
      const pointsPerCurrency = Math.max(0.01, Number(settings.pointsPerCurrency ?? 1));
      const stampGoal = Math.min(10, Math.max(1, Math.floor(Number(settings.stampGoal ?? 10))));
      const discountPointsThreshold = Math.max(1, Math.floor(Number(settings.discountPointsThreshold ?? 1000)));
      const discountPercent =
        settings.discountPercent == null ? null : Math.min(100, Math.max(1, Number(settings.discountPercent)));
      const discountValidDays = Math.min(365, Math.max(1, Math.floor(Number(settings.discountValidDays ?? 7))));

      const { error } = await supabase.rpc('save_loyalty_program_settings', {
        p_establishment_id: establishmentId,
        p_program_type: programType,
        p_stamp_goal: stampGoal,
        p_stamp_reward_name: settings.stampRewardName ?? null,
        p_stamp_reward_description: settings.stampRewardDescription ?? null,
        p_discount_percent: discountPercent,
        p_discount_valid_days: discountValidDays,
        p_points_per_currency: pointsPerCurrency,
        p_currency: settings.currency?.trim() || 'MAD',
        p_enabled: settings.enabled ?? true,
        p_discount_points_threshold: discountPointsThreshold,
      });

      if (error) throw error;
    },
    [establishmentId],
  );

  const getReferralConfig = useCallback(async (): Promise<LoyaltyReferralConfigState> => {
    if (!establishmentId) throw new Error('Establishment ID is required');

    const { data, error } = await supabase.rpc('get_loyalty_referral_config', {
      p_establishment_id: establishmentId,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return {
      draftConfig: normalizeConfig(row?.draft_config),
      publishedConfig: normalizeConfig(row?.published_config),
    };
  }, [establishmentId]);

  const saveReferralDraft = useCallback(
    async (config: LoyaltyReferralConfig) => {
      if (!establishmentId) throw new Error('Establishment ID is required');

      const normalized = normalizeConfig(config);
      const { error } = await supabase.rpc('save_loyalty_referral_draft', {
        p_establishment_id: establishmentId,
        p_config: normalized,
      });

      if (error) throw error;
    },
    [establishmentId],
  );

  const publishReferral = useCallback(async (): Promise<LoyaltyReferralConfig> => {
    if (!establishmentId) throw new Error('Establishment ID is required');

    const { data, error } = await supabase.rpc(
      'publish_loyalty_referral_settings',
      { p_establishment_id: establishmentId },
    );

    if (error) throw error;
    return normalizeConfig(data);
  }, [establishmentId]);

  const getReferralStats = useCallback(async (): Promise<LoyaltyReferralStats> => {
    if (!establishmentId) throw new Error('Establishment ID is required');

    const { data, error } = await supabase.rpc('get_loyalty_referral_stats', {
      p_establishment_id: establishmentId,
    });

    if (error) throw error;

    const row = Array.isArray(data) ? data[0] : data;
    return {
      acquiredCount: Number(row?.acquired_count ?? 0),
    };
  }, [establishmentId]);

  return {
    generateReferralCode,
    processReferral,
    getProgramSettings,
    saveProgramSettings,
    getReferralConfig,
    saveReferralDraft,
    publishReferral,
    getReferralStats,
  };
}
