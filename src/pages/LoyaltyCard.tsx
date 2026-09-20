import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Clock3, History, Star, WalletCards, Gift, X } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';

type Card = {
  customer_id: string;
  establishment_id: string;
  establishment_name: string;
  establishment_logo_url: string | null;
  loyalty_number: string;
  first_name: string;
  last_name: string | null;
  points_balance: number;
  total_points_earned: number;
  total_points_redeemed: number;
  visit_count: number;
  last_visit_at: string | null;
  created_at: string;
};

type Transaction = {
  id: string;
  points: number;
  transaction_type: string;
  description: string | null;
  type: string;
  created_at: string;
};

type Design = {
  template_id: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  button_color: string;
  border_radius: number;
};

type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  reward_type: 'GIFT' | 'DISCOUNT';
  discount_percent: number | null;
  discount_max_amount: number | null;
};

type Claim = {
  claim_token: string;
  reward_name: string;
  reward_type: 'GIFT' | 'DISCOUNT';
  points_required: number;
  discount_percent: number | null;
  discount_max_amount: number | null;
  expires_at: string;
};

const defaultDesign: Design = {
  template_id: 'luxury',
  primary_color: '#173D32',
  secondary_color: '#D3A84C',
  background_color: '#F7F7F3',
  text_color: '#173D32',
  button_color: '#173D32',
  border_radius: 24,
};

export default function LoyaltyCard() {
  const token = window.location.pathname.split('/').filter(Boolean).pop() ?? '';
  const [card, setCard] = useState<Card | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [design, setDesign] = useState<Design>(defaultDesign);
  const [qr, setQr] = useState('');
  const [claim, setClaim] = useState<Claim | null>(null);
  const [claimQr, setClaimQr] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [installDone, setInstallDone] = useState(false);

  const cardUrl = useMemo(() => window.location.href, []);

  useEffect(() => {
    if (token) {
      window.localStorage.setItem('tapmarrakech:customer-card-token', token);
      const request = indexedDB.open('tapmarrakech-pwa', 1);
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('settings')) request.result.createObjectStore('settings');
      };
      request.onsuccess = () => {
        const db = request.result;
        const tx = db.transaction('settings', 'readwrite');
        tx.objectStore('settings').put(token, 'customer-card-token');
        tx.oncomplete = () => db.close();
      };
    }

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, [token]);

  async function installCard() {
    if (!installPrompt) {
      setShowIosInstallHelp(true);
      return;
    }
    await installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === 'accepted') {
      setInstallPrompt(null);
      setInstallDone(true);
    }
  }

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!token) {
        setError('Carte de fidélité introuvable.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      const [
        { data: cardData, error: cardError },
        { data: txData },
        { data: designData },
        { data: rewardsData },
      ] = await Promise.all([
        supabase.rpc('get_public_loyalty_card', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_transactions', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_card_config', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_rewards', { p_access_token: token }),
      ]);

      if (!active) return;

      if (cardError || !cardData?.[0]) {
        setCard(null);
        setError('Cette carte de fidélité est introuvable ou indisponible.');
      } else {
        const nextCard = cardData[0] as Card;
        setCard(nextCard);
        setTransactions((txData ?? []) as Transaction[]);
        const designRow = Array.isArray(designData) ? designData[0] : designData;
        if (designRow) {
          setDesign({
            template_id: designRow.template_id ?? defaultDesign.template_id,
            primary_color: designRow.primary_color ?? defaultDesign.primary_color,
            secondary_color: designRow.secondary_color ?? defaultDesign.secondary_color,
            background_color: designRow.background_color ?? defaultDesign.background_color,
            text_color: designRow.text_color ?? defaultDesign.text_color,
            button_color: designRow.button_color ?? defaultDesign.button_color,
            border_radius: Number(designRow.border_radius ?? defaultDesign.border_radius),
          });
        }
        setRewards((rewardsData ?? []) as Reward[]);

        document.title = nextCard.establishment_name || 'Carte fidélité';
        let manifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
        if (!manifest) {
          manifest = document.createElement('link');
          manifest.rel = 'manifest';
          document.head.appendChild(manifest);
        }
        manifest.href =
          `/api/loyalty-manifest?name=${encodeURIComponent(nextCard.establishment_name || 'Carte fidélité')}&logo=${encodeURIComponent(nextCard.establishment_logo_url || '')}&start_url=${encodeURIComponent(cardUrl)}`;

        const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
        if (appleTitle) appleTitle.content = nextCard.establishment_name || 'Carte fidélité';

        const appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
        if (appleIcon && nextCard.establishment_logo_url) appleIcon.href = nextCard.establishment_logo_url;

        try {
          const dataUrl = await QRCode.toDataURL(cardUrl, {
            width: 240,
            margin: 2,
            color: { dark: nextCard.establishment_logo_url ? '#17352a' : '#17352a', light: '#ffffff' },
          });
          if (active) setQr(dataUrl);
        } catch {
          // QR enhancement only.
        }
      }

      setLoading(false);
    };

    void load();
    return () => { active = false; };
  }, [token, cardUrl]);

  async function chooseReward(reward: Reward) {
    if (!card || claiming) return;
    if (card.points_balance < reward.points_required) {
      alert(`Il vous manque ${reward.points_required - card.points_balance} points.`);
      return;
    }

    setClaiming(true);
    const { data, error: claimError } = await supabase.rpc('create_public_loyalty_reward_claim', {
      p_access_token: token,
      p_reward_id: reward.id,
    });
    setClaiming(false);

    const row = Array.isArray(data) ? data[0] : data;
    if (claimError || !row) {
      alert(claimError?.message ?? 'Impossible de préparer la récompense.');
      return;
    }

    const nextClaim = row as Claim;
    try {
      const url = `${window.location.origin}/loyalty/reward/${nextClaim.claim_token}`;
      const dataUrl = await QRCode.toDataURL(url, {
        width: 320,
        margin: 2,
        color: { dark: design.primary_color, light: '#ffffff' },
      });
      setClaim(nextClaim);
      setClaimQr(dataUrl);
    } catch {
      alert('Impossible de générer le QR de récompense.');
    }
  }

  function closeClaim() {
    if (claiming) return;
    setClaim(null);
    setClaimQr('');
  }

  if (loading) return <PageShell><Loader /></PageShell>;

  if (!card) {
    return (
      <PageShell>
        <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <WalletCards className="mx-auto text-gold" size={42} />
          <h1 className="mt-5 font-display text-2xl text-forest">Carte indisponible</h1>
          <p className="mt-2 text-sm text-ink/50">{error}</p>
        </div>
      </PageShell>
    );
  }

  const fullName = `${card.first_name} ${card.last_name ?? ''}`.trim();
  const isIos = /iphone|ipad|ipod/i.test(window.navigator.userAgent);

  return (
    <PageShell>
      <div
        className="overflow-hidden border shadow-2xl"
        style={{ borderRadius: design.border_radius, borderColor: `${design.primary_color}18`, background: design.background_color }}
      >
        <div className="px-6 pb-7 pt-7 text-white" style={{ background: design.primary_color }}>
          <div className="flex items-center gap-3">
            {card.establishment_logo_url ? (
              <img src={card.establishment_logo_url} alt="" className="h-12 w-12 rounded-xl bg-white object-contain p-1" />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 font-display text-xl" style={{ color: design.secondary_color }}>
                {card.establishment_name?.[0] ?? 'T'}
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] opacity-60">Carte fidélité</p>
              <h1 className="mt-1 text-lg font-semibold">{card.establishment_name}</h1>
            </div>
          </div>

          <div className="mt-8 rounded-2xl p-5" style={{ background: 'rgba(255,255,255,.10)' }}>
            <p className="text-sm opacity-70">{fullName}</p>
            <p className="mt-1 text-xs opacity-50">N° {card.loyalty_number}</p>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] opacity-50">Solde actuel</p>
                <p className="mt-1 font-display text-5xl" style={{ color: design.secondary_color }}>{card.points_balance}</p>
                <p className="text-xs opacity-60">points</p>
              </div>
              <Star size={30} fill="currentColor" style={{ color: design.secondary_color }} />
            </div>
          </div>
        </div>

        <div className="p-6" style={{ color: design.text_color }}>
          {qr && (
            <div className="rounded-2xl p-5 text-center" style={{ background: `${design.primary_color}08` }}>
              <img src={qr} alt="QR de votre carte fidélité" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
              <p className="mt-3 text-xs opacity-55">Présentez ce QR au personnel pour accéder à votre carte.</p>
            </div>
          )}

          <section className="mt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift size={17} style={{ color: design.secondary_color }} />
                <h2 className="font-semibold">Récompenses</h2>
              </div>
              <span className="text-[10px] opacity-45">Vos points = vos avantages</span>
            </div>

            {rewards.length === 0 ? (
              <p className="mt-3 rounded-xl p-4 text-xs opacity-50" style={{ background: `${design.primary_color}08` }}>Aucune récompense disponible pour le moment.</p>
            ) : (
              <div className="mt-3 space-y-2">
                {rewards.map(reward => {
                  const available = card.points_balance >= reward.points_required;
                  return (
                    <div key={reward.id} className="rounded-2xl border p-4" style={{ borderColor: `${design.primary_color}12`, background: available ? '#ffffff' : `${design.primary_color}05` }}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="font-semibold">{reward.name}</p>
                          <p className="mt-1 text-[11px] opacity-50">
                            {reward.points_required} points · {reward.reward_type === 'DISCOUNT' ? `-${reward.discount_percent}%${reward.discount_max_amount ? ` · max ${reward.discount_max_amount} MAD` : ''}` : 'cadeau'}
                          </p>
                        </div>
                        <button
                          type="button"
                          disabled={!available || claiming}
                          onClick={() => void chooseReward(reward)}
                          className="shrink-0 rounded-xl px-3 py-2 text-[11px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-30"
                          style={{ background: design.button_color }}
                        >
                          Utiliser
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {!isStandalone ? (
            <div className="mt-5 rounded-2xl p-4" style={{ background: `${design.primary_color}08` }}>
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: design.primary_color }}>
                  <WalletCards size={18} style={{ color: design.secondary_color }} />
                </div>
                <div>
                  <p className="text-sm font-semibold">Gardez votre carte sur votre téléphone</p>
                  <p className="mt-1 text-xs leading-5 opacity-55">Ajoutez-la à votre écran d’accueil pour la retrouver à chaque visite.</p>
                </div>
              </div>
              <button type="button" onClick={installCard} className="mt-4 w-full rounded-xl px-4 py-3 text-xs font-semibold text-white" style={{ background: design.button_color }}>
                {installPrompt ? 'Ajouter ma carte à l’écran d’accueil' : isIos ? 'Ajouter ma carte sur mon iPhone' : 'Ajouter ma carte sur mon téléphone'}
              </button>
              {installDone && <p className="mt-3 rounded-xl bg-white p-3 text-[11px] font-medium text-forest">✓ Votre carte a été ajoutée à votre écran d’accueil.</p>}
              {isIos && showIosInstallHelp && (
                <div className="mt-3 rounded-xl bg-white p-3 text-[11px] leading-5 text-ink/55">
                  <p className="font-semibold text-forest">Sur iPhone</p>
                  <p className="mt-1">1. Touchez <strong>Partager</strong> dans Safari.<br />2. Choisissez <strong>Sur l’écran d’accueil</strong>.<br />3. Touchez <strong>Ajouter</strong>.</p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl p-4" style={{ background: `${design.primary_color}08` }}>
              <p className="text-sm font-semibold">✓ Votre carte est déjà enregistrée</p>
              <p className="mt-1 text-xs leading-5 opacity-55">Retrouvez-la depuis l’icône de votre établissement.</p>
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2">
            <Metric label="Gagnés" value={card.total_points_earned} />
            <Metric label="Utilisés" value={card.total_points_redeemed} />
            <Metric label="Visites" value={card.visit_count} />
          </div>

          <section className="mt-7">
            <div className="flex items-center gap-2">
              <History size={17} />
              <h2 className="font-semibold">Historique</h2>
            </div>
            {transactions.length === 0 ? (
              <p className="mt-4 rounded-xl p-4 text-xs opacity-50" style={{ background: `${design.primary_color}08` }}>Aucune opération enregistrée pour le moment.</p>
            ) : (
              <div className="mt-3 divide-y rounded-2xl border" style={{ borderColor: `${design.primary_color}12` }}>
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tx.description || tx.transaction_type || 'Opération fidélité'}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] opacity-40"><Clock3 size={11} />{new Date(tx.created_at).toLocaleDateString('fr-FR')}</p>
                    </div>
                    <span className={tx.points >= 0 ? 'font-semibold text-forest' : 'font-semibold text-[#a15c50]'}>{tx.points >= 0 ? '+' : ''}{tx.points}</span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="mt-7 text-center text-[10px] opacity-30">TapMarrakech · carte permanente</p>
        </div>
      </div>

      {claim && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="text-left">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-gold">Récompense</p>
                <h2 className="mt-1 font-display text-xl text-forest">{claim.reward_name}</h2>
              </div>
              <button type="button" onClick={closeClaim} className="rounded-xl p-2 text-ink/40"><X size={18} /></button>
            </div>
            <img src={claimQr} alt="QR de récompense" className="mx-auto mt-5 h-64 w-64 rounded-2xl bg-white p-2 shadow-soft" />
            <p className="mt-4 text-sm font-semibold text-forest">{claim.reward_type === 'DISCOUNT' ? `Réduction de ${claim.discount_percent}%` : 'Récompense offerte'}</p>
            <p className="mt-1 text-xs text-ink/45">{claim.points_required} points seront utilisés lors de la validation.</p>
            <p className="mt-3 rounded-xl bg-[#f7f7f3] p-3 text-[11px] text-ink/45">Présentez ce QR au personnel. Il est valable 2 minutes et ne peut être utilisé qu'une seule fois.</p>
          </div>
        </div>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[#f7f7f3] px-4 py-6 sm:py-10"><div className="mx-auto w-full max-w-md">{children}</div></main>;
}

function Loader() {
  return <div className="grid min-h-[70vh] place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-forest border-t-transparent" /></div>;
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-[#f7f7f3] p-3 text-center"><p className="text-[10px] text-ink/40">{label}</p><p className="mt-1 text-sm font-semibold text-forest">{value}</p></div>;
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
