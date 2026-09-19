import { useEffect, useRef, useState } from 'react';

type QrScannerProps = {
  onScan: (value: string) => void;
  onClose?: () => void;
};

type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const lastValueRef = useRef('');
  const [error, setError] = useState('');
  const [torch, setTorch] = useState(false);

  useEffect(() => {
    let active = true;

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('La caméra n’est pas disponible dans ce navigateur.');
        return;
      }

      if (!window.isSecureContext) {
        setError('La caméra nécessite une connexion HTTPS.');
        return;
      }

      const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;

      if (!Detector) {
        setError('Le scan QR automatique n’est pas pris en charge sur cet appareil. Utilisez la saisie manuelle ci-dessous.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        const detector = new Detector({ formats: ['qr_code'] });

        const scan = async () => {
          if (!active || !videoRef.current || videoRef.current.readyState < 2) {
            if (active) frameRef.current = requestAnimationFrame(scan);
            return;
          }

          try {
            const results = await detector.detect(videoRef.current);
            const value = results[0]?.rawValue?.trim() ?? '';
            if (value && value !== lastValueRef.current) {
              lastValueRef.current = value;
              onScan(value);
              return;
            }
          } catch {
            // Continue scanning silently; manual fallback remains available.
          }

          frameRef.current = requestAnimationFrame(scan);
        };

        frameRef.current = requestAnimationFrame(scan);
      } catch (err) {
        const message = err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Accès caméra refusé. Autorisez la caméra dans les réglages du navigateur.'
          : 'Impossible d’ouvrir la caméra. Utilisez la saisie manuelle.';
        setError(message);
      }
    };

    void start();

    return () => {
      active = false;
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, [onScan]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
    if (!capabilities?.torch) return;

    try {
      await track.applyConstraints({ advanced: [{ torch: !torch }] } as MediaTrackConstraints);
      setTorch(value => !value);
    } catch {
      // Torch is optional.
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-ink/10 bg-black">
      <div className="relative aspect-square">
        <video
          ref={videoRef}
          muted
          playsInline
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
