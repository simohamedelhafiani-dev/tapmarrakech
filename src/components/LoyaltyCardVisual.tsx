import { useEffect, useMemo, useState } from 'react';
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
  showQr?: boolean;
  stamp_style: 'circles' | 'squares' | 'stars' | 'hearts';
  background_image_url: string | null;
  logo_url?: string | null;
  ai_prompt?: string;
  ai_generation_id?: string;
  card_mode?: 'QR' | 'STAMP' | 'POINTS_REWARD' | 'POINTS_DISCOUNT';
  loyaltyType?: 'STAMP' | 'POINTS' | 'DISCOUNT' | 'REWARD' | 'TIER' | 'CHALLENGE' | 'CASHBACK' | 'COLLECTION';
  cardTitle?: string;
  cardSubtitle?: string;
  progressText?: string;
  rewardTitle?: string;
  rewardDescription?: string;
  rewardName?: string;
  discountPercent?: number;
  benefits?: { title: string; description?: string; icon?: string }[];
  offers?: { title: string; description?: string; eyebrow?: string }[];
  business_type?: string | null;
};

export const defaultLoyaltyDesignConfig: LoyaltyDesignConfig = {
  logo_x: 0,
  logo_y: 0,
  front_title: 'CARTE FIDÉLITÉ',
  front_subtitle: 'Merci de faire partie de notre histoire !',
  back_title: 'Merci pour votre fidélité !',
  back_message: 'Chaque visite vous rapproche d’une expérience unique. À très bientôt !',
  show_qr: false,
  show_points: true,
  stamp_style: 'circles',
  background_image_url: null,
  logo_url: null,
  card_mode: 'POINTS_REWARD',
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
};

type VisualDesign = {
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  border_radius?: number;
  template_id?: string;
  config?: Partial<LoyaltyDesignConfig>;
};

function normalizeMode(
  design: VisualDesign,
  programType: 'STAMP' | 'DISCOUNT' | 'POINTS' | 'REWARD' | 'TIER',
) {
  const cfg = { ...defaultLoyaltyDesignConfig, ...(design.config ?? {}) };
  if (cfg.card_mode === 'STAMP' || cfg.loyaltyType === 'STAMP' || programType === 'STAMP') return 'STAMP';
  if (cfg.card_mode === 'POINTS_DISCOUNT' || cfg.loyaltyType === 'DISCOUNT' || programType === 'DISCOUNT') return 'DISCOUNT';
  return 'POINTS';
}

function StampMark({ filled, style, accent }: { filled: boolean; style: LoyaltyDesignConfig['stamp_style']; accent: string }) {
  const shape = style === 'squares' ? '10px' : '50%';
  const mark = style === 'stars' ? '★' : style === 'hearts' ? '♥' : filled ? '✓' : '';
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: shape,
        border: `1.5px solid ${accent}`,
        background: filled ? `${accent}38` : 'rgba(255,255,255,.04)',
        display: 'grid',
        placeItems: 'center',
        color: accent,
        fontSize: 13,
        fontWeight: 800,
        boxSizing: 'border-box',
      }}
    >
      {mark}
    </div>
  );
}

export function LoyaltyCardVisual({
  design,
  card,
  side = 'front',
  programType = 'POINTS',
}: {
  design: VisualDesign;
  card: LoyaltyVisualCard;
  side?: 'front' | 'back';
  compact?: boolean;
  programType?: 'STAMP' | 'DISCOUNT' | 'POINTS' | 'REWARD' | 'TIER';
}) {
  const config = { ...defaultLoyaltyDesignConfig, ...(design.config ?? {}) };
  const mode = normalizeMode(design, programType);
  const wallpaper = config.background_image_url;
  const showQr = Boolean(config.show_qr || config.showQr);
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!showQr || side !== 'front' || !card.cardUrl) {
      setQr('');
      return;
    }
    let active = true;
    void QRCode.toDataURL(card.cardUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: design.primary_color, light: '#FFFFFF' },
    }).then(value => {
      if (active) setQr(value);
    }).catch(() => {
      if (active) setQr('');
    });
    return () => { active = false; };
  }, [card.cardUrl, design.primary_color, showQr, side]);

  const goal = Math.max(1, Math.min(12, Number(card.stampGoal ?? 10)));
  const stamps = Math.max(0, Math.min(goal, Number(card.stampsBalance ?? 0)));
  const points = Math.max(0, Number(card.points ?? 0));
  const discount = Math.max(0, Number(card.discountPercent ?? config.discountPercent ?? 10));
  const logoUrl = config.logo_url || card.logoUrl || null;
  const radius = Math.max(28, Number(design.border_radius ?? 34));

  const background = useMemo(() => (
    wallpaper
      ? `linear-gradient(145deg, ${design.primary_color}D9 0%, ${design.primary_color}82 52%, ${design.primary_color}55 100%),url("${wallpaper}")`
      : `linear-gradient(145deg, ${design.background_color} 0%, ${design.primary_color} 54%, ${design.background_color} 100%)`
  ), [design.background_color, design.primary_color, wallpaper]);

  if (side === 'back') {
    return (
      <div style={{ width: 300, height: 450, flex: '0 0 300px', position: 'relative', overflow: 'hidden', borderRadius: radius, background, color: design.text_color, boxSizing: 'border-box', boxShadow: '0 28px 70px rgba(0,0,0,.38)' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundImage: background }} />
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'grid', placeItems: 'center', padding: 28, textAlign: 'center', boxSizing: 'border-box' }}>
          <div>
            <div style={{ color: design.secondary_color, fontSize: 10, fontWeight: 800, letterSpacing: '.24em', textTransform: 'uppercase' }}>{config.back_title}</div>
            <div style={{ marginTop: 12, fontSize: 13, lineHeight: 1.6, opacity: .72 }}>{config.back_message}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: 300,
        height: 450,
        flex: '0 0 300px',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: radius,
        border: '1px solid rgba(255,255,255,.18)',
        backgroundColor: design.background_color,
        backgroundImage: background,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        color: design.text_color,
        boxSizing: 'border-box',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,.20), inset 0 -30px 60px rgba(0,0,0,.22), 0 28px 70px rgba(0,0,0,.38)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(125deg,rgba(255,255,255,.15),rgba(255,255,255,.03) 25%,transparent 50%,rgba(255,255,255,.05) 78%,transparent)' }} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: 22, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 10 }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ width: 42, height: 42, flex: '0 0 42px', borderRadius: 13, objectFit: 'contain', padding: 5, boxSizing: 'border-box', background: 'rgba(255,255,255,.92)' }} />
            ) : (
              <div style={{ width: 42, height: 42, flex: '0 0 42px', display: 'grid', placeItems: 'center', borderRadius: 13, border: `1px solid ${design.secondary_color}88`, background: 'rgba(255,255,255,.10)', color: design.secondary_color, fontSize: 11, fontWeight: 800 }}>
                {(card.establishmentName || 'CL').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, fontWeight: 800 }}>{card.establishmentName || 'Votre établissement'}</div>
              <div style={{ marginTop: 3, fontSize: 7, letterSpacing: '.22em', textTransform: 'uppercase', opacity: .52 }}>Programme fidélité</div>
            </div>
          </div>
          <div style={{ flex: '0 0 auto', fontSize: 7, letterSpacing: '.16em', textTransform: 'uppercase', color: design.secondary_color, fontWeight: 800 }}>Carte</div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.24em', textTransform: 'uppercase', color: design.secondary_color }}>
            {mode === 'STAMP' ? 'CARTE À TAMPONS' : mode === 'DISCOUNT' ? 'POINTS & RÉDUCTION' : 'POINTS & RÉCOMPENSES'}
          </div>

          {card.customerName && <div style={{ marginTop: 7, fontSize: 12, fontWeight: 700, opacity: .78 }}>{card.customerName}</div>}

          {mode === 'STAMP' ? (
            <>
              <div style={{ marginTop: 10, fontSize: 42, lineHeight: 1, fontWeight: 900 }}>
                {stamps}<span style={{ fontSize: 16, opacity: .45 }}> / {goal}</span>
              </div>
              <div style={{ marginTop: 16, width: '100%', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7 }}>
                {Array.from({ length: goal }).map((_, index) => <StampMark key={index} filled={index < stamps} style={config.stamp_style} accent={design.secondary_color} />)}
              </div>
              <div style={{ marginTop: 13, fontSize: 11, opacity: .65 }}>{card.stampRewardName || config.rewardName || 'Cadeau fidélité'}</div>
            </>
          ) : (
            <>
              <div style={{ marginTop: 7, fontSize: 58, lineHeight: .92, fontWeight: 900, letterSpacing: '-.045em' }}>
                {points.toLocaleString('fr-FR')}
              </div>
              <div style={{ marginTop: 3, fontSize: 10, fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: design.secondary_color }}>points</div>
              {mode === 'DISCOUNT' && (
                <div style={{ marginTop: 14, padding: '9px 14px', borderRadius: 15, border: `1px solid ${design.secondary_color}66`, background: `${design.secondary_color}18`, fontSize: 20, fontWeight: 900 }}>
                  -{discount}%
                </div>
              )}
              {mode === 'POINTS' && config.rewardName && (
                <div style={{ marginTop: 12, fontSize: 10, opacity: .68 }}>{config.rewardName}</div>
              )}
            </>
          )}

          <div style={{ marginTop: 17, width: 54, height: 1, background: design.secondary_color, opacity: .55 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: 70, height: 70, padding: 6, boxSizing: 'border-box', borderRadius: 13, background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 12px 28px rgba(0,0,0,.28)' }}>
            {showQr && qr ? <img src={qr} alt="QR Code fidélité" style={{ width: 58, height: 58, display: 'block' }} /> : <div style={{ width: 58, height: 58 }} />}
          </div>
          <div style={{ marginTop: 8, fontSize: 8, letterSpacing: '.16em', textTransform: 'uppercase', opacity: .5 }}>{card.customerName || 'Client'}</div>
        </div>
      </div>
    </div>
  );
}
