import { useEffect, useRef, useState } from 'react';
import type { LoyaltyExperienceConfig } from './LoyaltyExperience';
import { LoyaltyExperience } from './LoyaltyExperience';

type LoyaltyPreviewProps = {
  config: LoyaltyExperienceConfig;
};

/**
 * Grand-format preview used only inside Loyalty Studio.
 * The card is automatically scaled so the complete card is visible inside
 * the 70vh preview area. No internal scrolling is used.
 */
export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.62);

  useEffect(() => {
    const measure = () => {
      const card = cardRef.current;
      const viewport = viewportRef.current;
      if (!card || !viewport) return;

      const naturalHeight = card.scrollHeight;
      const naturalWidth = card.scrollWidth;
      const availableHeight = viewport.clientHeight - 24;
      const availableWidth = viewport.clientWidth - 24;

      if (!naturalHeight || !naturalWidth || !availableHeight || !availableWidth) return;

      const nextScale = Math.min(
        1,
        availableHeight / naturalHeight,
        availableWidth / naturalWidth,
      );

      setScale(Math.max(0.38, nextScale));
    };

    const frame = window.requestAnimationFrame(measure);
    const resizeObserver = new ResizeObserver(measure);

    if (cardRef.current) resizeObserver.observe(cardRef.current);
    if (viewportRef.current) resizeObserver.observe(viewportRef.current);

    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [config]);

  const naturalHeight = cardRef.current?.scrollHeight ?? 1000;

  return (
    <div
      ref={viewportRef}
      className="flex h-[70vh] min-h-[560px] w-full items-center justify-center overflow-hidden rounded-[28px] bg-black/[0.02] p-3"
    >
      <div
        className="relative flex shrink-0 items-start justify-center"
        style={{
          width: 430 * scale + 'px',
          height: Math.max(1, naturalHeight * scale) + 'px',
        }}
      >
        <div
          ref={cardRef}
          className="origin-top"
          style={{
            width: '430px',
            transform: 'scale(' + scale + ')',
          }}
        >
          <LoyaltyExperience config={config} />
        </div>
      </div>
    </div>
  );
}
