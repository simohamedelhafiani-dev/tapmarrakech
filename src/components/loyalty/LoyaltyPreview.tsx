import type { LoyaltyExperienceConfig } from './LoyaltyExperience';
import { LoyaltyExperience } from './LoyaltyExperience';

type LoyaltyPreviewProps = {
  config: LoyaltyExperienceConfig;
};

/**
 * Grand-format preview used only inside Loyalty Studio.
 * It changes presentation size/viewport only; the loyalty engine and public card stay untouched.
 */
export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  return (
    <div className="flex w-full items-center justify-center">
      <div className="relative w-full max-w-[560px] rounded-[44px] border-[8px] border-[#171a18] bg-[#171a18] p-1.5 shadow-2xl">
        <div className="pointer-events-none absolute left-1/2 top-2 z-20 h-1.5 w-20 -translate-x-1/2 rounded-full bg-white/15" />
        <div className="overflow-hidden rounded-[34px] bg-white shadow-[0_35px_100px_rgba(0,0,0,.30)]">
          <div className="min-h-[70vh] w-full">
            <LoyaltyExperience config={config} />
          </div>
        </div>
      </div>
    </div>
  );
}
