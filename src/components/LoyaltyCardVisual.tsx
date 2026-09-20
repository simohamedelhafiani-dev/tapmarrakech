import { useEffect, useState } from 'react';
import { Gift, MapPin, Phone } from 'lucide-react';
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
  ai_prompt?: string;
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
};

export type LoyaltyVisualCard = {
  establishmentName: string;
  logoUrl?: string | null;
  points?: number;
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

  const logoStyle = {
    transform: `translate(${config.logo_x}px, ${config.logo_y}px)`,
  };

  return (
    <div
      className={`relative aspect-[1.62/1] w-full overflow-hidden text-white shadow-2xl ${compact ? 'p-4' : 'p-6 md:p-7'}`}
      style={{
        background: config.background_image_url
          ? `linear-gradient(135deg, ${design.primary_color}dd, ${design.primary_color}bb), url(${config.background_image_url}) center/cover`
          : `linear-gradient(135deg, ${design.primary_color}, ${design.primary_color}ee)`,
        borderRadius: design.border_radius,
      }}
    >
      <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full opacity-20" style={{ background: design.secondary_color }} />
      <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full opacity-10" style={{ background: design.secondary_color }} />

      {side === 'front' ? (
        <div className="relative flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3" style={logoStyle}>
              {card.logoUrl ? (
                <img src={card.logoUrl} alt="" className={`rounded-full bg-white object-contain p-1.5 shadow-sm ${compact ? 'h-9 w-9' : 'h-14 w-14'}`} />
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
            {config.show_qr && qr && <div className={`shrink-0 rounded-xl bg-white p-1.5 ${compact ? 'h-14 w-14' : 'h-20 w-20'}`}><img src={qr} alt="" className="h-full w-full" /></div>}
          </div>

          <div className="flex items-end justify-between gap-4">
            {config.show_points ? (
              <div>
                <p className="text-[8px] uppercase tracking-[0.18em] opacity-50">Solde</p>
                <p className={`font-semibold ${compact ? 'text-xl' : 'text-3xl'}`} style={{ color: design.secondary_color }}>{card.points ?? 250}</p>
              </div>
            ) : <span />}
            <div className="flex gap-1.5">
              {[0,1,2,3,4].map(i => <span key={i} className={`rounded-full border ${compact ? 'h-3 w-3' : 'h-4 w-4'}`} style={{ borderColor: design.secondary_color, background: i < 3 ? design.secondary_color : 'transparent' }} />)}
            </div>
          </div>
        </div>
      ) : (
        <div className="relative flex h-full flex-col justify-between">
          <div>
            <p className={`font-display ${compact ? 'text-lg' : 'text-2xl'}`} style={{ color: design.background_color }}>{config.back_title}</p>
            <p className="mt-3 max-w-[70%] text-xs leading-5 opacity-75">{config.back_message}</p>
          </div>
          <div className="flex items-end justify-between gap-4">
            <div className="space-y-1 text-[10px] opacity-65">
              {card.phone && <p className="flex items-center gap-1.5"><Phone size={11} />{card.phone}</p>}
              {card.address && <p className="flex items-center gap-1.5"><MapPin size={11} />{card.address}</p>}
              {card.loyaltyNumber && <p>N° {card.loyaltyNumber}</p>}
            </div>
            {card.logoUrl && <img src={card.logoUrl} alt="" className={`rounded-full bg-white object-contain p-2 ${compact ? 'h-12 w-12' : 'h-20 w-20'}`} />}
          </div>
        </div>
      )}
    </div>
  );
}
