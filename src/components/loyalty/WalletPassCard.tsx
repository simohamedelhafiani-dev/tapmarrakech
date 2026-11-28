import { useEffect, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import QRCode from 'qrcode';
import { QR_SIZES, type CardCategoryTemplate, type PassPattern, type QrFrame, type QrSize } from '@/components/loyalty/cardTemplates';

type PassConfig = {
  background_image_url?: string | null;
  logo_url?: string | null;
  show_qr?: boolean;
  showQr?: boolean;
  stamp_style?: 'circles' | 'squares' | 'stars' | 'hearts';
  rewardName?: string;
  discountPercent?: number;
  discountPointsThreshold?: number;
  back_title?: string;
  back_message?: string;
  qr_size?: QrSize;
  qr_frame?: QrFrame;
};

type PassCard = {
  establishmentName: string;
  logoUrl?: string | null;
  points?: number;
  stampsBalance?: number;
  stampGoal?: number;
  stampRewardName?: string | null;
  rewardName?: string | null;
  rewardPointsRequired?: number;
  discountPercent?: number;
  discountExpiresAt?: string | null;
  customerName?: string;
  loyaltyNumber?: string;
  cardUrl?: string;
  raffleTitle?: string | null;
  rafflePrize?: string | null;
  raffleStartsAt?: string | null;
  customerTierName?: string | null;
};

const label = (color: string): CSSProperties => ({
  fontSize: '2.3cqw',
  fontWeight: 800,
  letterSpacing: '.16em',
  textTransform: 'uppercase',
  color,
  whiteSpace: 'nowrap',
});

function patternLayer(pattern: PassPattern, accent: string): CSSProperties {
  const a = `${accent}38`;
  switch (pattern) {
    case 'dots':
      return { backgroundImage: `radial-gradient(${a} 0.45cqw, transparent 0.6cqw)`, backgroundSize: '4.6cqw 4.6cqw' };
    case 'grid':
      return { backgroundImage: `linear-gradient(${a} 1px, transparent 1px), linear-gradient(90deg, ${a} 1px, transparent 1px)`, backgroundSize: '7cqw 7cqw' };
    case 'rays':
      return { backgroundImage: `repeating-conic-gradient(from 0deg at 88% 10%, ${a} 0deg 5deg, transparent 5deg 13deg)` };
    case 'rings':
      return { backgroundImage: `repeating-radial-gradient(circle at 88% 12%, transparent 0 3.4cqw, ${a} 3.4cqw 3.7cqw)` };
    case 'waves': {
      const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='28'><path d='M0 14 Q30 2 60 14 T120 14' fill='none' stroke='${accent}' stroke-opacity='.4' stroke-width='1.6'/></svg>`;
      return { backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`, backgroundSize: '26cqw 6cqw' };
    }
    default:
      return {};
  }
}

/**
 * Wallet-style loyalty pass (Apple/Google Wallet look). Three layouts:
 * - band: header, photo band carrying the main value, fields, QR
 * - top: header, main value, photo band, fields, QR
 * - immersive: the photo (or pattern art) fills the whole card
 */
export function WalletPassCard({
  template,
  config,
  card,
  mode,
  side = 'front',
  cardWidth,
  onInviteFriend,
}: {
  template: CardCategoryTemplate;
  config: PassConfig;
  card: PassCard;
  mode: 'STAMP' | 'DISCOUNT' | 'POINTS';
  side?: 'front' | 'back';
  cardWidth?: string;
  onInviteFriend?: () => void;
}) {
  const showQr = Boolean(config.show_qr || config.showQr);
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!showQr || side !== 'front' || !card.cardUrl) {
      setQr('');
      return;
    }
    let active = true;
    void QRCode.toDataURL(card.cardUrl, { width: 512, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#FFFFFF' } })
      .then(value => { if (active) setQr(value); })
      .catch(() => { if (active) setQr(''); });
    return () => { active = false; };
  }, [card.cardUrl, showQr, side]);

  const { accent, background, backgroundEnd, layout, pattern } = template;
  const photo = config.background_image_url || null;
  const immersive = layout === 'immersive';
  // On an immersive photo the text sits on a dark veil, so it is always light.
  const text = immersive && photo ? '#FFFFFF' : template.text;
  const muted = `${text}A6`;
  const faint = `${text}2E`;
  const logoUrl = config.logo_url || card.logoUrl || null;
  const goal = Math.max(1, Math.min(12, Number(card.stampGoal ?? 10)));
  const stamps = Math.max(0, Math.min(goal, Number(card.stampsBalance ?? 0)));
  const points = Math.max(0, Number(card.points ?? 0));
  const discount = Math.max(0, Number(card.discountPercent ?? config.discountPercent ?? 10));
  const threshold = Number(config.discountPointsThreshold ?? 1000);
  const rewardName = mode === 'STAMP'
    ? card.stampRewardName || config.rewardName || 'Cadeau fidélité'
    : card.rewardName || config.rewardName || 'Récompense fidélité';
  const target = mode === 'STAMP' ? goal : mode === 'DISCOUNT' ? threshold : card.rewardPointsRequired ?? null;
  const current = mode === 'STAMP' ? stamps : points;
  const progress = target && target > 0 ? Math.min(1, current / target) : 0;
  const reached = Boolean(target && current >= target);
  const qrWidth = QR_SIZES.find(size => size.id === config.qr_size)?.width ?? 25;
  const qrFrame = config.qr_frame ?? 'white';

  const shell: CSSProperties = {
    width: cardWidth ?? 'min(90vw, 400px)',
    maxWidth: '100%',
    minWidth: 0,
    aspectRatio: '2 / 3',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    borderRadius: '5.5%',
    background: `linear-gradient(160deg, ${background} 0%, ${backgroundEnd} 100%)`,
    color: text,
    boxSizing: 'border-box',
    boxShadow: '0 1px 0 rgba(255,255,255,.18) inset, 0 30px 70px rgba(0,0,0,.42), 0 8px 18px rgba(0,0,0,.22)',
    fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    containerType: 'inline-size',
    isolation: 'isolate',
  };

  /** Photo, or abstract art in the template colors when there is no photo. */
  const art = (veil: string): ReactNode => (
    <>
      {photo ? (
        <div style={{ position: 'absolute', inset: 0, backgroundImage: `url("${photo}")`, backgroundSize: 'cover', backgroundPosition: 'center' }} />
      ) : (
        <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(75% 90% at 88% 12%, ${accent}55, transparent 62%), linear-gradient(125deg, ${backgroundEnd}, ${background})` }}>
          <div style={{ position: 'absolute', inset: 0, ...patternLayer(pattern, accent) }} />
        </div>
      )}
      <div style={{ position: 'absolute', inset: 0, background: veil }} />
    </>
  );

  if (side === 'back') {
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', inset: 0, ...patternLayer(pattern, accent), opacity: .6 }} />
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '9cqw', textAlign: 'center', boxSizing: 'border-box' }}>
          <div>
            <div style={{ ...label(accent), whiteSpace: 'normal' }}>{config.back_title || 'Merci pour votre fidélité !'}</div>
            <div style={{ marginTop: '3cqw', fontSize: '4cqw', lineHeight: 1.55, color: muted }}>{config.back_message || 'À très bientôt !'}</div>
          </div>
        </div>
      </div>
    );
  }

  const mainValue = mode === 'STAMP'
    ? <>{stamps}<span style={{ fontSize: '7cqw', opacity: .7 }}> / {goal}</span></>
    : mode === 'DISCOUNT' && reached
      ? <>-{discount}%</>
      : <>{points.toLocaleString('fr-FR')}</>;
  const mainLabel = mode === 'STAMP' ? 'Tampons' : mode === 'DISCOUNT' && reached ? 'Réduction disponible' : 'Points';

  const header = (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '3cqw', padding: '5cqw 5.5cqw 4cqw' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '3cqw', minWidth: 0 }}>
        {logoUrl ? (
          <img src={logoUrl} alt="" style={{ width: '11cqw', height: '11cqw', flex: '0 0 11cqw', borderRadius: '3cqw', objectFit: 'contain', background: '#FFFFFF', padding: '1.2cqw', boxSizing: 'border-box' }} />
        ) : (
          <div style={{ width: '11cqw', height: '11cqw', flex: '0 0 11cqw', borderRadius: '3cqw', display: 'grid', placeItems: 'center', background: accent, color: template.light ? '#FFFFFF' : background, fontSize: '4.4cqw', fontWeight: 900 }}>
            {(card.establishmentName || 'K').slice(0, 1).toUpperCase()}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: '4.4cqw', fontWeight: 800, letterSpacing: '-.01em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.establishmentName || 'Votre établissement'}</div>
          <div style={{ ...label(muted), fontSize: '2.1cqw', marginTop: '.6cqw' }}>Carte fidélité</div>
        </div>
      </div>
      <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
        <div style={label(immersive && photo ? '#FFFFFFCC' : accent)}>{card.customerTierName ? 'Niveau' : mode === 'STAMP' ? 'Visites' : 'Solde'}</div>
        <div style={{ marginTop: '.6cqw', fontSize: '4.6cqw', fontWeight: 800 }}>
          {card.customerTierName || (mode === 'STAMP' ? `${stamps}/${goal}` : `${points.toLocaleString('fr-FR')} pts`)}
        </div>
      </div>
    </div>
  );

  const value = (color: string, labelColor: string, shadow = false) => (
    <div style={{ color }}>
      <div style={label(labelColor)}>{mainLabel}</div>
      <div style={{ marginTop: '.5cqw', fontSize: '14cqw', lineHeight: .95, fontWeight: 900, letterSpacing: '-.04em', textShadow: shadow ? '0 2px 14px rgba(0,0,0,.45)' : 'none' }}>{mainValue}</div>
    </div>
  );

  const stampsGrid = mode === 'STAMP' ? (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(goal, 6)}, 1fr)`, gap: '2cqw' }}>
      {Array.from({ length: goal }).map((_, index) => {
        const filled = index < stamps;
        const shape = config.stamp_style === 'squares' ? '2.4cqw' : '50%';
        const mark = config.stamp_style === 'stars' ? '★' : config.stamp_style === 'hearts' ? '♥' : '✓';
        return (
          <div key={index} style={{ aspectRatio: '1', borderRadius: shape, display: 'grid', placeItems: 'center', fontSize: '3.6cqw', fontWeight: 900, border: `0.5cqw solid ${filled ? accent : faint}`, background: filled ? accent : 'transparent', color: filled ? (template.light ? '#FFFFFF' : background) : faint }}>
            {filled ? mark : index + 1}
          </div>
        );
      })}
    </div>
  ) : null;

  const fields = (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.25fr', gap: '3cqw' }}>
        <div style={{ minWidth: 0 }}>
          <div style={label(muted)}>Membre</div>
          <div style={{ marginTop: '.8cqw', fontSize: '3.7cqw', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.customerName || 'Client'}</div>
        </div>
        <div style={{ minWidth: 0, textAlign: 'right' }}>
          <div style={label(muted)}>{reached ? 'Récompense prête' : mode === 'DISCOUNT' ? 'Avantage' : 'Prochaine récompense'}</div>
          <div style={{ marginTop: '.8cqw', fontSize: '3.7cqw', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: reached ? accent : text }}>
            {mode === 'DISCOUNT' ? `-${discount}% dès ${threshold.toLocaleString('fr-FR')} pts` : rewardName}
          </div>
        </div>
      </div>
      {target ? (
        <div>
          <div style={{ height: '1.4cqw', borderRadius: '999px', background: faint, overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(4, progress * 100)}%`, height: '100%', borderRadius: '999px', background: accent }} />
          </div>
          <div style={{ marginTop: '1.2cqw', display: 'flex', justifyContent: 'space-between', fontSize: '2.5cqw', color: muted }}>
            <span>{reached ? 'Objectif atteint' : 'Progression'}</span>
            <span style={{ fontWeight: 800, color: text }}>{current.toLocaleString('fr-FR')} / {target.toLocaleString('fr-FR')}</span>
          </div>
        </div>
      ) : null}
      {card.raffleTitle && (
        <div style={{ padding: '2cqw 2.8cqw', borderRadius: '2.6cqw', border: `1px solid ${accent}66`, fontSize: '2.8cqw', display: 'flex', justifyContent: 'space-between', gap: '2cqw' }}>
          <span style={{ fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🎟 {card.raffleTitle}</span>
          {card.rafflePrize && <span style={{ color: muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.rafflePrize}</span>}
        </div>
      )}
    </>
  );

  const frameStyle: CSSProperties = qrFrame === 'accent'
    ? { background: '#FFFFFF', border: `1.2cqw solid ${accent}` }
    : qrFrame === 'glass'
      ? { background: 'rgba(255,255,255,.92)', border: '0.6cqw solid rgba(255,255,255,.45)', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }
      : { background: '#FFFFFF' };

  const barcode = (
    <div style={{ position: 'relative', marginTop: 'auto', padding: '2.5cqw 0 4.5cqw', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {showQr && (
        <div style={{ width: `${qrWidth}cqw`, aspectRatio: '1', padding: '1.6cqw', borderRadius: '3cqw', boxSizing: 'border-box', boxShadow: '0 10px 26px rgba(0,0,0,.25)', ...frameStyle }}>
          {qr ? <img src={qr} alt="QR Code fidélité" style={{ width: '100%', height: '100%', display: 'block' }} /> : null}
        </div>
      )}
      {card.loyaltyNumber && <div style={{ marginTop: '1.2cqw', fontSize: '2.4cqw', letterSpacing: '.18em', color: muted }}>{card.loyaltyNumber}</div>}
      {onInviteFriend && (
        <button type="button" onClick={onInviteFriend} style={{ marginTop: '1.8cqw', padding: '1.4cqw 4cqw', borderRadius: '999px', border: 'none', background: accent, color: template.light ? '#FFFFFF' : background, fontSize: '2.8cqw', fontWeight: 800, cursor: 'pointer' }}>
          🎁 Inviter un ami
        </button>
      )}
    </div>
  );

  const body = (children: ReactNode) => (
    <div style={{ position: 'relative', padding: '4cqw 5.5cqw 0', display: 'flex', flexDirection: 'column', gap: '3.2cqw' }}>{children}</div>
  );

  if (immersive) {
    return (
      <div style={shell}>
        <div style={{ position: 'absolute', inset: 0, zIndex: -1 }}>
          {art(photo
            ? 'linear-gradient(180deg, rgba(0,0,0,.55) 0%, rgba(0,0,0,.2) 30%, rgba(0,0,0,.45) 55%, rgba(0,0,0,.82) 100%)'
            : `linear-gradient(180deg, transparent 40%, ${background}E6 100%)`)}
        </div>
        {header}
        <div style={{ position: 'relative', padding: '8cqw 5.5cqw 2cqw' }}>{value(text, photo ? '#FFFFFFCC' : accent, Boolean(photo))}</div>
        {body(<>{stampsGrid}{fields}</>)}
        {barcode}
      </div>
    );
  }

  if (layout === 'top') {
    return (
      <div style={shell}>
        {header}
        <div style={{ padding: '1cqw 5.5cqw 4cqw' }}>{value(text, accent)}</div>
        <div style={{ position: 'relative', height: '30cqw', flex: '0 0 30cqw', margin: '0 5.5cqw', borderRadius: '4cqw', overflow: 'hidden' }}>
          {art(photo ? 'linear-gradient(180deg, transparent 50%, rgba(0,0,0,.25) 100%)' : 'transparent')}
        </div>
        {body(<>{stampsGrid}{fields}</>)}
        {barcode}
      </div>
    );
  }

  return (
    <div style={shell}>
      {header}
      <div style={{ position: 'relative', height: '40cqw', flex: '0 0 40cqw', overflow: 'hidden' }}>
        {art(`linear-gradient(180deg, transparent 30%, ${photo ? 'rgba(0,0,0,.62)' : `${background}CC`} 100%)`)}
        <div style={{ position: 'absolute', left: '5.5cqw', right: '5.5cqw', bottom: '4cqw' }}>
          {value(photo ? '#FFFFFF' : text, photo ? '#FFFFFFCC' : accent, Boolean(photo))}
        </div>
      </div>
      {body(<>{stampsGrid}{fields}</>)}
      {barcode}
    </div>
  );
}
