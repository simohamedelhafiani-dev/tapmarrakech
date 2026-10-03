import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Gift,
  ImagePlus,
  Loader2,
  Palette,
  Percent,
  Rocket,
  Save,
  Settings2,
  Sparkles,
  Stamp,
  Star,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import {
  useLoyaltyManager,
  type LoyaltyProgramType,
  type LoyaltyReferralBonusType,
  type LoyaltyReferralConfig,
} from '@/hooks/useLoyaltyManager';
import LoyaltyPreview from './LoyaltyPreview';
import { WALLET_TEMPLATES } from '@/components/LoyaltyCardVisual';
import type { LoyaltyExperienceConfig, LoyaltyExperienceReward } from './LoyaltyExperience';

type Props = { establishmentId: string };
type TabId = 'settings' | 'rewards' | 'referral' | 'design';
type RewardType = 'GIFT' | 'DISCOUNT';

type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
  reward_type: RewardType;
  discount_percent: number | null;
  discount_max_amount: number | null;
};

type RewardDraft = {
  id: string | null;
  name: string;
  description: string;
  pointsRequired: number;
  rewardType: RewardType;
  discountPercent: number;
  discountMaxAmount: number | null;
};

type DesignState = {
  templateId: string;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  borderRadius: number;
  wallpaperUrl: string | null;
  logoUrl: string | null;
  stampStyle: 'circles' | 'squares' | 'stars' | 'hearts';
  published: boolean;
};

const DEFAULT_DESIGN: DesignState = {
  templateId: 'onyx-black',
  primaryColor: '#181818',
  secondaryColor: '#D7D7D7',
  backgroundColor: '#070707',
  textColor: '#FFFFFF',
  buttonColor: '#181818',
  borderRadius: 34,
  wallpaperUrl: null,
  logoUrl: null,
  stampStyle: 'circles',
  published: false,
};

const TABS: { id: TabId; label: string; caption: string; icon: typeof Settings2 }[] = [
  { id: 'settings', label: 'Paramètres', caption: 'Programme', icon: Settings2 },
  { id: 'rewards', label: 'Récompenses', caption: 'Catalogue', icon: Gift },
  { id: 'referral', label: 'Parrainage', caption: 'Acquisition', icon: Rocket },
  { id: 'design', label: 'Design', caption: 'Visuels', icon: Palette },
];

const TYPES: {
  id: LoyaltyProgramType;
  label: string;
  description: string;
  icon: typeof Stamp;
}[] = [
  { id: 'STAMP', label: 'Tampons', description: 'Un tampon par visite et une récompense à l’objectif.', icon: Stamp },
  { id: 'POINTS_REWARD', label: 'Points + cadeaux', description: 'X MAD = Y points, puis échange contre des cadeaux.', icon: Star },
  { id: 'POINTS_DISCOUNT', label: 'Points + réduction', description: 'Accumulez des points et débloquez une réduction.', icon: Percent },
];

const emptyReward: RewardDraft = {
  id: null,
  name: '',
  description: '',
  pointsRequired: 100,
  rewardType: 'GIFT',
  discountPercent: 10,
  discountMaxAmount: null,
};

function bonusLabel(type: LoyaltyReferralBonusType, value: number) {
  if (type === 'STAMP') return `${value} tampon(s)`;
  if (type === 'REDUCTION') return `${value}% de réduction`;
  return `${value} point(s)`;
}

function normalizeReward(row: Record<string, unknown>): Reward {
  return {
    id: String(row.id),
    name: String(row.name ?? ''),
    description: row.description ? String(row.description) : null,
    points_required: Number(row.points_required ?? 0),
    active: row.active !== false,
    reward_type: row.reward_type === 'DISCOUNT' ? 'DISCOUNT' : 'GIFT',
    discount_percent: row.discount_percent == null ? null : Number(row.discount_percent),
    discount_max_amount: row.discount_max_amount == null ? null : Number(row.discount_max_amount),
  };
}

export default function LoyaltyStudio({ establishmentId }: Props) {
  const manager = useLoyaltyManager(establishmentId);
  const [tab, setTab] = useState<TabId>('settings');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [referralStats, setReferralStats] = useState(0);
  const [program, setProgram] = useState({
    programType: 'POINTS_REWARD' as LoyaltyProgramType,
    stampGoal: 10,
    stampRewardName: 'Cadeau fidélité',
    stampRewardDescription: '',
    pointsPerCurrency: 1,
    discountPointsThreshold: 1000,
    discountPercent: 10,
    discountValidDays: 7,
    enabled: true,
  });
  const [referral, setReferral] = useState<LoyaltyReferralConfig>({
    enabled: false,
    referrer_bonus_type: 'POINTS',
    referrer_bonus_value: 50,
    referee_bonus_type: 'POINTS',
    referee_bonus_value: 0,
    max_referrals: null,
    referrer_bonus_points: 50,
    referee_bonus_points: 0,
  });
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [rewardDraft, setRewardDraft] = useState<RewardDraft>(emptyReward);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [conversionMad, setConversionMad] = useState(1);
  const [conversionPoints, setConversionPoints] = useState(1);
  const [design, setDesign] = useState<DesignState>(DEFAULT_DESIGN);
  const [establishment, setEstablishment] = useState({
    name: 'Votre établissement',
    logoUrl: null as string | null,
  });
  const wallpaperInput = useRef<HTMLInputElement>(null);
  const designHydratedRef = useRef(false);
  const previewChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const [previewChannelReady, setPreviewChannelReady] = useState(false);
  const liveDesignTimerRef = useRef<number | null>(null);

  const load = async () => {
    if (!establishmentId) return;
    setLoading(true);
    setMessage('');

    try {
      const [{ data: place }, settings, referralState, referralStateStats, { data: designData }, { data: rewardData }] =
        await Promise.all([
          supabase.from('establishments').select('name,logo_url').eq('id', establishmentId).maybeSingle(),
          manager.getProgramSettings(),
          manager.getReferralConfig(),
          manager.getReferralStats(),
          supabase.rpc('get_loyalty_card_builder_config', { p_establishment_id: establishmentId }),
          supabase
            .from('loyalty_rewards')
            .select('id,name,description,points_required,active,reward_type,discount_percent,discount_max_amount')
            .eq('establishment_id', establishmentId)
            .order('points_required', { ascending: true }),
        ]);

      if (place) {
        setEstablishment({
          name: place.name || 'Votre établissement',
          logoUrl: place.logo_url || null,
        });
      }

      setProgram({
        programType: settings.programType,
        stampGoal: settings.stampGoal,
        stampRewardName: settings.stampRewardName || 'Cadeau fidélité',
        stampRewardDescription: settings.stampRewardDescription || '',
        pointsPerCurrency: settings.pointsPerCurrency,
        discountPointsThreshold: settings.discountPointsThreshold,
        discountPercent: settings.discountPercent ?? 10,
        discountValidDays: settings.discountValidDays,
        enabled: settings.enabled,
      });

      setConversionMad(1);
      setConversionPoints(settings.pointsPerCurrency);
      setReferral(referralState.draftConfig);
      setReferralStats(referralStateStats.acquiredCount);
      setRewards(
        ((rewardData ?? []) as unknown as Record<string, unknown>[]).map(normalizeReward),
      );

      const row = Array.isArray(designData) ? designData[0] : designData;
      if (row) {
        const cfg = row.design_config ?? {};
        setDesign({
          ...DEFAULT_DESIGN,
          templateId: row.template_id ?? DEFAULT_DESIGN.templateId,
          primaryColor: row.primary_color ?? DEFAULT_DESIGN.primaryColor,
          secondaryColor: row.secondary_color ?? DEFAULT_DESIGN.secondaryColor,
          backgroundColor: row.background_color ?? DEFAULT_DESIGN.backgroundColor,
          textColor: row.text_color ?? DEFAULT_DESIGN.textColor,
          buttonColor: row.button_color ?? DEFAULT_DESIGN.buttonColor,
          borderRadius: Number(row.border_radius ?? DEFAULT_DESIGN.borderRadius),
          wallpaperUrl: cfg.background_image_url ?? cfg.wallpaperUrl ?? null,
          logoUrl: cfg.logo_url ?? place?.logo_url ?? null,
          stampStyle: cfg.stamp_style ?? 'circles',
          published: Boolean(row.published),
        });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible de charger le Loyalty Studio.');
    } finally {
      setLoading(false);
      designHydratedRef.current = true;
    }
  };

  useEffect(() => {
    designHydratedRef.current = false;
    void load();
  }, [establishmentId]);

  useEffect(() => {
    if (!establishmentId) return;

    setPreviewChannelReady(false);
    const channel = supabase.channel(`loyalty-design-preview-${establishmentId}`);
    previewChannelRef.current = channel;

    void channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') setPreviewChannelReady(true);
    });

    return () => {
      previewChannelRef.current = null;
      setPreviewChannelReady(false);
      void supabase.removeChannel(channel);
    };
  }, [establishmentId]);

  const previewConfig = useMemo<LoyaltyExperienceConfig>(() => ({
    type: program.programType,
    establishmentName: establishment.name,
    logoUrl: design.logoUrl || establishment.logoUrl,
    coverImageUrl: design.wallpaperUrl,
    primaryColor: design.primaryColor,
    secondaryColor: design.secondaryColor,
    backgroundColor: design.backgroundColor,
    textColor: design.textColor,
    borderRadius: design.borderRadius,
    customerName: 'Votre client',
    pointsBalance: 720,
    pointsGoal: Math.max(1000, rewards[0]?.points_required ?? 1000),
    visits: Math.min(4, program.stampGoal),
    visitGoal: program.stampGoal,
    rewardName: program.stampRewardName || rewards[0]?.name || 'Cadeau fidélité',
    rewardDescription: program.stampRewardDescription,
    discountPercent: program.discountPercent,
    discountValidDays: program.discountValidDays,
    discountPointsThreshold: program.discountPointsThreshold,
    rewards: rewards.filter(r => r.active).map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      points_required: r.points_required,
    })) as LoyaltyExperienceReward[],
    qrValue: 'https://tapmarrakech.vercel.app/',
    templateId: design.templateId,
    published: design.published,
    stampStyle: design.stampStyle,
  }), [program, design, establishment, rewards]);

  useEffect(() => {
    if (!establishmentId || !designHydratedRef.current) return;

    if (liveDesignTimerRef.current !== null) {
      window.clearTimeout(liveDesignTimerRef.current);
    }

    liveDesignTimerRef.current = window.setTimeout(async () => {
      liveDesignTimerRef.current = null;

      const designConfig = {
        background_image_url: design.wallpaperUrl,
        wallpaperUrl: design.wallpaperUrl,
        logo_url: design.logoUrl || establishment.logoUrl,
        loyaltyType: program.programType,
        card_mode: program.programType,
        stamp_style: design.stampStyle,
        rewardName: program.stampRewardName || rewards[0]?.name || 'Cadeau fidélité',
        rewardDescription: program.stampRewardDescription,
        pointsPerCurrency: program.pointsPerCurrency,
        discountPointsThreshold: program.discountPointsThreshold,
        discountPercent: program.discountPercent,
        discountValidDays: program.discountValidDays,
      };

      const { error } = await supabase.rpc('save_loyalty_card_builder_config', {
        p_establishment_id: establishmentId,
        p_design_config: designConfig,
        p_template_id: design.templateId,
        p_primary_color: design.primaryColor,
        p_secondary_color: design.secondaryColor,
        p_background_color: design.backgroundColor,
        p_text_color: design.textColor,
        p_button_color: design.buttonColor,
        p_border_radius: design.borderRadius,
        p_published: true,
      });

      if (!error) {
        setDesign(current => current.published ? current : { ...current, published: true });
      }
    }, 180);

    return () => {
      if (liveDesignTimerRef.current !== null) {
        window.clearTimeout(liveDesignTimerRef.current);
        liveDesignTimerRef.current = null;
      }
    };
  }, [
    establishmentId,
    design,
    establishment.logoUrl,
    program.programType,
    program.stampRewardName,
    program.stampRewardDescription,
    program.pointsPerCurrency,
    program.discountPointsThreshold,
    program.discountPercent,
    program.discountValidDays,
    rewards,
  ]);

  useEffect(() => {
    if (!establishmentId || !previewChannelRef.current || !previewChannelReady) return;

    void previewChannelRef.current.send({
      type: 'broadcast',
      event: 'loyalty-design-preview',
      payload: {
        establishmentId,
        design: {
          template_id: design.templateId,
          primary_color: design.primaryColor,
          secondary_color: design.secondaryColor,
          background_color: design.backgroundColor,
          text_color: design.textColor,
          button_color: design.buttonColor,
          border_radius: design.borderRadius,
        },
        designConfig: {
          background_image_url: design.wallpaperUrl,
          wallpaperUrl: design.wallpaperUrl,
          logo_url: design.logoUrl || establishment.logoUrl,
          loyaltyType: program.programType,
          card_mode: program.programType,
          stamp_style: design.stampStyle,
          rewardName: program.stampRewardName || rewards[0]?.name || 'Cadeau fidélité',
          rewardDescription: program.stampRewardDescription,
          pointsPerCurrency: program.pointsPerCurrency,
          discountPointsThreshold: program.discountPointsThreshold,
          discountPercent: program.discountPercent,
          discountValidDays: program.discountValidDays,
        },
      },
    });
  }, [establishmentId, design, establishment.logoUrl, program, rewards, previewChannelReady]);

  const selectTemplate = (id: string) => {
    const template = WALLET_TEMPLATES[id];
    if (!template) return;

    setDesign(current => ({
      ...current,
      templateId: id,
      primaryColor: template.primary,
      secondaryColor: template.accent,
      backgroundColor: template.background,
      textColor: template.text,
      buttonColor: template.primary,
    }));
  };

  const updateColor = (key: keyof Pick<DesignState, 'primaryColor' | 'secondaryColor' | 'backgroundColor' | 'textColor' | 'buttonColor'>, value: string) => {
    setDesign(current => ({ ...current, templateId: 'custom', [key]: value }));
  };

  const uploadWallpaper = async (file: File) => {
    if (!file.type.startsWith('image/')) return;
    if (file.size > 8 * 1024 * 1024) {
      setMessage('Image trop lourde (8 Mo maximum).');
      return;
    }

    setSaving(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `loyalty-cards/${establishmentId}/wallpaper-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('promotion-images')
        .upload(path, file, { upsert: true, contentType: file.type });

      if (error) throw error;

      const { data } = supabase.storage.from('promotion-images').getPublicUrl(path);
      setDesign(current => ({ ...current, wallpaperUrl: data.publicUrl, published: false }));
      setMessage('Wallpaper prêt dans le miroir.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Upload impossible.');
    } finally {
      setSaving(false);
    }
  };

  const saveAll = async (publish: boolean) => {
    setSaving(true);
    setMessage('');

    try {
      await manager.saveProgramSettings({
        programType: program.programType,
        stampGoal: program.stampGoal,
        stampRewardName: program.stampRewardName,
        stampRewardDescription: program.stampRewardDescription,
        pointsPerCurrency: program.pointsPerCurrency,
        discountPointsThreshold: program.discountPointsThreshold,
        discountPercent: program.programType === 'POINTS_DISCOUNT' ? program.discountPercent : null,
        discountValidDays: program.discountValidDays,
        enabled: program.enabled,
      });

      await manager.saveReferralDraft(referral);
      if (publish) await manager.publishReferral();

      await saveDesign(publish);
      setDesign(current => ({ ...current, published: publish }));
      setMessage(publish ? 'Configuration publiée.' : 'Brouillon enregistré.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer.');
    } finally {
      setSaving(false);
    }
  };

  const saveDesign = async (publish: boolean) => {
    const designConfig = {
      background_image_url: design.wallpaperUrl,
      wallpaperUrl: design.wallpaperUrl,
      logo_url: design.logoUrl || establishment.logoUrl,
      loyaltyType: program.programType,
      card_mode: program.programType,
      stamp_style: design.stampStyle,
      rewardName: program.stampRewardName || rewards[0]?.name || 'Cadeau fidélité',
      rewardDescription: program.stampRewardDescription,
      pointsPerCurrency: program.pointsPerCurrency,
      discountPointsThreshold: program.discountPointsThreshold,
      discountPercent: program.discountPercent,
      discountValidDays: program.discountValidDays,
    };

    const { error } = await supabase.rpc('save_loyalty_card_builder_config', {
      p_establishment_id: establishmentId,
      p_design_config: designConfig,
      p_template_id: design.templateId,
      p_primary_color: design.primaryColor,
      p_secondary_color: design.secondaryColor,
      p_background_color: design.backgroundColor,
      p_text_color: design.textColor,
      p_button_color: design.buttonColor,
      p_border_radius: design.borderRadius,
      p_published: publish,
    });

    if (error) throw error;
  };

  const saveReward = async () => {
    if (!rewardDraft.name.trim() || rewardDraft.pointsRequired <= 0) {
      setMessage('Renseignez un nom et un seuil de points valide.');
      return;
    }

    if (rewardDraft.rewardType === 'DISCOUNT' && (rewardDraft.discountPercent <= 0 || rewardDraft.discountPercent > 20)) {
      setMessage('La réduction doit être comprise entre 1 et 20%.');
      return;
    }

    setRewardSaving(true);
    setMessage('');

    try {
      if (rewardDraft.id) {
        const { error } = await supabase
          .from('loyalty_rewards')
          .update({
            name: rewardDraft.name.trim(),
            description: rewardDraft.description.trim() || null,
            points_required: Math.floor(rewardDraft.pointsRequired),
            reward_type: rewardDraft.rewardType,
            discount_percent: rewardDraft.rewardType === 'DISCOUNT' ? rewardDraft.discountPercent : null,
            discount_max_amount: rewardDraft.rewardType === 'DISCOUNT' ? rewardDraft.discountMaxAmount : null,
          })
          .eq('id', rewardDraft.id)
          .eq('establishment_id', establishmentId);

        if (error) throw error;
        setMessage('Récompense mise à jour.');
      } else {
        const { error } = await supabase.rpc('create_loyalty_reward', {
          p_establishment_id: establishmentId,
          p_name: rewardDraft.name.trim(),
          p_description: rewardDraft.description.trim() || null,
          p_points_required: Math.floor(rewardDraft.pointsRequired),
          p_reward_type: rewardDraft.rewardType,
          p_discount_percent: rewardDraft.rewardType === 'DISCOUNT' ? rewardDraft.discountPercent : null,
          p_discount_max_amount: rewardDraft.rewardType === 'DISCOUNT' ? rewardDraft.discountMaxAmount : null,
        });

        if (error) throw error;
        setMessage('Récompense ajoutée.');
      }

      setRewardDraft(emptyReward);
      const { data, error } = await supabase
        .from('loyalty_rewards')
        .select('id,name,description,points_required,active,reward_type,discount_percent,discount_max_amount')
        .eq('establishment_id', establishmentId)
        .order('points_required', { ascending: true });

      if (error) throw error;
      setRewards(((data ?? []) as unknown as Record<string, unknown>[]).map(normalizeReward));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Impossible d’enregistrer la récompense.');
    } finally {
      setRewardSaving(false);
    }
  };

  const editReward = (reward: Reward) => {
    setRewardDraft({
      id: reward.id,
      name: reward.name,
      description: reward.description || '',
      pointsRequired: reward.points_required,
      rewardType: reward.reward_type,
      discountPercent: reward.discount_percent ?? 10,
      discountMaxAmount: reward.discount_max_amount,
    });
    setTab('rewards');
  };

  const deleteReward = async (id: string) => {
    const { error } = await supabase
      .from('loyalty_rewards')
      .delete()
      .eq('id', id)
      .eq('establishment_id', establishmentId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRewards(current => current.filter(reward => reward.id !== id));
    if (rewardDraft.id === id) setRewardDraft(emptyReward);
    setMessage('Récompense supprimée.');
  };

  const toggleReward = async (reward: Reward) => {
    const { error } = await supabase
      .from('loyalty_rewards')
      .update({ active: !reward.active })
      .eq('id', reward.id)
      .eq('establishment_id', establishmentId);

    if (error) {
      setMessage(error.message);
      return;
    }

    setRewards(current =>
      current.map(item => item.id === reward.id ? { ...item, active: !item.active } : item),
    );
  };

  const selectedTemplate = WALLET_TEMPLATES[design.templateId];

  if (loading) {
    return (
      <div className="grid min-h-[560px] place-items-center rounded-[30px] bg-[#111111]">
        <Loader2 className="animate-spin text-gold" />
      </div>
    );
  }

  return (
    <section className="rounded-[30px] border border-[#242424] bg-[#111111] p-4 shadow-soft md:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.22em] text-gold">Loyalty Studio</p>
          <h2 className="mt-1 font-display text-3xl text-[#E1C27A]">Carte fidélité</h2>
          <p className="mt-1 max-w-xl text-sm text-[#F5F5DC]">
            Un espace unique pour piloter le programme, l’acquisition et l’identité de la carte.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`hidden rounded-full px-3 py-1.5 text-[10px] font-semibold sm:inline-flex ${design.published ? 'bg-[#111111] text-[#E1C27A]' : 'bg-[#111111] text-[#F5F5DC]'}
            {design.published ? 'Publié' : 'Brouillon'}
          </span>
          <button
            type="button"
            onClick={() => void saveAll(false)}
            disabled={saving}
            className="rounded-xl border border-[#C9A45C]/20 bg-[#111111] px-4 py-2.5 text-xs font-semibold text-[#E1C27A] transition hover:bg-[#242424] disabled:opacity-50"
          >
            Enregistrer
          </button>
          <button
            type="button"
            onClick={() => void saveAll(true)}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-gold-gradient px-4 py-2.5 text-xs font-semibold text-[#050505] shadow-sm transition hover:-translate-y-0.5 disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? '...' : 'Publier'}
          </button>
        </div>
      </div>

      {message && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-[#242424] px-4 py-3 text-xs text-[#E1C27A]">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage('')} className="text-[#F5F5DC] hover:text-[#F5F5DC]">
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_390px]">
        <div className="min-w-0">
          <div className="mb-5 overflow-x-auto rounded-2xl bg-[#f3f5f2] p-1.5">
            <div className="grid min-w-[640px] grid-cols-4 gap-1">
              {TABS.map(item => {
                const Icon = item.icon;
                const active = tab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setTab(item.id)}
                    className={`group rounded-xl px-3 py-3 text-left transition ${active ? 'bg-[#111111] shadow-sm' : 'text-[#F5F5DC] hover:bg-[#111111]/60'}`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${active ? 'bg-gold-gradient text-[#050505]' : 'bg-[#111111] text-[#F5F5DC]
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0">
                        <span className={`block truncate text-xs font-bold ${active ? 'text-[#E1C27A]' : 'text-[#F5F5DC]
                        <span className="block truncate text-[9px] uppercase tracking-[.12em] text-[#F5F5DC]">{item.caption}</span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {tab === 'settings' && (
            <div className="space-y-5">
              <StudioCard eyebrow="Activation" title="Piloter le programme">
                <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#242424] p-4">
                  <div>
                    <p className="text-sm font-semibold text-[#E1C27A]">Programme fidélité</p>
                    <p className="mt-1 text-[10px] leading-4 text-[#F5F5DC]">
                      Les clients peuvent utiliser leur carte lorsque le programme est actif.
                    </p>
                  </div>
                  <Toggle checked={program.enabled} onChange={enabled => setProgram(current => ({ ...current, enabled }))} />
                </div>
              </StudioCard>

              <StudioCard eyebrow="Mécanique" title="Type de carte">
                <div className="grid gap-3 md:grid-cols-3">
                  {TYPES.map(item => {
                    const Icon = item.icon;
                    const active = program.programType === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setProgram(current => ({ ...current, programType: item.id }))}
                        className={`rounded-2xl border p-4 text-left transition ${active ? 'border-[#242424] bg-gold-gradient/[.04] ring-2 ring-[#C9A45C]/15' : 'border-[#242424] hover:border-[#C9A45C]/30'}`}
                      >
                        <Icon size={18} className={active ? 'text-gold' : 'text-[#F5F5DC] />
                        <p className="mt-3 text-sm font-semibold text-[#E1C27A]">{item.label}</p>
                        <p className="mt-1 text-[10px] leading-4 text-[#F5F5DC]">{item.description}</p>
                      </button>
                    );
                  })}
                </div>
              </StudioCard>

              <StudioCard eyebrow="Conversion" title="Taux de fidélité">
                <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-end">
                  <Field label="MAD dépensés">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={conversionMad}
                      onChange={e => {
                        const mad = Math.max(0.01, Number(e.target.value) || 0.01);
                        setConversionMad(mad);
                        setProgram(current => ({
                          ...current,
                          pointsPerCurrency: Math.max(0.01, conversionPoints / mad),
                        }));
                      }}
                      className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]"
                    />
                  </Field>
                  <span className="hidden pb-3 text-xs font-bold text-[#F5F5DC] md:block">=</span>
                  <Field label="Points gagnés">
                    <input
                      type="number"
                      min=".01"
                      step=".01"
                      value={conversionPoints}
                      onChange={e => {
                        const points = Math.max(0.01, Number(e.target.value) || 0.01);
                        setConversionPoints(points);
                        setProgram(current => ({
                          ...current,
                          pointsPerCurrency: Math.max(0.01, points / conversionMad),
                        }));
                      }}
                      className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]"
                    />
                  </Field>
                </div>
                <p className="mt-3 rounded-xl bg-[#242424] px-3 py-2.5 text-[10px] text-[#F5F5DC]">
                  Chaque {conversionMad} MAD dépensé génère {conversionPoints} point(s).
                </p>
              </StudioCard>

              {program.programType === 'STAMP' && (
                <>
                  <StudioCard eyebrow="Tampons" title="Objectif de tampons">
                    <div className="max-w-sm">
                      <Field label="Nombre de tampons à collecter">
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={program.stampGoal}
                          onChange={e => setProgram(current => ({
                            ...current,
                            stampGoal: Math.min(10, Math.max(1, Number(e.target.value) || 1)),
                          }))}
                          className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]"
                        />
                      </Field>
                      <p className="mt-3 rounded-xl bg-[#242424] px-3 py-2.5 text-[10px] leading-4 text-[#F5F5DC]">
                        Le client reçoit sa récompense automatiquement lorsqu’il atteint cet objectif.
                      </p>
                    </div>
                  </StudioCard>

                  <StudioCard eyebrow="Récompense tampon" title="Récompense après l'objectif">
                    <div className="grid gap-4 md:grid-cols-2">
                      <Field label="Nom de la récompense">
                        <input
                          value={program.stampRewardName}
                          onChange={e => setProgram(current => ({ ...current, stampRewardName: e.target.value }))}
                          placeholder="Ex. Café offert, dessert offert..."
                          className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]"
                        />
                      </Field>
                      <Field label="Description de la récompense">
                        <input
                          value={program.stampRewardDescription}
                          onChange={e => setProgram(current => ({ ...current, stampRewardDescription: e.target.value }))}
                          placeholder="Ex. Un café ou un dessert au choix"
                          className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]"
                        />
                      </Field>
                    </div>
                    <div className="mt-4 rounded-xl border border-gold/20 bg-gold/5 px-4 py-3">
                      <p className="text-[10px] font-semibold text-[#E1C27A]">Récompense dédiée aux tampons</p>
                      <p className="mt-1 text-[10px] leading-4 text-[#F5F5DC]">
                        Cette récompense est indépendante du catalogue des récompenses en points.
                      </p>
                    </div>
                  </StudioCard>
                </>
              )}

              {program.programType === 'POINTS_DISCOUNT' && (
                <StudioCard eyebrow="Réduction" title="Déblocage de l'avantage">
                  <div className="grid gap-4 md:grid-cols-3">
                    <Field label="Seuil de points">
                      <input
                        type="number"
                        min="1"
                        value={program.discountPointsThreshold}
                        onChange={e => setProgram(current => ({
                          ...current,
                          discountPointsThreshold: Math.max(1, Number(e.target.value) || 1),
                        }))}
                        className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]"
                      />
                    </Field>
                    <Field label="Réduction">
                      <div className="relative">
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={program.discountPercent}
                          onChange={e => setProgram(current => ({
                            ...current,
                            discountPercent: Math.min(100, Math.max(1, Number(e.target.value) || 1)),
                          }))}
                          className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC] pr-10"
                        />
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-[#F5F5DC]">%</span>
                      </div>
                    </Field>
                    <Field label="Validité de la carte">
                      <select
                        value={program.discountValidDays}
                        onChange={e => setProgram(current => ({
                          ...current,
                          discountValidDays: Number(e.target.value),
                        }))}
                        className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15"
                      >
                        <option value={1}>24 heures</option>
                        <option value={7}>7 jours</option>
                        <option value={15}>15 jours</option>
                        <option value={30}>30 jours</option>
                        <option value={60}>60 jours</option>
                        <option value={90}>90 jours</option>
                        <option value={180}>6 mois</option>
                        <option value={365}>1 an</option>
                      </select>
                      <p className="mt-2 text-[10px] leading-4 text-[#F5F5DC]">
                        La durée démarre automatiquement lorsque le client atteint {program.discountPointsThreshold.toLocaleString('fr-FR')} points.
                        La date d’expiration sera affichée sur sa carte dès que la réduction est débloquée.
                      </p>
                    </Field>
                  </div>
                </StudioCard>
              )}
            </div>
          )}

          {tab === 'rewards' && (
            <div className="space-y-5">
              <StudioCard eyebrow="Catalogue" title="Récompenses">
                <div className="mb-5 grid gap-3 md:grid-cols-3">
                  <Metric label="Récompenses" value={rewards.length} />
                  <Metric label="Actives" value={rewards.filter(reward => reward.active).length} />
                  <Metric label="Plus petit seuil" value={rewards.length ? `${Math.min(...rewards.map(r => r.points_required))} pts` : '—'} />
                </div>

                <div className="space-y-2">
                  {rewards.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-[#242424] px-5 py-10 text-center">
                      <Gift className="mx-auto text-[#F5F5DC]" size={22} />
                      <p className="mt-3 text-sm font-semibold text-[#E1C27A]">Votre catalogue est vide</p>
                      <p className="mt-1 text-[10px] text-[#F5F5DC]">Ajoutez votre première récompense ci-dessous.</p>
                    </div>
                  )}

                  {rewards.map(reward => (
                    <div key={reward.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#242424] bg-[#fafaf8] p-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#111111] text-gold shadow-sm">
                        {reward.reward_type === 'DISCOUNT' ? <Percent size={16} /> : <Gift size={16} />}
                      </span>
                      <div className="min-w-[150px] flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-xs font-semibold text-[#E1C27A]">{reward.name}</p>
                          <span className={`rounded-full px-2 py-0.5 text-[8px] font-bold uppercase tracking-[.12em] ${reward.active ? 'bg-[#111111] text-[#E1C27A]' : 'bg-[#111111] text-[#F5F5DC]'}
                            {reward.active ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-[#F5F5DC]">
                          {reward.points_required} points · {reward.reward_type === 'DISCOUNT' ? `${reward.discount_percent ?? 0}% de réduction` : 'Cadeau'}
                        </p>
                        {reward.description && <p className="mt-1 truncate text-[10px] text-[#F5F5DC]">{reward.description}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => void toggleReward(reward)} className="rounded-lg px-2.5 py-2 text-[10px] font-semibold text-[#F5F5DC] hover:bg-[#111111] hover:text-[#E1C27A]">
                          {reward.active ? 'Désactiver' : 'Activer'}
                        </button>
                        <button type="button" onClick={() => editReward(reward)} className="rounded-lg px-2.5 py-2 text-[10px] font-semibold text-[#E1C27A] hover:bg-[#111111]">
                          Modifier
                        </button>
                        <button type="button" onClick={() => void deleteReward(reward.id)} className="rounded-lg p-2 text-[#F5F5DC] hover:bg-[#111111] hover:text-[#E1C27A]">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </StudioCard>

              <StudioCard eyebrow={rewardDraft.id ? 'Édition' : 'Nouveau'} title={rewardDraft.id ? 'Modifier la récompense' : 'Ajouter une récompense'}>
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Nom">
                    <input value={rewardDraft.name} onChange={e => setRewardDraft(current => ({ ...current, name: e.target.value }))} placeholder="Ex. Dessert offert" className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]" />
                  </Field>
                  <Field label="Points requis">
                    <input type="number" min="1" value={rewardDraft.pointsRequired} onChange={e => setRewardDraft(current => ({ ...current, pointsRequired: Math.max(1, Number(e.target.value) || 1) }))} className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]" />
                  </Field>
                  <Field label="Type">
                    <select value={rewardDraft.rewardType} onChange={e => setRewardDraft(current => ({ ...current, rewardType: e.target.value as RewardType }))} className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]">
                      <option value="GIFT">Cadeau</option>
                      <option value="DISCOUNT">Réduction</option>
                    </select>
                  </Field>
                  {rewardDraft.rewardType === 'DISCOUNT' && (
                    <>
                      <Field label="Pourcentage de réduction">
                        <input type="number" min="1" max="20" value={rewardDraft.discountPercent} onChange={e => setRewardDraft(current => ({ ...current, discountPercent: Math.min(20, Math.max(1, Number(e.target.value) || 1)) }))} className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]" />
                      </Field>
                      <Field label="Plafond de réduction (MAD)">
                        <input type="number" min="0" value={rewardDraft.discountMaxAmount ?? ''} onChange={e => setRewardDraft(current => ({ ...current, discountMaxAmount: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) }))} className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]" placeholder="Optionnel" />
                      </Field>
                    </>
                  )}
                  <div className="md:col-span-2">
                    <Field label="Description">
                      <textarea value={rewardDraft.description} onChange={e => setRewardDraft(current => ({ ...current, description: e.target.value }))} rows={3} className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC] resize-none" placeholder="Ce que le client reçoit..." />
                    </Field>
                  </div>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  {rewardDraft.id && (
                    <button type="button" onClick={() => setRewardDraft(emptyReward)} className="rounded-xl border border-[#242424] px-4 py-2.5 text-xs font-semibold text-[#F5F5DC]">
                      Annuler
                    </button>
                  )}
                  <button type="button" onClick={() => void saveReward()} disabled={rewardSaving} className="inline-flex items-center gap-2 rounded-xl bg-gold-gradient px-4 py-2.5 text-xs font-semibold text-[#050505] disabled:opacity-50">
                    <Gift size={14} />
                    {rewardSaving ? 'Enregistrement...' : rewardDraft.id ? 'Mettre à jour' : 'Ajouter'}
                  </button>
                </div>
              </StudioCard>
            </div>
          )}

          {tab === 'referral' && (
            <div className="space-y-5">
              <StudioCard eyebrow="Acquisition" title="Transformer les clients en ambassadeurs">
                <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                  <div className="rounded-2xl bg-[#242424] p-4">
                    <div className="flex items-start gap-3">
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#111111] text-gold shadow-sm">
                        <UserPlus size={17} />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-[#E1C27A]">Programme de parrainage</p>
                        <p className="mt-1 text-[10px] leading-4 text-[#F5F5DC]">
                          Récompensez le parrain et le nouveau client après leur mise en relation.
                        </p>
                      </div>
                    </div>
                  </div>
                  <Toggle checked={referral.enabled} onChange={enabled => setReferral(current => ({ ...current, enabled }))} />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ReferralField
                    label="Bonus du parrain"
                    type={referral.referrer_bonus_type}
                    value={referral.referrer_bonus_value}
                    onChange={(type, value) => setReferral(current => ({ ...current, referrer_bonus_type: type, referrer_bonus_value: value }))}
                  />
                  <ReferralField
                    label="Bonus du filleul"
                    type={referral.referee_bonus_type}
                    value={referral.referee_bonus_value}
                    onChange={(type, value) => setReferral(current => ({ ...current, referee_bonus_type: type, referee_bonus_value: value }))}
                  />
                </div>

                <div className="mt-4">
                  <Field label="Limite maximale de parrainages par client">
                    <div className="relative max-w-sm">
                      <input
                        type="number"
                        min="0"
                        value={referral.max_referrals ?? ''}
                        onChange={e => setReferral(current => ({
                          ...current,
                          max_referrals: e.target.value === '' ? null : Math.max(0, Math.floor(Number(e.target.value) || 0)),
                        }))}
                        placeholder="Illimité"
                        className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC] pr-20"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-[#F5F5DC]">par client</span>
                    </div>
                  </Field>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  <Metric label="Clients acquis" value={referralStats} icon={<UserPlus size={15} />} />
                  <Metric label="Bonus parrain" value={bonusLabel(referral.referrer_bonus_type, referral.referrer_bonus_value)} />
                  <Metric label="Bonus filleul" value={bonusLabel(referral.referee_bonus_type, referral.referee_bonus_value)} />
                </div>
              </StudioCard>

              <div className="rounded-2xl border border-[#242424] bg-[#242424] p-4 text-[10px] leading-5 text-[#F5F5DC]">
                Les changements sont conservés avec le bouton <strong className="text-[#E1C27A]">Enregistrer</strong>. Le miroir de droite reflète immédiatement les paramètres qui modifient la carte.
              </div>
            </div>
          )}

          {tab === 'design' && (
            <div className="space-y-5">
              <StudioCard eyebrow="Wallet" title="Choisir une identité">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Object.values(WALLET_TEMPLATES).map(item => {
                    const active = design.templateId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => selectTemplate(item.id)}
                        className={`overflow-hidden rounded-2xl border text-left transition ${active ? 'border-[#242424] ring-2 ring-[#C9A45C]/15' : 'border-[#242424] hover:border-[#C9A45C]/30'}`}
                      >
                        <div className="relative h-20 overflow-hidden" style={{ background: item.background }}>
                          <div className="absolute inset-x-3 bottom-3 h-1 rounded-full" style={{ background: item.accent }} />
                        </div>
                        <div className="bg-[#111111] px-3 py-2.5">
                          <p className="text-[10px] font-semibold text-[#E1C27A]">{item.name}</p>
                        </div>
                      </button>
                    );
                  })}
                </div>
                {selectedTemplate && (
                  <p className="mt-3 text-[10px] text-[#F5F5DC]">
                    Template actif : <span className="font-semibold text-[#E1C27A]">{selectedTemplate.name}</span>
                  </p>
                )}
              </StudioCard>

              <StudioCard eyebrow="Wallpaper" title="Arrière-plan de la carte">
                <div className="grid gap-4 md:grid-cols-[1fr_220px] md:items-center">
                  <div>
                    <p className="text-sm font-semibold text-[#E1C27A]">Image immersive</p>
                    <p className="mt-1 text-[10px] leading-4 text-[#F5F5DC]">
                      Le wallpaper est recadré automatiquement en cover pour rester élégant sur mobile et desktop.
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button type="button" onClick={() => wallpaperInput.current?.click()} className="inline-flex items-center gap-2 rounded-xl border border-[#C9A45C]/20 bg-[#111111] px-4 py-2.5 text-xs font-semibold text-[#E1C27A]">
                        <ImagePlus size={14} />
                        {design.wallpaperUrl ? 'Remplacer' : 'Choisir une image'}
                      </button>
                      {design.wallpaperUrl && (
                        <button type="button" onClick={() => setDesign(current => ({ ...current, wallpaperUrl: null, published: false }))} className="rounded-xl border border-[#242424] px-4 py-2.5 text-xs font-semibold text-[#E1C27A]">
                          Retirer
                        </button>
                      )}
                    </div>
                    <input ref={wallpaperInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void uploadWallpaper(file); e.currentTarget.value = ''; }} />
                  </div>
                  <div className="h-28 overflow-hidden rounded-2xl bg-[#111111]">
                    {design.wallpaperUrl ? <img src={design.wallpaperUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] text-[#F5F5DC]">Aucun wallpaper</div>}
                  </div>
                </div>
              </StudioCard>

              <StudioCard eyebrow="Palette" title="Couleurs personnalisées">
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <ColorField label="Primaire" value={design.primaryColor} onChange={value => updateColor('primaryColor', value)} />
                  <ColorField label="Secondaire / accent" value={design.secondaryColor} onChange={value => updateColor('secondaryColor', value)} />
                  <ColorField label="Fond" value={design.backgroundColor} onChange={value => updateColor('backgroundColor', value)} />
                  <ColorField label="Texte" value={design.textColor} onChange={value => updateColor('textColor', value)} />
                  <ColorField label="Bouton" value={design.buttonColor} onChange={value => updateColor('buttonColor', value)} />
                </div>
                <div className="mt-5">
                  <Field label={`Rayon des angles · ${design.borderRadius}px`}>
                    <input type="range" min="8" max="40" value={design.borderRadius} onChange={e => setDesign(current => ({ ...current, templateId: 'custom', borderRadius: Number(e.target.value) }))} className="w-full accent-forest" />
                  </Field>
                </div>
                <div className="mt-5">
                  <Field label="Style des tampons">
                    <div className="grid grid-cols-4 gap-2">
                      {(['circles', 'squares', 'stars', 'hearts'] as const).map(style => (
                        <button key={style} type="button" onClick={() => setDesign(current => ({ ...current, stampStyle: style }))} className={`rounded-xl border px-2 py-2.5 text-[10px] font-semibold capitalize ${design.stampStyle === style ? 'border-[#242424] bg-gold-gradient text-[#050505]' : 'border-[#242424] text-[#F5F5DC]
                          {style === 'circles' ? 'Ronds' : style === 'squares' ? 'Carrés' : style === 'stars' ? 'Étoiles' : 'Cœurs'}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </StudioCard>
            </div>
          )}
        </div>

        <aside className="sticky top-6 h-fit overflow-hidden rounded-[30px] bg-[#050505] p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[.24em] text-gold">Le Miroir</p>
              <p className="mt-1 text-xs text-[#F5F5DC]">Aperçu permanent et synchronisé</p>
            </div>
            <span className="rounded-full bg-[#111111] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[.12em] text-[#E1C27A]">
              {TABS.find(item => item.id === tab)?.label}
            </span>
          </div>

          <div className="flex min-h-[500px] w-full items-center justify-center overflow-visible rounded-[24px] bg-[#111111]/[.03] p-3 sm:min-h-[560px]">
            <LoyaltyPreview config={previewConfig} />
          </div>

          <div className="mt-4 rounded-2xl bg-[#111111] p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] uppercase tracking-[.16em] text-gold">Carte actuelle</p>
                <p className="mt-1 text-sm font-semibold text-[#E1C27A]">{establishment.name}</p>
              </div>
              <span className={`h-2.5 w-2.5 rounded-full ${previewChannelReady ? 'bg-[#C9A45C]' : 'bg-[#242424]'} title={previewChannelReady ? 'Synchronisation active' : 'Connexion en cours'} />
            </div>
            <p className="mt-2 text-[10px] leading-4 text-[#F5F5DC]">
              {program.programType === 'STAMP'
                ? `${program.stampGoal} tampons`
                : program.programType === 'POINTS_DISCOUNT'
                  ? `${program.discountPointsThreshold} points · ${program.discountPercent}%`
                  : `${program.pointsPerCurrency} point(s) / MAD`}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function StudioCard({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[24px] border border-[#242424] bg-[#111111] p-5 shadow-[0_10px_35px_rgba(20,30,24,0.035)]">
      <div className="mb-5">
        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gold">{eyebrow}</p>
        <h3 className="mt-1 text-lg font-semibold text-[#E1C27A]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-[.1em] text-[#F5F5DC]">
      {label}
      {children}
    </label>
  );
}

function Metric({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[#242424] bg-[#111111] p-3.5">
      <div className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.12em] text-[#F5F5DC]">
        {icon}
        {label}
      </div>
      <p className="mt-2 text-lg font-semibold text-[#E1C27A]">{value}</p>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full p-1 transition ${checked ? 'bg-gold-gradient' : 'bg-[#111111]
    >
      <span className={`block h-5 w-5 rounded-full bg-[#111111] shadow-sm transition ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-[.1em] text-[#F5F5DC]">
      {label}
      <div className="mt-2 flex items-center gap-2 rounded-xl border border-[#242424] bg-[#111111] p-2">
        <input type="color" value={value} onChange={e => onChange(e.target.value)} className="h-9 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" />
        <input value={value} onChange={e => onChange(e.target.value)} className="min-w-0 flex-1 bg-transparent px-1 text-xs font-semibold uppercase text-[#E1C27A] outline-none" />
      </div>
    </label>
  );
}

function ReferralField({
  label,
  type,
  value,
  onChange,
}: {
  label: string;
  type: LoyaltyReferralBonusType;
  value: number;
  onChange: (type: LoyaltyReferralBonusType, value: number) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-[#F5F5DC]">{label}</p>
      <div className="mt-2 grid grid-cols-[1fr_110px] gap-2">
        <select value={type} onChange={e => onChange(e.target.value as LoyaltyReferralBonusType, value)} className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]">
          <option value="POINTS">Points</option>
          <option value="STAMP">Tampons</option>
          <option value="REDUCTION">Réduction</option>
        </select>
        <input
          type="number"
          min="0"
          value={value}
          onChange={e => onChange(type, Math.max(0, Number(e.target.value) || 0))}
          className="h-12 w-full rounded-xl border border-[#242424] bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none transition focus:border-[#242424] focus:ring-2 focus:ring-[#C9A45C]/15 placeholder:text-[#F5F5DC]"
        />
      </div>
    </div>
  );
}
