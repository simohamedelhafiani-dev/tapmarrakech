export const WALLET_TEMPLATES = {
  'onyx-black': { id: 'onyx-black', name: 'Onyx Black', primary: '#181818', accent: '#D7D7D7', background: '#070707', text: '#FFFFFF' },
  'royal-gold': { id: 'royal-gold', name: 'Royal Gold', primary: '#3A2A12', accent: '#E7C66A', background: '#120C05', text: '#FFF9E8' },
  'deep-ocean': { id: 'deep-ocean', name: 'Deep Ocean', primary: '#123B4A', accent: '#8ED9E8', background: '#071B22', text: '#F2FCFF' },
  'minimal-white': { id: 'minimal-white', name: 'Minimal White', primary: '#E9ECE8', accent: '#20352C', background: '#F8FAF7', text: '#17231D' },
  'emerald-luxe': { id: 'emerald-luxe', name: 'Emerald Luxe', primary: '#123D2B', accent: '#C8E6B8', background: '#071D14', text: '#F5FFF8' },
  'burgundy': { id: 'burgundy', name: 'Burgundy', primary: '#4A1725', accent: '#F0B8C5', background: '#210A11', text: '#FFF4F6' },
  'midnight-blue': { id: 'midnight-blue', name: 'Midnight Blue', primary: '#172A52', accent: '#AFC7FF', background: '#080F22', text: '#F5F8FF' },
  'sandstone': { id: 'sandstone', name: 'Sandstone', primary: '#8A6848', accent: '#FFF0D4', background: '#332619', text: '#FFF9EF' },
} as const;

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
  discountPointsThreshold?: number;
  discountValidDays?: number;
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
  rewardName?: string | null;
  rewardPointsRequired?: number;
  rewardDescription?: string | null;
  discountPercent?: number;
  discountPointsThreshold?: number;
  discountExpiresAt?: string | null;
  discountValidDays?: number;
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
        width: '11.33cqw',
        aspectRatio: '1',
        height: 'auto',
        borderRadius: shape === '10px' ? '3.33cqw' : '50%',
        border: `0.5cqw solid ${accent}`,
        background: filled ? `${accent}38` : 'rgba(255,255,255,.04)',
        display: 'grid',
        placeItems: 'center',
        color: accent,
        fontSize: '4.33cqw',
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
  cardWidth,
}: {
  design: VisualDesign;
  card: LoyaltyVisualCard;
  side?: 'front' | 'back';
  compact?: boolean;
  programType?: 'STAMP' | 'DISCOUNT' | 'POINTS' | 'REWARD' | 'TIER';
  cardWidth?: string;
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
  const background = useMemo(() => (
    wallpaper
      ? `linear-gradient(145deg, ${design.primary_color}D9 0%, ${design.primary_color}82 52%, ${design.primary_color}55 100%),url("${wallpaper}")`
      : `linear-gradient(145deg, ${design.background_color} 0%, ${design.primary_color} 54%, ${design.background_color} 100%)`
  ), [design.background_color, design.primary_color, wallpaper]);

  if (side === 'back') {
    return (
      <div style={{ width: cardWidth ?? 'min(90vw, 400px)', height: 'auto', aspectRatio: '2 / 3', position: 'relative', overflow: 'hidden', borderRadius: '6%', background, color: design.text_color, boxSizing: 'border-box', boxShadow: '0 28px 70px rgba(0,0,0,.38)', containerType: 'inline-size' }}>
        <div style={{ position: 'absolute', inset: 0, backgroundSize: 'cover', backgroundPosition: 'center', backgroundRepeat: 'no-repeat', backgroundImage: background }} />
        <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'grid', placeItems: 'center', padding: '9.33cqw', textAlign: 'center', boxSizing: 'border-box' }}>
          <div>
            <div style={{ color: design.secondary_color, fontSize: '3.33cqw', fontWeight: 800, letterSpacing: '.24em', textTransform: 'uppercase' }}>{config.back_title}</div>
            <div style={{ marginTop: '4cqw', fontSize: '4.33cqw', lineHeight: 1.6, opacity: .72 }}>{config.back_message}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        width: cardWidth ?? 'min(90vw, 400px)',
        height: 'auto',
        aspectRatio: '2 / 3',
        position: 'relative',
        overflow: 'hidden',
        borderRadius: '6%',
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
        containerType: 'inline-size',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(125deg,rgba(255,255,255,.15),rgba(255,255,255,.03) 25%,transparent 50%,rgba(255,255,255,.05) 78%,transparent)' }} />
      <div style={{ position: 'relative', zIndex: 1, height: '100%', display: 'flex', flexDirection: 'column', padding: '7.33cqw', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4cqw' }}>
          <div style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: '3.33cqw' }}>
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ width: '14cqw', height: '14cqw', flex: '0 0 14cqw', borderRadius: '4.33cqw', objectFit: 'contain', padding: '1.67cqw', boxSizing: 'border-box', background: 'rgba(255,255,255,.92)' }} />
            ) : (
              <div style={{ width: '14cqw', height: '14cqw', flex: '0 0 14cqw', display: 'grid', placeItems: 'center', borderRadius: '4.33cqw', border: `1px solid ${design.secondary_color}88`, background: 'rgba(255,255,255,.10)', color: design.secondary_color, fontSize: '3.67cqw', fontWeight: 800 }}>
                {(card.establishmentName || 'CL').slice(0, 2).toUpperCase()}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '4cqw', fontWeight: 800 }}>{card.establishmentName || 'Votre établissement'}</div>
              <div style={{ marginTop: '1cqw', fontSize: '2.33cqw', letterSpacing: '.22em', textTransform: 'uppercase', opacity: .52 }}>Programme fidélité</div>
            </div>
          </div>
          <div style={{ flex: '0 0 auto', fontSize: '2.33cqw', letterSpacing: '.16em', textTransform: 'uppercase', color: design.secondary_color, fontWeight: 800 }}>Carte</div>
        </div>

        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ fontSize: '3cqw', fontWeight: 800, letterSpacing: '.24em', textTransform: 'uppercase', color: design.secondary_color }}>
            {mode === 'STAMP' ? 'CARTE À TAMPONS' : mode === 'DISCOUNT' ? 'POINTS & RÉDUCTION' : 'POINTS & RÉCOMPENSES'}
          </div>

          {card.customerName && <div style={{ marginTop: '2.33cqw', fontSize: '4cqw', fontWeight: 700, opacity: .78 }}>{card.customerName}</div>}

          {mode === 'STAMP' ? (
            <>
              <div style={{ marginTop: '3.33cqw', fontSize: '14cqw', lineHeight: 1, fontWeight: 900 }}>
                {stamps}<span style={{ fontSize: '5.33cqw', opacity: .45 }}> / {goal}</span>
              </div>
              <div style={{ marginTop: '5.33cqw', width: '100%', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '2.33cqw' }}>
                {Array.from({ length: goal }).map((_, index) => <StampMark key={index} filled={index < stamps} style={config.stamp_style} accent={design.secondary_color} />)}
              </div>
              <div
                style={{
                  marginTop: '4cqw',
                  width: '100%',
                  padding: '3.33cqw',
                  borderRadius: '5.33cqw',
                  border: `1px solid ${design.secondary_color}66`,
                  background: `linear-gradient(135deg, ${design.secondary_color}22, rgba(255,255,255,.07), ${design.primary_color}28)`,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 12px 28px rgba(0,0,0,.14)',
                  backdropFilter: 'blur(10px)',
                  WebkitBackdropFilter: 'blur(10px)',
                  textAlign: 'left',
                  boxSizing: 'border-box',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '2.67cqw' }}>
                  <div style={{ width: '10.67cqw', height: '10.67cqw', flex: '0 0 10.67cqw', display: 'grid', placeItems: 'center', borderRadius: '3.33cqw', background: `${design.secondary_color}25`, border: `1px solid ${design.secondary_color}66`, color: design.secondary_color, fontSize: '5.33cqw' }}>🎁</div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: '2.33cqw', letterSpacing: '.17em', textTransform: 'uppercase', color: design.secondary_color, fontWeight: 900 }}>Votre cadeau</div>
                    <div style={{ marginTop: '.67cqw', fontSize: '4.33cqw', fontWeight: 850 }}>{card.stampRewardName || config.rewardName || 'Cadeau fidélité'}</div>
                  </div>
                </div>
                <div style={{ marginTop: '2.67cqw', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '2.67cqw', opacity: .68 }}>
                  <span>{stamps >= goal ? '🎉 Objectif atteint' : 'Votre progression'}</span>
                  <span style={{ fontWeight: 900, color: design.secondary_color }}>{stamps} / {goal}</span>
                </div>
                <div style={{ marginTop: '1.33cqw', width: '100%', height: '1.33cqw', borderRadius: '999px', background: 'rgba(255,255,255,.13)', overflow: 'hidden' }}>
                  <div style={{ width: `${Math.max(4, (stamps / goal) * 100)}%`, height: '100%', borderRadius: '999px', background: `linear-gradient(90deg, ${design.secondary_color}99, ${design.secondary_color})`, boxShadow: `0 0 12px ${design.secondary_color}66` }} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginTop: '2.33cqw', fontSize: '19.33cqw', lineHeight: .92, fontWeight: 900, letterSpacing: '-.045em' }}>
                {points.toLocaleString('fr-FR')}
              </div>
              <div style={{ marginTop: '1cqw', fontSize: '3.33cqw', fontWeight: 800, letterSpacing: '.18em', textTransform: 'uppercase', color: design.secondary_color }}>points</div>
              {mode === 'DISCOUNT' && (
                <>
                  <div
                    style={{
                      marginTop: '4cqw',
                      width: '100%',
                      padding: '3.33cqw',
                      borderRadius: '5.33cqw',
                      border: `1px solid ${design.secondary_color}66`,
                      background: `linear-gradient(135deg, ${design.secondary_color}24, rgba(255,255,255,.07), ${design.primary_color}30)`,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 12px 28px rgba(0,0,0,.14)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3cqw' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '2.67cqw' }}>
                        <div style={{ width: '10.67cqw', height: '10.67cqw', display: 'grid', placeItems: 'center', borderRadius: '3.33cqw', background: `${design.secondary_color}25`, border: `1px solid ${design.secondary_color}66`, color: design.secondary_color, fontSize: '5cqw' }}>%</div>
                        <div>
                          <div style={{ fontSize: '2.33cqw', letterSpacing: '.17em', textTransform: 'uppercase', color: design.secondary_color, fontWeight: 900 }}>Avantage fidélité</div>
                          <div style={{ marginTop: '.67cqw', fontSize: '4cqw', fontWeight: 850 }}>Réduction</div>
                        </div>
                      </div>
                      <div style={{ fontSize: '8cqw', lineHeight: 1, fontWeight: 950, color: design.secondary_color }}>-{discount}%</div>
                    </div>
                  </div>
                  <div style={{ marginTop: '3cqw', width: '100%', padding: '2.67cqw 3.33cqw', borderRadius: '3.33cqw', background: 'rgba(255,255,255,.08)', fontSize: '3cqw', lineHeight: 1.45, opacity: .82 }}>
                    {points >= Number(config.discountPointsThreshold ?? 1000)
                      ? card.discountExpiresAt
                        ? `Seuil atteint · profitez de votre réduction jusqu’au ${new Date(card.discountExpiresAt).toLocaleDateString('fr-FR')}`
                        : `Seuil de ${Number(config.discountPointsThreshold ?? 1000).toLocaleString('fr-FR')} points atteint · votre réduction est disponible`
                      : `Atteignez ${Number(config.discountPointsThreshold ?? 1000).toLocaleString('fr-FR')} points pour bénéficier de -${discount}%`}
                  </div>
                </>
              )}
              {mode === 'POINTS' && (card.rewardName || config.rewardName) && (() => {
                const rewardName = card.rewardName || config.rewardName || 'Récompense fidélité';
                const rewardPoints = card.rewardPointsRequired ?? null;
                const rewardAvailable = rewardPoints != null && points >= rewardPoints;
                const rewardProgress = rewardPoints != null && rewardPoints > 0
                  ? Math.min(1, points / rewardPoints)
                  : 0;

                return (
                  <div
                    style={{
                      marginTop: '4cqw',
                      width: '100%',
                      padding: '3.33cqw',
                      borderRadius: '5.33cqw',
                      border: `1px solid ${design.secondary_color}66`,
                      background: `linear-gradient(135deg, ${design.secondary_color}22 0%, rgba(255,255,255,.08) 52%, ${design.primary_color}28 100%)`,
                      boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), 0 12px 28px rgba(0,0,0,.14)',
                      backdropFilter: 'blur(10px)',
                      WebkitBackdropFilter: 'blur(10px)',
                      textAlign: 'left',
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2.67cqw' }}>
                      <div
                        style={{
                          width: '10.67cqw',
                          height: '10.67cqw',
                          flex: '0 0 10.67cqw',
                          display: 'grid',
                          placeItems: 'center',
                          borderRadius: '3.33cqw',
                          background: `linear-gradient(145deg, ${design.secondary_color}38, ${design.secondary_color}12)`,
                          border: `1px solid ${design.secondary_color}66`,
                          color: design.secondary_color,
                          fontSize: '5.33cqw',
                          boxShadow: `0 6px 16px ${design.primary_color}35`,
                        }}
                      >
                        🎁
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontSize: '2.33cqw', letterSpacing: '.17em', textTransform: 'uppercase', color: design.secondary_color, fontWeight: 900 }}>
                          {rewardAvailable ? 'Récompense disponible' : 'Prochaine récompense'}
                        </div>
                        <div style={{ marginTop: '.67cqw', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '4.33cqw', fontWeight: 850, letterSpacing: '-.02em' }}>
                          {rewardName}
                        </div>
                      </div>
                      {rewardPoints != null && (
                        <div
                          style={{
                            flex: '0 0 auto',
                            padding: '1.67cqw 2.33cqw',
                            borderRadius: '999px',
                            background: rewardAvailable ? `${design.secondary_color}30` : 'rgba(255,255,255,.10)',
                            border: `1px solid ${design.secondary_color}55`,
                            color: rewardAvailable ? design.secondary_color : design.text_color,
                            fontSize: '2.33cqw',
                            fontWeight: 900,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {rewardPoints.toLocaleString('fr-FR')} pts
                        </div>
                      )}
                    </div>

                    {card.rewardDescription && (
                      <div style={{ marginTop: '2.67cqw', fontSize: '2.67cqw', lineHeight: 1.45, opacity: .68 }}>
                        {card.rewardDescription}
                      </div>
                    )}

                    {rewardPoints != null && (
                      <div style={{ marginTop: '2.67cqw' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.33cqw', fontSize: '2.33cqw', opacity: .62 }}>
                          <span>{rewardAvailable ? 'Vous pouvez la réclamer' : 'Votre progression'}</span>
                          <span style={{ fontWeight: 800 }}>{points.toLocaleString('fr-FR')} / {rewardPoints.toLocaleString('fr-FR')}</span>
                        </div>
                        <div style={{ width: '100%', height: '1.33cqw', borderRadius: '999px', background: 'rgba(255,255,255,.13)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(4, rewardProgress * 100)}%`,
                              height: '100%',
                              borderRadius: '999px',
                              background: `linear-gradient(90deg, ${design.secondary_color}99, ${design.secondary_color})`,
                              boxShadow: `0 0 12px ${design.secondary_color}66`,
                              transition: 'width .3s ease',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    <div style={{ marginTop: '2.67cqw', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '2cqw' }}>
                      <span style={{ fontSize: '2.33cqw', opacity: .48 }}>
                        {rewardAvailable ? '🎉 Félicitations !' : 'Continuez à cumuler vos points'}
                      </span>
                      {rewardAvailable && (
                        <span style={{ fontSize: '2.33cqw', fontWeight: 900, color: design.secondary_color }}>
                          DISPONIBLE
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}
            </>
          )}

          <div style={{ marginTop: '5.67cqw', width: '18cqw', height: '0.33cqw', background: design.secondary_color, opacity: .55 }} />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ width: '23.33cqw', height: '23.33cqw', padding: '2cqw', boxSizing: 'border-box', borderRadius: '4.33cqw', background: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 12px 28px rgba(0,0,0,.28)' }}>
            {showQr && qr ? <img src={qr} alt="QR Code fidélité" style={{ width: '19.33cqw', height: '19.33cqw', display: 'block' }} /> : <div style={{ width: '19.33cqw', height: '19.33cqw' }} />}
          </div>
          <div style={{ marginTop: '2.67cqw', fontSize: '2.67cqw', letterSpacing: '.16em', textTransform: 'uppercase', opacity: .5 }}>{card.customerName || 'Client'}</div>
        </div>
      </div>
    </div>
  );
}
