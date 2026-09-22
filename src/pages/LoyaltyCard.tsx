import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
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
  });
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [rewards, setRewards] = useState<LoyaltyExperienceReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const cardUrl = window.location.href;

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
        supabase.rpc('get_public_loyalty_card_builder_config', { p_access_token: token }),
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
          template_id: 'custom',
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
    if (!card?.customer_id) return;

    const refreshCard = async () => {
      const [{ data: cardData }, { data: programData }, { data: historyData }, { data: rewardsData }] = await Promise.all([
        supabase.rpc('get_public_loyalty_card', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_program_context', { p_access_token: token }),
        supabase.rpc('get_public_loyalty_history', { p_access_token: token, p_limit: 20 }),
        supabase.rpc('get_public_loyalty_rewards', { p_access_token: token }),
      ]);

      if (cardData?.[0]) setCard(cardData[0] as Card);
      setHistory((historyData ?? []) as HistoryItem[]);
      setRewards((rewardsData ?? []) as LoyaltyExperienceReward[]);
      const programRow = Array.isArray(programData) ? programData[0] : programData;
      if (programRow) {
        setProgram({
          program_type: programRow.program_type ?? 'POINTS',
          stamp_goal: Number(programRow.stamp_goal ?? 10),
          stamps_balance: Number(programRow.stamps_balance ?? 0),
          stamp_reward_name: programRow.stamp_reward_name ?? null,
          stamp_reward_description: programRow.stamp_reward_description ?? null,
          discount_percent: programRow.discount_percent != null ? Number(programRow.discount_percent) : null,
        });
      }
    };

    const channel = supabase
      .channel(`loyalty-card-${card.customer_id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_customers',
          filter: `id=eq.${card.customer_id}`,
        },
        () => {
          void refreshCard();
        },
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'loyalty_transactions',
          filter: `customer_id=eq.${card.customer_id}`,
        },
        () => {
          void refreshCard();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [card?.customer_id, token]);

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
    logoUrl: raw.logo_url || card.establishment_logo_url,
    coverImageUrl: raw.background_image_url,
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
    templateId: design.template_id,
    published: true,
  };

  return (
    <main className="min-h-screen bg-[#eef0ed] px-3 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-[430px]">
        <LoyaltyExperience config={experience} />
      </div>
    </main>
  );
}

function PageShell({ children }: { children: ReactNode }) {
  return <main className="min-h-screen bg-[#f7f7f3] px-4 py-6 sm:py-10"><div className="mx-auto w-full max-w-md">{children}</div></main>;
}

function Loader() {
  return <div className="grid min-h-screen place-items-center"><div className="h-9 w-9 animate-spin rounded-full border-2 border-forest border-t-transparent" /></div>;
}
