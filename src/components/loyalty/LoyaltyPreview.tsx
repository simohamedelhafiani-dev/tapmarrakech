import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { LoyaltyExperienceConfig } from './LoyaltyExperience';

type LoyaltyPreviewProps = {
  config: LoyaltyExperienceConfig;
};

const CARD_WIDTH = 300;
const CARD_HEIGHT = 450;

export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const [qr, setQr] = useState('');
  const [scale, setScale] = useState(1);

  const isStamp =
    config.type === 'STAMP' ||
    config.type === 'CHALLENGE' ||
    config.type === 'COLLECTION';

  const balance = isStamp
    ? `${config.visits ?? 0} / ${Math.max(1, config.visitGoal ?? 10)}`
    : (config.pointsBalance ?? 0).toLocaleString('fr-FR');

  const accent = config.secondaryColor || '#c9a45c';
  const textColor = config.textColor || '#17201c';

  useEffect(() => {
    let active = true;

    if (!config.qrValue) {
      setQr('');
      return;
    }

    void QRCode.toDataURL(config.qrValue, {
      width: 300,
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
  }, [config.qrValue]);

  useEffect(() => {
    const updateScale = () => {
      const horizontalSpace = window.innerWidth - 32;
      const verticalSpace = window.innerHeight - 32;

      setScale(
        Math.min(
          1,
          horizontalSpace / CARD_WIDTH,
          verticalSpace / CARD_HEIGHT,
        ),
      );
    };

    updateScale();
    window.addEventListener('resize', updateScale);

    return () => window.removeEventListener('resize', updateScale);
  }, []);

  return (
    <div className="bg-slate-100 w-full h-full flex items-center justify-center p-4 overflow-hidden">
      <div
        className="max-w-full max-h-full flex items-center justify-center"
        style={{
          width: CARD_WIDTH * scale,
          height: CARD_HEIGHT * scale,
        }}
      >
        <div
          className="flex flex-col justify-between overflow-y-auto shrink-0 rounded-[2rem] p-8 shadow-2xl"
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            maxWidth: '100%',
            maxHeight: '100%',
            color: textColor,
            backgroundColor: config.backgroundColor || '#ffffff',
            backgroundImage: config.coverImageUrl
              ? `linear-gradient(rgba(0,0,0,.22),rgba(0,0,0,.62)), url("${config.coverImageUrl}")`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            transform: `scale(${scale})`,
            transformOrigin: 'center center',
          }}
        >
          <div>
            {config.logoUrl ? (
              <img
                src={config.logoUrl}
                alt=""
                className="mx-auto h-14 w-14 rounded-2xl bg-white object-contain p-2 shadow"
              />
            ) : (
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-black/5 text-sm font-bold">
                {(config.establishmentName || 'CL').slice(0, 2).toUpperCase()}
              </div>
            )}

            <h2 className="mt-3 text-center text-lg font-bold">
              {config.establishmentName || 'Votre établissement'}
            </h2>

            <p className="mt-1 text-center text-[9px] uppercase tracking-[.2em] opacity-60">
              Programme fidélité
            </p>
          </div>

          <div className="text-center">
            <p className="text-[9px] uppercase tracking-[.2em] opacity-60">
              Votre solde
            </p>

            <p className="mt-2 text-4xl font-bold leading-none">
              {balance}
            </p>

            <p className="mt-2 text-[9px] uppercase tracking-[.18em] opacity-60">
              {isStamp ? 'tampons' : 'points'}
            </p>

            <div
              className="mx-auto mt-4 h-1.5 w-full max-w-[210px] rounded-full"
              style={{ backgroundColor: `${accent}33` }}
            >
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(
                    100,
                    isStamp
                      ? ((config.visits ?? 0) /
                          Math.max(1, config.visitGoal ?? 10)) *
                          100
                      : ((config.pointsBalance ?? 0) /
                          Math.max(1, config.pointsGoal ?? 1000)) *
                          100,
                  )}%`,
                  backgroundColor: accent,
                }}
              />
            </div>

            <div className="mt-4 rounded-2xl bg-black/5 p-3">
              <p className="text-[9px] uppercase tracking-[.16em] opacity-60">
                Prochaine récompense
              </p>
              <p className="mt-2 text-sm font-semibold">
                {config.rewardName || 'Votre cadeau'}
              </p>
            </div>
          </div>

          <div>
            <div className="mx-auto w-[86px] rounded-2xl bg-white p-2 shadow-lg">
              {qr ? (
                <img
                  src={qr}
                  alt="QR fidélité"
                  className="block w-full rounded-lg"
                />
              ) : (
                <div className="aspect-square rounded-lg bg-slate-100" />
              )}
            </div>

            <p className="mt-2 text-center text-[8px] uppercase tracking-[.16em] opacity-60">
              QR fidélité
            </p>

            <div className="mt-3 flex items-end justify-between border-t border-black/10 pt-3">
              <div>
                <p className="text-[7px] uppercase tracking-[.15em] opacity-50">
                  Membre
                </p>
                <p className="mt-1 text-xs font-semibold">
                  {config.customerName || 'Client'}
                </p>
              </div>

              <p className="text-xs font-semibold">
                {config.currentTier || 'MEMBER'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
