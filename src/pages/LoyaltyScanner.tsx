import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Coins, Search, Smartphone, X } from 'lucide-react';
import QrScanner from '@/components/QrScanner';
import { supabase } from '@/lib/supabase';

type ScannerContext = {
  establishment_id: string;
  establishment_name: string;
  establishment_logo_url: string | null;
};

type Customer = {
  customer_id: string;
  establishment_id: string;
  loyalty_number: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  points_balance: number;
  stamps_balance?: number;
};

type PendingRewardClaim = {
  claim_token: string;
  establishment_id: string;
  customer_id: string;
  reward_name: string;
  reward_type: 'GIFT' | 'DISCOUNT';
  points_required: number;
  discount_percent: number | null;
  discount_max_amount: number | null;
  status: 'PENDING' | 'REDEEMED' | 'EXPIRED' | 'CANCELLED';
  expires_at: string;
};

type Settings = {
  points_per_currency: number;
  currency: string;
  enabled: boolean;
  program_type: string;
  stamp_goal: number;
};

export default function LoyaltyScanner() {
  const scannerToken = useMemo(
    () => new URLSearchParams(window.location.search).get('scanner') ?? '',
    []
  );

  const [context, setContext] = useState<ScannerContext | null>(null);
  const [settings, setSettings] = useState<Settings>({
    points_per_currency: 1,
    currency: 'MAD',
    enabled: true,
    program_type: 'POINTS',
    stamp_goal: 10,
  });
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [manualSearch, setManualSearch] = useState('');
  const [manualMatches, setManualMatches] = useState<Customer[]>([]);
  const [amount, setAmount] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [pendingReward, setPendingReward] = useState<PendingRewardClaim | null>(null);
  const [rewardInvoiceAmount, setRewardInvoiceAmount] = useState('');
  const [rewardInvoiceNumber, setRewardInvoiceNumber] = useState('');
  const [redeemingReward, setRedeemingReward] = useState(false);

  useEffect(() => {
    if (!scannerToken) {
      setLoading(false);
      setMessage('Lien scanner invalide.');
      return;
    }

    window.localStorage.setItem('tapmarrakech:scanner-token', scannerToken);

    const load = async () => {
      const { data, error } = await supabase.rpc('get_public_scanner_context', {
        p_scanner_token: scannerToken,
      });
      const row = Array.isArray(data) ? data[0] : data;

      if (error || !row) {
        setMessage('Lien scanner invalide ou introuvable.');
        setLoading(false);
        return;
      }

      setContext(row as ScannerContext);

      const { data: settingsData, error: settingsError } =
        await supabase.rpc('get_public_scanner_settings', {
          p_scanner_token: scannerToken,
        });

      const settingsRow = Array.isArray(settingsData)
        ? settingsData[0]
        : settingsData;

      if (!settingsError && settingsRow) {
        setSettings({
          points_per_currency: Number(settingsRow.points_per_currency ?? 1),
          currency: settingsRow.currency ?? 'MAD',
          enabled: Boolean(settingsRow.enabled ?? true),
          program_type: settingsRow.program_type ?? 'POINTS',
          stamp_goal: Number(settingsRow.stamp_goal ?? 10),
        });
      }

      setLoading(false);
    };

    void load();
  }, [scannerToken]);

  useEffect(() => {
    const handleInstall = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };

    window.addEventListener('beforeinstallprompt', handleInstall);
    return () => window.removeEventListener('beforeinstallprompt', handleInstall);
  }, []);

  useEffect(() => {
    if (!context || !scannerToken) return;

    const scannerUrl =
      window.location.origin +
      '/employee?scanner=' +
      encodeURIComponent(scannerToken);

    const manifestUrl =
      '/api/loyalty-manifest?name=' +
      encodeURIComponent(context.establishment_name + ' — Scanner fidélité') +
      '&logo=' +
      encodeURIComponent(context.establishment_logo_url || '') +
      '&start_url=' +
      encodeURIComponent(scannerUrl);

    let manifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;

    if (!manifest) {
      manifest = document.createElement('link');
      manifest.rel = 'manifest';
      document.head.appendChild(manifest);
    }

    manifest.href = manifestUrl;
    document.title = context.establishment_name + ' — Scanner fidélité';

    return () => {
      document.querySelector('link[rel="manifest"]')?.remove();
    };
  }, [context, scannerToken]);

  async function installScanner() {
    if (installPrompt) {
      installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice?.outcome === 'accepted') setInstallPrompt(null);
      return;
    }

    alert(
      /iPhone|iPad|iPod/i.test(navigator.userAgent)
        ? 'Sur iPhone : Safari → Partager → Sur l’écran d’accueil.'
        : 'Sur Android : Chrome → menu ⋮ → Ajouter à l’écran d’accueil / Installer.'
    );
  }

  async function loadCustomerFromCard(rawValue: string) {
    const value = rawValue.trim();
    if (!value) return;

    let token = value;
    let isRewardClaim = false;

    try {
      const url = new URL(value);
      const parts = url.pathname.split('/').filter(Boolean);

      if (parts[0] === 'loyalty' && parts[1] === 'stamp-reward' && parts[2]) {
        setSearching(true);
        const { data, error } = await supabase.rpc('get_public_loyalty_stamp_reward_claim', { p_claim_token: parts[2] });
        setSearching(false);
        const row = Array.isArray(data) ? data[0] : data;
        if (error || !row || row.establishment_id !== context?.establishment_id) {
          setMessage('QR cadeau invalide ou expiré.');
          return;
        }
        setPendingReward({
          claim_token: row.claim_token,
          establishment_id: row.establishment_id,
          customer_id: row.customer_id,
          reward_name: row.reward_name,
          reward_type: 'GIFT',
          points_required: 0,
          discount_percent: null,
          discount_max_amount: null,
          status: row.status,
          expires_at: row.expires_at,
        });
        setRewardInvoiceAmount('');
        setRewardInvoiceNumber('');
        setShowScanner(false);
        return;
      } else if (parts[0] === 'loyalty' && parts[1] === 'reward' && parts[2]) {
        token = parts[2];
        isRewardClaim = true;
      } else if (parts[0] === 'loyalty' && parts[1]) {
        token = parts[1];
      }
    } catch {
      // Raw UUID tokens are also accepted.
    }

    if (isRewardClaim) {
      setSearching(true);
      setMessage('');

      const { data, error } = await supabase.rpc('get_public_loyalty_reward_claim', {
        p_claim_token: token,
      });

      setSearching(false);

      const row = Array.isArray(data) ? data[0] : data;

      if (error || !row) {
        setMessage('QR de récompense invalide.');
        return;
      }

      if (row.establishment_id !== context?.establishment_id) {
        setMessage('Cette récompense appartient à un autre établissement.');
        return;
      }

      setPendingReward(row as PendingRewardClaim);
      setRewardInvoiceAmount('');
      setRewardInvoiceNumber('');
      setShowScanner(false);
      return;
    }

    setSearching(true);
    setMessage('');

    const { data, error } = await supabase.rpc('get_public_loyalty_card', {
      p_access_token: token,
    });

    const row = Array.isArray(data) ? data[0] : data;

    setSearching(false);

    if (error || !row) {
      setMessage('Carte inconnue. Scannez le QR de la carte client.');
      return;
    }

    if (row.establishment_id !== context?.establishment_id) {
      setMessage('Cette carte appartient à un autre établissement.');
      return;
    }

    setCustomer({
      customer_id: row.customer_id,
      establishment_id: row.establishment_id,
      loyalty_number: row.loyalty_number,
      first_name: row.first_name,
      last_name: row.last_name,
      phone: row.phone ?? '',
      points_balance: Number(row.points_balance ?? 0),
      stamps_balance: Number(row.stamps_balance ?? 0),
    });

    setAmount('');
    setInvoiceNumber('');
    setShowScanner(false);
  }

  async function redeemPendingReward() {
    if (!pendingReward) return;

    const invoiceAmount = rewardInvoiceAmount.trim() ? Number(rewardInvoiceAmount) : null;

    if (pendingReward.reward_type === 'DISCOUNT' && (!invoiceAmount || invoiceAmount <= 0)) {
      setMessage('Le montant de la facture est obligatoire pour appliquer la réduction.');
      return;
    }

    setRedeemingReward(true);
    setMessage('');

    const isStampReward = pendingReward.points_required === 0 && pendingReward.reward_type === 'GIFT';
    const { data, error } = isStampReward
      ? await supabase.rpc('redeem_public_loyalty_stamp_reward_claim', {
          p_scanner_token: scannerToken,
          p_claim_token: pendingReward.claim_token,
        })
      : await supabase.rpc('redeem_loyalty_reward_claim', {
          p_scanner_token: scannerToken,
          p_claim_token: pendingReward.claim_token,
          p_invoice_amount: invoiceAmount,
          p_invoice_number: rewardInvoiceNumber.trim() || null,
        });

    setRedeemingReward(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;
    const discountAmount = Number(result?.discount_amount ?? 0);
    const finalAmount = result?.final_amount == null ? null : Number(result.final_amount);
    const newBalance = isStampReward
      ? Number(result?.new_stamps_balance ?? 0)
      : Number(result?.new_points_balance ?? 0);

    setPendingReward(null);
    setRewardInvoiceAmount('');
    setRewardInvoiceNumber('');

    if (isStampReward) {
      alert(`Cadeau validé !\\n\\n${pendingReward.reward_name}\\nNouveau solde : ${newBalance} tampons.`);
    } else if (pendingReward.reward_type === 'DISCOUNT') {
      alert(
        `Réduction appliquée !\\n\\n${pendingReward.reward_name}\\n-${discountAmount.toFixed(2)} MAD\\nMontant final : ${finalAmount?.toFixed(2) ?? '0.00'} MAD\\n\\nNouveau solde : ${newBalance} points.`
      );
    } else {
      alert(
        `Récompense validée !\\n\\n${pendingReward.reward_name}\\n${pendingReward.points_required} points utilisés.\\nNouveau solde : ${newBalance} points.`
      );
    }
  }


  async function searchCustomer(query = manualSearch) {
    const value = query.trim();

    if (value.length < 2) {
      setManualMatches([]);
      return;
    }

    setSearching(true);
    setMessage('');

    const { data, error } = await supabase.rpc('search_public_scanner_customers', {
      p_scanner_token: scannerToken,
      p_query: value,
    });

    setSearching(false);

    if (error) {
      setManualMatches([]);
      setMessage(error.message);
      return;
    }

    setManualMatches((data ?? []) as Customer[]);
  }

  async function addStamp() {
    if (!customer || !context) return;
    if (!settings.enabled || settings.program_type !== 'STAMP') {
      setMessage('Le programme à tampons n’est pas actif.');
      return;
    }
    setSaving(true);
    setMessage('');
    const { data, error } = await supabase.rpc('add_loyalty_stamp_by_scanner', {
      p_scanner_token: scannerToken,
      p_customer_id: customer.customer_id,
    });
    setSaving(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    const balance = Number(row?.stamps_balance ?? (customer.stamps_balance ?? 0) + 1);
    setCustomer({ ...customer, stamps_balance: balance });
    alert(row?.reward_ready
      ? `+1 tampon. Cadeau débloqué : ${row.reward_name || 'votre récompense'} !`
      : `+1 tampon. Solde : ${balance}/${settings.stamp_goal} tampons.`);
  }

  async function addPoints() {
    if (!customer || !context) return;

    const purchaseAmount = Number(amount);

    if (!settings.enabled) {
      setMessage('Le programme fidélité est désactivé pour cet établissement.');
      return;
    }

    if (!Number.isFinite(purchaseAmount) || purchaseAmount <= 0) {
      setMessage('Veuillez saisir un montant valide.');
      return;
    }

    const points = Math.floor(
      purchaseAmount * Number(settings.points_per_currency)
    );

    if (points <= 0) {
      setMessage('Le montant est trop faible pour générer des points.');
      return;
    }

    setSaving(true);
    setMessage('');

    const { data, error } = await supabase.rpc('add_loyalty_points_by_scanner', {
      p_scanner_token: scannerToken,
      p_customer_id: customer.customer_id,
      p_amount: purchaseAmount,
      p_invoice_number: invoiceNumber.trim() || null,
      p_description: `Achat de ${purchaseAmount.toFixed(2)} ${settings.currency}`,
    });

    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    const newBalance = Number(data ?? customer.points_balance + points);

    alert(`+${points} points ajoutés. Nouveau solde : ${newBalance} points.`);

    setCustomer({
      ...customer,
      points_balance: newBalance,
    });
    setAmount('');
    setInvoiceNumber('');
    setMessage('Opération enregistrée.');
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f7f3]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!context) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f7f3] px-5">
        <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center shadow-xl">
          <h1 className="font-display text-2xl text-forest">Scanner fidélité</h1>
          <p className="mt-3 text-sm leading-6 text-red-700">{message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f3] px-4 py-5">
      <main className="mx-auto w-full max-w-md">
        <header className="rounded-[2rem] bg-forest p-6 text-white shadow-xl">
          <div className="flex items-center gap-4">
            {context.establishment_logo_url ? (
              <img
                src={context.establishment_logo_url}
                alt={context.establishment_name}
                className="h-14 w-14 rounded-2xl bg-white object-contain p-1.5"
              />
            ) : (
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
                <Coins size={25} className="text-gold" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">
                Fidélité
              </p>
              <h1 className="mt-1 truncate font-display text-2xl">
                {context.establishment_name}
              </h1>
              <p className="mt-1 text-xs text-white/55">Scanner fidélité</p>
            </div>
          </div>
        </header>

        {installPrompt && (
          <button
            onClick={installScanner}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-xs font-semibold text-forest shadow-soft"
          >
            <Smartphone size={16} />
            Installer sur le téléphone
          </button>
        )}

        <section className="mt-5 rounded-3xl bg-white p-5 shadow-soft">
          {!customer ? (
            <>
              <button
                onClick={() => {
                  setShowScanner(true);
                  setMessage('');
                }}
                className="flex w-full items-center justify-center gap-3 rounded-2xl bg-forest py-5 text-base font-semibold text-white"
              >
                <div className="grid h-11 w-11 place-items-center rounded-full bg-white/10">
                  <Search size={22} />
                </div>
                Scanner la carte du client
              </button>

              <div className="my-5 flex items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink/30">
                <span className="h-px flex-1 bg-ink/10" />
                ou recherche
                <span className="h-px flex-1 bg-ink/10" />
              </div>

              <div className="relative">
                <Search
                  size={16}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30"
                />
                <input
                  value={manualSearch}
                  onChange={e => {
                    setManualSearch(e.target.value);
                    if (e.target.value.trim().length >= 2) void searchCustomer(e.target.value);
                    else setManualMatches([]);
                  }}
                  placeholder="N° fidélité, téléphone ou nom"
                  className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] py-3 pl-9 pr-3 text-sm outline-none focus:border-forest"
                />
              </div>

              {manualMatches.length > 0 && (
                <div className="mt-2 overflow-hidden rounded-xl border border-ink/5">
                  {manualMatches.map(item => (
                    <button
                      key={item.customer_id}
                      type="button"
                      onClick={() => {
                        setCustomer(item);
                        setManualSearch('');
                        setManualMatches([]);
                      }}
                      className="flex w-full items-center justify-between border-b border-ink/5 bg-white px-4 py-3 text-left last:border-0"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-forest">
                          {item.first_name} {item.last_name ?? ''}
                        </span>
                        <span className="text-[11px] text-ink/40">
                          {item.loyalty_number} · {item.phone}
                        </span>
                      </span>
                      <span className="text-xs font-semibold text-gold">
                        {item.points_balance} pts
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="rounded-2xl bg-[#f7f7f3] p-4">
                <p className="text-xs text-ink/40">Client</p>
                <p className="mt-1 text-lg font-bold text-forest">
                  {customer.first_name} {customer.last_name ?? ''}
                </p>
                <p className="mt-1 text-xs text-ink/45">{customer.phone}</p>
                <p className="mt-1 text-xs font-medium text-forest/60">
                  N° fidélité : {customer.loyalty_number}
                </p>
                <div className="mt-4 flex items-center justify-between border-t border-ink/5 pt-3">
                  <span className="text-xs text-ink/45">Solde actuel</span>
                  <span className="font-bold text-forest">
                    {customer.points_balance} points
                  </span>
                </div>
              </div>

              {settings.program_type === 'STAMP' ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl bg-forest/5 p-5 text-center">
                    <p className="text-xs text-ink/40">Programme à tampons</p>
                    <p className="mt-2 text-4xl font-bold text-forest">{customer.stamps_balance ?? 0} / {settings.stamp_goal}</p>
                    <p className="mt-1 text-xs text-ink/45">Un tampon ajouté à chaque visite</p>
                  </div>
                  <button disabled={saving} onClick={() => void addStamp()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-4 text-sm font-semibold text-white disabled:opacity-50">
                    <CheckCircle2 size={18} />
                    {saving ? 'Enregistrement...' : 'Ajouter 1 tampon'}
                  </button>
                  <button disabled={saving} onClick={() => { setCustomer(null); setMessage(''); }} className="w-full py-2 text-xs font-semibold text-ink/40">Changer de client</button>
                </div>
              ) : (
              <div className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-xs font-semibold text-ink/50">
                    Montant de la facture ({settings.currency})
                  </label>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="500"
                    className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-lg outline-none focus:border-forest"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-xs font-semibold text-ink/50">
                    Numéro de facture <span className="font-normal">(optionnel)</span>
                  </label>
                  <input
                    value={invoiceNumber}
                    onChange={e => setInvoiceNumber(e.target.value)}
                    placeholder="FAC-2026-001"
                    className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-forest"
                  />
                </div>

                {amount && Number(amount) > 0 && (
                  <div className="rounded-xl bg-forest/5 p-3 text-sm text-forest">
                    <strong>
                      +{Math.floor(Number(amount) * Number(settings.points_per_currency))}
                    </strong>{' '}
                    points seront ajoutés.
                  </div>
                )}

                <button
                  disabled={saving}
                  onClick={addPoints}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-4 text-sm font-semibold text-white disabled:opacity-50"
                >
                  <CheckCircle2 size={18} />
                  {saving ? 'Enregistrement...' : 'Ajouter les points'}
                </button>

                <button
                  disabled={saving}
                  onClick={() => {
                    setCustomer(null);
                    setAmount('');
                    setInvoiceNumber('');
                    setMessage('');
                  }}
                  className="w-full py-2 text-xs font-semibold text-ink/40"
                >
                  Changer de client
                </button>
              </div>
              )}
            </>
          )}
        </section>

        {showScanner && (
          <div className="fixed inset-0 z-50 bg-black/50 p-4">
            <div className="mx-auto flex h-full max-w-md items-center justify-center">
              <div className="w-full rounded-3xl bg-white p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className="font-display text-xl text-forest">Scanner la carte</h2>
                  <button
                    onClick={() => setShowScanner(false)}
                    className="rounded-xl px-3 py-2 text-sm text-ink/50"
                  >
                    Fermer
                  </button>
                </div>
                <QrScanner
                  onScan={loadCustomerFromCard}
                  onClose={() => setShowScanner(false)}
                />
                {searching && (
                  <p className="mt-3 text-center text-xs text-ink/45">
                    Lecture de la carte…
                  </p>
                )}
              </div>
            </div>
          </div>
        )}

        {pendingReward && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
            <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">Récompense</p>
                  <h2 className="mt-1 font-display text-2xl text-forest">{pendingReward.reward_name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPendingReward(null)}
                  disabled={redeemingReward}
                  className="rounded-xl p-2 text-ink/40"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="mt-5 rounded-2xl bg-[#f7f7f3] p-4">
                <p className="text-sm font-semibold text-forest">
                  {pendingReward.reward_type === 'DISCOUNT'
                    ? `Réduction de ${pendingReward.discount_percent}%`
                    : 'Récompense à valider'}
                </p>
                <p className="mt-1 text-xs text-ink/45">
                  {pendingReward.points_required > 0
                    ? `${pendingReward.points_required} points seront déduits du compte client.`
                    : 'Le cadeau sera validé et les tampons seront remis à zéro.'}
                </p>
                {pendingReward.discount_max_amount && (
                  <p className="mt-2 text-xs font-medium text-forest">
                    Plafond de réduction : {pendingReward.discount_max_amount} MAD
                  </p>
                )}
              </div>

              {pendingReward.reward_type === 'DISCOUNT' && (
                <div className="mt-4">
                  <label className="mb-2 block text-xs font-semibold text-ink/50">
                    Montant de la facture (MAD)
                  </label>
                  <input
                    autoFocus
                    type="number"
                    min="0"
                    step="0.01"
                    value={rewardInvoiceAmount}
                    onChange={e => setRewardInvoiceAmount(e.target.value)}
                    placeholder="500"
                    className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-lg outline-none focus:border-forest"
                  />
                  {rewardInvoiceAmount && Number(rewardInvoiceAmount) > 0 && (
                    <div className="mt-2 rounded-xl bg-forest/5 p-3 text-xs text-forest">
                      Réduction estimée : <strong>
                        {Math.min(
                          Number(rewardInvoiceAmount) * Number(pendingReward.discount_percent ?? 0) / 100,
                          pendingReward.discount_max_amount ?? Number.POSITIVE_INFINITY
                        ).toFixed(2)} MAD
                      </strong>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-4">
                <label className="mb-2 block text-xs font-semibold text-ink/50">
                  Numéro de facture <span className="font-normal">(optionnel)</span>
                </label>
                <input
                  value={rewardInvoiceNumber}
                  onChange={e => setRewardInvoiceNumber(e.target.value)}
                  placeholder="FAC-2026-001"
                  className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
                />
              </div>

              <button
                type="button"
                disabled={redeemingReward}
                onClick={() => void redeemPendingReward()}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-4 text-sm font-semibold text-white disabled:opacity-50"
              >
                <CheckCircle2 size={18} />
                {redeemingReward ? 'Validation...' : pendingReward.points_required > 0 ? 'Appliquer et déduire les points' : 'Valider le cadeau'}
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="mt-4 rounded-2xl bg-white px-4 py-3 text-center text-xs leading-5 text-ink/55 shadow-soft">
            {message}
          </p>
        )}

        <p className="pb-5 pt-6 text-center text-[10px] font-medium text-ink/30">
          Scanner fidélité · accès établissement
        </p>
      </main>
    </div>
  );
}
