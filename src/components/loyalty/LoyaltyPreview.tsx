import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type { LoyaltyExperienceConfig } from './LoyaltyExperience';

type LoyaltyPreviewProps = {
  config: LoyaltyExperienceConfig;
};

const LUXURY_TEMPLATES = new Set([
  'luxury',
  'obsidian',
  'titanium',
  'wallet-premium',
]);

const CARD_WIDTH = 320;
const CARD_HEIGHT = 500;
const VIEWPORT_PADDING = 24;

export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const [qr, setQr] = useState('');
  const [scale, setScale] = useState(1);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);

  const isLuxury = LUXURY_TEMPLATES.has(config.templateId || '');

  const points = config.pointsBalance ?? 0;
  const visits = config.visits ?? 0;
  const visitGoal = Math.max(1, config.visitGoal ?? 10);
  const pointsGoal = Math.max(points, config.pointsGoal ?? 1000);
  const isStamp =
    config.type === 'STAMP' ||
    config.type === 'CHALLENGE' ||
    config.type === 'COLLECTION';

  const progress = isStamp
    ? Math.min(100, (visits / visitGoal) * 100)
    : Math.min(100, (points / pointsGoal) * 100);

  const balanceLabel = isStamp
    ? visits + ' / ' + visitGoal
    : points.toLocaleString('fr-FR');

  const balanceUnit = isStamp ? 'tampons' : 'points';

  const qrValue = useMemo(() => config.qrValue || '', [config.qrValue]);

  useEffect(() => {
    let active = true;

    if (!qrValue) {
      setQr('');
      return;
    }

    void QRCode.toDataURL(qrValue, {
      width: 520,
      margin: 1,
      color: {
        dark: '#111111',
        light: '#ffffff',
      },
    })
      .then(value => {
        if (active) setQr(value);
      })
      .catch(() => {
        if (active) setQr('');
      });

    return () => {
      active = false;
    };
  }, [qrValue]);

  useEffect(() => {
    if (!viewport) return;

    const measure = () => {
      const availableWidth = Math.max(1, viewport.clientWidth - VIEWPORT_PADDING * 2);
      const availableHeight = Math.max(1, viewport.clientHeight - VIEWPORT_PADDING * 2);

      const nextScale = Math.min(
        1,
        availableWidth / CARD_WIDTH,
        availableHeight / CARD_HEIGHT,
      );

      setScale(Math.max(0.55, nextScale));
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(viewport);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [viewport]);

  const cardStyle = {
    background: config.coverImageUrl
      ? undefined
      : isLuxury
        ? 'linear-gradient(145deg, #050608 0%, #101a2c 52%, #050608 100%)'
        : 'linear-gradient(145deg, ' +
          config.primaryColor +
          ' 0%, ' +
          config.backgroundColor +
          ' 100%)',
    color: config.textColor || (isLuxury ? '#ffffff' : '#17201c'),
    borderRadius: '2.5rem',
  };

  return (
    <div
      ref={setViewport}
      className="relative flex min-h-[560px] w-full flex-1 items-center justify-center overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#f3f5f3_42%,#e4e9e5_100%)] p-6"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,.9),transparent_58%)]" />

      <div
        className="relative z-10 shrink-0"
        style={{
          width: CARD_WIDTH * scale,
          height: CARD_HEIGHT * scale,
        }}
      >
        <div
          key={config.templateId || 'wallet-card'}
          className="absolute left-0 top-0 flex h-[500px] w-[320px] origin-top-left flex-col overflow-hidden rounded-[2.5rem] border border-white/25 shadow-[0_28px_80px_rgba(0,0,0,0.38)]"
          style={{
            ...cardStyle,
            transform: 'scale(' + scale + ')',
            animation: 'loyalty-wallet-in 500ms ease-out',
          }}
        >
          {config.coverImageUrl && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: 'url("' + config.coverImageUrl + '")' }}
            />
          )}

          <div
            className="absolute inset-0"
            style={{
              background: config.coverImageUrl
                ? isLuxury
                  ? 'linear-gradient(180deg,rgba(0,0,0,.28) 0%,rgba(5,8,12,.28) 38%,rgba(3,6,10,.92) 100%)'
                  : 'linear-gradient(180deg,rgba(255,255,255,.12) 0%,rgba(0,0,0,.05) 40%,rgba(0,0,0,.65) 100%)'
                : isLuxury
                  ? 'linear-gradient(180deg,rgba(255,255,255,.04),rgba(0,0,0,.35))'
                  : 'linear-gradient(180deg,rgba(255,255,255,.18),rgba(255,255,255,0))',
            }}
          />

          <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between p-5">
            <div className="flex min-w-0 items-center justify-between gap-2 border-b border-white/15 pb-4">
              <div className="flex min-w-0 items-center gap-2.5">
                {config.logoUrl ? (
                  <img
                    src={config.logoUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-2xl border border-white/25 bg-white object-contain p-1.5 shadow-lg"
                  />
                ) : (
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-[10px] font-bold backdrop-blur-xl">
                    {config.establishmentName.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-[13px] font-semibold">
                    {config.establishmentName}
                  </p>
                  <p className="mt-0.5 text-[7px] uppercase tracking-[.24em] opacity-55">
                    Programme fidélité
                  </p>
                </div>
              </div>

              <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2.5 py-1 text-[7px] font-bold uppercase tracking-[.16em] backdrop-blur-xl">
                {config.currentTier || 'MEMBER'}
              </span>
            </div>

            <div className="min-h-0 text-center">
              <p className="text-[8px] font-medium uppercase tracking-[.26em] opacity-55">
                Solde fidélité
              </p>

              <div className="mt-1.5">
                <span className="text-[38px] font-black leading-none tracking-[-.06em]">
                  {balanceLabel}
                </span>
              </div>

              <p className="mt-1.5 text-[8px] font-medium uppercase tracking-[.22em] opacity-50">
                {balanceUnit}
              </p>

              <div className="mx-auto mt-3 w-full max-w-[240px]">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: progress + '%',
                      background: isLuxury ? '#d6ad58' : config.secondaryColor,
                    }}
                  />
                </div>
              </div>

              {isStamp && (
                <div className="mx-auto mt-3 grid w-full max-w-[250px] grid-cols-5 gap-1.5 rounded-[18px] border border-white/15 bg-white/10 p-2 backdrop-blur-xl">
                  {Array.from({ length: visitGoal }).map((_, index) => (
                    <span
                      key={index}
                      className="grid aspect-square place-items-center rounded-full border"
                      style={{
                        borderColor:
                          (isLuxury ? '#d6ad58' : config.secondaryColor) + '99',
                        background:
                          index < Math.min(visits, visitGoal)
                            ? (isLuxury ? '#d6ad58' : config.secondaryColor) + '35'
                            : 'transparent',
                      }}
                    >
                      {index < Math.min(visits, visitGoal) && (
                        <span
                          className="h-1.5 w-1.5 rounded-full"
                          style={{
                            background: isLuxury
                              ? '#d6ad58'
                              : config.secondaryColor,
                          }}
                        />
                      )}
                    </span>
                  ))}
                </div>
              )}

              <p className="mx-auto mt-3 max-w-[250px] text-[9px] leading-4 opacity-60">
                {config.rewardName ||
                  config.progressLabel ||
                  'Votre fidélité vous rapproche de votre prochaine récompense.'}
              </p>
            </div>

            <div className="border-t border-white/15 pt-3">
              <div className="mx-auto w-[105px] rounded-[1.2rem] border border-black/5 bg-white p-2 shadow-xl">
                {qr ? (
                  <img
                    src={qr}
                    alt="QR fidélité"
                    className="aspect-square w-full rounded-lg"
                  />
                ) : (
                  <div className="grid aspect-square w-full place-items-center rounded-lg bg-[#f5f5f3] text-[7px] font-bold uppercase tracking-[.12em] text-black/35">
                    QR fidélité
                  </div>
                )}
              </div>

              <p className="mt-1.5 text-center text-[7px] font-semibold uppercase tracking-[.16em] opacity-55">
                Présentez votre carte
              </p>

              <div className="mt-2 flex items-end justify-between gap-3 text-left">
                <div>
                  <p className="text-[6px] uppercase tracking-[.18em] opacity-45">
                    Membre
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold">
                    {config.customerName || 'Client'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[6px] uppercase tracking-[.18em] opacity-45">
                    Statut
                  </p>
                  <p className="mt-0.5 text-[9px] font-semibold">
                    {config.currentTier || 'Privilégié'}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {isLuxury && (
            <div className="pointer-events-none absolute inset-0 rounded-[2.5rem] border border-[#d6ad58]/25" />
          )}
        </div>
      </div>

      <style>{`
        @keyframes loyalty-wallet-in {
          from { opacity: 0; transform: scale(.96) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
