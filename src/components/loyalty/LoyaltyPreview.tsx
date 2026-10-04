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
      className="flex w-full min-w-0 items-center justify-center overflow-visible rounded-3xl border border-[#242424]/[.08] bg-[#050505] p-4 shadow-luxury sm:p-6"
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
            loyaltyType: mode,
            card_mode:
              config.type === 'STAMP'
                ? 'STAMP'
                : config.type === 'POINTS_DISCOUNT'
                  ? 'POINTS_DISCOUNT'
                  : 'POINTS_REWARD',
            stamp_style: config.stampStyle || 'circles',
            rewardName: config.rewardName,
            rewardDescription: config.rewardDescription,
            discountPercent: config.discountPercent ?? undefined,
            show_qr: true,
            show_points: true,
          },
        }}
        card={{
          establishmentName: config.establishmentName || 'Votre établissement',
          logoUrl: config.logoUrl ?? undefined,
          points: config.pointsBalance ?? 0,
          stampsBalance: config.visits ?? 0,
          stampGoal: config.visitGoal ?? 10,
          stampRewardName: config.rewardName ?? undefined,
          discountPercent: config.discountPercent,
          customerName: config.customerName || 'Votre client',
          cardUrl: config.qrValue ?? undefined,
        }}
        programType={mode}
        cardWidth="300px"
      />
    </div>
  );
}
