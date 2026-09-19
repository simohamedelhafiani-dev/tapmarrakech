import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Clock3, History, Star, WalletCards } from 'lucide-react';
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

export default function LoyaltyCard() {
  const token = window.location.pathname.split('/').filter(Boolean).pop() ?? '';
  const [card, setCard] = useState<Card | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [qr, setQr] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIosInstallHelp, setShowIosInstallHelp] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  const cardUrl = useMemo(() => window.location.href, []);

  useEffect(() => {
    if (token) window.localStorage.setItem('tapmarrakech:customer-card-token', token);

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
    if (result.outcome === 'accepted') setInstallPrompt(null);
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

      const [{ data: cardData, error: cardError }, { data: txData }] = await Promise.all([
        supabase.rpc('get_public_loyalty_card', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_transactions', { p_access_token: token }),
      ]);

      if (!active) return;

      if (cardError || !cardData?.[0]) {
        setCard(null);
        setError('Cette carte de fidélité est introuvable ou indisponible.');
      } else {
        const nextCard = cardData[0] as Card;
        setCard(nextCard);
        setTransactions((txData ?? []) as Transaction[]);

        try {
          const dataUrl = await QRCode.toDataURL(cardUrl, {
            width: 240,
            margin: 2,
            color: { dark: '#17352a', light: '#ffffff' },
          });
          if (active) setQr(dataUrl);
        } catch {
          // QR is an enhancement; the permanent URL still works.
        }
      }

      setLoading(false);
    };

    void load();
    return () => {
      active = false;
    };
  }, [token, cardUrl]);

  if (loading) {
    return <PageShell><Loader /></PageShell>;
  }

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
      <div className="overflow-hidden rounded-[2rem] border border-ink/5 bg-white shadow-2xl">
        <div className="bg-forest px-6 pb-7 pt-7 text-white">
          <div className="flex items-center gap-3">
            {card.establishment_logo_url ? (
              <img
                src={card.establishment_logo_url}
                alt=""
                className="h-12 w-12 rounded-xl bg-white object-contain p-1"
              />
            ) : (
              <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/10 font-display text-xl text-gold">
                {card.establishment_name?.[0] ?? 'T'}
              </div>
            )}
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">Carte fidélité</p>
              <h1 className="mt-1 text-lg font-semibold">{card.establishment_name}</h1>
            </div>
          </div>

          <div className="mt-8 rounded-2xl bg-white/10 p-5">
            <p className="text-sm text-white/65">{fullName}</p>
            <p className="mt-1 text-xs text-white/45">N° {card.loyalty_number}</p>
            <div className="mt-5 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/45">Solde actuel</p>
                <p className="mt-1 font-display text-5xl text-gold">{card.points_balance}</p>
                <p className="text-xs text-white/55">points</p>
              </div>
              <Star className="text-gold" size={30} fill="currentColor" />
            </div>
          </div>
        </div>

        <div className="p-6">
          {qr && (
            <div className="rounded-2xl bg-[#f7f7f3] p-5 text-center">
              <img src={qr} alt="QR de votre carte fidélité" className="mx-auto h-44 w-44 rounded-xl bg-white p-2" />
              <p className="mt-3 text-xs text-ink/45">Gardez ce lien dans vos favoris ou sur votre écran d’accueil.</p>
            </div>
          )}

          {!isStandalone && (
            <div className="mt-5 rounded-2xl border border-forest/10 bg-forest/5 p-4">
              <p className="text-sm font-semibold text-forest">Votre carte sur votre téléphone</p>
              <p className="mt-1 text-xs leading-5 text-ink/50">
                Installez votre carte pour la retrouver comme une application, sans chercher le lien à chaque visite.
              </p>
              <button
                type="button"
                onClick={installCard}
                className="mt-3 w-full rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white"
              >
                {installPrompt ? 'Ajouter ma carte à l’écran d’accueil' : 'Installer ma carte'}
              </button>
              {isIos && showIosInstallHelp && (
                <p className="mt-3 rounded-xl bg-white p-3 text-[11px] leading-5 text-ink/55">
                  Sur iPhone : touchez <strong>Partager</strong> dans Safari, puis <strong>Sur l’écran d’accueil</strong>.
                </p>
              )}
            </div>
          )}

          <div className="mt-6 grid grid-cols-3 gap-2">
            <Metric label="Gagnés" value={card.total_points_earned} />
            <Metric label="Utilisés" value={card.total_points_redeemed} />
            <Metric label="Visites" value={card.visit_count} />
          </div>

          <section className="mt-7">
            <div className="flex items-center gap-2">
              <History size={17} className="text-forest" />
              <h2 className="font-semibold text-forest">Historique</h2>
            </div>

            {transactions.length === 0 ? (
              <p className="mt-4 rounded-xl bg-[#f7f7f3] p-4 text-xs text-ink/45">Aucune opération enregistrée pour le moment.</p>
            ) : (
              <div className="mt-3 divide-y divide-ink/5 rounded-2xl border border-ink/5">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{tx.description || tx.transaction_type || 'Opération fidélité'}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-ink/40">
                        <Clock3 size={11} />
                        {new Date(tx.created_at).toLocaleDateString('fr-FR')}
                      </p>
                    </div>
                    <span className={tx.points >= 0 ? 'font-semibold text-forest' : 'font-semibold text-[#a15c50]'}>
                      {tx.points >= 0 ? '+' : ''}{tx.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>

          <p className="mt-7 text-center text-[10px] text-ink/30">TapMarrakech · carte permanente</p>
        </div>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-screen bg-[#f7f7f3] px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">{children}</div>
    </main>
  );
}

function Loader() {
  return (
    <div className="grid min-h-[70vh] place-items-center">
      <div className="h-9 w-9 animate-spin rounded-full border-2 border-forest border-t-transparent" />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#f7f7f3] p-3 text-center">
      <p className="text-[10px] text-ink/40">{label}</p>
      <p className="mt-1 text-sm font-semibold text-forest">{value}</p>
    </div>
  );
}


type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};
