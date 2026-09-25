import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { QrCode, X, Download } from 'lucide-react';

type Props = {
  establishmentId: string;
  establishmentName: string;
};

export default function LoyaltyCardRecoveryQr({ establishmentId, establishmentName }: Props) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);

  const recoveryUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/loyalty/recover/${encodeURIComponent(establishmentId)}`
      : '';

  useEffect(() => {
    if (!open || !recoveryUrl) return;

    let active = true;
    QRCode.toDataURL(recoveryUrl, {
      width: 420,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#173D32', light: '#FFFFFF' },
    }).then((dataUrl) => {
      if (active) setQr(dataUrl);
    }).catch((error) => {
      console.error('Erreur génération QR récupération carte:', error);
      if (active) setQr(null);
    });

    return () => {
      active = false;
    };
  }, [open, recoveryUrl]);

  const downloadQr = () => {
    if (!qr) return;
    const link = document.createElement('a');
    link.href = qr;
    link.download = `qr-recuperation-carte-${establishmentName || 'etablissement'}.png`;
    link.click();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-white px-4 py-3 text-sm font-semibold text-forest transition hover:bg-gold/5"
      >
        <QrCode size={17} />
        Récupérer une carte
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/50 p-4">
          <div className="relative w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 rounded-full p-2 text-ink/40 hover:bg-ink/5 hover:text-ink"
              aria-label="Fermer"
            >
              <X size={20} />
            </button>

            <div className="pr-10">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                Fidélité
              </p>
              <h2 className="mt-2 font-display text-2xl text-forest">
                Récupérer une carte
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink/50">
                Faites scanner ce QR code par le client. Il pourra retrouver sa carte
                fidélité avec le numéro de téléphone utilisé lors de son inscription.
              </p>
            </div>

            <div className="mt-6 rounded-3xl bg-[#f7f7f3] p-5">
              {qr ? (
                <img
                  src={qr}
                  alt="QR code de récupération de carte fidélité"
                  className="mx-auto h-auto w-full max-w-[280px] rounded-2xl bg-white p-3"
                />
              ) : (
                <div className="mx-auto grid aspect-square max-w-[280px] place-items-center rounded-2xl bg-white text-sm text-ink/40">
                  Génération du QR code...
                </div>
              )}
            </div>

            <p className="mt-4 text-center text-xs font-medium text-forest/60">
              {establishmentName}
            </p>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={downloadQr}
                disabled={!qr}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-forest/15 px-4 py-3 text-sm font-semibold text-forest disabled:opacity-40"
              >
                <Download size={16} />
                Télécharger
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex-1 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
