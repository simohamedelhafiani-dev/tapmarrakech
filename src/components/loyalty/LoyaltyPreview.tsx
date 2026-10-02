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

export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const [qr, setQr] = useState('');
  const isLuxury = LUXURY_TEMPLATES.has(config.templateId || '');

  const points = config.pointsBalance ?? 0;
  const visits = config.visits ?? 0;
  const visitGoal = Math.max(1, config.visitGoal ?? 10);
  const pointsGoal = Math.max(points, config.pointsGoal ?? 1000);
  const isStamp = config.type === 'STAMP' || config.type === 'CHALLENGE' || config.type === 'COLLECTION';

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

  const cardStyle = {
    background: config.coverImageUrl
      ? undefined
      : isLuxury
        ? 'linear-gradient(145deg, #050608 0%, #101a2c 52%, #050608 100%)'
        : 'linear-gradient(145deg, ' + config.primaryColor + ' 0%, ' + config.backgroundColor + ' 100%)',
    color: config.textColor || (isLuxury ? '#ffffff' : '#17201c'),
    borderRadius: '3rem',
  };

  return (
    <div className="relative flex h-[70vh] min-h-[560px] w-full items-center justify-center overflow-hidden rounded-[32px] bg-[radial-gradient(circle_at_50%_35%,#ffffff_0%,#f3f5f3_42%,#e4e9e5_100%)] px-4 py-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,.9),transparent_58%)]" />

      <div
        key={config.templateId || 'wallet-card'}
        className="relative z-10 flex h-[70%] w-[70%] max-w-[430px] min-w-[250px] flex-col overflow-hidden rounded-[3rem] border border-white/25 shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all duration-500 ease-out"
        style={{
          ...cardStyle,
          aspectRatio: '0.72',
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

        <div className="relative z-10 flex h-full min-h-0 flex-col p-[7%]">
          <div className="flex items-center justify-between gap-3 border-b border-white/15 pb-[5%]">
            <div className="flex min-w-0 items-center gap-3">
              {config.logoUrl ? (
                <img
                  src={config.logoUrl}
                  alt=""
                  className="h-12 w-12 shrink-0 rounded-2xl border border-white/25 bg-white object-contain p-1.5 shadow-lg"
                />
              ) : (
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-xs font-bold backdrop-blur-xl">
                  {config.establishmentName.slice(0, 2).toUpperCase()}
                </div>
              )}

              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{config.establishmentName}</p>
                <p className="mt-1 text-[8px] uppercase tracking-[.28em] opacity-55">
                  Programme fidélité
                </p>
              </div>
            </div>

            <span className="shrink-0 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[.18em] backdrop-blur-xl">
              {config.currentTier || 'MEMBER'}
            </span>
          </div>

          <div className="flex min-h-0 flex-1 flex-col justify-center text-center">
            <p className="text-[9px] font-medium uppercase tracking-[.3em] opacity-55">
              Solde fidélité
            </p>

            <div className="mt-2">
              <span className="text-[clamp(3rem,7vw,5.5rem)] font-black leading-none tracking-[-.06em]">
                {balanceLabel}
              </span>
            </div>

            <p className="mt-2 text-[9px] font-medium uppercase tracking-[.25em] opacity-50">
              {balanceUnit}
            </p>

            <div className="mx-auto mt-5 w-full max-w-[260px]">
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
              <div className="mx-auto mt-4 grid w-full max-w-[270px] grid-cols-5 gap-1.5 rounded-[20px] border border-white/15 bg-white/10 p-2.5 backdrop-blur-xl">
                {Array.from({ length: visitGoal }).map((_, index) => (
                  <span
                    key={index}
                    className="grid aspect-square place-items-center rounded-full border"
                    style={{
                      borderColor: (isLuxury ? '#d6ad58' : config.secondaryColor) + '99',
                      background:
                        index < Math.min(visits, visitGoal)
                          ? (isLuxury ? '#d6ad58' : config.secondaryColor) + '35'
                          : 'transparent',
                    }}
                  >
                    {index < Math.min(visits, visitGoal) && (
                      <span
                        className="h-2 w-2 rounded-full"
                        style={{ background: isLuxury ? '#d6ad58' : config.secondaryColor }}
                      />
                    )}
                  </span>
                ))}
              </div>
            )}

            <p className="mx-auto mt-4 max-w-[280px] text-[10px] leading-5 opacity-60">
              {config.rewardName || config.progressLabel || 'Votre fidélité vous rapproche de votre prochaine récompense.'}
            </p>
          </div>

          <div className="border-t border-white/15 pt-[5%]">
            <div className="mx-auto w-[42%] max-w-[150px] min-w-[100px] rounded-[1.4rem] border border-black/5 bg-white p-2.5 shadow-xl">
              {qr ? (
                <img src={qr} alt="QR fidélité" className="aspect-square w-full rounded-xl" />
              ) : (
                <div className="grid aspect-square w-full place-items-center rounded-xl bg-[#f5f5f3] text-[8px] font-bold uppercase tracking-[.15em] text-black/35">
                  QR fidélité
                </div>
              )}
            </div>

            <p className="mt-2 text-center text-[8px] font-semibold uppercase tracking-[.18em] opacity-55">
              Présentez votre carte
            </p>

            <div className="mt-3 flex items-end justify-between gap-4 text-left">
              <div>
                <p className="text-[7px] uppercase tracking-[.2em] opacity-45">Membre</p>
                <p className="mt-1 text-[10px] font-semibold">{config.customerName || 'Client'}</p>
              </div>
              <div className="text-right">
                <p className="text-[7px] uppercase tracking-[.2em] opacity-45">Statut</p>
                <p className="mt-1 text-[10px] font-semibold">{config.currentTier || 'Privilégié'}</p>
              </div>
            </div>
          </div>
        </div>

        {isLuxury && (
          <div className="pointer-events-none absolute inset-0 rounded-[3rem] border border-[#d6ad58]/25" />
        )}
      </div>

      <style>{`
        @keyframes loyalty-wallet-in {
          from { opacity: 0; transform: scale(.94) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}
