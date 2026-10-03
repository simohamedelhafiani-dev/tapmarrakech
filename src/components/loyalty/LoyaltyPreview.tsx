export { WALLET_TEMPLATES } from '@/components/LoyaltyCardVisual';

import type { LoyaltyExperienceConfig } from './LoyaltyExperience';
import { LoyaltyCardVisual } from '@/components/LoyaltyCardVisual';

type LoyaltyPreviewProps = {
  config: LoyaltyExperienceConfig;
};

export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const mode =
    config.type === 'STAMP' || config.type === 'CHALLENGE' || config.type === 'COLLECTION'
      ? 'STAMP'
      : config.type === 'POINTS_DISCOUNT' || config.type === 'DISCOUNT'
        ? 'DISCOUNT'
        : 'POINTS';

  return (
    <div
      className="flex w-full min-w-0 items-center justify-center overflow-visible rounded-[28px] border border-[#242424] bg-[#050505] p-4 shadow-[0_0_80px_rgba(201,164,92,0.18)] sm:p-6"
      style={{
        minWidth: 0,
        minHeight: '480px',
      }}
    >
      <LoyaltyCardVisual
        design={{
          template_id: config.templateId,
          primary_color: config.primaryColor || '#181818',
          secondary_color: config.secondaryColor || '#D7D7D7',
          background_color: config.backgroundColor || '#070707',
          text_color: config.textColor || '#FFFFFF',
          border_radius: config.borderRadius ?? 34,
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
        cardWidth="300px"
      />
    </div>
  );
}
