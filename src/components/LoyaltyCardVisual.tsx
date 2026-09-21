import { useEffect, useState } from 'react';
import { Gift } from 'lucide-react';
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
  programType?: 'STAMP' | 'DISCOUNT' | 'POINTS';
}) {
  const config = { ...defaultLoyaltyDesignConfig, ...(design.config ?? {}) };
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!config.show_qr || side !== 'front' || !card.cardUrl) {
      setQr('');
      return;
    }
    void QRCode.toDataURL(card.cardUrl, { width: 180, margin: 1, color: { dark: design.primary_color, light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [card.cardUrl, config.show_qr, design.primary_color, side]);

  const isAIDesign = Boolean(config.ai_generation_id && config.background_image_url);
  const cardMode = config.card_mode ?? (programType === 'STAMP' ? 'STAMP' : 'QR');
  const logoUrl = config.logo_url || card.logoUrl;
  const logoStyle = {
    transform: `translate(${config.logo_x}px, ${config.logo_y}px)`,
  };

  return (
    <div
      className={`relative aspect-[1.62/1] w-full overflow-hidden text-white shadow-2xl ${compact ? 'p-4' : 'p-6 md:p-7'}`}
      style={{
        background: isAIDesign
          ? `url(${config.background_image_url}) center/cover no-repeat`
          : config.background_image_url
            ? `linear-gradient(135deg, ${design.primary_color}dd, ${design.primary_color}bb), url(${config.background_image_url}) center/cover`
            : `linear-gradient(135deg, ${design.primary_color}, ${design.primary_color}ee)`,
        borderRadius: design.border_radius,
      }}
    >
      {!isAIDesign && <>
        <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-20" style={{ background: design.secondary_color }} />
        <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full opacity-10" style={{ background: design.secondary_color }} />
      </>}

      {side === 'front' ? (
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3" style={logoStyle}>
              {logoUrl ? (
                <img src={logoUrl ?? undefined} alt="" className={`rounded-full bg-white object-contain p-1.5 shadow-sm ${compact ? 'h-9 w-9' : 'h-14 w-14'}`} />
              ) : (
                <div className={`grid place-items-center rounded-full border font-semibold ${compact ? 'h-9 w-9 text-[9px]' : 'h-14 w-14 text-xs'}`} style={{ borderColor: design.secondary_color, color: design.secondary_color }}>
                  {card.establishmentName.slice(0, 2).toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className={`truncate font-semibold uppercase tracking-[0.12em] ${compact ? 'text-[8px]' : 'text-sm'}`}>{card.establishmentName}</p>
                <p className="mt-1 text-[9px] uppercase tracking-[0.2em] opacity-55">Programme fidélité</p>
              </div>
            </div>
            {!compact && <div className="grid h-10 w-10 place-items-center rounded-full border" style={{ borderColor: design.secondary_color, color: design.secondary_color }}><Gift size={17} /></div>}
          </div>

          <div className="flex items-end justify-between gap-4">
            <div className="min-w-0">
              <p className={`font-display ${compact ? 'text-lg' : 'text-2xl'}`} style={{ color: design.background_color }}>{config.front_title}</p>
              <p className="mt-1 max-w-[340px] text-[10px] opacity-65">{config.front_subtitle}</p>
              {card.customerName && <p className="mt-3 text-xs font-semibold">{card.customerName}</p>}
            </div>
            {cardMode === 'QR' && qr && <div className={`shrink-0 rounded-xl bg-white p-1.5 ${compact ? 'h-14 w-14' : 'h-20 w-20'}`}><img src={qr} alt="" className="h-full w-full" /></div>}
          </div>

          <div className="flex items-end justify-between gap-4">
            {cardMode === 'STAMP' ? (
              <div className="w-full">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] uppercase tracking-[0.18em] opacity-55">Visites</p>
                  <p className="text-[9px] font-medium opacity-70">{card.stampsBalance ?? 0} / {card.stampGoal ?? 10}</p>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex min-w-0 flex-1 gap-1.5">
                    {Array.from({ length: Math.min(card.stampGoal ?? 10, 12) }).map((_, i) => (
                      <span key={i} className={`grid place-items-center border ${compact ? 'h-4 w-4' : 'h-5 w-5'} ${config.stamp_style === 'squares' ? 'rounded-md' : 'rounded-full'}`} style={{ borderColor: design.secondary_color, background: i < (card.stampsBalance ?? 0) ? design.secondary_color : 'transparent' }}>
                        {i < (card.stampsBalance ?? 0) && <span className="h-1.5 w-1.5 rounded-full bg-white/90" />}
                      </span>
                    ))}
                  </div>
                  <div className="shrink-0 rounded-xl border px-2 py-1.5 text-right" style={{ borderColor: design.secondary_color }}>
                    <Gift size={compact ? 12 : 14} style={{ color: design.secondary_color }} className="ml-auto" />
                    <p className="mt-0.5 max-w-[92px] truncate text-[8px] font-semibold">{card.stampRewardName || 'Récompense'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="w-full text-right">
                <p className="text-[8px] uppercase tracking-[0.18em] opacity-55">Carte digitale</p>
                <p className="mt-1 text-[9px] font-medium opacity-70">Présentez ou scannez votre QR code</p>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-center justify-center gap-3 text-[8px] uppercase tracking-[0.25em] opacity-70">
            <span className="h-px w-8" style={{ background: design.secondary_color }} />
            <span>by Tap Marrakech</span>
            <span className="h-px w-8" style={{ background: design.secondary_color }} />
          </div>
        </div>
      ) : null
    </div>
  );
}
