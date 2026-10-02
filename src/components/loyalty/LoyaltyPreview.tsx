import { useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import type { LoyaltyExperienceConfig } from './LoyaltyExperience';

type LoyaltyPreviewProps = {
  config: LoyaltyExperienceConfig;
};

const CARD_WIDTH = 300;
const CARD_HEIGHT = 480;
const FRAME_PADDING = 24;

export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const [qr, setQr] = useState('');
  const [scale, setScale] = useState(1);
  const [frame, setFrame] = useState<HTMLDivElement | null>(null);

  const isLuxury = new Set([
    'luxury',
    'obsidian',
    'titanium',
    'wallet-premium',
  ]).has(config.templateId || '');

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

  const qrValue = useMemo(() => config.qrValue || '', [config.qrValue]);

  useEffect(() => {
    let active = true;

    if (!qrValue) {
      setQr('');
      return;
    }

    void QRCode.toDataURL(qrValue, {
      width: 400,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
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
    if (!frame) return;

    const measure = () => {
      const availableWidth = Math.max(1, frame.clientWidth - FRAME_PADDING * 2);
      const availableHeight = Math.max(1, frame.clientHeight - FRAME_PADDING * 2);

      setScale(
        Math.min(
          1,
          availableWidth / CARD_WIDTH,
          availableHeight / CARD_HEIGHT,
        ),
      );
    };

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    window.addEventListener('resize', measure);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [frame]);

  const background = config.coverImageUrl
    ? undefined
    : isLuxury
      ? 'linear-gradient(145deg,#050608 0%,#101a2c 52%,#050608 100%)'
      : 'linear-gradient(145deg,' +
        config.primaryColor +
        ' 0%,' +
        config.backgroundColor +
        ' 100%)';

  const textColor = config.textColor || (isLuxury ? '#ffffff' : '#17201c');
  const accent = isLuxury ? '#d6ad58' : config.secondaryColor;

  return (
    <div
      ref={setFrame}
      className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#f3f5f3_42%,#e4e9e5_100%)] p-6"
    >
      <div
        className="relative z-10 flex max-h-full max-w-full shrink-0 items-center justify-center"
        style={{
          width: CARD_WIDTH * scale,
          height: CARD_HEIGHT * scale,
        }}
      >
        <div
          className="relative flex h-[480px] w-[300px] shrink-0 flex-col justify-between overflow-hidden rounded-[2.5rem] border border-white/25 p-6 shadow-2xl"
          style={{
            color: textColor,
            background,
            transform: 'scale(' + scale + ')',
            transformOrigin: 'center center',
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
                ? 'linear-gradient(180deg,rgba(0,0,0,.28),rgba(3,6,10,.9))'
                : 'linear-gradient(180deg,rgba(255,255,255,.05),rgba(0,0,0,.32))',
            }}
          />

          <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-between">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                {config.logoUrl ? (
                  <img
                    src={config.logoUrl}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-2xl border border-white/25 bg-white object-contain p-1.5"
                  />
                ) : (
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white/10 text-[9px] font-bold">
                    {(config.establishmentName || 'CL').slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0">
                  <p className="truncate text-[12px] font-semibold">
                    {config.establishmentName}
                  </p>
                  <p className="text-[6px] uppercase tracking-[.22em] opacity-55">
                    Programme fidélité
                  </p>
                </div>
              </div>

              <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-2 py-1 text-[6px] font-bold uppercase tracking-[.14em]">
                {config.currentTier || 'MEMBER'}
              </span>
            </div>

            <div className="min-h-0 text-center">
              <p className="text-[7px] uppercase tracking-[.24em] opacity-55">
                Solde fidélité
              </p>

              <p className="mt-1 text-[34px] font-black leading-none tracking-[-.06em]">
                {balanceLabel}
              </p>

              <p className="mt-1 text-[6px] uppercase tracking-[.2em] opacity-50">
                {isStamp ? 'tampons' : 'points'}
              </p>

              <div className="mx-auto mt-3 w-[220px]">
                <div className="h-1.5 overflow-hidden rounded-full bg-white/15">
                  <div
                    className="h-full rounded-full"
                    style={{ width: progress + '%', background: accent }}
                  />
                </div>
              </div>

              {isStamp && (
                <div className="mx-auto mt-3 grid w-[220px] grid-cols-5 gap-1.5 rounded-[16px] border border-white/15 bg-white/10 p-2">
                  {Array.from({ length: visitGoal }).map((_, index) => (
                    <span
                      key={index}
                      className="grid aspect-square place-items-center rounded-full border"
                      style={{
                        borderColor: accent + '99',
                        background:
                          index < Math.min(visits, visitGoal)
                            ? accent + '35'
                            : 'transparent',
                      }}
                    />
                  ))}
                </div>
              )}

              <p className="mx-auto mt-3 max-w-[220px] text-[8px] leading-3 opacity-60">
                {config.rewardName ||
                  config.progressLabel ||
                  'Votre fidélité vous rapproche de votre prochaine récompense.'}
              </p>
            </div>

            <div className="border-t border-white/15 pt-3">
              <div className="mx-auto w-[82px] rounded-[18px] bg-white p-2 shadow-xl">
                {qr ? (
                  <img
                    src={qr}
                    alt="QR fidélité"
                    className="aspect-square w-full rounded-lg"
                  />
                ) : (
                  <div className="aspect-square w-full rounded-lg bg-[#f5f5f3]" />
                )}
              </div>

              <p className="mt-1 text-center text-[6px] font-semibold uppercase tracking-[.14em] opacity-55">
                Présentez votre carte
              </p>

              <div className="mt-2 flex items-end justify-between gap-3">
                <div>
                  <p className="text-[5px] uppercase tracking-[.16em] opacity-45">
                    Membre
                  </p>
                  <p className="text-[8px] font-semibold">
                    {config.customerName || 'Client'}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[5px] uppercase tracking-[.16em] opacity-45">
                    Statut
                  </p>
                  <p className="text-[8px] font-semibold">
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
    </div>
  );
}
