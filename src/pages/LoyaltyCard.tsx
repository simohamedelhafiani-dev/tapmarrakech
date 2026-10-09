import { useEffect, useState } from 'react';
import { Bell, CheckCircle2, Gift, Link2, Share2, Trophy, X } from 'lucide-react';
import QRCode from 'qrcode';
import type { ReactNode } from 'react';

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }> };
import { defaultLoyaltyDesignConfig } from '@/components/LoyaltyCardVisual';
import type { LoyaltyExperienceReward } from '@/components/loyalty/LoyaltyExperience';
import { LoyaltyCardVisual, type LoyaltyDesignConfig } from '@/components/LoyaltyCardVisual';
import { supabase } from '@/lib/supabase';
import { enableLoyaltyPush, getLoyaltyPushSubscription } from '@/lib/loyaltyPush';

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
type CustomerTier = { tier_key:string;tier_name:string;sort_order:number;total_points:number;rewards_redeemed:number;ticket_multiplier:number;next_tier_key:string|null;next_tier_name:string|null;next_points:number|null;next_rewards:number|null };
type ActiveRaffle = { id:string; title:string; description:string|null; prize_name:string; prize_description:string|null; starts_at:string; draw_at:string; winners_count:number; participant_count:number };

type RaffleWinner = {
  id: string;
  raffle_id: string;
  title: string;
  prize_name: string;
  prize_description: string | null;
  valid_from: string;
  valid_until: string;
  reservation_required: boolean;
  single_use: boolean;
  non_cumulative: boolean;
  status: 'PENDING' | 'REDEEMED' | 'EXPIRED';
  claim_token: string;
  drawn_at: string;
};

type CardNotification = {
  id: string;
  title: string;
  message: string;
  type: 'INFO' | 'OFFER' | 'REWARD' | 'POINTS';
  created_at: string;
  expires_at: string | null;
  is_read: boolean;
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
    program_type: 'POINTS_REWARD' as 'STAMP' | 'POINTS_REWARD' | 'POINTS_DISCOUNT',
    stamp_goal: 10,
    stamps_balance: 0,
    stamp_reward_name: null as string | null,
    stamp_reward_description: null as string | null,
    discount_percent: null as number | null,
    discount_valid_days: 7,
    discount_points_threshold: 1000,
    discount_expires_at: null as string | null,
    referral_enabled: false,
  });
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralOpen, setReferralOpen] = useState(false);
  const [referralLoading, setReferralLoading] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [referralQrDataUrl, setReferralQrDataUrl] = useState('');
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [notifications, setNotifications] = useState<CardNotification[]>([]);
  const [raffleWins, setRaffleWins] = useState<RaffleWinner[]>([]);
  const [activeRaffle, setActiveRaffle] = useState<ActiveRaffle | null>(null);
  const [raffleLoadError, setRaffleLoadError] = useState('');
  const [raffleDetailsOpen, setRaffleDetailsOpen] = useState(false);
  const [customerTier, setCustomerTier] = useState<CustomerTier | null>(null);
  const [rewards, setRewards] = useState<LoyaltyExperienceReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [cardSaved, setCardSaved] = useState(false);
  const [liveVersion, setLiveVersion] = useState(0);
  const [isLiveRefreshing, setIsLiveRefreshing] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [pushMessage, setPushMessage] = useState('');

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

  useEffect(() => {
    if (!card?.customer_id) return;
    void (async () => {
      const { data, error } = await supabase.rpc('get_public_loyalty_customer_tier', { p_access_token: token });
      if (!error) {
        const row = Array.isArray(data) ? data[0] : data;
        setCustomerTier((row ?? null) as CustomerTier | null);
      }
    })();
  }, [card?.customer_id]);

  useEffect(() => {
    if (!card?.customer_id || !token) return;
    let cancelled = false;
    void (async () => {
      setRaffleLoadError('');
      const { data, error: raffleError } = await supabase.rpc('get_public_loyalty_raffles', { p_access_token: token });
      if (cancelled) return;
      if (raffleError) {
        console.error('[KELYANI] Impossible de charger les tombolas de la carte:', raffleError);
        setActiveRaffle(null);
        setRaffleLoadError('Impossible de charger les tombolas pour cette carte. Réessayez dans un instant.');
        return;
      }
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const now = Date.now();
      const current = (rows as ActiveRaffle[])
        .filter(raffle => new Date(raffle.starts_at).getTime() <= now && new Date(raffle.draw_at).getTime() > now)
        .sort((a, b) => new Date(a.draw_at).getTime() - new Date(b.draw_at).getTime())[0] ?? null;
      setActiveRaffle(current);
      setRaffleLoadError('');
      console.info('[KELYANI] Tombolas reçues pour la carte:', { received: rows.length, active: Boolean(current) });
    })();
    return () => { cancelled = true; };
  }, [card?.customer_id, token]);

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
        { data: discountData },
        { data: notificationsData },
      ] = await Promise.all([
        supabase.rpc('get_public_loyalty_card', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_card_config', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_program_context', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_history', { p_access_token: token, p_limit: 20 }),
        supabase.rpc('get_public_loyalty_rewards', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_discount_status', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_notifications', { p_access_token: token, p_limit: 20 }),
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
      setNotifications((notificationsData ?? []) as CardNotification[]);

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
          program_type: programRow.program_type === 'STAMP' ? 'STAMP' : programRow.program_type === 'POINTS_DISCOUNT' || programRow.program_type === 'DISCOUNT' ? 'POINTS_DISCOUNT' : 'POINTS_REWARD',
          stamp_goal: Number(programRow.stamp_goal ?? 10),
          stamps_balance: Number(programRow.stamps_balance ?? 0),
          stamp_reward_name: programRow.stamp_reward_name ?? null,
          stamp_reward_description: programRow.stamp_reward_description ?? null,
          discount_percent: programRow.discount_percent != null ? Number(programRow.discount_percent) : null,
          discount_valid_days: Number(programRow.discount_valid_days ?? 7),
          discount_points_threshold: Number(programRow.discount_points_threshold ?? 1000),
          discount_expires_at: (Array.isArray(discountData) ? discountData[0]?.expires_at : discountData?.expires_at) ?? null,
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
        document.body.style.background = '#050505';
      }
    };

    void load();

    return () => {
      // Realtime is attached after the initial load below.
    };
  }, [token, cardUrl]);

  useEffect(() => {
    if (!card?.establishment_id) return;

    const channel = supabase
      .channel(`loyalty-design-preview-${card.establishment_id}`)
      .on('broadcast', { event: 'loyalty-design-preview' }, ({ payload }) => {
        if (!payload || payload.establishmentId !== card.establishment_id) return;

        if (payload.design) {
          setDesign((current) => ({
            ...current,
            ...payload.design,
          }));
        }

        if (payload.designConfig) {
          setDesignConfig((current) => ({
            ...current,
            ...payload.designConfig,
          }));
        }

        if (payload.designConfig?.loyaltyType) {
          setProgram((current) => ({
            ...current,
            program_type: payload.designConfig.loyaltyType,
          }));
        }
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [card?.establishment_id]);

  useEffect(() => {
    let active = true;
    const checkPushSubscription = async () => {
      try {
        const subscription = await getLoyaltyPushSubscription();
        if (active && subscription) setPushEnabled(true);
      } catch {
        // Push support is optional; the loyalty card must remain usable.
      }
    };
    void checkPushSubscription();
    return () => { active = false; };
  }, [token]);

  const cardUrl = window.location.href;
  const activatePushNotifications = async () => {
    if (pushLoading || pushEnabled) return;
    setPushLoading(true);
    setPushMessage('');
    try {
      await enableLoyaltyPush(token, cardUrl);
      setPushEnabled(true);
      setPushMessage('Notifications activées. Vous recevrez les nouveaux messages même lorsque votre téléphone est verrouillé.');
    } catch (error) {
      console.error('Failed to enable loyalty push:', error);
      setPushMessage(error instanceof Error ? error.message : 'Impossible d’activer les notifications.');
    } finally {
      setPushLoading(false);
    }
  };

  useEffect(() => {
    if (!card?.customer_id || !card.establishment_id) return;

    let refreshTimeout: number | null = null;
    let disposed = false;
    let refreshSequence = 0;

    const refreshCard = async () => {
      if (disposed) return;

      const sequence = ++refreshSequence;
      setIsLiveRefreshing(true);

      const [
        { data: cardData },
        { data: designData },
        { data: programData },
        { data: historyData },
        { data: rewardsData },
        { data: discountData },
        { data: notificationsData },
      ] = await Promise.all([
        supabase.rpc('get_public_loyalty_card', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_card_config', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_program_context', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_history', { p_access_token: token, p_limit: 20 }),
        supabase.rpc('get_public_loyalty_rewards', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_discount_status', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_notifications', { p_access_token: token, p_limit: 20 }),
      ]);

      if (disposed || sequence !== refreshSequence) return;

      if (cardData?.[0]) setCard(cardData[0] as Card);
      setHistory((historyData ?? []) as HistoryItem[]);
      setRewards((rewardsData ?? []) as LoyaltyExperienceReward[]);
      setNotifications((notificationsData ?? []) as CardNotification[]);

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
          discount_valid_days: Number(programRow.discount_valid_days ?? 7),
          discount_points_threshold: Number(programRow.discount_points_threshold ?? 1000),
          discount_expires_at: (Array.isArray(discountData) ? discountData[0]?.expires_at : discountData?.expires_at) ?? null,
          referral_enabled: Boolean(programRow.referral_enabled),
        });
      }

      // RPC calls are POST requests and are not browser-cacheable in the usual
      // way. We version the visual assets instead, which is the part that can
      // otherwise remain cached on a phone/PWA after a published upload.
      setLiveVersion(Date.now());
      requestAnimationFrame(() => {
        if (!disposed && sequence === refreshSequence) setIsLiveRefreshing(false);
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_rewards',
          filter: `establishment_id=eq.${card.establishment_id}`,
        },
        scheduleRefresh,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_card_notifications',
          filter: `customer_id=eq.${card.customer_id}`,
        },
        scheduleRefresh,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          scheduleRefresh();
        }
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          window.setTimeout(() => {
            if (!disposed) scheduleRefresh();
          }, 500);
        }
      });

    // Realtime is the primary path. This lightweight fallback only protects
    // installed PWAs/background tabs from missed websocket events.
    const refreshWhileVisible = () => {
      if (document.visibilityState === 'visible') void refreshCard();
    };
    const refreshInterval = window.setInterval(refreshWhileVisible, 15000);
    document.addEventListener('visibilitychange', refreshWhileVisible);

    return () => {
      disposed = true;
      if (refreshTimeout !== null) window.clearTimeout(refreshTimeout);
      window.clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', refreshWhileVisible);
      void supabase.removeChannel(channel);
    };
  }, [card?.customer_id, card?.establishment_id, token]);

  if (loading) return <PageShell><Loader /></PageShell>;

  if (!card) {
    return (
      <PageShell>
        <div className="rounded-[2rem] border border-white/10 bg-[#111111] p-8 text-center shadow-luxury">
          <h1 className="font-display text-2xl text-forest">Carte indisponible</h1>
          <p className="mt-2 text-sm text-ink/50">{error}</p>
        </div>
      </PageShell>
    );
  }

  const fullName = `${card.first_name} ${card.last_name ?? ''}`.trim();

  const configuredType = (designConfig as typeof designConfig & { loyaltyType?: string }).loyaltyType;
  const mode =
    configuredType === 'STAMP' || designConfig.card_mode === 'STAMP' || program.program_type === 'STAMP'
      ? 'STAMP'
      : (configuredType as string) === 'POINTS_DISCOUNT' || (designConfig.card_mode as string) === 'POINTS_DISCOUNT' || (program.program_type as string) === 'POINTS_DISCOUNT'
        ? 'DISCOUNT'
        : 'POINTS';

  const discountThreshold = Number((designConfig as typeof designConfig & { discountPointsThreshold?: number }).discountPointsThreshold ?? program.discount_points_threshold ?? 1000);
  const discountValidDays = Number((designConfig as typeof designConfig & { discountValidDays?: number }).discountValidDays ?? program.discount_valid_days ?? 7);

  const discountUnlockDate = program.discount_expires_at;
  const hasPendingRaffleWin = raffleWins.some(win => win.status === 'PENDING');

  const raw = designConfig as typeof designConfig & {
    background_image_url?: string | null;
    logo_url?: string | null;
    discountPercent?: number;
    discountPointsThreshold?: number;
    discountValidDays?: number;
    rewardName?: string;
  };
  return (
    <main className="min-h-screen bg-[#050505] px-3 py-5 text-[#EDE9DF] sm:px-6 sm:py-8">
      <div className="flex w-full flex-col items-center gap-4">
        <div className="w-full max-w-[430px]">
        {showWelcome && (
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-[#C9A45C]/20 bg-[#111111] px-4 py-3 shadow-soft">
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

        {customerTier && (
          <div className="mb-3 flex items-center justify-between rounded-2xl border border-[#D4AF37]/20 bg-[#111111] px-4 py-3">
            <div><p className="text-[9px] font-bold uppercase tracking-[.16em] text-[#D4AF37]">Niveau fidélité</p><p className="mt-1 text-sm font-semibold text-white">{customerTier.tier_name}</p></div>
            <div className="text-right"><p className="text-[9px] text-white/35">{customerTier.total_points} points · {customerTier.rewards_redeemed} récompense(s)</p>{customerTier.next_tier_name&&<p className="mt-1 text-[9px] text-[#D4AF37]">Prochain : {customerTier.next_tier_name}</p>}</div>
          </div>
        )}

        <div className="flex w-full justify-center">
          <div className={isLiveRefreshing ? 'opacity-90 transition-opacity duration-200' : 'opacity-100 transition-opacity duration-200'}>
            <LoyaltyCardVisual
              design={{
                template_id: design.template_id,
                primary_color: design.primary_color,
                secondary_color: design.secondary_color,
                background_color: design.background_color,
                text_color: design.text_color,
                border_radius: 34,
                config: {
                  ...designConfig,
                  background_image_url: raw.background_image_url || null,
                  logo_url: raw.logo_url || card.establishment_logo_url || null,
                  loyaltyType: configuredType as LoyaltyDesignConfig['loyaltyType'],
                  card_mode: mode === 'STAMP' ? 'STAMP' : mode === 'DISCOUNT' ? 'POINTS_DISCOUNT' : 'POINTS_REWARD',
                  show_qr: true,
                },
              }}
              card={{
                establishmentName: card.establishment_name,
                logoUrl: card.establishment_logo_url,
                points: card.points_balance,
                stampsBalance: program.stamps_balance,
                stampGoal: program.stamp_goal,
                stampRewardName: raw.rewardName || program.stamp_reward_name,
                rewardName: rewards[0]?.name || raw.rewardName || null,
                rewardPointsRequired: rewards[0]?.points_required,
                rewardDescription: rewards[0]?.description || null,
                discountPercent: raw.discountPercent ?? program.discount_percent ?? undefined,
                discountPointsThreshold: discountThreshold,
                discountExpiresAt: discountUnlockDate,
                discountValidDays,
                customerName: fullName,
                loyaltyNumber: card.loyalty_number,
                cardUrl: cardUrl,
              }}
              programType={mode}
              cardWidth="min(90vw, calc((100svh - 125px) * 0.666667))"
            />
          </div>
        </div>

        {raffleLoadError && (
          <div role="status" className="mt-4 w-full rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-xs leading-5 text-amber-100">
            {raffleLoadError}
          </div>
        )}

        {activeRaffle && (
          <section className="mt-4 overflow-hidden rounded-2xl border shadow-lg transition-colors duration-300" style={{ backgroundColor: design.background_color, color: readableTextColor(design.background_color), borderColor: design.secondary_color }}>
            <button type="button" onClick={() => setRaffleDetailsOpen(open => !open)} aria-expanded={raffleDetailsOpen} className="flex w-full items-center gap-3 p-4 text-left transition-opacity hover:opacity-90">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl" style={{ backgroundColor: design.primary_color, color: readableTextColor(design.primary_color) }}><Trophy className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block text-[10px] font-bold uppercase tracking-[.15em]" style={{ color: design.secondary_color }}>Tombola en cours</span>
                <span className="mt-1 block truncate text-sm font-semibold">{activeRaffle.title}</span>
                <span className="mt-1 block text-xs opacity-75">À gagner : {activeRaffle.prize_name}</span>
              </span>
              <span className="shrink-0 rounded-full px-3 py-1.5 text-[10px] font-bold" style={{ backgroundColor: design.secondary_color, color: readableTextColor(design.secondary_color) }}>{raffleDetailsOpen ? 'Fermer' : 'Voir'}</span>
            </button>
            {raffleDetailsOpen && (
              <div className="border-t px-4 pb-4 pt-3" style={{ borderColor: design.secondary_color }}>
                {activeRaffle.description && <p className="mb-2 text-sm leading-5 opacity-85">{activeRaffle.description}</p>}
                {activeRaffle.prize_description && <p className="mb-3 text-xs leading-5 opacity-75">{activeRaffle.prize_description}</p>}
                <div className="flex items-center justify-between gap-3 text-xs"><span className="opacity-75">Tirage prévu</span><strong>{new Date(activeRaffle.draw_at).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })}</strong></div>
                <div className="mt-2 flex items-center justify-between gap-3 text-xs"><span className="opacity-75">Participants éligibles</span><strong>{activeRaffle.participant_count}</strong></div>
              </div>
            )}
          </section>
        )}

        {program.referral_enabled && cardSaved && (
          <button
            type="button"
            onClick={() => void openReferral()}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-2xl px-5 py-3.5 text-sm font-semibold shadow-[0_10px_30px_rgba(23,61,50,0.14)] transition hover:-translate-y-0.5 hover:shadow-lg"
            style={{
              backgroundColor: design.primary_color,
              color: design.text_color,
              border: `1px solid ${design.secondary_color}`,
            }}
          >
            <span
              className="grid h-8 w-8 shrink-0 place-items-center rounded-full"
              style={{ backgroundColor: design.secondary_color, color: design.primary_color }}
            >
              <Gift className="h-4 w-4" />
            </span>
            <span>🎁 Inviter un ami</span>
          </button>
        )}

        {notifications.length > 0 && (
          <section className="mt-4 overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#111111] shadow-luxury">
            <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
              <div className="flex items-center gap-3">
                <div
                  className="grid h-10 w-10 place-items-center rounded-xl"
                  style={{ backgroundColor: `${design.secondary_color}22`, color: design.secondary_color }}
                >
                  <Bell className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-white">Notifications</h2>
                  <p className="mt-0.5 text-[10px] text-white/35">
                    {notifications.filter(notification => !notification.is_read).length} non lue(s)
                  </p>
                </div>
              </div>
              {notifications.some(notification => !notification.is_read) && (
                <span
                  className="rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em]"
                  style={{ backgroundColor: `${design.secondary_color}18`, color: design.secondary_color }}
                >
                  Nouveau
                </span>
              )}
            </div>
            <div className="divide-y divide-white/6">
              {notifications.map(notification => (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => {
                    if (notification.is_read) return;
                    setNotifications(current =>
                      current.map(item =>
                        item.id === notification.id ? { ...item, is_read: true } : item
                      )
                    );
                    void supabase.rpc('mark_public_loyalty_notification_read', {
                      p_access_token: token,
                      p_notification_id: notification.id,
                    });
                  }}
                  className="w-full px-5 py-4 text-left transition hover:bg-white/[0.03]"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ backgroundColor: notification.is_read ? 'rgba(255,255,255,.15)' : design.secondary_color }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <p className={`text-sm font-semibold ${notification.is_read ? 'text-white/55' : 'text-white'}`}>
                          {notification.title}
                        </p>
                        <span className="shrink-0 text-[9px] text-white/25">
                          {new Date(notification.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-white/45">{notification.message}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {!pushEnabled && (
          <section className="mt-4 overflow-hidden rounded-[1.75rem] border border-[#D4AF37]/20 bg-[#111111] p-5 shadow-luxury">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#D4AF37]/10 text-[#D4AF37]">
                <Bell className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-white">Recevoir les notifications</h2>
                <p className="mt-1 text-[11px] leading-5 text-white/40">
                  Recevez les offres et messages de votre établissement directement sur votre téléphone, même lorsque la carte est fermée ou que l’écran est verrouillé.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void activatePushNotifications()}
              disabled={pushLoading}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#D4AF37] px-4 py-3 text-xs font-semibold text-[#0D0D0D] disabled:opacity-50"
            >
              <Bell size={15} />
              {pushLoading ? 'Activation…' : 'Activer les notifications'}
            </button>
            {pushMessage && (
              <p className="mt-3 text-center text-[10px] leading-4 text-[#D4AF37]" role="status">
                {pushMessage}
              </p>
            )}
          </section>
        )}
        {pushEnabled && pushMessage && (
          <p className="mt-3 text-center text-[10px] leading-4 text-[#D4AF37]" role="status">
            {pushMessage}
          </p>
        )}

        {!isInstalled && (
          <button
            type="button"
            onClick={() => void saveCardOnPhone()}
            className="mt-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-gold-gradient px-5 py-4 text-sm font-semibold text-[#050505] shadow-gold transition hover:brightness-105"
          >
            <span className="text-lg">▣</span>
            Enregistrer ma carte sur mon téléphone
          </button>
        )}

        <p className="mt-2 text-center text-[10px] text-white/35">Ajoutez-la à votre écran d’accueil ou partagez votre carte.</p>

        {referralOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#10231d]/55 p-3 backdrop-blur-sm sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="public-referral-title"
              className="flex h-[40vh] max-h-[40vh] w-full max-w-[430px] flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#111111] shadow-luxury"
            >
              <div
                className="relative shrink-0 px-6 pb-4 pt-4"
                style={{ backgroundColor: design.primary_color, color: design.text_color }}
              >
                <button
                  type="button"
                  onClick={() => setReferralOpen(false)}
                  aria-label="Fermer"
                  className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-full bg-white/10 transition hover:bg-white/20"
                  style={{ color: design.text_color }}
                >
                  <X className="h-4 w-4" />
                </button>
                <h2 id="public-referral-title" className="pr-10 font-display text-xl">
                  Inviter un ami
                </h2>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden p-4">
                {referralLoading ? (
                  <div className="flex h-full items-center justify-center">
                    <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#173D32] border-t-transparent" />
                  </div>
                ) : referralCode ? (
                  <div className="flex h-full flex-col items-center justify-center">
                    <p
                      className="mb-2 text-center text-sm font-semibold"
                      style={{ color: design.primary_color }}
                    >
                      Bienvenue dans la famille {card?.establishment_name || "cet établissement"} 🤍
                    </p>
                    <div className="flex aspect-square w-[min(30vh,210px)] max-w-full items-center justify-center rounded-2xl bg-white p-2 shadow-sm">
                      {referralQrDataUrl ? (
                        <img
                          src={referralQrDataUrl}
                          alt="QR Code de parrainage"
                          className="h-full w-full rounded-xl"
                        />
                      ) : (
                        <div className="h-full w-full animate-pulse rounded-xl bg-[#eef0ed]" />
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-center text-sm text-[#173D32]/60">
                    Votre code de parrainage n’est pas encore disponible.
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

function readableTextColor(hexColor: string): string {
  const normalized = hexColor.replace('#', '').trim();
  if (!/^[0-9a-fA-F]{6}$/.test(normalized)) return '#FFFFFF';
  const channels = [0, 2, 4].map(offset => {
    const value = parseInt(normalized.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
  return luminance > 0.42 ? '#111111' : '#FFFFFF';
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
  return <main className="min-h-screen bg-[#050505] px-4 py-6 text-[#EDE9DF] sm:py-10"><div className="mx-auto w-full max-w-md">{children}</div></main>;
}

function Loader() {
  return <div className="grid min-h-screen place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-forest border-t-transparent" /></div>;
}
