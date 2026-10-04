import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, CheckCircle2, Coins, Gift, ReceiptText, Search, Smartphone, UserRound, X } from 'lucide-react';
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
      <div className="min-h-[100dvh] grid place-items-center bg-[#070707]">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="grid h-14 w-14 place-items-center rounded-2xl border border-[#C9A45C]/20 bg-[#111111]"><div className="h-6 w-6 animate-spin rounded-full border-2 border-[#C9A45C] border-t-transparent" /></div>
          <p className="text-xs font-semibold text-white/45">Chargement du scanner…</p>
        </div>
      </div>
    );
  }

  if (!context) {
    return (
      <div className="min-h-[100dvh] grid place-items-center bg-[#070707] px-5">
        <div className="w-full max-w-md rounded-[28px] border border-[#242424] bg-[#111111] p-7 text-center shadow-2xl">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#C9A45C]/10 text-[#C9A45C]"><Coins size={24} /></div>
          <p className="mt-5 text-[9px] font-bold uppercase tracking-[.22em] text-[#C9A45C]">KELYANI · Scanner</p>
          <h1 className="mt-2 font-display text-2xl text-white">Scanner indisponible</h1>
          <p className="mt-3 text-sm leading-6 text-white/40">{message}</p>
        </div>
      </div>
    );
  }

  const resetCustomer = () => {
    setCustomer(null); setManualSearch(''); setManualMatches([]); setAmount(''); setInvoiceNumber(''); setMessage('');
  };

  return (
    <div className="min-h-[100dvh] w-full bg-[#070707] text-white">
      <div className="mx-auto min-h-[100dvh] w-full max-w-lg px-3 pb-6 pt-3 sm:px-5 sm:pt-5">
        <header className="overflow-hidden rounded-[28px] border border-[#242424] bg-[#111111] shadow-2xl">
          <div className="relative overflow-hidden bg-[#050505] p-5 sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full border border-[#C9A45C]/10" />
            <div className="relative flex items-center gap-3.5">
              {context.establishment_logo_url ? <img src={context.establishment_logo_url} alt={context.establishment_name} className="h-12 w-12 shrink-0 rounded-2xl border border-[#C9A45C]/20 bg-white object-contain p-1.5" /> : <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-[#C9A45C]/20 bg-[#C9A45C]/10 text-[#C9A45C]"><Coins size={21} /></div>}
              <div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.22em] text-[#C9A45C]">KELYANI · Fidélité</p><h1 className="mt-1 truncate text-base font-semibold text-white sm:text-lg">{context.establishment_name}</h1><p className="mt-1 text-[10px] text-white/35">Espace équipe · Scanner</p></div>
              <span className="hidden shrink-0 items-center gap-1.5 rounded-full border border-[#C9A45C]/15 bg-[#C9A45C]/5 px-2.5 py-1.5 text-[9px] font-bold text-[#E1C27A] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#C9A45C]" /> Actif</span>
            </div>
          </div>
          <div className="grid grid-cols-2 border-t border-[#242424]">
            <div className="px-4 py-3.5"><p className="text-[8px] font-bold uppercase tracking-[.18em] text-white/25">Programme</p><p className="mt-1 text-xs font-semibold text-white/70">{settings.program_type === 'STAMP' ? 'Tampons' : 'Points'}</p></div>
            <div className="border-l border-[#242424] px-4 py-3.5"><p className="text-[8px] font-bold uppercase tracking-[.18em] text-white/25">Statut</p><p className="mt-1 text-xs font-semibold text-[#E1C27A]">{settings.enabled ? 'Programme actif' : 'Programme inactif'}</p></div>
          </div>
        </header>
        {installPrompt && <button onClick={installScanner} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-[#C9A45C]/20 bg-[#111111] px-4 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-[#E1C27A]"><Smartphone size={15} /> Installer le scanner</button>}
        {message && <div className="mt-3 flex items-start gap-3 rounded-2xl border border-[#C9A45C]/15 bg-[#C9A45C]/5 px-4 py-3 text-xs leading-5 text-white/65"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#C9A45C]" /><span>{message}</span></div>}
        <main className="mt-3">
          {!customer ? (
            <section className="rounded-[28px] border border-[#242424] bg-[#111111] p-4 shadow-2xl sm:p-5">
              <p className="text-[9px] font-bold uppercase tracking-[.22em] text-[#C9A45C]">Point de vente</p><h2 className="mt-1 text-xl font-semibold text-white">Identifier un client</h2><p className="mt-1 text-xs leading-5 text-white/35">Scannez sa carte ou recherchez son numéro fidélité.</p>
              <button type="button" onClick={() => { setShowScanner(true); setMessage(''); }} className="group relative mt-5 flex min-h-[170px] w-full flex-col items-center justify-center overflow-hidden rounded-[24px] border border-[#C9A45C]/25 bg-[#C9A45C]/[.06] text-center transition hover:border-[#C9A45C]/45 active:scale-[.99]">
                <div className="pointer-events-none absolute inset-5 rounded-[20px] border border-dashed border-[#C9A45C]/20" /><div className="relative grid h-14 w-14 place-items-center rounded-2xl bg-[#C9A45C] text-[#050505]"><Search size={24} /></div><span className="relative mt-4 text-sm font-bold text-white">Scanner la carte</span><span className="relative mt-1 text-[10px] text-white/35">QR client ou QR récompense</span>
              </button>
              <div className="my-5 flex items-center gap-3"><span className="h-px flex-1 bg-[#242424]" /><span className="text-[8px] font-bold uppercase tracking-[.18em] text-white/20">Recherche manuelle</span><span className="h-px flex-1 bg-[#242424]" /></div>
              <div className="relative"><UserRound size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20" /><input value={manualSearch} onChange={e => { setManualSearch(e.target.value); if (e.target.value.trim().length >= 2) void searchCustomer(e.target.value); else setManualMatches([]); }} placeholder="Nom, téléphone ou N° fidélité" className="h-12 w-full rounded-2xl border border-[#242424] bg-[#050505] pl-10 pr-4 text-sm text-white outline-none placeholder:text-white/20 focus:border-[#C9A45C]/45" /></div>
              {manualMatches.length > 0 && <div className="mt-2 overflow-hidden rounded-2xl border border-[#242424] bg-[#050505]">{manualMatches.map(item => <button key={item.customer_id} type="button" onClick={() => { setCustomer(item); setManualSearch(''); setManualMatches([]); }} className="flex w-full items-center gap-3 border-b border-[#242424] px-4 py-3.5 text-left last:border-0 hover:bg-[#111111]"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#C9A45C]"><UserRound size={15} /></div><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-white">{item.first_name} {item.last_name ?? ''}</span><span className="block truncate text-[10px] text-white/30">{item.loyalty_number} · {item.phone}</span></span><span className="text-[10px] font-bold text-[#E1C27A]">{item.points_balance} pts</span></button>)}</div>}
            </section>
          ) : (
            <section className="space-y-3">
              <div className="rounded-[28px] border border-[#242424] bg-[#111111] p-5 shadow-2xl">
                <div className="flex items-start gap-3"><div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#C9A45C]/10 text-[#C9A45C]"><UserRound size={21} /></div><div className="min-w-0 flex-1"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#C9A45C]">Client identifié</p><h2 className="mt-1 truncate text-xl font-semibold text-white">{customer.first_name} {customer.last_name ?? ''}</h2><p className="mt-1 truncate text-[10px] text-white/35">{customer.phone || 'Téléphone non renseigné'} · {customer.loyalty_number}</p></div><button type="button" onClick={resetCustomer} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[#242424] text-white/35 hover:text-white"><X size={16} /></button></div>
                <div className="mt-5 grid grid-cols-2 gap-2"><div className="rounded-2xl border border-[#242424] bg-[#050505] p-3.5"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-white/25">Points</p><p className="mt-1 text-xl font-semibold text-[#E1C27A]">{customer.points_balance.toLocaleString('fr-FR')}</p></div><div className="rounded-2xl border border-[#242424] bg-[#050505] p-3.5"><p className="text-[8px] font-bold uppercase tracking-[.15em] text-white/25">Tampons</p><p className="mt-1 text-xl font-semibold text-white">{customer.stamps_balance ?? 0}{settings.program_type === 'STAMP' ? ' / ' + settings.stamp_goal : ''}</p></div></div>
              </div>
              {settings.program_type === 'STAMP' ? (
                <div className="rounded-[28px] border border-[#242424] bg-[#111111] p-5 shadow-2xl"><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#C9A45C]">Programme à tampons</p><div className="mt-4 rounded-2xl bg-[#C9A45C]/[.06] p-5 text-center"><p className="font-display text-4xl text-[#E1C27A]">{customer.stamps_balance ?? 0}<span className="text-xl text-white/25"> / {settings.stamp_goal}</span></p><p className="mt-2 text-[10px] text-white/35">1 tampon sera ajouté à cette visite.</p></div><button disabled={saving} onClick={() => void addStamp()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A45C] py-4 text-sm font-bold text-[#050505] disabled:opacity-50"><CheckCircle2 size={18} /> {saving ? 'Enregistrement…' : 'Ajouter 1 tampon'}</button><button disabled={saving} onClick={resetCustomer} className="mt-2 flex w-full items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white/30"><ArrowLeft size={14} /> Changer de client</button></div>
              ) : (
                <div className="rounded-[28px] border border-[#242424] bg-[#111111] p-5 shadow-2xl"><div className="flex items-center gap-2"><ReceiptText size={16} className="text-[#C9A45C]" /><p className="text-[9px] font-bold uppercase tracking-[.18em] text-[#C9A45C]">Nouvelle visite</p></div><label className="mt-5 block text-[9px] font-bold uppercase tracking-[.12em] text-white/35">Montant de la facture · {settings.currency}<input autoFocus type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="500" className="mt-2 h-14 w-full rounded-2xl border border-[#242424] bg-[#050505] px-4 text-lg font-semibold text-white outline-none placeholder:text-white/15 focus:border-[#C9A45C]/45" /></label><label className="mt-4 block text-[9px] font-bold uppercase tracking-[.12em] text-white/35">Numéro de facture <span className="font-normal normal-case tracking-normal text-white/20">(optionnel)</span><input value={invoiceNumber} onChange={e => setInvoiceNumber(e.target.value)} placeholder="FAC-2026-001" className="mt-2 h-12 w-full rounded-2xl border border-[#242424] bg-[#050505] px-4 text-sm text-white outline-none placeholder:text-white/15 focus:border-[#C9A45C]/45" /></label>{amount && Number(amount) > 0 && <div className="mt-4 flex items-center justify-between rounded-2xl border border-[#C9A45C]/15 bg-[#C9A45C]/[.05] px-4 py-3"><span className="text-[10px] text-white/40">Points générés</span><strong className="text-sm text-[#E1C27A]">+{Math.floor(Number(amount) * Number(settings.points_per_currency))} pts</strong></div>}<button disabled={saving} onClick={addPoints} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A45C] py-4 text-sm font-bold text-[#050505] disabled:opacity-50"><CheckCircle2 size={18} /> {saving ? 'Enregistrement…' : 'Ajouter les points'}</button><button disabled={saving} onClick={resetCustomer} className="mt-2 flex w-full items-center justify-center gap-2 py-3 text-[10px] font-bold uppercase tracking-[.12em] text-white/30"><ArrowLeft size={14} /> Changer de client</button></div>
              )}
            </section>
          )}
        </main>
        {showScanner && <div className="fixed inset-0 z-50 bg-[#050505]/90 p-3 backdrop-blur-md sm:p-5"><div className="mx-auto flex h-full w-full max-w-lg items-center justify-center"><div className="w-full overflow-hidden rounded-[28px] border border-[#242424] bg-[#111111] shadow-2xl"><div className="flex items-center justify-between border-b border-[#242424] px-4 py-4 sm:px-5"><div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#C9A45C]">Lecture QR</p><h2 className="mt-1 text-lg font-semibold text-white">Scanner la carte</h2></div><button type="button" onClick={() => setShowScanner(false)} className="grid h-9 w-9 place-items-center rounded-xl border border-[#242424] text-white/40"><X size={17} /></button></div><div className="p-3 sm:p-5"><div className="overflow-hidden rounded-2xl bg-black"><QrScanner onScan={loadCustomerFromCard} onClose={() => setShowScanner(false)} /></div><p className="mt-3 text-center text-[10px] leading-5 text-white/30">Cadrez le QR de la carte client ou celui d’une récompense.</p>{searching && <p className="mt-2 text-center text-xs font-semibold text-[#E1C27A]">Lecture en cours…</p>}</div></div></div></div>}
        {pendingReward && <div className="fixed inset-0 z-[60] grid place-items-center bg-[#050505]/90 p-3 backdrop-blur-md sm:p-5"><div className="w-full max-w-md rounded-[28px] border border-[#242424] bg-[#111111] p-5 shadow-2xl sm:p-6"><div className="flex items-start justify-between gap-4"><div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-[#C9A45C]">Récompense</p><h2 className="mt-1 text-2xl font-semibold text-white">{pendingReward.reward_name}</h2></div><button type="button" onClick={() => setPendingReward(null)} disabled={redeemingReward} className="grid h-9 w-9 place-items-center rounded-xl border border-[#242424] text-white/35"><X size={16} /></button></div><div className="mt-5 rounded-2xl border border-[#C9A45C]/15 bg-[#C9A45C]/[.05] p-4"><div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#C9A45C]"><Gift size={18} /></div><div><p className="text-sm font-semibold text-white">{pendingReward.reward_type === 'DISCOUNT' ? 'Réduction de ' + pendingReward.discount_percent + '%' : 'Récompense à valider'}</p><p className="mt-1 text-[10px] leading-5 text-white/35">{pendingReward.points_required > 0 ? pendingReward.points_required + ' points seront déduits du compte client.' : 'Le cadeau sera validé et les tampons seront remis à zéro.'}</p></div></div>{pendingReward.discount_max_amount && <p className="mt-3 text-[10px] font-semibold text-[#E1C27A]">Plafond de réduction : {pendingReward.discount_max_amount} MAD</p>}</div>{pendingReward.reward_type === 'DISCOUNT' && <label className="mt-4 block text-[9px] font-bold uppercase tracking-[.12em] text-white/35">Montant de la facture · MAD<input autoFocus type="number" min="0" step="0.01" value={rewardInvoiceAmount} onChange={e => setRewardInvoiceAmount(e.target.value)} placeholder="500" className="mt-2 h-13 w-full rounded-2xl border border-[#242424] bg-[#050505] px-4 text-lg font-semibold text-white outline-none placeholder:text-white/15 focus:border-[#C9A45C]/45" />{rewardInvoiceAmount && Number(rewardInvoiceAmount) > 0 && <span className="mt-2 block rounded-xl bg-[#C9A45C]/[.05] px-3 py-2 text-[10px] text-white/45">Réduction estimée : <strong className="text-[#E1C27A]">{Math.min(Number(rewardInvoiceAmount) * Number(pendingReward.discount_percent ?? 0) / 100, pendingReward.discount_max_amount ?? Number.POSITIVE_INFINITY).toFixed(2)} MAD</strong></span>}</label>}{pendingReward.points_required > 0 && <label className="mt-4 block text-[9px] font-bold uppercase tracking-[.12em] text-white/35">Numéro de facture <span className="font-normal normal-case tracking-normal text-white/20">(optionnel)</span><input value={rewardInvoiceNumber} onChange={e => setRewardInvoiceNumber(e.target.value)} placeholder="FAC-2026-001" className="mt-2 h-12 w-full rounded-2xl border border-[#242424] bg-[#050505] px-4 text-sm text-white outline-none placeholder:text-white/15 focus:border-[#C9A45C]/45" /></label>}<button type="button" disabled={redeemingReward} onClick={() => void redeemPendingReward()} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#C9A45C] py-4 text-sm font-bold text-[#050505] disabled:opacity-50"><CheckCircle2 size={18} /> {redeemingReward ? 'Validation…' : pendingReward.points_required > 0 ? 'Appliquer et déduire les points' : 'Valider le cadeau'}</button></div></div>}
        <p className="pb-2 pt-5 text-center text-[9px] font-semibold uppercase tracking-[.18em] text-white/15">KELYANI · Scanner fidélité</p>
      </div>
    </div>
  );
}