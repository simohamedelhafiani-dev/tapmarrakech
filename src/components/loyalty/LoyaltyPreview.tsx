
export const WALLET_TEMPLATES = {
  'onyx-black': { id: 'onyx-black', name: 'Onyx Black', primary: '#181818', accent: '#D7D7D7', background: '#070707', text: '#FFFFFF' },
  'royal-gold': { id: 'royal-gold', name: 'Royal Gold', primary: '#3A2A12', accent: '#E7C66A', background: '#120C05', text: '#FFF9E8' },
  'deep-ocean': { id: 'deep-ocean', name: 'Deep Ocean', primary: '#123B4A', accent: '#8ED9E8', background: '#071B22', text: '#F2FCFF' },
  'minimal-white': { id: 'minimal-white', name: 'Minimal White', primary: '#E9ECE8', accent: '#20352C', background: '#F8FAF7', text: '#17231D' },
  'emerald-luxe': { id: 'emerald-luxe', name: 'Emerald Luxe', primary: '#123D2B', accent: '#C8E6B8', background: '#071D14', text: '#F5FFF8' },
  'burgundy': { id: 'burgundy', name: 'Burgundy', primary: '#4A1725', accent: '#F0B8C5', background: '#210A11', text: '#FFF4F6' },
  'midnight-blue': { id: 'midnight-blue', name: 'Midnight Blue', primary: '#172A52', accent: '#AFC7FF', background: '#080F22', text: '#F5F8FF' },
  'sandstone': { id: 'sandstone', name: 'Sandstone', primary: '#8A6848', accent: '#FFF0D4', background: '#332619', text: '#FFF9EF' },
} as const;

import type { LoyaltyExperienceConfig } from './LoyaltyExperience';
import { LoyaltyCardVisual } from '@/components/LoyaltyCardVisual';

type LoyaltyPreviewProps = { config: LoyaltyExperienceConfig };

export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const mode =
    config.type === 'STAMP' || config.type === 'CHALLENGE' || config.type === 'COLLECTION'
      ? 'STAMP'
      : config.type === 'POINTS_DISCOUNT' || config.type === 'DISCOUNT'
        ? 'DISCOUNT'
        : 'POINTS';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        minHeight: 450,
        overflow: 'visible',
      }}
    >
      <LoyaltyCardVisual
        design={{
          template_id: config.templateId,
          primary_color: config.primaryColor || '#181818',
          secondary_color: config.secondaryColor || '#D7D7D7',
          background_color: config.backgroundColor || '#070707',
          text_color: config.textColor || '#FFFFFF',
          border_radius: 34,
          config: {
            background_image_url: config.coverImageUrl || null,
            logo_url: config.logoUrl || null,
            loyaltyType: config.type,
            card_mode:
              config.type === 'STAMP'
                ? 'STAMP'
                : config.type === 'POINTS_DISCOUNT'
                  ? 'POINTS_DISCOUNT'
                  : 'POINTS_REWARD',
            stamp_style: config.stampStyle || 'circles',
            rewardName: config.rewardName,
            rewardDescription: config.rewardDescription,
            discountPercent: config.discountPercent,
            show_qr: true,
            show_points: true,
          },
        }}
        card={{
          establishmentName: config.establishmentName || 'Votre établissement',
          logoUrl: config.logoUrl,
          points: config.pointsBalance ?? 0,
          stampsBalance: config.visits ?? 0,
          stampGoal: config.visitGoal ?? 10,
          stampRewardName: config.rewardName,
          discountPercent: config.discountPercent,
          customerName: config.customerName || 'Votre client',
          cardUrl: config.qrValue,
        }}
        programType={mode}
      />
    </div>
  );
}
