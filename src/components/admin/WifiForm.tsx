import { useEffect, useState } from 'react';
import { CheckCircle2, Download, Eye, EyeOff, Loader2, QrCode, Wifi } from 'lucide-react';
import { type EstablishmentWifi, useEstablishmentWifi } from '@/hooks/useEstablishmentWifi';
import { buildWifiQrPayload } from '@/lib/wifiQr';
import QRCode from 'qrcode';

type WifiFormProps = {
  establishmentId: string;
};

export default function WifiForm({ establishmentId }: WifiFormProps) {
  const engine = useEstablishmentWifi(establishmentId);
  const [networkName, setNetworkName] = useState('');
  const [password, setPassword] = useState('');
  const [securityType, setSecurityType] = useState('WPA');
  const [active, setActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');

  useEffect(() => {
    if (!engine.wifi) {
      setNetworkName('');
      setPassword('');
      setSecurityType('WPA');
      setActive(true);
      return;
    }

    setNetworkName(engine.wifi.network_name ?? '');
    setPassword(engine.wifi.wifi_password ?? '');
    setSecurityType(engine.wifi.security_type || 'WPA');
    setActive(engine.wifi.active);
  }, [engine.wifi]);

  const qrPayload = buildWifiQrPayload({
    network_name: networkName,
    wifi_password: password,
    security_type: securityType,
  });

  useEffect(() => {
    let cancelled = false;

    if (!qrPayload) {
      setQrDataUrl(null);
      return;
    }

    void QRCode.toDataURL(qrPayload, {
      width: 480,
      margin: 3,
      errorCorrectionLevel: 'M',
      color: { dark: '#173D32', light: '#FFFFFF' },
    })
      .then((dataUrl) => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch((error) => {
        console.error('[EstablishmentWifi] QR ERROR:', error);
        if (!cancelled) setQrDataUrl(null);
      });

    return () => {
      cancelled = true;
    };
  }, [qrPayload]);

  const handleSave = async () => {
    setSaveMessage('');
    setSaveError('');

    const result = await engine.saveWifi({
      network_name: networkName,
      wifi_password: password,
      security_type: securityType,
      active,
    });

    if (!result.success) {
      setSaveError(result.error?.message ?? 'Impossible d’enregistrer le Wi-Fi.');
      return;
    }

    setSaveMessage('Wi-Fi enregistré avec succès.');
  };

  const downloadQr = () => {
    if (!qrDataUrl) return;

    const link = document.createElement('a');
    link.href = qrDataUrl;
    link.download = establishmentId + '-wifi-qr.png';
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  if (engine.loading) {
    return (
      <div className="rounded-3xl border border-[#242424] bg-[#111111] p-8 shadow-[0_12px_40px_rgba(15,23,42,0.045)]">
        <div className="flex items-center gap-3 text-sm text-[#FFFFFF]/45">
          <Loader2 size={17} className="animate-spin text-forest" />
          Chargement du Wi-Fi…
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1.1fr_.9fr]">
      <div className="rounded-3xl border border-[#242424] bg-[#111111] p-6 shadow-[0_12px_40px_rgba(15,23,42,0.045)]">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Connectivité</p>
            <h3 className="mt-1 text-lg font-semibold text-forest">Wi-Fi client</h3>
            <p className="mt-1 text-xs leading-5 text-[#FFFFFF]/40">
              Configure le réseau qui sera proposé aux clients. Le QR est généré localement à partir des informations saisies.
            </p>
          </div>
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-semibold ${active ? 'bg-[#C9A45C]/5 text-forest' : 'bg-ink/5 text-[#FFFFFF]/45'}`}>
            <Wifi size={13} />
            {active ? 'Actif' : 'Désactivé'}
          </span>
        </div>

        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#FFFFFF]/55">Nom du réseau (SSID)</span>
            <input
              value={networkName}
              onChange={(event) => { setNetworkName(event.target.value); setSaveMessage(''); setSaveError(''); }}
              className="w-full rounded-xl border border-[#242424] bg-[#111111] px-3 py-3 text-sm outline-none focus:border-[#C9A45C]/60"
              placeholder="Ex. Kissko WiFi"
              autoComplete="off"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-[#FFFFFF]/55">Type de sécurité</span>
            <select
              value={securityType}
              onChange={(event) => { setSecurityType(event.target.value); setSaveMessage(''); setSaveError(''); }}
              className="w-full rounded-xl border border-[#242424] bg-[#111111] px-3 py-3 text-sm outline-none focus:border-[#C9A45C]/60"
            >
              <option value="WPA">WPA / WPA2 / WPA3</option>
              <option value="WEP">WEP</option>
              <option value="nopass">Sans mot de passe</option>
            </select>
          </label>

          {securityType.toUpperCase() !== 'NOPASS' && (
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-[#FFFFFF]/55">Mot de passe Wi-Fi</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => { setPassword(event.target.value); setSaveMessage(''); setSaveError(''); }}
                  className="w-full rounded-xl border border-[#242424] bg-[#111111] px-3 py-3 pr-11 text-sm outline-none focus:border-[#C9A45C]/60"
                  placeholder="Mot de passe du réseau"
                  autoComplete="off"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#FFFFFF]/35 hover:text-[#FFFFFF]"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </label>
          )}

          <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#242424] bg-[#111111] px-4 py-3">
            <input
              type="checkbox"
              checked={active}
              onChange={(event) => { setActive(event.target.checked); setSaveMessage(''); }}
              className="h-4 w-4 accent-forest"
            />
            <span>
              <span className="block text-xs font-semibold text-forest">Module Wi-Fi actif</span>
              <span className="mt-0.5 block text-[11px] text-[#FFFFFF]/40">Le Wi-Fi peut être affiché sur la page publique.</span>
            </span>
          </label>

          {securityType.toUpperCase() !== 'NOPASS' && !password && (
            <p className="rounded-xl border border-[#242424] bg-[#111111] px-3 py-2.5 text-[11px] leading-4 text-[#E1C27A]">
              Aucun mot de passe n’est renseigné. Le QR pourra être généré, mais le téléphone ne pourra pas s’authentifier sur un réseau protégé.
            </p>
          )}

          {saveMessage && (
            <p className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-forest">
              <CheckCircle2 size={14} />
              {saveMessage}
            </p>
          )}
          {saveError && <p className="rounded-xl bg-[#111111] px-3 py-2.5 text-[11px] text-[#E1C27A]">{saveError}</p>}

          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={engine.saving || !networkName.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-5 py-3 text-sm font-semibold text-[#050505] transition hover:bg-[#C9A45C]-light disabled:cursor-not-allowed disabled:opacity-40"
          >
            {engine.saving ? <Loader2 size={16} className="animate-spin" /> : <Wifi size={16} />}
            {engine.saving ? 'Enregistrement…' : 'Enregistrer le Wi-Fi'}
          </button>
        </div>
      </div>

      <div className="rounded-3xl border border-[#242424] bg-[#C9A45C] p-6 text-[#050505] shadow-[0_12px_40px_rgba(23,61,50,0.12)]">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Accès instantané</p>
            <h3 className="mt-1 text-lg font-semibold">QR Code Wi-Fi</h3>
            <p className="mt-1 text-xs leading-5 text-[#050505]/55">
              Le QR se met à jour en temps réel. Scanne-le avec un téléphone compatible pour rejoindre le réseau.
            </p>
          </div>
          <QrCode size={22} className="text-gold" />
        </div>

        <div className="mt-6 flex min-h-[320px] items-center justify-center rounded-3xl bg-[#111111] p-6">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="QR Code Wi-Fi" className="h-64 w-64 rounded-xl" />
          ) : (
            <div className="text-center text-xs text-[#FFFFFF]/35">
              <QrCode size={34} className="mx-auto mb-3" />
              Saisis le nom du réseau pour générer le QR.
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={downloadQr}
          disabled={!qrDataUrl}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-forest transition hover:bg-gold/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Download size={16} />
          Télécharger le QR Code
        </button>

        {qrPayload && (
          <p className="mt-3 break-all text-[9px] leading-4 text-[#050505]/25">
            Payload généré localement · {securityType.toUpperCase()}
          </p>
        )}
      </div>
    </div>
  );
}
