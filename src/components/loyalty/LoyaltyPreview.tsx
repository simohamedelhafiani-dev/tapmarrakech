
export { WALLET_TEMPLATES } from '@/components/LoyaltyCardVisual';

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
        cardWidth="min(90%, 400px)"
      />
    </div>
  );
}
