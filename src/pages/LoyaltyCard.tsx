import { useEffect, useState } from 'react';
import { Gift, Link2, Share2, X } from 'lucide-react';
import QRCode from 'qrcode';
import type { ReactNode } from 'react';

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };
import { defaultLoyaltyDesignConfig } from '@/components/LoyaltyCardVisual';
import { LoyaltyExperience, type LoyaltyExperienceConfig, type LoyaltyExperienceReward } from '@/components/loyalty/LoyaltyExperience';
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
  stamps_balance?: number;
  stamps_total?: number;
  total_points_earned?: number;
};

type HistoryItem = { id: string; points: number; type: string; description: string | null; amount: number | null; created_at: string; };

type Design = {
  template_id: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  button_color: string;
  border_radius: number;
};

export default function LoyaltyCard() {
  const token = window.location.pathname.split('/').filter(Boolean).pop() ?? '';
  const [card, setCard] = useState<Card | null>(null);
  const [design, setDesign] = useState<Design>({
    template_id: 'custom',
    primary_color: '#173D32',
    secondary_color: '#D3A84C',
    background_color: '#F7F7F3',
    text_color: '#FFFFFF',
    button_color: '#173D32',
    border_radius: 24,
  });
  const [designConfig, setDesignConfig] = useState(defaultLoyaltyDesignConfig);
  const [program, setProgram] = useState({
    program_type: 'POINTS' as 'STAMP' | 'DISCOUNT' | 'POINTS',
    stamp_goal: 10,
    stamps_balance: 0,
    stamp_reward_name: null as string | null,
    stamp_reward_description: null as string | null,
    discount_percent: null as number | null,
    referral_enabled: false,
  });
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralQrDataUrl, setReferralQrDataUrl] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [rewards, setRewards] = useState<LoyaltyExperienceReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);
  const [liveVersion, setLiveVersion] = useState(0);
  const [isLiveRefreshing, setIsLiveRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('welcome') !== '1') return;

    setShowWelcome(true);
    params.delete('welcome');
    const cleanUrl = window.location.pathname + (params.toString() ? '?' + params.toString() : '') + window.location.hash;
    window.history.replaceState({}, '', cleanUrl);

    const timeout = window.setTimeout(() => setShowWelcome(false), 4500);
    return () => window.clearTimeout(timeout);
  }, []);

  const cardUrl = window.location.href;

  async function loadReferralCode() {
    if (!token || referralLoading || referralCode) return;

    setReferralLoading(true);
    setReferralCopied(false);

    try {
      const { data, error: referralError } = await supabase.rpc('get_public_referral_code', {
        p_access_token: token,
      });

      if (referralError) {
        console.error('Failed to load referral code:', referralError);
        return;
      }

      const row = Array.isArray(data) ? data[0] : data;
      setReferralCode(row?.referral_code ?? null);
    } finally {
      setReferralLoading(false);
    }
  }

  async function openReferral() {
    setReferralOpen(true);
    await loadReferralCode();
  }

  const referralUrl = referralCode
    ? `${window.location.origin}/loyalty/join?ref=${encodeURIComponent(referralCode)}`
    : '';

  useEffect(() => {
    if (!referralOpen || !cardSaved || !referralUrl) {
      setReferralQrDataUrl('');
      return;
    }

    let active = true;

    void QRCode.toDataURL(referralUrl, {
      width: 240,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#173D32',
        light: '#FFFFFF',
      },
    }).then(dataUrl => {
      if (active) setReferralQrDataUrl(dataUrl);
    }).catch(error => {
      console.error('Failed to generate referral QR code:', error);
      if (active) setReferralQrDataUrl('');
    });

    return () => {
      active = false;
    };
  }, [referralOpen, referralUrl]);

  useEffect(() => {
    if (!cardSaved || !program.referral_enabled) return;
    void loadReferralCode();
  }, [cardSaved, program.referral_enabled]);

  const referralMessage = referralCode
    ? `🎁 Je t’invite à rejoindre le programme fidélité de ${card?.establishment_name || 'cet établissement'}.

Scanne le QR code ou ouvre ce lien pour rejoindre le programme fidélité.`
    : '';

  async function shareReferral() {
    if (!referralCode) return;

    try {
      if (navigator.share) {
        await navigator.share({
          title: `Invitation fidélité — ${card?.establishment_name || 'Programme fidélité'}`,
          text: referralMessage,
          url: referralUrl,
        });
        return;
      }

      await copyReferralCode();
    } catch {
      // User cancelled native sharing; keep the panel open.
    }
  }

  async function copyReferralCode() {
    if (!referralCode) return;

    try {
      await navigator.clipboard.writeText(referralUrl);
      setReferralCopied(true);
      window.setTimeout(() => setReferralCopied(false), 2200);
    } catch {
      // Clipboard can be unavailable on some browsers/contexts.
    }
  }

  useEffect(() => {
    const media = window.matchMedia?.('(display-mode: standalone)');
    const checkInstalled = () => {
      setIsInstalled(Boolean(media?.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true));
    };
    checkInstalled();
    setCardSaved(Boolean(media?.matches || (window.navigator as Navigator & { standalone?: boolean }).standalone === true));
    media?.addEventListener?.('change', checkInstalled);

    const handler = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      media?.removeEventListener?.('change', checkInstalled);
    };
  }, []);

  async function saveCardOnPhone() {
    if (isInstalled) return;

    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallPrompt(null);
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setCardSaved(true);
      }
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share({
          title: card?.establishment_name || 'Ma carte fidélité',
          text: 'Ma carte fidélité',
          url: cardUrl,
        });
        setCardSaved(true);
        return;
      } catch {
        // User cancelled sharing; keep the page open.
      }
    }

    try {
      await navigator.clipboard.writeText(cardUrl);
      alert('Lien de votre carte copié. Ouvrez-le sur votre téléphone pour l’enregistrer.');
    } catch {
      alert('Utilisez le menu Partager puis « Ajouter à l’écran d’accueil ».');
    }
  }

  useEffect(() => {
    if (!token) {
      setError('Carte de fidélité introuvable.');
      setLoading(false);
      return;
    }

    window.localStorage.setItem('tapmarrakech:customer-card-token', token);

    const standalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

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

    const load = async () => {
      const [
        { data: cardData, error: cardError },
        { data: designData },
        { data: programData },
        { data: historyData },
        { data: rewardsData },
      ] = await Promise.all([
        supabase.rpc('get_public_loyalty_card', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_card_config', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_program_context', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_history', { p_access_token: token, p_limit: 20 }),
        supabase.rpc('get_public_loyalty_rewards', { p_access_token: token }),
      ]);

      if (cardError || !cardData?.[0]) {
        setError('Cette carte de fidélité est introuvable ou indisponible.');
        setLoading(false);
        return;
      }

      const nextCard = cardData[0] as Card;
      setCard(nextCard);
      setHistory((historyData ?? []) as HistoryItem[]);
      setRewards((rewardsData ?? []) as LoyaltyExperienceReward[]);

      const designRow = Array.isArray(designData) ? designData[0] : designData;
      if (designRow) {
        setDesign({
          template_id: designRow.template_id ?? 'custom',
          primary_color: designRow.primary_color ?? '#173D32',
          secondary_color: designRow.secondary_color ?? '#D3A84C',
          background_color: designRow.background_color ?? '#F7F7F3',
          text_color: designRow.text_color ?? '#FFFFFF',
          button_color: designRow.button_color ?? '#173D32',
          border_radius: Number(designRow.border_radius ?? 24),
        });
        setDesignConfig({ ...defaultLoyaltyDesignConfig, ...(designRow.design_config ?? {}) });
      }

      const programRow = Array.isArray(programData) ? programData[0] : programData;
      if (programRow) {
        setProgram({
          program_type: programRow.program_type ?? 'POINTS',
          stamp_goal: Number(programRow.stamp_goal ?? 10),
          stamps_balance: Number(programRow.stamps_balance ?? 0),
          stamp_reward_name: programRow.stamp_reward_name ?? null,
          stamp_reward_description: programRow.stamp_reward_description ?? null,
          discount_percent: programRow.discount_percent != null ? Number(programRow.discount_percent) : null,
          referral_enabled: Boolean(programRow.referral_enabled),
        });
      }

      document.title = nextCard.establishment_name || 'Carte fidélité';

      let manifest = document.querySelector('link[rel="manifest"]') as HTMLLinkElement | null;
      if (!manifest) {
        manifest = document.createElement('link');
        manifest.rel = 'manifest';
        document.head.appendChild(manifest);
      }
      manifest.href = `/api/loyalty-manifest?name=${encodeURIComponent(nextCard.establishment_name || 'Carte fidélité')}&logo=${encodeURIComponent(nextCard.establishment_logo_url || '')}&start_url=${encodeURIComponent(cardUrl)}`;

      const appleTitle = document.querySelector('meta[name="apple-mobile-web-app-title"]') as HTMLMetaElement | null;
      if (appleTitle) appleTitle.content = nextCard.establishment_name || 'Carte fidélité';

      const appleIcon = document.querySelector('link[rel="apple-touch-icon"]') as HTMLLinkElement | null;
      if (appleIcon && nextCard.establishment_logo_url) appleIcon.href = nextCard.establishment_logo_url;

      setLoading(false);

      if (standalone) {
        document.body.style.background = '#f7f7f3';
      }
    };

    void load();

    return () => {
      // Realtime is attached after the initial load below.
    };
  }, [token, cardUrl]);

  useEffect(() => {
    if (!card?.customer_id || !card.establishment_id) return;

    let refreshTimeout: number | null = null;
    let disposed = false;

    const refreshCard = async () => {
      if (disposed) return;

      setIsLiveRefreshing(true);

      const [
        { data: cardData },
        { data: designData },
        { data: programData },
        { data: historyData },
        { data: rewardsData },
      ] = await Promise.all([
        supabase.rpc('get_public_loyalty_card', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_card_config', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_program_context', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_history', { p_access_token: token, p_limit: 20 }),
        supabase.rpc('get_public_loyalty_rewards', { p_access_token: token }),
      ]);

      if (disposed) return;

      if (cardData?.[0]) setCard(cardData[0] as Card);
      setHistory((historyData ?? []) as HistoryItem[]);
      setRewards((rewardsData ?? []) as LoyaltyExperienceReward[]);

      const designRow = Array.isArray(designData) ? designData[0] : designData;
      if (designRow) {
        setDesign({
          template_id: designRow.template_id ?? 'custom',
          primary_color: designRow.primary_color ?? '#173D32',
          secondary_color: designRow.secondary_color ?? '#D3A84C',
          background_color: designRow.background_color ?? '#F7F7F3',
          text_color: designRow.text_color ?? '#FFFFFF',
          button_color: designRow.button_color ?? '#173D32',
          border_radius: Number(designRow.border_radius ?? 24),
        });
        setDesignConfig({ ...defaultLoyaltyDesignConfig, ...(designRow.design_config ?? {}) });
      }

      const programRow = Array.isArray(programData) ? programData[0] : programData;
      if (programRow) {
        setProgram({
          program_type: programRow.program_type ?? 'POINTS',
          stamp_goal: Number(programRow.stamp_goal ?? 10),
          stamps_balance: Number(programRow.stamps_balance ?? 0),
          stamp_reward_name: programRow.stamp_reward_name ?? null,
          stamp_reward_description: programRow.stamp_reward_description ?? null,
          discount_percent: programRow.discount_percent != null ? Number(programRow.discount_percent) : null,
          referral_enabled: Boolean(programRow.referral_enabled),
        });
      }

      // RPC calls are POST requests and are not browser-cacheable in the usual
      // way. We version the visual assets instead, which is the part that can
      // otherwise remain cached on a phone/PWA after a published upload.
      setLiveVersion(Date.now());
      requestAnimationFrame(() => {
        if (!disposed) setIsLiveRefreshing(false);
      });
    };

    const scheduleRefresh = () => {
      if (refreshTimeout !== null) window.clearTimeout(refreshTimeout);
      refreshTimeout = window.setTimeout(() => {
        refreshTimeout = null;
        void refreshCard();
      }, 80);
    };

    const channel = supabase
      .channel(`loyalty-card-live-${card.customer_id}-${card.establishment_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_card_designs',
          filter: `establishment_id=eq.${card.establishment_id}`,
        },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_settings',
          filter: `establishment_id=eq.${card.establishment_id}`,
        },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_customers',
          filter: `id=eq.${card.customer_id}`,
        },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_transactions',
          filter: `customer_id=eq.${card.customer_id}`,
        },
        scheduleRefresh,
      )
      .subscribe();

    // Realtime is the primary path. This lightweight fallback only protects
    // installed PWAs/background tabs from missed websocket events.
    const refreshWhileVisible = () => {
      if (document.visibilityState === 'visible') void refreshCard();
    };
    const refreshInterval = window.setInterval(refreshWhileVisible, 3000);
    window.addEventListener('focus', refreshWhileVisible);
    document.addEventListener('visibilitychange', refreshWhileVisible);

    return () => {
      disposed = true;
      if (refreshTimeout !== null) window.clearTimeout(refreshTimeout);
      window.clearInterval(refreshInterval);
      window.removeEventListener('focus', refreshWhileVisible);
      document.removeEventListener('visibilitychange', refreshWhileVisible);
      void supabase.removeChannel(channel);
    };
  }, [card?.customer_id, card?.establishment_id, token]);

  if (loading) return <PageShell><Loader /></PageShell>;

  if (!card) {
    return (
      <PageShell>
        <div className="rounded-[2rem] bg-white p-8 text-center shadow-xl">
          <h1 className="font-display text-2xl text-forest">Carte indisponible</h1>
          <p className="mt-2 text-sm text-ink/50">{error}</p>
        </div>
      </PageShell>
    );
  }

  const fullName = `${card.first_name} ${card.last_name ?? ''}`.trim();

  const configuredType = (designConfig as typeof designConfig & { loyaltyType?: string }).loyaltyType;
  const mode: LoyaltyExperienceConfig['type'] =
    configuredType === 'STAMP' || designConfig.card_mode === 'STAMP' || program.program_type === 'STAMP'
      ? 'STAMP'
      : configuredType === 'DISCOUNT'
        ? 'DISCOUNT'
        : configuredType === 'TIER'
          ? 'TIER'
          : configuredType === 'CASHBACK'
            ? 'CASHBACK'
            : configuredType === 'CHALLENGE'
              ? 'CHALLENGE'
              : configuredType === 'COLLECTION'
                ? 'COLLECTION'
                : configuredType === 'REWARD'
                  ? 'REWARD'
                  : 'POINTS';

  const raw = designConfig as typeof designConfig & {
    benefits?: LoyaltyExperienceConfig['benefits'];
    offers?: LoyaltyExperienceConfig['offers'];
    tiers?: LoyaltyExperienceConfig['tiers'];
    pointsGoal?: number;
    cashbackBalance?: number;
    discountPercent?: number;
    discountExpiresAt?: string;
    rewardName?: string;
    rewardDescription?: string;
    intro?: string;
    currentTier?: string;
    business_type?: string | null;
  };

  const experience: LoyaltyExperienceConfig = {
    type: mode,
    businessType: raw.business_type,
    establishmentName: card.establishment_name,
    logoUrl: card.establishment_logo_url ? withLiveVersion(card.establishment_logo_url, liveVersion) : raw.logo_url ? withLiveVersion(raw.logo_url, liveVersion) : undefined,
    coverImageUrl: raw.background_image_url ? withLiveVersion(raw.background_image_url, liveVersion) : undefined,
    primaryColor: design.primary_color,
    secondaryColor: design.secondary_color,
    backgroundColor: design.background_color,
    textColor: design.text_color === '#FFFFFF' ? '#17201c' : design.text_color,
    borderRadius: design.border_radius,
    customerName: fullName,
    pointsBalance: card.points_balance,
    pointsGoal: raw.pointsGoal ?? Math.max(1000, rewards[rewards.length - 1]?.points_required ?? 1000),
    visits: program.stamps_balance,
    visitGoal: program.stamp_goal,
    rewardName: raw.rewardName || program.stamp_reward_name,
    rewardDescription: raw.rewardDescription || program.stamp_reward_description,
    discountPercent: raw.discountPercent ?? program.discount_percent,
    discountExpiresAt: raw.discountExpiresAt,
    cashbackBalance: raw.cashbackBalance,
    currentTier: raw.currentTier,
    tiers: raw.tiers,
    benefits: raw.benefits,
    offers: raw.offers,
    rewards,
    history: history.map(item => ({
      id: item.id,
      title: item.description || item.type || 'Opération fidélité',
      date: new Date(item.created_at).toLocaleDateString('fr-FR'),
      points: item.points,
      amount: item.amount,
    })),
    qrValue: cardUrl,
    intro: raw.intro || designConfig.front_subtitle,
    // The customer card must use the exact premium customer layout shown in the admin preview.
    // Keep the admin preview untouched; this only aligns the public/customer card renderer.
    templateId: 'luxury',
    published: true,
    stampStyle: designConfig.stamp_style,
  };

  return (
    <main className="min-h-screen bg-[#eef0ed] px-3 py-5 sm:px-6 sm:py-8">
      <div className="flex min-h-[calc(100vh-2.5rem)] w-full flex-col items-center justify-center gap-4 sm:min-h-[calc(100vh-4rem)]">
        <div className="flex h-[70vh] max-h-[720px] min-h-[420px] w-full max-w-[430px] flex-col overflow-y-auto rounded-[30px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {showWelcome && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#D6B15A]/30 bg-white px-4 py-3 shadow-[0_10px_30px_rgba(23,61,50,0.08)]">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e7f1eb] text-[#173D32]">
              <Gift className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#173D32]">Bienvenue dans votre programme fidélité 🎉</p>
              <p className="mt-0.5 text-[10px] leading-4 text-ink/45">Votre carte est maintenant active. Gardez-la sur votre téléphone.</p>
            </div>
            <button type="button" onClick={() => setShowWelcome(false)} className="ml-auto shrink-0 p-1 text-ink/30" aria-label="Fermer">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div className={`transition-opacity duration-200 ${isLiveRefreshing ? 'opacity-90' : 'opacity-100'}`}>
          <LoyaltyExperience config={experience} />
        </div>

        {program.referral_enabled && cardSaved && (
          <button
            type="button"
            onClick={() => void openReferral()}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl border border-[#D3A84C]/35 bg-white px-5 py-4 text-sm font-semibold text-[#173D32] shadow-[0_10px_30px_rgba(23,61,50,0.08)] transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#173D32] text-[#D6B15A]">
              <Gift className="h-4 w-4" />
            </span>
            <span>🎁 Inviter un ami</span>
          </button>
        )}

        {!isInstalled && (
          <button
            type="button"
            onClick={() => void saveCardOnPhone()}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#D6B15A] px-5 py-4 text-sm font-semibold text-[#17130f] shadow-lg transition hover:brightness-105"
          >
            <span className="text-lg">▣</span>
            Enregistrer ma carte sur mon téléphone
          </button>
        )}

        <p className="mt-2 text-center text-[10px] text-ink/40">Ajoutez-la à votre écran d’accueil ou partagez votre carte.</p>

        {referralOpen && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[#10231d]/55 p-3 backdrop-blur-sm sm:items-center sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="public-referral-title"
              className="w-full max-w-[430px] overflow-hidden rounded-[2rem] bg-[#F7F7F3] shadow-2xl"
            >
              <div className="relative bg-[#173D32] px-6 pb-7 pt-6 text-white">
                <button
                  type="button"
                  onClick={() => setReferralOpen(false)}
                  aria-label="Fermer"
                  className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                >
                  <X className="h-4 w-4" />
                </button>

                <div className="pr-10">
                  <div className="mb-3 grid h-11 w-11 place-items-center rounded-2xl bg-[#D6B15A] text-[#173D32]">
                    <Gift className="h-5 w-5" />
                  </div>
                  <h2 id="public-referral-title" className="font-display text-2xl">
                    Inviter un ami
                  </h2>
                  <p className="mt-1 text-sm text-white/65">
                    Partagez votre code et invitez un proche à rejoindre le programme fidélité.
                  </p>
                </div>
              </div>

              <div className="space-y-4 p-5">
                {referralLoading ? (
                  <div className="rounded-2xl bg-white px-4 py-8 text-center shadow-sm">
                    <div className="mx-auto h-7 w-7 animate-spin rounded-full border-2 border-[#173D32] border-t-transparent" />
                    <p className="mt-3 text-sm text-[#173D32]/60">Chargement de votre code…</p>
                  </div>
                ) : referralCode ? (
                  <>
                    <div className="rounded-2xl border border-[#D3A84C]/35 bg-white p-5 text-center shadow-sm">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#173D32]/45">
                        Inviter avec votre QR Code
                      </p>

                      <div className="mx-auto mt-4 flex min-h-[260px] w-full items-center justify-center rounded-2xl bg-white p-3">
                        {referralQrDataUrl ? (
                          <img
                            src={referralQrDataUrl}
                            alt="QR Code de parrainage"
                            className="h-[240px] w-[240px] max-w-full rounded-xl"
                          />
                        ) : (
                          <div className="h-[240px] w-[240px] animate-pulse rounded-xl bg-[#eef0ed]" />
                        )}
                      </div>

                      <p className="mt-3 text-[10px] text-[#173D32]/45">
                        Scannez ce QR Code pour rejoindre le programme fidélité.
                      </p>

                      <p className="mt-2 break-all text-[10px] leading-4 text-[#173D32]/45">
                        {referralUrl}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-[#173D32]/[0.06] p-4">
                      <p className="whitespace-pre-line text-sm leading-6 text-[#173D32]/80">
                        {referralMessage}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void shareReferral()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#173D32] px-5 py-4 text-sm font-semibold text-white shadow-lg transition hover:brightness-110"
                    >
                      <Share2 className="h-4 w-4" />
                      Partager maintenant
                    </button>

                    <button
                      type="button"
                      onClick={() => void copyReferralCode()}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#173D32]/12 bg-white px-5 py-3.5 text-sm font-semibold text-[#173D32] transition hover:bg-[#173D32]/[0.04]"
                    >
                      <Link2 className="h-4 w-4" />
                      {referralCopied ? 'Lien copié ✓' : 'Copier le lien'}
                    </button>
                  </>
                ) : (
                  <div className="rounded-2xl bg-white p-5 text-center shadow-sm">
                    <p className="text-sm leading-6 text-[#173D32]/65">
                      Votre code de parrainage n’est pas encore disponible.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </main>
  );
}

function withLiveVersion(url: string, version: number) {
  if (!version || !url) return url;
  try {
    const nextUrl = new URL(url, window.location.origin);
    nextUrl.searchParams.set('v', String(version));
    return nextUrl.toString();
  } catch {
    return url;
  }
}

function PageShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[#f7f7f3] px-4 py-6 sm:py-10"><div className="mx-auto w-full max-w-md">{children}</div></main>;
}

function Loader() {
  return <div className="grid min-h-screen place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-forest border-t-transparent" /></div>;
}
