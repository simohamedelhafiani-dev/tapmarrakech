import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { LoyaltyExperienceConfig } from './LoyaltyExperience';

type LoyaltyPreviewProps = {
  config: LoyaltyExperienceConfig;
};

const CARD_WIDTH = 300;
const CARD_HEIGHT = 450;

function hexToRgb(hex: string) {
  const value = hex.replace('#', '');
  const normalized =
    value.length === 3
      ? value.split('').map(char => char + char).join('')
      : value;

  const number = Number.parseInt(normalized, 16);
  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function getContrastColor(color: string) {
  if (!color || !color.startsWith('#')) return '#17201c';

  const { r, g, b } = hexToRgb(color);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance < 0.52 ? '#ffffff' : '#17201c';
}

export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const [qr, setQr] = useState('');
  const [scale, setScale] = useState(1);

  const isStamp =
    config.type === 'STAMP' ||
    config.type === 'CHALLENGE' ||
    config.type === 'COLLECTION';

  const isLuxury =
    config.templateId === 'obsidian' ||
    config.templateId === 'titanium' ||
    config.templateId === 'luxury' ||
    config.templateId === 'hospitality';

  const contrastText = getContrastColor(config.backgroundColor);
  const textColor = config.textColor || contrastText;
  const primary = config.primaryColor || config.backgroundColor;
  const secondary = config.secondaryColor || '#c9a45c';
  const background = config.backgroundColor || '#ffffff';

  const balance = isStamp
    ? `${config.visits ?? 0} / ${Math.max(1, config.visitGoal ?? 10)}`
    : (config.pointsBalance ?? 0).toLocaleString('fr-FR');

  const progress = isStamp
    ? Math.min(100, ((config.visits ?? 0) / Math.max(1, config.visitGoal ?? 10)) * 100)
    : Math.min(100, ((config.pointsBalance ?? 0) / Math.max(1, config.pointsGoal ?? 1000)) * 100);

  useEffect(() => {
    let active = true;

    if (!config.qrValue) {
      setQr('');
      return;
    }

    void QRCode.toDataURL(config.qrValue, {
      width: 280,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
    }).then(value => {
      if (active) setQr(value);
    }).catch(() => {
      if (active) setQr('');
    });

    return () => {
      active = false;
    };
  }, [config.qrValue]);

  useEffect(() => {
    const resize = () => {
      const availableWidth = window.innerWidth - 32;
      const availableHeight = window.innerHeight - 32;

      setScale(Math.min(1, availableWidth / CARD_WIDTH, availableHeight / CARD_HEIGHT));
    };

    resize();
    window.addEventListener('resize', resize);

    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="bg-slate-100 w-full h-full flex items-center justify-center p-4 overflow-hidden">
      <div
        className="max-w-full max-h-full flex items-center justify-center"
        style={{ width: CARD_WIDTH * scale, height: CARD_HEIGHT * scale }}
      >
        <div
          className="flex flex-col justify-between overflow-y-auto shrink-0 rounded-[2rem] p-8 shadow-2xl"
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            maxWidth: '100%',
            maxHeight: '100%',
            backgroundColor: background,
            color: textColor,
            borderRadius: config.borderRadius || 32,
            backgroundImage: config.coverImageUrl
              ? `linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.58)), url("${config.coverImageUrl}")`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          <div
            className="flex min-h-0 flex-1 flex-col justify-between"
            style={{
              fontFamily:
                config.templateId === 'editorial' || config.templateId === 'apple-wallet'
                  ? 'Georgia, serif'
                  : 'inherit',
            }}
          >
            <div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  {config.logoUrl ? (
                    <img
                      src={config.logoUrl}
                      alt=""
                      className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain p-2 shadow"
                    />
                  ) : (
                    <div
                      className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl"
                      style={{ backgroundColor: secondary + '30' }}
                    >
                      {(config.establishmentName || 'CL').slice(0, 2).toUpperCase()}
                    </div>
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">
                      {config.establishmentName || 'Votre établissement'}
                    </p>
                    <p className="mt-1 text-[7px] uppercase tracking-[.2em]" style={{ color: secondary }}>
                      {isLuxury ? 'MEMBER EXPERIENCE' : 'PROGRAMME FIDÉLITÉ'}
                    </p>
                  </div>
                </div>

                <span
                  className="shrink-0 rounded-full border px-2 py-1 text-[6px] font-bold uppercase tracking-[.14em]"
                  style={{
                    borderColor: secondary + '80',
                    backgroundColor: secondary + '18',
                    color: textColor,
                  }}
                >
                  {config.currentTier || 'MEMBER'}
                </span>
              </div>

              <div className="mt-6 text-center">
                <p className="text-[8px] uppercase tracking-[.22em]" style={{ color: secondary }}>
                  Votre fidélité
                </p>

                <p className="mt-2 text-4xl font-bold leading-none">
                  {balance}
                </p>

                <p className="mt-2 text-[7px] uppercase tracking-[.18em] opacity-60">
                  {isStamp ? 'tampons' : 'points'}
                </p>

                <div className="mx-auto mt-4 w-full max-w-[210px]">
                  <div
                    className="h-1.5 rounded-full"
                    style={{ backgroundColor: secondary + '35' }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{ width: progress + '%', backgroundColor: secondary }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-3" style={{ backgroundColor: primary + '22' }}>
              <p className="text-[8px] uppercase tracking-[.16em]" style={{ color: secondary }}>
                Prochaine récompense
              </p>
              <p className="mt-2 text-sm font-semibold">
                {config.rewardName || 'Votre cadeau'}
              </p>
              {config.rewardDescription && (
                <p className="mt-1 text-[8px] leading-3 opacity-65">
                  {config.rewardDescription}
                </p>
              )}
            </div>

            <div>
              <div className="mx-auto w-[86px] rounded-2xl bg-white p-2 shadow-lg">
                {qr ? (
                  <img src={qr} alt="QR fidélité" className="block w-full rounded-lg" />
                ) : (
                  <div className="aspect-square rounded-lg bg-slate-100" />
                )}
              </div>

              <p className="mt-2 text-center text-[7px] font-semibold uppercase tracking-[.16em]" style={{ color: secondary }}>
                QR fidélité
              </p>

              <div className="mt-3 flex items-end justify-between border-t pt-3" style={{ borderColor: secondary + '35' }}>
                <div>
                  <p className="text-[6px] uppercase tracking-[.15em] opacity-50">Membre</p>
                  <p className="mt-1 text-[9px] font-semibold">{config.customerName || 'Client'}</p>
                </div>
                <p className="text-[9px] font-semibold">{config.currentTier || 'MEMBER'}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
