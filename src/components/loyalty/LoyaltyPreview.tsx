import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { LoyaltyExperienceConfig } from './LoyaltyExperience';

type LoyaltyPreviewProps = {
  config: LoyaltyExperienceConfig;
};

type WalletTemplate = {
  id: string;
  name: string;
  background: string;
  text: string;
  accent: string;
  primary: string;
  fontFamily: string;
  effect: 'gradient' | 'glass' | 'solid';
};

export const WALLET_TEMPLATES: Record<string, WalletTemplate> = {
  'onyx-black': {
    id: 'onyx-black',
    name: 'Onyx Black',
    background: '#070707',
    text: '#FFFFFF',
    accent: '#D7D7D7',
    primary: '#181818',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    effect: 'gradient',
  },
  'royal-gold': {
    id: 'royal-gold',
    name: 'Royal Gold',
    background: '#17110A',
    text: '#FFF8E8',
    accent: '#D6B15A',
    primary: '#6E4B18',
    fontFamily: 'Georgia, serif',
    effect: 'gradient',
  },
  'deep-ocean': {
    id: 'deep-ocean',
    name: 'Deep Ocean',
    background: '#061923',
    text: '#F4FCFF',
    accent: '#6FD3E8',
    primary: '#0D4050',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    effect: 'glass',
  },
  'minimal-white': {
    id: 'minimal-white',
    name: 'Minimal White',
    background: '#F5F5F2',
    text: '#151515',
    accent: '#777777',
    primary: '#FFFFFF',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    effect: 'solid',
  },
  'forest-green': {
    id: 'forest-green',
    name: 'Forest Green',
    background: '#071A14',
    text: '#F7FFF9',
    accent: '#B9D8A4',
    primary: '#164D3A',
    fontFamily: 'Georgia, serif',
    effect: 'gradient',
  },
  'ruby-red': {
    id: 'ruby-red',
    name: 'Ruby Red',
    background: '#21080D',
    text: '#FFF5F5',
    accent: '#E8A0A8',
    primary: '#6D1724',
    fontFamily: 'Georgia, serif',
    effect: 'gradient',
  },
  'silver-chrome': {
    id: 'silver-chrome',
    name: 'Silver Chrome',
    background: '#777B80',
    text: '#FFFFFF',
    accent: '#F5F5F5',
    primary: '#BFC4C9',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    effect: 'gradient',
  },
  'midnight-blue': {
    id: 'midnight-blue',
    name: 'Midnight Blue',
    background: '#080D24',
    text: '#F4F7FF',
    accent: '#9DB7FF',
    primary: '#17275F',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
    effect: 'glass',
  },
};

function hexToRgb(hex: string) {
  const value = hex.replace('#', '').trim();
  const normalized =
    value.length === 3
      ? value.split('').map(char => char + char).join('')
      : value;

  const number = Number.parseInt(normalized, 16);

  if (!Number.isFinite(number)) {
    return { r: 0, g: 0, b: 0 };
  }

  return {
    r: (number >> 16) & 255,
    g: (number >> 8) & 255,
    b: number & 255,
  };
}

function getContrastColor(color: string) {
  if (!color || !color.startsWith('#')) return '#FFFFFF';

  const { r, g, b } = hexToRgb(color);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  return luminance < 0.55 ? '#FFFFFF' : '#111111';
}

export default function LoyaltyPreview({ config }: LoyaltyPreviewProps) {
  const [qr, setQr] = useState('');

  const template =
    WALLET_TEMPLATES[config.templateId] ||
    WALLET_TEMPLATES['onyx-black'];

  const isStamp =
    config.type === 'STAMP' ||
    config.type === 'CHALLENGE' ||
    config.type === 'COLLECTION';
  const isDiscount = config.type === 'DISCOUNT';

  const balance = isDiscount
    ? `-${Math.max(0, Number(config.discountPercent ?? 0))}%`
    : isStamp
      ? `${config.visits ?? 0} / ${Math.max(1, config.visitGoal ?? 10)}`
      : (config.pointsBalance ?? 0).toLocaleString('fr-FR');

  const draftBackground = config.backgroundColor || '';
  const draftPrimary = config.primaryColor || '';
  const draftAccent = config.secondaryColor || '';
  const draftText = config.textColor || '';

  const backgroundColor = draftBackground || template.background;
  const primaryColor = draftPrimary || template.primary;
  const accentColor = draftAccent || template.accent;
  const textColor = draftText || getContrastColor(backgroundColor);

  useEffect(() => {
    let active = true;

    if (!config.qrValue) {
      setQr('');
      return;
    }

    void QRCode.toDataURL(config.qrValue, {
      width: 260,
      margin: 1,
      color: {
        dark: '#111111',
        light: '#FFFFFF',
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

  const backgroundImage = (() => {
    const draftOverlay = `linear-gradient(145deg, ${primaryColor}66, transparent 55%, ${accentColor}22)`;

    if (config.coverImageUrl) {
      return [
        'linear-gradient(180deg, rgba(0,0,0,.12), rgba(0,0,0,.58))',
        draftOverlay,
        `url("${config.coverImageUrl}")`,
      ].join(', ');
    }

    if (template.effect === 'glass') {
      return [
        `linear-gradient(135deg, ${primaryColor}CC 0%, transparent 48%, ${accentColor}22 100%)`,
        'linear-gradient(145deg, rgba(255,255,255,.10), rgba(255,255,255,0) 48%)',
      ].join(', ');
    }

    if (template.effect === 'gradient') {
      return [
        `linear-gradient(145deg, ${backgroundColor} 0%, ${primaryColor} 52%, ${backgroundColor} 100%)`,
        draftOverlay,
      ].join(', ');
    }

    return draftOverlay;
  })();

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        boxSizing: 'border-box',
      }}
    >
      <div
        style={{
          width: '320px',
          height: '640px',
          minHeight: '640px',
          minWidth: '320px',
          overflow: 'hidden',
          boxSizing: 'border-box',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          borderRadius: '48px',
          border: `1px solid rgba(255,255,255,.20)`,
          backgroundColor,
          backgroundImage,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          color: textColor,
          fontFamily: template.fontFamily,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,.18), inset 0 -24px 50px rgba(0,0,0,.20), 0 24px 60px rgba(0,0,0,.20)',
          padding: '30px',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: 'linear-gradient(125deg, rgba(255,255,255,.16) 0%, rgba(255,255,255,.04) 22%, rgba(255,255,255,0) 48%, rgba(255,255,255,.06) 72%, rgba(255,255,255,0) 100%)',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            width: '100%',
          }}
        >
          <div
            style={{
              minWidth: 0,
              overflow: 'hidden',
              fontSize: '18px',
              fontWeight: 700,
              letterSpacing: '.01em',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
            }}
          >
            {config.establishmentName || 'Votre établissement'}
          </div>

          {config.logoUrl ? (
            <img
              src={config.logoUrl}
              alt=""
              style={{
                width: '48px',
                height: '48px',
                flexShrink: 0,
                objectFit: 'contain',
                borderRadius: '14px',
                padding: '6px',
                boxSizing: 'border-box',
                backgroundColor: 'rgba(255,255,255,.92)',
                boxShadow: '0 8px 24px rgba(0,0,0,.20)',
              }}
            />
          ) : (
            <div
              style={{
                width: '48px',
                height: '48px',
                flexShrink: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '14px',
                border: '1px solid rgba(255,255,255,.22)',
                backgroundColor: 'rgba(255,255,255,.10)',
                color: textColor,
                fontSize: '11px',
                fontWeight: 700,
              }}
            >
              {(config.establishmentName || 'CL').slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            flex: 1,
            minHeight: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              fontSize: '72px',
              fontWeight: 900,
              lineHeight: 1,
              letterSpacing: '-.05em',
              color: textColor,
              textShadow: '0 8px 30px rgba(0,0,0,.22)',
              overflowWrap: 'anywhere',
            }}
          >
            {balance}
          </div>

          <div
            style={{
              marginTop: '12px',
              fontSize: '10px',
              fontWeight: 700,
              letterSpacing: '.34em',
              textTransform: 'uppercase',
              color: accentColor,
            }}
          >
            {isDiscount ? 'RÉDUCTION' : isStamp ? 'TAMPONS' : 'POINTS'}
          </div>

          {isDiscount && (
            <div
              style={{
                marginTop: '16px',
                fontSize: '12px',
                fontWeight: 600,
                letterSpacing: '.12em',
                textTransform: 'uppercase',
                color: accentColor,
              }}
            >
              Valable {Math.max(1, Number(config.discountExpiresAt ? 0 : 0)) || 7} jours
            </div>
          )}

          <div
            style={{
              width: '72px',
              height: '1px',
              marginTop: '20px',
              backgroundColor: accentColor,
              opacity: 0.55,
            }}
          />

          <div
            style={{
              marginTop: '12px',
              fontSize: '10px',
              fontWeight: 600,
              letterSpacing: '.22em',
              textTransform: 'uppercase',
              color: accentColor,
              opacity: 0.82,
            }}
          >
            {config.currentTier || 'MEMBER'}
          </div>
        </div>

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
          }}
        >
          <div
            style={{
              backgroundColor: '#FFFFFF',
              padding: '12px',
              borderRadius: '20px',
              boxShadow: '0 14px 35px rgba(0,0,0,.28)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '124px',
              height: '124px',
              boxSizing: 'border-box',
            }}
          >
            {qr ? (
              <img
                src={qr}
                alt="QR Code fidélité"
                style={{
                  display: 'block',
                  width: '100px',
                  height: '100px',
                }}
              />
            ) : (
              <div
                style={{
                  width: '100px',
                  height: '100px',
                  backgroundColor: '#F1F1F1',
                  borderRadius: '8px',
                }}
              />
            )}
          </div>

          <div
            style={{
              marginTop: '10px',
              maxWidth: '100%',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: '11px',
              fontWeight: 400,
              color: textColor,
              opacity: 0.78,
            }}
          >
            {config.customerName || 'Client'}
          </div>
        </div>
      </div>
    </div>
  );
}
