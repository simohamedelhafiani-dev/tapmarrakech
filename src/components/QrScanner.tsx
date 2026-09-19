import { useEffect, useRef, useState } from 'react';
import QrScannerLib from 'qr-scanner';

type QrScannerProps = {
  onScan: (value: string) => void;
  onClose?: () => void;
};

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const scannerRef = useRef<QrScannerLib | null>(null);
  const onScanRef = useRef(onScan);
  const [error, setError] = useState('');
  const [torch, setTorch] = useState(false);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    let active = true;

    const start = async () => {
      setError('');

      if (!navigator.mediaDevices?.getUserMedia) {
        setError('La caméra n’est pas disponible. Ouvrez le lien dans Safari avec HTTPS.');
        return;
      }

      if (!window.isSecureContext) {
        setError('La caméra nécessite une connexion HTTPS.');
        return;
      }

      if (!videoRef.current) return;

      try {
        const scanner = new QrScannerLib(
          videoRef.current,
          result => {
            if (!active) return;
            const value = typeof result === 'string' ? result : result.data;
            if (value?.trim()) onScanRef.current(value.trim());
          },
          {
            preferredCamera: 'environment',
            highlightScanRegion: false,
            highlightCodeOutline: false,
            maxScansPerSecond: 5,
            returnDetailedScanResult: true,
          }
        );

        scannerRef.current = scanner;
        await scanner.start();

        if (!active) {
          scanner.stop();
          scanner.destroy();
        }
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';

        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('Accès caméra refusé. Sur iPhone : Réglages → Safari → Caméra → Autoriser, puis rechargez la page.');
        } else if (name === 'NotFoundError') {
          setError('Aucune caméra disponible sur cet appareil.');
        } else {
          setError('Impossible d’ouvrir la caméra. Autorisez la caméra et rechargez la page.');
        }
      }
    };

    void start();

    return () => {
      active = false;
      scannerRef.current?.stop();
      scannerRef.current?.destroy();
      scannerRef.current = null;
    };
  }, []);

  const toggleTorch = async () => {
    const scanner = scannerRef.current;
    if (!scanner) return;

    try {
      if (torch) {
        await scanner.turnFlashOff();
      } else {
        await scanner.turnFlashOn();
      }
      setTorch(value => !value);
    } catch {
      setError('La lampe n’est pas disponible sur cette caméra.');
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-black">
      <div className="relative aspect-square">
        <video
          ref={videoRef}
          muted
          playsInline
          autoPlay
          className="h-full w-full object-cover"
        />
        <div className="pointer-events-none absolute inset-8 rounded-3xl border-2 border-white/80" />
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/65 px-3 py-1.5 text-[10px] font-semibold text-white">
          Placez le QR dans le cadre
        </div>
      </div>

      {error && (
        <div className="border-t border-white/10 px-4 py-3 text-xs leading-5 text-white/75">
          {error}
        </div>
      )}

      <div className="flex gap-2 p-3">
        <button
          type="button"
          onClick={toggleTorch}
          className="flex-1 rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white"
        >
          {torch ? 'Éteindre la lampe' : 'Allumer la lampe'}
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-white/10 px-3 py-2 text-xs font-semibold text-white"
          >
            Fermer
          </button>
        )}
      </div>
    </div>
  );
}
