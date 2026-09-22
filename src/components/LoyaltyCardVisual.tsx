import { useEffect, useState } from 'react';
import { Gift, Star } from 'lucide-react';
import QRCode from 'qrcode';

export type LoyaltyDesignConfig = {
  logo_x: number;
  logo_y: number;
  front_title: string;
  front_subtitle: string;
  back_title: string;
  back_message: string;
  show_qr: boolean;
  show_points: boolean;
  stamp_style: 'circles' | 'squares' | 'stars' | 'hearts';
  background_image_url: string | null;
  logo_url?: string | null;
  ai_prompt?: string;
  ai_generation_id?: string;
  card_mode?: 'QR' | 'STAMP';
  loyaltyType?: 'STAMP' | 'POINTS' | 'DISCOUNT' | 'REWARD' | 'TIER' | 'CHALLENGE' | 'CASHBACK';
  cardTitle?: string;
  cardSubtitle?: string;
  progressText?: string;
  rewardTitle?: string;
  rewardDescription?: string;
  rewardName?: string;
  discountPercent?: number;
};

export const defaultLoyaltyDesignConfig: LoyaltyDesignConfig = {
  logo_x: 0,
  logo_y: 0,
  front_title: 'CARTE FIDÉLITÉ',
  front_subtitle: 'Savourez, collectionnez, profitez !',
  back_title: 'Merci pour votre fidélité !',
  back_message: 'Chaque visite vous rapproche d’une expérience unique. À très bientôt !',
  show_qr: true,
  show_points: true,
  stamp_style: 'circles',
  background_image_url: null,
  logo_url: null,
  card_mode: 'QR',
};

export type LoyaltyVisualCard = {
  establishmentName: string;
  logoUrl?: string | null;
  points?: number;
  stampsBalance?: number;
  stampGoal?: number;
  stampRewardName?: string | null;
  discountPercent?: number;
  discountExpiresAt?: string | null;
  customerName?: string;
  loyaltyNumber?: string;
  cardUrl?: string;
  phone?: string | null;
  address?: string | null;
};

function StampMark({
  filled,
  style,
  secondaryColor,
  compact,
}: {
  filled: boolean;
  style: LoyaltyDesignConfig['stamp_style'];
  secondaryColor: string;
  compact: boolean;
}) {
  const size = compact ? 'h-7 w-7' : 'h-10 w-10';

  if (style === 'stars') {
    return (
      <span
        className={`grid ${size} place-items-center rounded-xl border-2`}
        style={{
          borderColor: secondaryColor,
          background: filled ? secondaryColor : 'transparent',
        }}
      >
        <Star
          size={compact ? 12 : 17}
          fill={filled ? 'currentColor' : 'none'}
          style={{ color: filled ? '#ffffff' : secondaryColor }}
        />
      </span>
    );
  }

  if (style === 'hearts') {
    return (
      <span
        className={`grid ${size} place-items-center rounded-full border-2`}
        style={{
          borderColor: secondaryColor,
          background: filled ? secondaryColor : 'transparent',
        }}
      >
        <span
          className="text-xs"
          style={{ color: filled ? '#ffffff' : secondaryColor }}
        >
          ♥
        </span>
      </span>
    );
  }

  return (
    <span
      className={`grid ${size} place-items-center border-2 ${
        style === 'squares' ? 'rounded-lg' : 'rounded-full'
      }`}
      style={{
        borderColor: secondaryColor,
        background: filled ? secondaryColor : 'transparent',
      }}
    >
      {filled && <span className="h-2 w-2 rounded-full bg-white" />}
    </span>
  );
}

export function LoyaltyCardVisual({
  design,
  card,
  side = 'front',
  compact = false,
  programType = 'POINTS',
}: {
  design: {
    primary_color: string;
    secondary_color: string;
    background_color: string;
    text_color: string;
    border_radius: number;
    config?: Partial<LoyaltyDesignConfig>;
  };
  card: LoyaltyVisualCard;
  side?: 'front' | 'back';
  compact?: boolean;
  programType?: 'STAMP' | 'DISCOUNT' | 'POINTS' | 'REWARD' | 'TIER';
}) {
  const config = { ...defaultLoyaltyDesignConfig, ...(design.config ?? {}) };
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!config.show_qr || side !== 'front' || !card.cardUrl) {
      setQr('');
      return;
    }

    void QRCode.toDataURL(card.cardUrl, {
      width: 280,
      margin: 1,
      color: {
        dark: design.primary_color,
        light: '#ffffff',
      },
    })
      .then(setQr)
      .catch(() => setQr(''));
  }, [card.cardUrl, config.show_qr, design.primary_color, side]);

  const cardMode =
    config.card_mode ?? (programType === 'STAMP' ? 'STAMP' : 'QR');
  const logoUrl = config.logo_url || card.logoUrl;
  const stampGoal = Math.max(1, Math.min(card.stampGoal ?? 10, 12));
  const stampsBalance = Math.max(0, Math.min(card.stampsBalance ?? 0, stampGoal));

  const background = config.background_image_url
    ? `linear-gradient(135deg, ${design.primary_color}ee 0%, ${design.primary_color}99 55%, ${design.primary_color}55 100%), url(${config.background_image_url}) center/cover no-repeat`
    : `linear-gradient(145deg, ${design.primary_color} 0%, ${design.primary_color}f2 55%, ${design.primary_color}cc 100%)`;

  return (
    <div
      className={`relative w-full overflow-hidden text-white shadow-2xl ${
        compact ? 'aspect-[0.98/1] p-5' : 'aspect-[0.93/1] p-6 sm:p-7'
      }`}
      style={{
        background,
        borderRadius: design.border_radius,
      }}
    >
      <div
        className="pointer-events-none absolute -right-24 -top-28 h-[58%] w-[62%] rounded-full opacity-20"
        style={{ background: design.secondary_color }}
      />
      <div
        className="pointer-events-none absolute -bottom-28 -left-24 h-[52%] w-[62%] rounded-full opacity-15"
        style={{ background: design.secondary_color }}
      />

      {side === 'front' ? (
        <div className="relative flex h-full flex-col">
          <div className="flex items-start justify-between gap-4">
            <div
              className="flex min-w-0 items-center gap-3"
              style={{
                transform: `translate(${config.logo_x}px, ${config.logo_y}px)`,
              }}
            >
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt=""
                  className={`rounded-full bg-white object-contain shadow-lg ${
                    compact ? 'h-14 w-14 p-1.5' : 'h-[76px] w-[76px] p-2'
                  }`}
                />
              ) : (
                <div
                  className={`grid place-items-center rounded-full border-2 bg-white/10 font-semibold ${
                    compact ? 'h-14 w-14 text-xs' : 'h-[76px] w-[76px] text-sm'
                  }`}
                  style={{
                    borderColor: design.secondary_color,
                    color: design.secondary_color,
                  }}
                >
                  {card.establishmentName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p
                  className={`truncate font-semibold uppercase tracking-[0.14em] ${
                    compact ? 'text-[10px]' : 'text-sm'
                  }`}
                >
                  {card.establishmentName}
                </p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.25em] opacity-60">
                  Programme fidélité
                </p>
              </div>
            </div>

            <div className="shrink-0 text-right">
              <p
                className={`font-medium uppercase tracking-[0.22em] opacity-80 ${
                  compact ? 'text-[8px]' : 'text-[10px]'
                }`}
              >
                Carte fidélité
              </p>
              <p className="mt-2 text-[8px] uppercase tracking-[0.2em] opacity-45">
                {cardMode === 'STAMP' ? 'Collectionnez vos visites' : 'Good food · Better moments'}
              </p>
            </div>
          </div>

          <div className="mt-8 min-h-0 flex-1">
            <p
              className={`font-display leading-none ${
                compact ? 'text-3xl' : 'text-4xl sm:text-[44px]'
              }`}
              style={{ color: design.text_color }}
            >
              {config.front_title}
            </p>

            <p
              className={`mt-3 max-w-[330px] leading-5 opacity-70 ${
                compact ? 'text-[10px]' : 'text-xs sm:text-sm'
              }`}
            >
              {config.front_subtitle}
            </p>

            {card.customerName && (
              <div className="mt-6">
                <p className="text-[9px] uppercase tracking-[0.24em] opacity-50">
                  Client
                </p>
                <p
                  className={`mt-1 font-semibold tracking-tight ${
                    compact ? 'text-lg' : 'text-2xl'
                  }`}
                >
                  {card.customerName}
                </p>
              </div>
            )}

            {loyaltyType === 'POINTS' && config.show_points && (
              <div className="mt-7">
                <p className="text-[9px] uppercase tracking-[0.24em] opacity-50">Vos points</p>
                <p className={`mt-1 font-bold leading-none tracking-tight ${compact ? 'text-5xl' : 'text-6xl sm:text-7xl'}`}>
                  {card.points ?? 0}
                </p>
              </div>
            )}

            {loyaltyType === 'DISCOUNT' && (
              <div className="mt-7 rounded-2xl border border-white/15 bg-white/10 p-4">
                <p className="text-[9px] uppercase tracking-[0.2em] opacity-60">Votre avantage</p>
                <p className={`mt-1 font-bold ${compact ? 'text-4xl' : 'text-5xl'}`}>
                  -{config.discountPercent ?? 10}%
                </p>
                <p className="mt-1 text-[10px] opacity-70">{config.progressText || 'sur votre prochaine visite'}</p>
              </div>
            )}

            {loyaltyType === 'REWARD' && (
              <div className="mt-7 rounded-2xl border border-white/15 bg-white/10 p-4">
                <Gift size={18} style={{ color: design.secondary_color }} />
                <p className="mt-2 text-lg font-semibold">{config.rewardName || config.rewardTitle || 'Votre récompense'}</p>
                <p className="mt-1 text-[10px] opacity-60">{config.rewardDescription || 'Votre fidélité est récompensée.'}</p>
              </div>
            )}

            {loyaltyType === 'TIER' && (
              <div className="mt-7 grid grid-cols-3 gap-2">
                {['Bronze', 'Silver', 'Gold'].map((tier, index) => (
                  <div key={tier} className="rounded-xl bg-white/10 p-2 text-center">
                    <p className="text-[8px] uppercase tracking-wider opacity-60">{tier}</p>
                    <p className="mt-1 text-sm font-bold">{index === 0 ? '-5%' : index === 1 ? '-10%' : '-20%'}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {cardMode === 'STAMP' ? (
            <div className={`mt-5 ${compact ? '' : 'sm:mt-6'}`}>
              <div className="flex items-end justify-between gap-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.22em] opacity-55">
                    Vos visites
                  </p>
                  <p className="mt-1 text-sm font-semibold">
                    {stampsBalance} / {stampGoal}
                  </p>
                </div>
                <div
                  className="flex items-center gap-2 rounded-full border px-3 py-1.5"
                  style={{ borderColor: design.secondary_color }}
                >
                  <Gift size={14} style={{ color: design.secondary_color }} />
                  <span className="max-w-[150px] truncate text-[10px] font-semibold">
                    {card.stampRewardName || 'Récompense'}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {Array.from({ length: stampGoal }).map((_, i) => (
                  <StampMark
                    key={i}
                    filled={i < stampsBalance}
                    style={config.stamp_style}
                    secondaryColor={design.secondary_color}
                    compact={compact}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-col items-center">
              {qr && (
                <div
                  className={`rounded-2xl bg-white shadow-xl ${
                    compact ? 'h-24 w-24 p-2' : 'h-32 w-32 p-2.5 sm:h-36 sm:w-36'
                  }`}
                >
                  <img src={qr} alt="" className="h-full w-full" />
                </div>
              )}
              <p className="mt-3 text-center text-[9px] uppercase tracking-[0.2em] opacity-55">
                Présentez ou scannez votre QR code
              </p>
            </div>
          )}

          <div className="mt-5 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-[8px] uppercase tracking-[0.2em] opacity-55">
              <span
                className="h-px w-7"
                style={{ background: design.secondary_color }}
              />
              <span>
                {cardMode === 'STAMP'
                  ? 'Récompense à la dernière visite'
                  : 'Présentez votre carte'}
              </span>
            </div>
            <span className="shrink-0 text-[9px] uppercase tracking-[0.18em] opacity-70">
              by Tap Marrakech
            </span>
          </div>
        </div>
      ) : (
        <div className="relative grid h-full place-items-center text-center">
          <div>
            <p className="text-[10px] uppercase tracking-[0.24em] opacity-60">
              {config.back_title}
            </p>
            <p className="mt-3 text-sm opacity-70">{config.back_message}</p>
          </div>
        </div>
      )}
    </div>
  );
}
