import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export type LoyaltyReferralConfig = {
  enabled: boolean;
  referrer_bonus_points: number;
  referee_bonus_points: number;
};

export type LoyaltyReferralConfigState = {
  draftConfig: LoyaltyReferralConfig;
  publishedConfig: LoyaltyReferralConfig;
};

export type ProcessReferralResult = {
  referralId: string;
  status: 'pending' | 'completed';
  referrerPoints: number;
  refereePoints: number;
};

const DEFAULT_REFERRAL_CONFIG: LoyaltyReferralConfig = {
  enabled: false,
  referrer_bonus_points: 50,
  referee_bonus_points: 0,
};

function normalizeConfig(value: unknown): LoyaltyReferralConfig {
  const raw =
    value && typeof value === 'object'
      ? (value as Record<string, unknown>)
      : {};

  return {
    enabled: raw.enabled === true,
    referrer_bonus_points: Math.max(
      0,
      Number.isFinite(Number(raw.referrer_bonus_points))
        ? Number(raw.referrer_bonus_points)
        : DEFAULT_REFERRAL_CONFIG.referrer_bonus_points,
    ),
    referee_bonus_points: Math.max(
      0,
      Number.isFinite(Number(raw.referee_bonus_points))
        ? Number(raw.referee_bonus_points)
        : DEFAULT_REFERRAL_CONFIG.referee_bonus_points,
    ),
  };
}

/**
 * Technical loyalty manager for the referral engine.
 *
 * This hook intentionally contains no UI and does not replace the existing
 * loyalty engine. It is a thin client adapter around the referral RPCs.
 */
export function useLoyaltyManager(establishmentId?: string) {
  const generateReferralCode = useCallback(async (customerId: string) => {
    if (!customerId) {
      throw new Error('Customer ID is required');
    }

    const { data, error } = await supabase.rpc(
      'generate_loyalty_referral_code',
      { p_customer_id: customerId },
    );

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error('Referral code was not generated');
    }

    return String(data);
  }, []);

  const processReferral = useCallback(
    async (code: string, newCustomerId: string): Promise<ProcessReferralResult> => {
      if (!code?.trim()) {
        throw new Error('Referral code is required');
      }

      if (!newCustomerId) {
        throw new Error('New customer ID is required');
      }

      const { data, error } = await supabase.rpc('process_loyalty_referral', {
        p_code: code.trim(),
        p_new_customer_id: newCustomerId,
      });

      if (error) {
        throw error;
      }

      const row = Array.isArray(data) ? data[0] : data;

      if (!row?.referral_id) {
        throw new Error('Referral processing returned no result');
      }

      return {
        referralId: String(row.referral_id),
        status: row.status === 'completed' ? 'completed' : 'pending',
        referrerPoints: Number(row.referrer_points ?? 0),
        refereePoints: Number(row.referee_points ?? 0),
      };
    },
    [],
  );

  const getReferralConfig = useCallback(async (): Promise<LoyaltyReferralConfigState> => {
    if (!establishmentId) {
      throw new Error('Establishment ID is required');
    }

    const { data, error } = await supabase.rpc('get_loyalty_referral_config', {
      p_establishment_id: establishmentId,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;

    return {
      draftConfig: normalizeConfig(row?.draft_config),
      publishedConfig: normalizeConfig(row?.published_config),
    };
  }, [establishmentId]);

  const saveReferralDraft = useCallback(
    async (config: LoyaltyReferralConfig) => {
      if (!establishmentId) {
        throw new Error('Establishment ID is required');
      }

      const normalized = normalizeConfig(config);

      const { error } = await supabase.rpc('save_loyalty_referral_draft', {
        p_establishment_id: establishmentId,
        p_config: normalized,
      });

      if (error) {
        throw error;
      }
    },
    [establishmentId],
  );

  const publishReferral = useCallback(async (): Promise<LoyaltyReferralConfig> => {
    if (!establishmentId) {
      throw new Error('Establishment ID is required');
    }

    const { data, error } = await supabase.rpc(
      'publish_loyalty_referral_settings',
      {
        p_establishment_id: establishmentId,
      },
    );

    if (error) {
      throw error;
    }

    return normalizeConfig(data);
  }, [establishmentId]);

  return {
    generateReferralCode,
    processReferral,
    getReferralConfig,
    saveReferralDraft,
    publishReferral,
  };
}
