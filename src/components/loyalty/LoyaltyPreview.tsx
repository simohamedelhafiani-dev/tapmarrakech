import { useEffect, useRef, useState } from 'react';
import type { LoyaltyExperienceConfig } from './LoyaltyExperience';
import { LoyaltyExperience } from './LoyaltyExperience';

type LoyaltyPreviewProps = {
  config: LoyaltyExperienceConfig;
};

/**
 * Premium Wallet-style preview used only inside Loyalty Studio.
 * The customer card remains the real LoyaltyExperience renderer; this
 * component only controls the presentation, scale and floating stage.
 */
export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0.62);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    setVisible(false);

    const frame = window.requestAnimationFrame(() => {
      setVisible(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [config]);

  useEffect(() => {
    const measure = () => {
      const card = cardRef.current;
      const stage = stageRef.current;
      if (!card || !stage) return;

      const naturalHeight = card.scrollHeight;
      const naturalWidth = card.scrollWidth;
      const stageWidth = stage.clientWidth * 0.98;
      const stageHeight = stage.clientHeight * 0.98;

      if (!naturalHeight || !naturalWidth || !stageWidth || !stageHeight) return;

      const nextScale = Math.min(
        1,
        stageWidth / naturalWidth,
        stageHeight / naturalHeight,
      );

      setScale(Math.max(0.38, nextScale));
    };

    const frame = window.requestAnimationFrame(measure);
    const resizeObserver = new ResizeObserver(measure);

    if (cardRef.current) resizeObserver.observe(cardRef.current);
    if (stageRef.current) resizeObserver.observe(stageRef.current);

    window.addEventListener('resize', measure);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [config]);

  const naturalHeight = cardRef.current?.scrollHeight ?? 900;
  const cardWidth = 430 * scale;
  const cardHeight = naturalHeight * scale;

  return (
    <div
      ref={stageRef}
      className="relative flex h-[70vh] min-h-[560px] w-full items-center justify-center overflow-hidden rounded-[30px] bg-[radial-gradient(circle_at_50%_35%,rgba(255,255,255,0.92),rgba(242,244,241,0.82)_42%,rgba(224,228,224,0.72)_100%)] px-4 py-8"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(23,61,50,0.08),transparent_58%)]" />

      <div
        className="relative flex shrink-0 items-start justify-center"
        style={{
          width: cardWidth + 'px',
          height: Math.max(1, cardHeight) + 'px',
        }}
      >
        <div
          ref={cardRef}
          className="origin-top overflow-hidden rounded-[2rem] shadow-[0_30px_80px_rgba(20,35,29,0.24),0_8px_24px_rgba(20,35,29,0.12)] transition-[transform,opacity] duration-500 ease-out will-change-transform"
          style={{
            width: '430px',
            opacity: visible ? 1 : 0,
            transform: 'scale(' + scale + ')',
          }}
        >
          <LoyaltyExperience config={config} />
        </div>
      </div>
    </div>
  );
}
