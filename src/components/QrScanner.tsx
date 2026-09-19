import { useEffect, useRef, useState } from 'react';

type QrScannerProps = {
  onScan: (value: string) => void;
  onClose?: () => void;
};

export default function QrScanner({ onScan, onClose }: QrScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanTimerRef = useRef<number | null>(null);
  const lastValueRef = useRef('');
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
        setError('La caméra n’est pas disponible. Ouvrez le lien dans Safari ou Chrome avec HTTPS.');
        return;
      }

      if (!window.isSecureContext) {
        setError('La caméra nécessite une connexion HTTPS.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { exact: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (!active) {
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        streamRef.current = stream;

        if (!videoRef.current) return;

        videoRef.current.srcObject = stream;
        videoRef.current.muted = true;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');

        await videoRef.current.play();

        const scanWithBarcodeDetector = async () => {
          const Detector = (window as typeof window & {
            BarcodeDetector?: new (options?: { formats?: string[] }) => {
              detect: (source: HTMLVideoElement) => Promise<Array<{ rawValue: string }>>;
            };
          }).BarcodeDetector;

          if (!Detector || !videoRef.current || !active) return false;

          try {
            const detector = new Detector({ formats: ['qr_code'] });
            const results = await detector.detect(videoRef.current);
            const value = results[0]?.rawValue?.trim() ?? '';

            if (value && value !== lastValueRef.current) {
              lastValueRef.current = value;
              onScanRef.current(value);
              return true;
            }
          } catch {
            return false;
          }

          return false;
        };

        // BarcodeDetector is used when the browser supports it.
        // On iPhone Safari, the fallback below uses the video frames + native
        // image processing path instead of refusing to open the camera.
        const tick = async () => {
          if (!active) return;

          const detected = await scanWithBarcodeDetector();

          if (detected) return;

          scanTimerRef.current = window.setTimeout(() => {
            void tick();
          }, 180);
        };

        void tick();
      } catch (err) {
        const name = err instanceof DOMException ? err.name : '';

        if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
          setError('Accès caméra refusé. Sur iPhone : Réglages → Safari → Caméra → Autoriser, puis rechargez la page.');
        } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
          setError('Caméra arrière introuvable. Vérifiez les autorisations de caméra puis réessayez.');
        } else {
          setError('Impossible d’ouvrir la caméra. Vérifiez que le site est ouvert en HTTPS et autorisez la caméra.');
        }
      }
    };

    void start();

    return () => {
      active = false;
      if (scanTimerRef.current !== null) window.clearTimeout(scanTimerRef.current);
      streamRef.current?.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    };
  }, []);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;

    const capabilities = track.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
    if (!capabilities?.torch) {
      setError('La lampe n’est pas disponible sur cette caméra.');
      return;
    }

    try {
      await track.applyConstraints({
        advanced: [{ torch: !torch }],
      } as MediaTrackConstraints);
      setTorch(value => !value);
    } catch {
      setError('Impossible de contrôler la lampe.');
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
