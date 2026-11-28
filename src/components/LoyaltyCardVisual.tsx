export const WALLET_TEMPLATES = {
  'onyx-black': { id: 'onyx-black', name: 'Nardo Onyx', primary: '#686D76', accent: '#686D76', background: '#050505', text: '#FFFFFF' },
  'royal-gold': { id: 'royal-gold', name: 'Nardo Signature', primary: '#686D76', accent: '#686D76', background: '#050505', text: '#FFFFFF' },
  'deep-ocean': { id: 'deep-ocean', name: 'Nardo Blue', primary: '#686D76', accent: '#686D76', background: '#050505', text: '#FFFFFF' },
  'minimal-white': { id: 'minimal-white', name: 'Nardo Minimal', primary: '#686D76', accent: '#686D76', background: '#050505', text: '#FFFFFF' },
  'emerald-luxe': { id: 'emerald-luxe', name: 'Nardo Graphite', primary: '#686D76', accent: '#686D76', background: '#050505', text: '#FFFFFF' },
  'burgundy': { id: 'burgundy', name: 'Nardo Night', primary: '#686D76', accent: '#686D76', background: '#050505', text: '#FFFFFF' },
  'midnight-blue': { id: 'midnight-blue', name: 'Nardo Electric', primary: '#686D76', accent: '#686D76', background: '#050505', text: '#FFFFFF' },
  'sandstone': { id: 'sandstone', name: 'Nardo Stone', primary: '#686D76', accent: '#686D76', background: '#050505', text: '#FFFFFF' },
} as const;

import { resolvePassTemplate } from '@/components/loyalty/cardTemplates';
import { WalletPassCard } from '@/components/loyalty/WalletPassCard';

export type LoyaltyDesignConfig = {
  logo_x: number;
  logo_y: number;
  front_title: string;
  front_subtitle: string;
  back_title: string;
  back_message: string;
  show_qr: boolean;
  show_points: boolean;
  showQr?: boolean;
  stamp_style: 'circles' | 'squares' | 'stars' | 'hearts';
  qr_size?: 'small' | 'medium' | 'large';
  qr_frame?: 'white' | 'accent' | 'glass';
  background_image_url: string | null;
  logo_url?: string | null;
  ai_prompt?: string;
  ai_generation_id?: string;
  card_mode?: 'QR' | 'STAMP' | 'POINTS_REWARD' | 'POINTS_DISCOUNT';
  loyaltyType?: 'STAMP' | 'POINTS' | 'DISCOUNT' | 'REWARD' | 'TIER' | 'CHALLENGE' | 'CASHBACK' | 'COLLECTION';
  cardTitle?: string;
  cardSubtitle?: string;
  progressText?: string;
  rewardTitle?: string;
  rewardDescription?: string;
  rewardName?: string;
  discountPercent?: number;
  discountPointsThreshold?: number;
  discountValidDays?: number;
  benefits?: { title: string; description?: string; icon?: string }[];
  offers?: { title: string; description?: string; eyebrow?: string }[];
  business_type?: string | null;
};

export const defaultLoyaltyDesignConfig: LoyaltyDesignConfig = {
  logo_x: 0,
  logo_y: 0,
  front_title: 'CARTE FIDÉLITÉ',
  front_subtitle: 'Merci de faire partie de notre histoire !',
  back_title: 'Merci pour votre fidélité !',
  back_message: 'Chaque visite vous rapproche d’une expérience unique. À très bientôt !',
  show_qr: false,
  show_points: true,
  stamp_style: 'circles',
  background_image_url: null,
  logo_url: null,
  card_mode: 'POINTS_REWARD',
};

export type LoyaltyVisualCard = {
  establishmentName: string;
  logoUrl?: string | null;
  points?: number;
  stampsBalance?: number;
  stampGoal?: number;
  stampRewardName?: string | null;
  rewardName?: string | null;
  rewardPointsRequired?: number;
  rewardDescription?: string | null;
  discountPercent?: number;
  discountPointsThreshold?: number;
  discountExpiresAt?: string | null;
  discountValidDays?: number;
  customerName?: string;
  loyaltyNumber?: string;
  cardUrl?: string;
  raffleTitle?: string | null;
  rafflePrize?: string | null;
  raffleStartsAt?: string | null;
  raffleDrawAt?: string | null;
  customerTierName?: string | null;
  customerRankLabel?: string | null;
};

type VisualDesign = {
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  border_radius?: number;
  template_id?: string;
  config?: Partial<LoyaltyDesignConfig>;
};

function normalizeMode(
  design: VisualDesign,
  programType: 'STAMP' | 'DISCOUNT' | 'POINTS' | 'REWARD' | 'TIER',
) {
  const cfg = { ...defaultLoyaltyDesignConfig, ...(design.config ?? {}) };
  if (cfg.card_mode === 'STAMP' || cfg.loyaltyType === 'STAMP' || programType === 'STAMP') return 'STAMP';
  if (cfg.card_mode === 'POINTS_DISCOUNT' || cfg.loyaltyType === 'DISCOUNT' || programType === 'DISCOUNT') return 'DISCOUNT';
  return 'POINTS';
}

/** Every KELYANI loyalty card renders as a Wallet-style pass (see cardTemplates.ts). */
export function LoyaltyCardVisual(props: {
  design: VisualDesign;
  card: LoyaltyVisualCard;
  side?: 'front' | 'back';
  compact?: boolean;
  programType?: 'STAMP' | 'DISCOUNT' | 'POINTS' | 'REWARD' | 'TIER';
  cardWidth?: string;
  onInviteFriend?: () => void;
}) {
  const config = { ...defaultLoyaltyDesignConfig, ...(props.design.config ?? {}) };
  return (
    <WalletPassCard
      template={resolvePassTemplate(props.design.template_id)}
      config={config}
      card={props.card}
      mode={normalizeMode(props.design, props.programType ?? 'POINTS')}
      side={props.side}
      cardWidth={props.cardWidth}
      onInviteFriend={props.onInviteFriend}
    />
  );
}
