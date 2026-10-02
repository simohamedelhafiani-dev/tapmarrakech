import { useEffect, useRef, useState } from 'react';
import { Check, Gift, ImagePlus, Link2, Loader2, Pencil, Plus, QrCode, Share2, Stamp, Trash2, Upload, X } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { defaultLoyaltyDesignConfig, type LoyaltyDesignConfig } from './LoyaltyCardVisual';
import { type LoyaltyExperienceConfig } from './loyalty/LoyaltyExperience';
import LoyaltyPreview from './loyalty/LoyaltyPreview';
import { useLoyaltyManager, type LoyaltyReferralBonusType, type LoyaltyReferralConfig } from '@/hooks/useLoyaltyManager';

type CardMode = 'STAMP' | 'POINTS_REWARD' | 'POINTS_DISCOUNT';

type LoyaltyRewardAdmin = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
  reward_type: 'GIFT' | 'DISCOUNT';
  discount_percent: number | null;
  discount_max_amount: number | null;
  valid_days: string[];
};

type LoyaltyPreset = {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  background: string;
  text: string;
  radius: number;
  mode: CardMode;
  title: string;
  subtitle: string;
  stampStyle: LoyaltyDesignConfig['stamp_style'];
};

const LOYALTY_PRESETS: LoyaltyPreset[] = [
  { id: 'obsidian', name: '01 — Obsidian', description: 'Fond photo immersif, contraste cinématique, or discret et composition luxe pour restaurants et lounges.', primary: '#0A0A09', secondary: '#D6B15A', background: '#111111', text: '#FFFFFF', radius: 30, mode: 'QR', title: 'Bon goût. Belles rencontres.', subtitle: 'Votre fidélité mérite une expérience à part.', stampStyle: 'circles' },
  { id: 'editorial', name: '02 — Editorial', description: 'Direction artistique éditoriale : ivoire, typographie magazine, espace négatif et détails champagne.', primary: '#3B332B', secondary: '#C9A86A', background: '#F4EDE1', text: '#17130F', radius: 30, mode: 'QR', title: 'Des moments qui comptent.', subtitle: 'Une expérience pensée pour vous.', stampStyle: 'circles' },
  { id: 'glass', name: '03 — Glass', description: 'Photo plein écran, surfaces vitrées, blur et lumière pour une esthétique wellness ultra premium.', primary: '#18372C', secondary: '#D8C28A', background: '#10251E', text: '#FFFFFF', radius: 30, mode: 'QR', title: 'Prendre soin de vous, toujours.', subtitle: 'Vos avantages évoluent avec vous.', stampStyle: 'circles' },
  { id: 'titanium', name: '04 — Titanium', description: 'Noir profond, reflets métalliques et signature gold pour une carte au caractère exclusif.', primary: '#11110F', secondary: '#D6B15A', background: '#10100F', text: '#FFFFFF', radius: 26, mode: 'QR', title: 'GOOD FOOD. BETTER PEOPLE.', subtitle: 'Elevate every visit.', stampStyle: 'squares' },
  { id: 'hospitality', name: '05 — Hospitality', description: 'Univers hôtel, restaurant et travel : photographie immersive, chaleur et statut membre.', primary: '#3A2115', secondary: '#E2B66D', background: '#2B1B13', text: '#FFFFFF', radius: 30, mode: 'QR', title: 'Plus qu’un repas, une expérience.', subtitle: 'Saveurs. Partage. Souvenirs.', stampStyle: 'circles' },
  { id: 'apple-wallet', name: '06 — Apple Wallet', description: 'Minimalisme premium, hiérarchie typographique et lecture instantanée sur mobile.', primary: '#403A32', secondary: '#B9975B', background: '#F2EEE6', text: '#1B1A18', radius: 28, mode: 'QR', title: 'Beauty in every detail.', subtitle: 'Vos privilèges, toujours avec vous.', stampStyle: 'circles' },
  { id: 'wallet', name: '07 — Premium Wallet', description: 'Carte Wallet haut de gamme : verre fumé, lumière diagonale, hiérarchie premium et QR central.', primary: '#0B0B0B', secondary: '#D6B15A', background: '#1A1A1A', text: '#FFFFFF', radius: 36, mode: 'QR', title: 'Votre fidélité, toujours avec vous.', subtitle: 'Une expérience Wallet premium.', stampStyle: 'circles' },
  { id: 'onyx-black', name: '08 — Onyx Black', description: 'Wallet noir profond, contraste net et finition premium.', primary: '#181818', secondary: '#D7D7D7', background: '#070707', text: '#FFFFFF', radius: 36, mode: 'QR', title: 'Votre fidélité, toujours avec vous.', subtitle: 'Une expérience Wallet premium.', stampStyle: 'circles' },
  { id: 'royal-gold', name: '09 — Royal Gold', description: 'Wallet noir chaud et signature or pour une expérience luxe.', primary: '#6E4B18', secondary: '#D6B15A', background: '#17110A', text: '#FFF8E8', radius: 36, mode: 'QR', title: 'Votre fidélité, toujours avec vous.', subtitle: 'Une expérience Wallet premium.', stampStyle: 'circles' },
  { id: 'deep-ocean', name: '10 — Deep Ocean', description: 'Wallet bleu profond avec effet verre et lumière froide.', primary: '#0D4050', secondary: '#6FD3E8', background: '#061923', text: '#F4FCFF', radius: 36, mode: 'QR', title: 'Votre fidélité, toujours avec vous.', subtitle: 'Une expérience Wallet premium.', stampStyle: 'circles' },
  { id: 'minimal-white', name: '11 — Minimal White', description: 'Wallet clair minimaliste, moderne et ultra lisible.', primary: '#FFFFFF', secondary: '#777777', background: '#F5F5F2', text: '#151515', radius: 36, mode: 'QR', title: 'Votre fidélité, toujours avec vous.', subtitle: 'Une expérience Wallet premium.', stampStyle: 'circles' },
  { id: 'forest-green', name: '12 — Forest Green', description: 'Wallet vert profond inspiré des univers premium hospitality.', primary: '#164D3A', secondary: '#B9D8A4', background: '#071A14', text: '#F7FFF9', radius: 36, mode: 'QR', title: 'Votre fidélité, toujours avec vous.', subtitle: 'Une expérience Wallet premium.', stampStyle: 'circles' },
  { id: 'ruby-red', name: '13 — Ruby Red', description: 'Wallet rouge rubis profond avec signature éditoriale.', primary: '#6D1724', secondary: '#E8A0A8', background: '#21080D', text: '#FFF5F5', radius: 36, mode: 'QR', title: 'Votre fidélité, toujours avec vous.', subtitle: 'Une expérience Wallet premium.', stampStyle: 'circles' },
  { id: 'silver-chrome', name: '14 — Silver Chrome', description: 'Wallet chrome argenté avec reflets métalliques.', primary: '#BFC4C9', secondary: '#F5F5F5', background: '#777B80', text: '#FFFFFF', radius: 36, mode: 'QR', title: 'Votre fidélité, toujours avec vous.', subtitle: 'Une expérience Wallet premium.', stampStyle: 'circles' },
  { id: 'midnight-blue', name: '15 — Midnight Blue', description: 'Wallet bleu nuit avec effet verre et profondeur.', primary: '#17275F', secondary: '#9DB7FF', background: '#080D24', text: '#F4F7FF', radius: 36, mode: 'QR', title: 'Votre fidélité, toujours avec vous.', subtitle: 'Une expérience Wallet premium.', stampStyle: 'circles' },
];

type Design = {
  template_id: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  text_color: string;
  button_color: string;
  border_radius: number;
  design_config: LoyaltyDesignConfig;
  published: boolean;
};

const baseDesign: Design = {
  template_id: 'onyx-black',
  primary_color: '#0B3327',
  secondary_color: '#D6B15A',
  background_color: '#F7F7F3',
  text_color: '#FFFFFF',
  button_color: '#173D32',
  border_radius: 24,
  design_config: {
    ...defaultLoyaltyDesignConfig,
    card_mode: 'QR',
    front_title: 'CARTE FIDÉLITÉ',
    front_subtitle: 'Merci de faire partie de notre histoire !',
  },
  published: false,
};

export default function LoyaltyProgramCustomization({ establishmentId }: { establishmentId: string }) {
  const [design, setDesign] = useState<Design>(baseDesign);
  const [establishment, setEstablishment] = useState<{ name: string; logo_url: string | null; business_type: string | null }>({ name: 'Votre établissement', logo_url: null, business_type: null });
  const [cardMode, setCardMode] = useState<CardMode>('POINTS_REWARD');
  const [stampGoal, setStampGoal] = useState('10');
  const [stampRewardName, setStampRewardName] = useState('Cadeau fidélité');
  const [stampRewardDescription, setStampRewardDescription] = useState('');
  const [pointsPerCurrency, setPointsPerCurrency] = useState('1');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [discountValidDays, setDiscountValidDays] = useState('7');
  const [discountPointsThreshold, setDiscountPointsThreshold] = useState('1000');
  const [programEnabled, setProgramEnabled] = useState(true);
  const [rewards, setRewards] = useState<LoyaltyRewardAdmin[]>([]);
  const [previewCustomer, setPreviewCustomer] = useState<{ id: string; first_name: string | null; points_balance: number; visit_count: number; stamps_balance: number } | null>(null);
  const [previewTransactions, setPreviewTransactions] = useState<Array<{ id: string; description: string | null; created_at: string; points: number }>>([]);
  const [availableTemplates, setAvailableTemplates] = useState<LoyaltyPreset[]>(LOYALTY_PRESETS);
  const [rewardEditorOpen, setRewardEditorOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyRewardAdmin | null>(null);
  const [rewardName, setRewardName] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [rewardPoints, setRewardPoints] = useState('500');
  const [rewardType, setRewardType] = useState<'GIFT' | 'DISCOUNT'>('GIFT');
  const [discountMaxAmount, setDiscountMaxAmount] = useState('');
  const [validDays, setValidDays] = useState<string[]>(['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']);
  const [rewardSaving, setRewardSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'photo' | 'wallpapers' | null>(null);
  const [activeTab, setActiveTab] = useState<'Structure' | 'Acquisition' | 'Design'>('Structure');
  const [referralDraft, setReferralDraft] = useState<LoyaltyReferralConfig>({
    enabled: false,
    referrer_bonus_type: 'POINTS',
    referrer_bonus_value: 50,
    referee_bonus_type: 'POINTS',
    referee_bonus_value: 0,
    max_referrals: null,
    referrer_bonus_points: 50,
    referee_bonus_points: 0,
  });
  const [referralPublished, setReferralPublished] = useState<LoyaltyReferralConfig>({
    enabled: false,
    referrer_bonus_type: 'POINTS',
    referrer_bonus_value: 50,
    referee_bonus_type: 'POINTS',
    referee_bonus_value: 0,
    max_referrals: null,
    referrer_bonus_points: 50,
    referee_bonus_points: 0,
  });
  const [referralAcquiredCount, setReferralAcquiredCount] = useState(0);
  const [referralSaving, setReferralSaving] = useState(false);
  const [referralInviteOpen, setReferralInviteOpen] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [referralGenerating, setReferralGenerating] = useState(false);
  const [referralCopied, setReferralCopied] = useState(false);
  const [masterQrDataUrl, setMasterQrDataUrl] = useState('');
  const [masterLinkCopied, setMasterLinkCopied] = useState(false);

  const {
    generateReferralCode,
    getProgramSettings,
    getReferralConfig,
    saveReferralDraft,
    publishReferral,
    getReferralStats,
  } = useLoyaltyManager(establishmentId);
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const wallpapersInput = useRef<HTMLInputElement>(null);

  async function load() {
    if (!establishmentId) return;
    const [{ data: designData }, { data: place }, { data: programData }, { data: rewardData }, { data: templateRows }, { data: customerRows }, { data: transactionRows }] = await Promise.all([
      supabase.rpc('get_loyalty_card_builder_config', { p_establishment_id: establishmentId }),
      supabase.from('establishments').select('name,logo_url,business_type').eq('id', establishmentId).maybeSingle(),
      supabase.rpc('get_loyalty_program_settings', { p_establishment_id: establishmentId }),
      supabase.from('loyalty_rewards').select('id,name,description,points_required,active,reward_type,discount_percent,discount_max_amount,valid_days').eq('establishment_id', establishmentId).order('points_required', { ascending: true }),
      supabase.from('templates').select('id,name,description,config').eq('kind', 'loyalty').eq('active', true).order('name'),
      supabase.from('loyalty_customers').select('id,first_name,points_balance,visit_count,stamps_balance').eq('establishment_id', establishmentId).order('created_at', { ascending: false }).limit(1),
      supabase.from('loyalty_transactions').select('id,description,created_at,points').eq('establishment_id', establishmentId).order('created_at', { ascending: false }).limit(6),
    ]);

    const row = Array.isArray(designData) ? designData[0] : designData;
    if (row) {
      const nextConfig = { ...defaultLoyaltyDesignConfig, ...(row.design_config ?? {}) };
      setDesign({
        template_id: row.template_id ?? baseDesign.template_id,
        primary_color: row.primary_color ?? baseDesign.primary_color,
        secondary_color: row.secondary_color ?? baseDesign.secondary_color,
        background_color: row.background_color ?? baseDesign.background_color,
        text_color: row.text_color ?? baseDesign.text_color,
        button_color: row.button_color ?? baseDesign.button_color,
        border_radius: Number(row.border_radius ?? baseDesign.border_radius),
        design_config: nextConfig,
        published: Boolean(row.published),
      });
      setCardMode(nextConfig.card_mode === 'STAMP' ? 'STAMP' : nextConfig.card_mode === 'POINTS_DISCOUNT' ? 'POINTS_DISCOUNT' : 'POINTS_REWARD');
    }
    if (place) setEstablishment({ name: place.name || 'Votre établissement', logo_url: place.logo_url || null, business_type: place.business_type || null });
    setRewards((rewardData ?? []) as LoyaltyRewardAdmin[]);
    setPreviewCustomer((customerRows?.[0] as { id: string; first_name: string | null; points_balance: number; visit_count: number; stamps_balance: number } | undefined) ?? null);
    setPreviewTransactions((transactionRows ?? []) as Array<{ id: string; description: string | null; created_at: string; points: number }>);
    if (templateRows?.length) {
      const mapped = (templateRows as Array<{ id: string; name: string; description: string | null; config: Record<string, any> }>).map((row) => {
        const c = row.config || {};
        return {
          id: c.key || row.id,
          name: row.name,
          description: row.description || '',
          primary: c.primary || '#173D32',
          secondary: c.secondary || '#D3A84C',
          background: c.background || '#F7F7F3',
          text: c.text || '#FFFFFF',
          radius: Number(c.radius || 28),
          mode: c.mode === 'STAMP' ? 'STAMP' : 'QR',
          title: c.title || 'Votre fidélité, autrement.',
          subtitle: c.subtitle || 'Vos avantages, toujours avec vous.',
          stampStyle: c.stampStyle || 'circles',
        } as LoyaltyPreset;
      });
      const presetIds = new Set(LOYALTY_PRESETS.map(template => template.id));
      setAvailableTemplates([
        ...LOYALTY_PRESETS,
        ...mapped.filter(template => !presetIds.has(template.id)),
      ]);
    } else {
      setAvailableTemplates(LOYALTY_PRESETS);
    }

    const program = Array.isArray(programData) ? programData[0] : programData;
    if (program) {
      setStampGoal(String(program.stamp_goal ?? 10));
      setStampRewardName(program.stamp_reward_name ?? 'Cadeau fidélité');
      setStampRewardDescription(program.stamp_reward_description ?? '');
      setPointsPerCurrency(String(program.points_per_currency ?? 1));
       setDiscountPercent(String(program.discount_percent ?? 10));
       setDiscountValidDays(String(program.discount_valid_days ?? 7));
       setDiscountPointsThreshold(String(program.discount_points_threshold ?? 1000));
      setProgramEnabled(Boolean(program.enabled ?? true));
      if (!row?.design_config?.card_mode) setCardMode(program.program_type === 'STAMP' ? 'STAMP' : program.program_type === 'POINTS_DISCOUNT' ? 'POINTS_DISCOUNT' : 'POINTS_REWARD');
    }
  }

  useEffect(() => { void load(); }, [establishmentId]);

  useEffect(() => {
    let cancelled = false;
    if (!establishmentId) return;

    void Promise.all([getReferralConfig(), getReferralStats()])
      .then(([config, stats]) => {
        if (cancelled) return;
        setReferralDraft(config.draftConfig);
        setReferralPublished(config.publishedConfig);
        setReferralAcquiredCount(stats.acquiredCount);
      })
      .catch(error => {
        console.error('Impossible de charger la configuration de parrainage:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [establishmentId, getReferralConfig, getReferralStats]);

  useEffect(() => {
    if (!establishmentId) {
      setMasterQrDataUrl('');
      return;
    }

    let active = true;
    const url = window.location.origin + '/loyalty/join?est=' + encodeURIComponent(establishmentId);

    void QRCode.toDataURL(url, {
      width: 260,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#173D32', light: '#FFFFFF' },
    }).then(dataUrl => {
      if (active) setMasterQrDataUrl(dataUrl);
    }).catch(error => {
      console.error('Impossible de générer le QR maître:', error);
      if (active) setMasterQrDataUrl('');
    });

    return () => {
      active = false;
    };
  }, [establishmentId]);

  function masterEnrollmentUrl() {
    return window.location.origin + '/loyalty/join?est=' + encodeURIComponent(establishmentId);
  }

  async function copyMasterEnrollmentLink() {
    const url = masterEnrollmentUrl();
    try {
      await navigator.clipboard.writeText(url);
      setMasterLinkCopied(true);
      window.setTimeout(() => setMasterLinkCopied(false), 1800);
    } catch {
      alert('Impossible de copier le lien NFC.');
    }
  }

  function openRewardEditor(reward?: LoyaltyRewardAdmin) {
    setEditingReward(reward ?? null);
    setRewardName(reward?.name ?? '');
    setRewardDescription(reward?.description ?? '');
    setRewardPoints(String(reward?.points_required ?? 500));
    setValidDays(reward?.valid_days?.length ? reward.valid_days : ['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']);
    setRewardType(reward?.reward_type ?? 'GIFT');
    setDiscountPercent(String(reward?.discount_percent ?? 10));
    setDiscountMaxAmount(reward?.discount_max_amount != null ? String(reward.discount_max_amount) : '');
    setRewardEditorOpen(true);
  }

  async function saveReward() {
    const points = Number(rewardPoints);
    if (!rewardName.trim() || !Number.isInteger(points) || points <= 0) return alert('Indique un nom et un nombre de points valide.');
    const discount = Number(discountPercent);
    if (rewardType === 'DISCOUNT' && (!Number.isFinite(discount) || discount <= 0 || discount > 20)) return alert('La réduction doit être comprise entre 0 et 20 %.');
    setRewardSaving(true);
    let error: { message: string } | null = null;
    let createdRewardId: string | null = null;
    if (editingReward) {
      const result = await supabase.rpc('update_loyalty_reward', {
        p_reward_id: editingReward.id, p_name: rewardName.trim(), p_description: rewardDescription.trim() || null,
        p_points_required: points, p_reward_type: rewardType,
        p_discount_percent: rewardType === 'DISCOUNT' ? discount : null,
        p_discount_max_amount: rewardType === 'DISCOUNT' ? Number(discountMaxAmount) || null : null,
        p_active: editingReward.active,
      });
      error = result.error;
    } else {
      const result = await supabase.rpc('create_loyalty_reward', {
        p_establishment_id: establishmentId, p_name: rewardName.trim(), p_description: rewardDescription.trim(),
        p_points_required: points, p_reward_type: rewardType,
        p_discount_percent: rewardType === 'DISCOUNT' ? discount : null,
        p_discount_max_amount: rewardType === 'DISCOUNT' ? Number(discountMaxAmount) || null : null,
      });
      error = result.error;
      createdRewardId = result.data ?? null;
    }
    if (error) {
      setRewardSaving(false);
      return alert(error.message);
    }
    const rewardId = editingReward?.id ?? createdRewardId;
    if (!rewardId) {
      setRewardSaving(false);
      return alert('Impossible de récupérer la récompense.');
    }
    const { error: scheduleError } = await supabase.rpc('update_loyalty_reward_schedule', { p_reward_id: rewardId, p_valid_days: validDays });
    if (scheduleError) {
      setRewardSaving(false);
      return alert(scheduleError.message);
    }
    setRewardSaving(false);
    setRewardEditorOpen(false);
    await load();
  }

  async function toggleReward(reward: LoyaltyRewardAdmin) {
    const { error } = await supabase.rpc('update_loyalty_reward', {
      p_reward_id: reward.id, p_name: reward.name, p_description: reward.description,
      p_points_required: reward.points_required, p_reward_type: reward.reward_type,
      p_discount_percent: reward.discount_percent, p_discount_max_amount: reward.discount_max_amount,
      p_active: !reward.active,
    });
    if (error) return alert(error.message);
    await load();
  }

  async function removeReward(reward: LoyaltyRewardAdmin) {
    if (!confirm('Désactiver cette récompense ?')) return;
    const { error } = await supabase.rpc('delete_loyalty_reward', { p_reward_id: reward.id });
    if (error) return alert(error.message);
    await load();
  }

  function updateConfig(patch: Partial<LoyaltyDesignConfig>) {
    setDesign(d => ({ ...d, design_config: { ...d.design_config, ...patch }, published: false }));
  }

  function chooseMode(mode: CardMode) {
    setCardMode(mode);
    setReferralDraft(current => ({
      ...current,
      referrer_bonus_type: mode === 'STAMP' ? 'STAMP' : 'POINTS',
      referee_bonus_type: mode === 'STAMP' ? 'STAMP' : 'POINTS',
      referrer_bonus_value: Math.max(0, Number(current.referrer_bonus_value) || 0),
      referee_bonus_value: Math.max(0, Number(current.referee_bonus_value) || 0),
    }));
    updateConfig({
      card_mode: mode,
      show_qr: true,
      show_points: mode !== 'STAMP',
    });
  }

  function applyPreset(preset: LoyaltyPreset) {
    setDesign(d => ({
      ...d,
      template_id: preset.id,
      primary_color: preset.primary,
      secondary_color: preset.secondary,
      background_color: preset.background,
      text_color: preset.text,
      border_radius: preset.radius,
      published: false,
      design_config: {
        ...d.design_config,
        front_title: preset.title,
        front_subtitle: preset.subtitle,
        stamp_style: preset.stampStyle,
        card_mode: cardMode,
        show_qr: true,
        show_points: cardMode !== 'STAMP',
      },
    }));
    setCardMode(cardMode);
  }

  async function uploadAsset(file: File, kind: 'logo' | 'photo') {
    if (!file.type.startsWith('image/')) return alert('Choisis une image PNG, JPG ou WEBP.');
    if (file.size > 5 * 1024 * 1024) return alert('L’image doit faire moins de 5 Mo.');
    setUploading(kind);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `loyalty-cards/${establishmentId}/${kind}-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from('loyalty-assets').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('loyalty-assets').getPublicUrl(path);
      updateConfig(kind === 'logo' ? { logo_url: data.publicUrl } : { background_image_url: data.publicUrl, ai_generation_id: undefined });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Impossible d’envoyer cette image.');
    } finally {
      setUploading(null);
    }
  }
  async function uploadWallpapers(files: FileList | null) {
    if (!files?.length) return;
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024);
    if (!validFiles.length) return alert('Choisis des images PNG, JPG ou WEBP de moins de 5 Mo.');

    setUploading('wallpapers');
    try {
      const uploaded: string[] = [];
      for (const file of validFiles) {
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `loyalty-cards/${establishmentId}/wallpaper-${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
        const { error } = await supabase.storage.from('loyalty-assets').upload(path, file, { upsert: false, contentType: file.type });
        if (error) throw error;
        uploaded.push(supabase.storage.from('loyalty-assets').getPublicUrl(path).data.publicUrl);
      }

      const current = Array.isArray((design.design_config as LoyaltyDesignConfig & { wallpaper_library?: string[] }).wallpaper_library)
        ? (design.design_config as LoyaltyDesignConfig & { wallpaper_library?: string[] }).wallpaper_library!
        : [];
      updateConfig({ wallpaper_library: Array.from(new Set([...current, ...uploaded])) } as Partial<LoyaltyDesignConfig>);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Impossible d’ajouter les wallpapers.');
    } finally {
      setUploading(null);
    }
  }

  async function saveReferralDraftOnly() {
    setReferralSaving(true);
    try {
      await saveReferralDraft(referralDraft);
      alert('Brouillon des règles de parrainage enregistré.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Impossible d’enregistrer le brouillon.');
    } finally {
      setReferralSaving(false);
    }
  }

  async function publishReferralRules() {
    setReferralSaving(true);
    try {
      await saveReferralDraft(referralDraft);
      const published = await publishReferral();
      setReferralPublished(published);
      setReferralDraft(published);
      alert('Règles de parrainage publiées.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Impossible de publier les règles de parrainage.');
    } finally {
      setReferralSaving(false);
    }
  }

  async function openReferralInvite() {
    if (!previewCustomer?.id) {
      return alert('Aucun client de démonstration disponible pour générer un code.');
    }

    setReferralInviteOpen(true);
    setReferralCopied(false);

    if (referralCode) return;

    setReferralGenerating(true);
    try {
      const code = await generateReferralCode(previewCustomer.id);
      setReferralCode(code);
    } catch (error) {
      setReferralInviteOpen(false);
      alert(error instanceof Error ? error.message : 'Impossible de générer le code de parrainage.');
    } finally {
      setReferralGenerating(false);
    }
  }

  function referralShareUrl(code: string) {
    return window.location.origin + '/loyalty/join?ref=' + encodeURIComponent(code);
  }

  function referralBonusLabel(type: LoyaltyReferralBonusType, value: number) {
    if (value <= 0) return 'aucun bonus';
    if (type === 'STAMP') return `${value} tampon${value > 1 ? 's' : ''}`;
    if (type === 'REDUCTION') return `-${value}% de réduction`;
    return `${value} point${value > 1 ? 's' : ''}`;
  }

  function referralMessage(code: string) {
    const referrerBonus = referralBonusLabel(referralPublished.referrer_bonus_type, referralPublished.referrer_bonus_value);
    const refereeBonus = referralBonusLabel(referralPublished.referee_bonus_type, referralPublished.referee_bonus_value);
    const bonusText = referralPublished.referee_bonus_value > 0
      ? `🎁 Ton avantage : ${refereeBonus}. Moi, je reçois ${referrerBonus} quand tu rejoins le programme.`
      : `🎁 Je reçois ${referrerBonus} quand tu rejoins le programme.`;
    return `Je t’invite à rejoindre le programme fidélité de ${establishment.name}. ${bonusText} ${referralShareUrl(code)}`;
  }

  async function copyReferralMessage() {
    if (!referralCode) return;
    try {
      await navigator.clipboard.writeText(referralMessage(referralCode));
      setReferralCopied(true);
      window.setTimeout(() => setReferralCopied(false), 1800);
    } catch {
      alert('Impossible de copier le message.');
    }
  }

  async function shareReferral() {
    if (!referralCode) return;
    const url = referralShareUrl(referralCode);
    const text = referralMessage(referralCode);
    if (navigator.share) {
      try {
        await navigator.share({ title: `Invitation fidélité · ${establishment.name}`, text, url });
      } catch {
        // L’utilisateur peut simplement fermer la feuille de partage.
      }
      return;
    }
    await copyReferralMessage();
  }

  async function save(publish: boolean) {
    setSaving(true);
    const { error: programError } = await supabase.rpc('save_loyalty_program_settings', {
      p_establishment_id: establishmentId,
      p_program_type: cardMode,
      p_stamp_goal: Number(stampGoal) || 10,
      p_stamp_reward_name: cardMode === 'STAMP' ? stampRewardName.trim() : null,
      p_stamp_reward_description: cardMode === 'STAMP' ? stampRewardDescription.trim() || null : null,
      p_discount_percent: cardMode === 'DISCOUNT' ? Math.min(100, Math.max(1, Number(discountPercent) || 10)) : null,
      p_discount_valid_days: cardMode === 'DISCOUNT' ? Math.max(1, Number(discountValidDays) || 7) : 7,
      p_points_per_currency: Number(pointsPerCurrency) > 0 ? Number(pointsPerCurrency) : 1,
      p_currency: 'MAD',
      p_enabled: programEnabled,
    });
    if (programError) {
      setSaving(false);
      return alert(programError.message);
    }

    const { error } = await supabase.rpc('save_loyalty_card_builder_config', {
      p_establishment_id: establishmentId,
      p_design_config: {
        ...design.design_config,
        card_mode: cardMode,
        show_qr: cardMode === 'QR',
        show_points: true,
        business_type: establishment.business_type,
      },
      p_template_id: design.template_id,
      p_primary_color: design.primary_color,
      p_secondary_color: design.secondary_color,
      p_background_color: design.background_color,
      p_text_color: design.text_color,
      p_button_color: design.button_color,
      p_border_radius: design.border_radius,
      p_published: publish,
    });
    setSaving(false);
    if (error) return alert(error.message);
    setDesign(d => ({ ...d, published: publish }));
    alert(publish ? 'Carte fidélité publiée.' : 'Brouillon enregistré.');
  }

  const visualExperience: LoyaltyExperienceConfig = {
    type: cardMode,
    stampStyle: design.design_config.stamp_style,
    templateId: design.template_id,
    businessType: design.design_config.business_type || establishment.business_type,
    establishmentName: establishment.name,
    logoUrl: design.design_config.logo_url || establishment.logo_url,
    coverImageUrl: design.design_config.background_image_url,
    primaryColor: design.primary_color,
    secondaryColor: design.secondary_color,
    backgroundColor: design.background_color,
    textColor: design.text_color || '#17201c',
    borderRadius: design.border_radius,
    customerName: previewCustomer?.first_name || 'Client',
    pointsBalance: Number(previewCustomer?.points_balance ?? 0),
    pointsGoal: Number(rewards[0]?.points_required ?? 0),
     discountPointsThreshold: cardMode === 'POINTS_DISCOUNT' ? Math.max(1, Number(discountPointsThreshold) || 1000) : undefined,
    visits: Number(previewCustomer?.stamps_balance ?? 0),
    visitGoal: Number(stampGoal) || 10,
    rewardName: cardMode === 'STAMP' ? stampRewardName : (rewards[0]?.name ?? 'Aucune récompense'),
    rewardDescription: cardMode === 'STAMP' ? (stampRewardDescription || null) : (rewards[0]?.description ?? null),
     discountPercent: cardMode === 'DISCOUNT' ? Number(discountPercent) || 10 : null,
     discountValidDays: cardMode === 'DISCOUNT' ? Number(discountValidDays) || 7 : 7,
    intro: design.design_config.front_subtitle,
    benefits: design.design_config.benefits || [],
    offers: design.design_config.offers || [],
    rewards: rewards.map(reward => ({
      id: reward.id,
      name: reward.name,
      description: reward.description,
      points_required: reward.points_required,
      reward_type: reward.reward_type,
      discount_percent: reward.discount_percent,
      discount_max_amount: reward.discount_max_amount,
    })),
    history: previewTransactions.map(transaction => ({
      id: transaction.id,
      title: transaction.description || 'Transaction',
      date: new Date(transaction.created_at).toLocaleDateString('fr-FR'),
      points: Number(transaction.points || 0),
    })),
    qrValue: window.location.origin + '/loyalty/preview-' + establishmentId,
    published: design.published,
  };

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-ink/5 bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Fidélité</p>
            <h2 className="mt-1 font-display text-3xl text-forest">Loyalty Studio</h2>
            <p className="mt-1 text-sm text-ink/45">Structure, Design et Miroir de la carte fidélité existante de l’établissement.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void save(false)} disabled={saving} className="rounded-xl border border-forest/20 bg-white px-4 py-3 text-xs font-semibold text-forest">Enregistrer</button>
            <button type="button" onClick={() => void save(true)} disabled={saving} className="rounded-xl bg-forest px-5 py-3 text-xs font-semibold text-white">{saving ? 'Publication…' : 'Publier la carte'}</button>
          </div>
        </div>

        <div className="mt-6 grid items-stretch gap-6 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-[#fafaf8] p-1">
              {(['Structure', 'Acquisition', 'Design'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    const targetId = tab === 'Structure' ? 'loyalty-structure' : tab === 'Acquisition' ? 'loyalty-acquisition' : 'loyalty-design';
                    window.requestAnimationFrame(() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
                  }}
                  className={`flex-1 rounded-xl px-3 py-2.5 text-center text-[10px] font-semibold transition ${activeTab === tab ? 'bg-white text-forest shadow-sm' : 'text-ink/35 hover:text-forest'}`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div id="loyalty-design" className="scroll-mt-6 rounded-2xl border border-ink/10 p-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-gold">Modèles</p>
                <p className="mt-1 text-xs text-ink/45">Choisis un modèle de départ, puis personnalise-le avec tes couleurs, ton logo et ta photo.</p>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {availableTemplates.map(preset => {
                  const active = design.template_id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`overflow-hidden rounded-2xl border text-left transition ${active ? 'border-forest ring-2 ring-forest/10' : 'border-ink/10 hover:border-forest/30'}`}
                    >
                      <PresetMiniPreview preset={preset} />
                      <div className="bg-white p-3">
                        <p className="text-xs font-semibold text-forest">{preset.name}</p>
                        <p className="mt-1 text-[9px] leading-4 text-ink/45">{preset.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-ink/10 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <AssetPicker title="Logo de l’établissement" description="PNG, JPG ou WEBP · 5 Mo max" value={design.design_config.logo_url || establishment.logo_url} fallback={establishment.logo_url} loading={uploading === 'logo'} inputRef={logoInput} />
                <AssetPicker title="Photo de fond" description="Une photo qui représente votre établissement" value={design.design_config.background_image_url} loading={uploading === 'photo'} inputRef={photoInput} />
              </div>
              <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const file=e.target.files?.[0]; if(file) void uploadAsset(file,'logo'); e.currentTarget.value=''; }} />
              <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const file=e.target.files?.[0]; if(file) void uploadAsset(file,'photo'); e.currentTarget.value=''; }} />
              <input ref={wallpapersInput} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={e => { void uploadWallpapers(e.target.files); e.currentTarget.value=''; }} />

              <div className="mt-5 rounded-2xl border border-ink/10 bg-[#fafaf8] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-gold">Bibliothèque de wallpapers</p>
                    <p className="mt-1 text-[10px] text-ink/45">Ajoute plusieurs fonds premium et sélectionne celui utilisé par la carte.</p>
                  </div>
                  <button type="button" onClick={() => wallpapersInput.current?.click()} disabled={uploading === 'wallpapers'} className="inline-flex items-center gap-2 rounded-xl bg-forest px-3 py-2 text-[10px] font-semibold text-white disabled:opacity-50">
                    <Upload size={14} /> {uploading === 'wallpapers' ? 'Upload…' : 'Ajouter plusieurs'}
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {[
                    ...new Set([
                      design.design_config.background_image_url,
                      ...(((design.design_config as LoyaltyDesignConfig & { wallpaper_library?: string[] }).wallpaper_library) || []),
                    ].filter((url): url is string => Boolean(url))),
                  ].map((url) => (
                    <button
                      key={url}
                      type="button"
                      onClick={() => updateConfig({ background_image_url: url } as Partial<LoyaltyDesignConfig>)}
                      className={`relative aspect-[3/4] overflow-hidden rounded-xl border-2 ${design.design_config.background_image_url === url ? 'border-gold ring-2 ring-gold/20' : 'border-transparent'}`}
                    >
                      <img src={url} alt="" className="h-full w-full object-cover" />
                      {design.design_config.background_image_url === url && <span className="absolute right-1.5 top-1.5 grid h-5 w-5 place-items-center rounded-full bg-gold text-white"><Check size={12} /></span>}
                    </button>
                  ))}
                  {!design.design_config.background_image_url && !((design.design_config as LoyaltyDesignConfig & { wallpaper_library?: string[] }).wallpaper_library || []).length && (
                    <div className="col-span-full rounded-xl border border-dashed border-ink/10 px-4 py-5 text-center text-[10px] text-ink/35">Aucun wallpaper ajouté.</div>
                  )}
                </div>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {([['Couleur principale','primary_color'],['Couleur secondaire','secondary_color'],['Fond','background_color'],['Texte','text_color']] as const).map(([label,key]) => (
                  <label key={key} className="text-[10px] font-semibold uppercase tracking-wide text-ink/40">{label}
                    <div className="mt-1 flex items-center gap-2 rounded-xl border border-ink/10 bg-white p-2"><input type="color" value={design[key]} onChange={e => setDesign(d => ({ ...d, [key]: e.target.value, published: false }))} className="h-8 w-8 cursor-pointer rounded-lg border-0 bg-transparent p-0" /><span className="text-[10px] text-ink/50">{design[key]}</span></div>
                  </label>
                ))}
              </div>

              <div className="mt-5">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-ink/40">Type de fidélité</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <ModeButton active={cardMode === 'QR'} icon={<QrCode size={23}/>} title="QR Code" description="Une carte avec un QR unique pour le client." onClick={() => chooseMode('QR')} />
                  <ModeButton active={cardMode === 'STAMP'} icon={<Stamp size={23}/>} title="Tampons" description="Une carte de visites avec des tampons." onClick={() => chooseMode('STAMP')} />
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs font-medium text-ink/50">Titre<input value={design.design_config.front_title} onChange={e => updateConfig({front_title:e.target.value})} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"/></label>
                <label className="block text-xs font-medium text-ink/50">Sous-titre<input value={design.design_config.front_subtitle} onChange={e => updateConfig({front_subtitle:e.target.value})} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"/></label>
              </div>

              <div id="loyalty-structure" className="scroll-mt-6 rounded-2xl border border-ink/10 bg-[#fafaf8] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-gold">Structure</p>
                <p className="mt-1 text-xs text-ink/45">Les réglages ci-dessous pilotent le programme de fidélité déjà utilisé par cet établissement.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <label className="text-xs font-medium text-ink/50">
                    Nombre de tampons sur la carte
                    <input
                      type="number"
                      min="1"
                      max="10"
                      step="1"
                      value={stampGoal}
                      onChange={e => setStampGoal(e.target.value.replace(/\\D/g, '').slice(0, 3))}
                      className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm text-ink outline-none"
                    />
                    <span className="mt-1 block text-[10px] text-ink/35">Ex. 6, 8 ou 10 cases. Le maximum est de 10 tampons.</span>
                  </label>
                  <label className="text-xs font-medium text-ink/50">
                    Récompense à la carte complète
                    <input
                      value={stampRewardName}
                      onChange={e => setStampRewardName(e.target.value)}
                      disabled={cardMode !== 'STAMP'}
                      className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm text-ink outline-none disabled:opacity-40"
                      placeholder="Cadeau fidélité"
                    />
                  </label>
                </div>

                {cardMode === 'POINTS_DISCOUNT' && (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className="text-xs font-medium text-ink/50">Seuil de points
                      <div className="mt-1 flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5">
                        <input type="number" min="1" value={discountPointsThreshold} onChange={e => setDiscountPointsThreshold(e.target.value)} className="w-full bg-transparent text-sm text-ink outline-none" />
                        <span className="text-[10px] font-semibold text-ink/35">pts</span>
                      </div>
                    </label>
                    <label className="text-xs font-medium text-ink/50">Réduction
                      <div className="mt-1 flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5">
                        <input type="number" min="1" max="100" value={discountPercent} onChange={e => setDiscountPercent(e.target.value)} className="w-full bg-transparent text-sm text-ink outline-none" />
                        <span className="text-[10px] font-semibold text-ink/35">%</span>
                      </div>
                    </label>
                    <label className="text-xs font-medium text-ink/50">Validité
                      <div className="mt-1 flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5">
                        <input type="number" min="1" max="365" value={discountValidDays} onChange={e => setDiscountValidDays(e.target.value)} className="w-full bg-transparent text-sm text-ink outline-none" />
                        <span className="text-[10px] font-semibold text-ink/35">jours</span>
                      </div>
                    </label>
                  </div>
                )}

                <div className="mt-3 rounded-xl border border-forest/10 bg-white p-3 text-[10px] text-ink/45">
                  Exemple : 250 MAD = {Math.floor(Math.max(0, Number(pointsPerCurrency) || 0) * 250)} points.
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[#D6B15A]/25 bg-gradient-to-br from-[#173D32] to-[#102a22] p-5 text-white">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-[#D6B15A]">Accès Client</p>
                    <h3 className="mt-1 text-lg font-semibold">QR Code Maître</h3>
                    <p className="mt-1 max-w-xl text-[10px] leading-4 text-white/55">
                      Un seul lien permanent pour inscrire n’importe quel nouveau client. Le même lien peut être programmé dans une plaque NFC.
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full border border-white/10 bg-white/10 px-3 py-1.5 text-[9px] font-semibold text-white/70">
                    Permanent
                  </span>
                </div>

                <div className="mt-4 grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
                  <div className="mx-auto flex h-[230px] w-[230px] items-center justify-center rounded-2xl bg-white p-3">
                    {masterQrDataUrl ? (
                      <img src={masterQrDataUrl} alt="QR Code maître d'inscription" className="h-full w-full rounded-xl" />
                    ) : (
                      <div className="h-full w-full animate-pulse rounded-xl bg-[#eef0ed]" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                      <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-white/45">Lien d’enrôlement</p>
                      <p className="mt-2 break-all text-xs leading-5 text-white/80">{masterEnrollmentUrl()}</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => void copyMasterEnrollmentLink()}
                      className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#D6B15A] px-4 py-3 text-[11px] font-semibold text-[#173D32] transition hover:brightness-105"
                    >
                      {masterLinkCopied ? <Check size={15} /> : <Link2 size={15} />}
                      {masterLinkCopied ? 'Lien copié !' : 'Copier le lien NFC'}
                    </button>

                    <p className="mt-2 text-center text-[9px] leading-4 text-white/40">
                      Scannez le QR ou copiez ce lien pour programmer vos plaques NFC, cartes ou supports imprimés.
                    </p>
                  </div>
                </div>
              </div>

              <div id="loyalty-acquisition" className="mt-4 scroll-mt-6 rounded-2xl border border-ink/10 bg-[#fafaf8] p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-gold">Acquisition · Parrainage</p>
                    <p className="mt-1 text-sm font-semibold text-forest">Paramètres de parrainage</p>
                    <p className="mt-1 max-w-xl text-[10px] leading-4 text-ink/45">
                      Configure précisément la récompense du parrain, celle du filleul et la limite de parrainages.
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1.5 text-[9px] font-semibold ${referralPublished.enabled ? 'bg-forest/10 text-forest' : 'bg-ink/5 text-ink/40'}`}>
                    {referralPublished.enabled ? 'Règles actives' : 'Désactivé'}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-forest/10 bg-forest/[0.04] p-4">
                    <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-ink/40">Acquisition</p>
                    <p className="mt-1 text-2xl font-bold text-forest">{referralAcquiredCount}</p>
                    <p className="mt-1 text-[10px] text-ink/45">{referralAcquiredCount === 1 ? "client a été acquis via parrainage" : "clients ont été acquis via parrainage"}</p>
                  </div>
                  <div className="rounded-2xl border border-ink/10 bg-white p-4">
                    <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-ink/40">Limite par parrain</p>
                    <p className="mt-1 text-lg font-semibold text-forest">
                      {referralDraft.max_referrals === null ? 'Illimitée' : `${referralDraft.max_referrals} parrainages`}
                    </p>
                    <p className="mt-1 text-[10px] text-ink/45">contrôlée côté serveur</p>
                  </div>
                  <div className="rounded-2xl border border-ink/10 bg-white p-4">
                    <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-ink/40">Boucle</p>
                    <p className="mt-1 text-lg font-semibold text-forest">QR automatique</p>
                    <p className="mt-1 text-[10px] text-ink/45">le nouveau client peut parrainer à son tour</p>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
                  <label className="flex items-center gap-3 text-xs font-medium text-ink/60">
                    <input
                      type="checkbox"
                      checked={referralDraft.enabled}
                      onChange={e => setReferralDraft(draft => ({ ...draft, enabled: e.target.checked }))}
                      className="h-4 w-4 rounded"
                    />
                    Activer le programme de parrainage
                  </label>

                  <div className="mt-5 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-2xl border border-ink/10 bg-[#fafaf8] p-4">
                      <p className="text-xs font-semibold text-forest">Récompense du parrain</p>
                      <p className="mt-1 text-[10px] text-ink/40">Ce que reçoit le client qui invite.</p>

                      <label className="mt-4 block text-xs font-medium text-ink/50">
                        Type de récompense
                        <select
                          value={referralDraft.referrer_bonus_type}
                          onChange={e => setReferralDraft(draft => ({
                            ...draft,
                            referrer_bonus_type: e.target.value as LoyaltyReferralBonusType,
                          }))}
                          className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm text-ink"
                        >
                          <option value="POINTS">Points</option>
                          <option value="STAMP">Stamps</option>
                          <option value="REDUCTION">Réduction</option>
                        </select>
                      </label>

                      <label className="mt-3 block text-xs font-medium text-ink/50">
                        Valeur du bonus
                        <div className="mt-1 flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max={referralDraft.referrer_bonus_type === 'REDUCTION' ? '100' : '1000000'}
                            step={referralDraft.referrer_bonus_type === 'REDUCTION' ? '0.5' : '1'}
                            value={referralDraft.referrer_bonus_value}
                            onChange={e => setReferralDraft(draft => ({ ...draft, referrer_bonus_value: Math.max(0, Number(e.target.value) || 0) }))}
                            className="w-full bg-transparent text-sm text-ink outline-none"
                          />
                          <span className="text-[10px] font-semibold text-ink/35">
                            {referralDraft.referrer_bonus_type === 'REDUCTION' ? '%' : referralDraft.referrer_bonus_type === 'STAMP' ? 'stamps' : 'pts'}
                          </span>
                        </div>
                      </label>
                    </div>

                    <div className="rounded-2xl border border-ink/10 bg-[#fafaf8] p-4">
                      <p className="text-xs font-semibold text-forest">Bonus du filleul</p>
                      <p className="mt-1 text-[10px] text-ink/40">Ce que reçoit le nouveau client à son inscription.</p>

                      <label className="mt-4 block text-xs font-medium text-ink/50">
                        Type de récompense
                        <select
                          value={referralDraft.referee_bonus_type}
                          onChange={e => setReferralDraft(draft => ({
                            ...draft,
                            referee_bonus_type: e.target.value as LoyaltyReferralBonusType,
                          }))}
                          className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm text-ink"
                        >
                          <option value="POINTS">Points</option>
                          <option value="STAMP">Stamps</option>
                          <option value="REDUCTION">Réduction</option>
                        </select>
                      </label>

                      <label className="mt-3 block text-xs font-medium text-ink/50">
                        Valeur du bonus
                        <div className="mt-1 flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5">
                          <input
                            type="number"
                            min="0"
                            max={referralDraft.referee_bonus_type === 'REDUCTION' ? '100' : '1000000'}
                            step={referralDraft.referee_bonus_type === 'REDUCTION' ? '0.5' : '1'}
                            value={referralDraft.referee_bonus_value}
                            onChange={e => setReferralDraft(draft => ({ ...draft, referee_bonus_value: Math.max(0, Number(e.target.value) || 0) }))}
                            className="w-full bg-transparent text-sm text-ink outline-none"
                          />
                          <span className="text-[10px] font-semibold text-ink/35">
                            {referralDraft.referee_bonus_type === 'REDUCTION' ? '%' : referralDraft.referee_bonus_type === 'STAMP' ? 'stamps' : 'pts'}
                          </span>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div className="mt-4 rounded-2xl border border-gold/15 bg-[#fbf7ed] p-4">
                    <label className="block text-xs font-medium text-ink/50">
                      Limite de parrainages par client
                      <div className="mt-1 flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2.5">
                        <input
                          type="number"
                          min="0"
                          max="1000000"
                          value={referralDraft.max_referrals ?? ''}
                          onChange={e => {
                            const value = e.target.value.trim();
                            setReferralDraft(draft => ({
                              ...draft,
                              max_referrals: value === '' ? null : Math.max(0, Number(value) || 0),
                            }));
                          }}
                          className="w-full bg-transparent text-sm text-ink outline-none"
                          placeholder="Illimité"
                        />
                        <span className="whitespace-nowrap text-[10px] font-semibold text-ink/35">fois</span>
                      </div>
                    </label>
                    <p className="mt-2 text-[10px] leading-4 text-ink/40">
                      Laisser vide pour autoriser un nombre illimité de filleuls. La limite est vérifiée et verrouillée côté SQL avant chaque attribution.
                    </p>
                  </div>

                  <div className="mt-4 rounded-xl border border-forest/10 bg-forest/[0.03] p-3 text-[10px] leading-4 text-ink/50">
                    {referralDraft.referrer_bonus_value > 0
                      ? `Parrain : ${referralBonusLabel(referralDraft.referrer_bonus_type, referralDraft.referrer_bonus_value)} · Filleul : ${referralBonusLabel(referralDraft.referee_bonus_type, referralDraft.referee_bonus_value)}.`
                      : 'Configure une récompense pour activer le parrainage.'}
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      disabled={referralSaving}
                      onClick={() => void saveReferralDraftOnly()}
                      className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-xs font-semibold text-forest disabled:opacity-50"
                    >
                      {referralSaving ? 'Enregistrement...' : 'Enregistrer le brouillon'}
                    </button>
                    <button
                      type="button"
                      disabled={referralSaving}
                      onClick={() => void publishReferralRules()}
                      className="rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white disabled:opacity-50"
                    >
                      {referralSaving ? 'Publication...' : 'Publier les règles'}
                    </button>
                  </div>
                </div>
              </div>
              <div id="loyalty-content" className="mt-5 scroll-mt-6 rounded-2xl border border-ink/10 bg-[#fafaf8] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[.16em] text-gold">Contenu de la carte</p>
                <p className="mt-1 text-[10px] text-ink/45">Modifie les avantages et les offres affichés au client.</p>
                <p className="mt-4 text-[10px] font-semibold uppercase tracking-[.16em] text-gold">Avantages & offres</p>
                <p className="mt-1 text-[10px] text-ink/45">Ces contenus sont enregistrés dans la configuration de la carte et affichés au client.</p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  {(design.design_config.benefits || []).slice(0,3).map((benefit, index) => (
                    <div key={index} className="rounded-xl border border-ink/10 bg-white p-3">
                      <input value={benefit.title} onChange={e => {
                        const benefits = [...(design.design_config.benefits || [])];
                        benefits[index] = { ...benefits[index], title: e.target.value };
                        updateConfig({ benefits });
                      }} placeholder="Titre avantage" className="w-full rounded-lg border border-ink/10 px-2.5 py-2 text-xs" />
                      <input value={benefit.description || ''} onChange={e => {
                        const benefits = [...(design.design_config.benefits || [])];
                        benefits[index] = { ...benefits[index], description: e.target.value };
                        updateConfig({ benefits });
                      }} placeholder="Description" className="mt-2 w-full rounded-lg border border-ink/10 px-2.5 py-2 text-[10px]" />
                    </div>
                  ))}
                </div>
                <div className="mt-3">
                  {(design.design_config.offers || []).slice(0,2).map((offer, index) => (
                    <div key={index} className="mb-2 rounded-xl border border-ink/10 bg-white p-3">
                      <div className="grid gap-2 sm:grid-cols-3">
                        <input value={offer.eyebrow || ''} onChange={e => {
                          const offers = [...(design.design_config.offers || [])];
                          offers[index] = { ...offers[index], eyebrow: e.target.value };
                          updateConfig({ offers });
                        }} placeholder="Label" className="rounded-lg border border-ink/10 px-2.5 py-2 text-[10px]" />
                        <input value={offer.title} onChange={e => {
                          const offers = [...(design.design_config.offers || [])];
                          offers[index] = { ...offers[index], title: e.target.value };
                          updateConfig({ offers });
                        }} placeholder="Titre offre" className="rounded-lg border border-ink/10 px-2.5 py-2 text-xs" />
                        <input value={offer.description || ''} onChange={e => {
                          const offers = [...(design.design_config.offers || [])];
                          offers[index] = { ...offers[index], description: e.target.value };
                          updateConfig({ offers });
                        }} placeholder="Description" className="rounded-lg border border-ink/10 px-2.5 py-2 text-[10px]" />
                      </div>
                    </div>
                  ))}
                  {!(design.design_config.offers || []).length && <p className="text-[10px] text-ink/35">Aucune offre configurée pour le moment.</p>}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-ink/50">Coins arrondis <span className="float-right">{design.border_radius}px</span><input type="range" min="12" max="36" value={design.border_radius} onChange={e=>setDesign(d=>({...d,border_radius:Number(e.target.value),published:false}))} className="mt-3 w-full"/></label>
                <label className="text-xs text-ink/50">Style des tampons<select disabled={cardMode !== 'STAMP'} value={design.design_config.stamp_style} onChange={e=>updateConfig({stamp_style:e.target.value as LoyaltyDesignConfig['stamp_style']})} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 disabled:opacity-40"><option value="circles">Cercles</option><option value="squares">Carrés</option><option value="stars">Étoiles</option><option value="hearts">Cœurs</option></select></label>
              </div>
            </div>
          </div>

          <div id="loyalty-preview" className="scroll-mt-6 flex min-h-[78vh] flex-col overflow-hidden rounded-[32px] border border-white/70 bg-[linear-gradient(145deg,#f8faf8_0%,#eef2ef_48%,#e5eae6_100%)] p-5 shadow-[0_24px_70px_rgba(23,61,50,0.10)] sm:p-7">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-gold">Aperçu en temps réel</p><p className="mt-1 text-xs text-ink/45">Voici exactement ce que vos clients verront.</p></div>
              <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-forest shadow-sm">Client</span>
            </div>
            <div className="mt-6 flex min-h-0 w-full flex-1 flex-col items-center justify-center">

              <div
                style={{
                  width: '320px',
                  height: '640px',
                  flexShrink: 0,
                }}
              >
                <LoyaltyPreview config={visualExperience} />
              </div>

              <div className="mt-4 rounded-[22px] border border-ink/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-[.18em] text-gold">Parrainage</p>
                    <p className="mt-1 text-xs text-ink/45">Invite un proche depuis cette carte et partage ton avantage fidélité.</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${referralPublished.enabled ? 'bg-forest/10 text-forest' : 'bg-ink/5 text-ink/35'}`}>
                    {referralPublished.enabled ? 'Actif' : 'Inactif'}
                  </span>
                </div>
                <button
                  type="button"
                  disabled={!referralPublished.enabled || !previewCustomer?.id}
                  onClick={() => void openReferralInvite()}
                  className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white transition hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Gift size={15} />
                  🎁 Inviter un ami
                </button>
              </div>

              {referralInviteOpen && (
                <div className="fixed inset-0 z-[130] grid place-items-center bg-black/60 p-4" onClick={() => !referralGenerating && setReferralInviteOpen(false)}>
                  <div className="w-full max-w-md rounded-[28px] bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[9px] font-bold uppercase tracking-[.2em] text-gold">Invitation fidélité</p>
                        <h3 className="mt-1 text-xl font-semibold text-forest">Invite un ami</h3>
                        <p className="mt-1 text-xs leading-5 text-ink/45">
                          {referralPublished.referee_bonus_value > 0
                            ? `Ton ami reçoit ${referralBonusLabel(referralPublished.referee_bonus_type, referralPublished.referee_bonus_value)} et toi ${referralBonusLabel(referralPublished.referrer_bonus_type, referralPublished.referrer_bonus_value)} après validation.`
                            : `Tu reçois ${referralBonusLabel(referralPublished.referrer_bonus_type, referralPublished.referrer_bonus_value)} après validation du parrainage.`}
                        </p>
                      </div>
                      <button type="button" onClick={() => setReferralInviteOpen(false)} className="rounded-xl p-2 text-ink/35">
                        <X size={18} />
                      </button>
                    </div>

                    {referralGenerating ? (
                      <div className="grid place-items-center py-10">
                        <Loader2 className="animate-spin text-gold" size={28} />
                        <p className="mt-3 text-xs text-ink/45">Génération du code…</p>
                      </div>
                    ) : (
                      <>
                        <div className="mt-5 rounded-2xl border border-forest/10 bg-[#f7f7f3] p-5 text-center">
                          <p className="text-[9px] font-semibold uppercase tracking-[.18em] text-ink/40">Ton code unique</p>
                          <p className="mt-2 text-3xl font-bold tracking-[.18em] text-forest">{referralCode || '—'}</p>
                        </div>

                        <div className="mt-4 rounded-2xl border border-ink/10 bg-white p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-ink/40">Lien de partage</p>
                          <div className="mt-2 flex items-center gap-2 rounded-xl bg-[#f7f7f3] px-3 py-2.5">
                            <Link2 size={15} className="shrink-0 text-ink/35" />
                            <p className="min-w-0 flex-1 truncate text-[10px] text-ink/50">{referralCode ? referralShareUrl(referralCode) : '—'}</p>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-gold/15 bg-[#fbf7ed] p-4">
                          <p className="text-[9px] font-semibold uppercase tracking-[.16em] text-gold">Message prêt à partager</p>
                          <p className="mt-2 text-xs leading-5 text-ink/55">{referralCode ? referralMessage(referralCode) : '—'}</p>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <button type="button" onClick={() => void copyReferralMessage()} className="inline-flex items-center justify-center gap-2 rounded-xl border border-forest/15 bg-white px-3 py-3 text-xs font-semibold text-forest">
                            <Share2 size={15} />
                            {referralCopied ? 'Copié !' : 'Copier'}
                          </button>
                          <button type="button" onClick={() => void shareReferral()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-3 py-3 text-xs font-semibold text-white">
                            <Share2 size={15} />
                            Partager
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function PresetMiniPreview({ preset }: { preset: LoyaltyPreset }) {
  const base = 'relative h-28 overflow-hidden';

  if (preset.id === 'obsidian') {
    return (
      <div className={base + ' bg-[#090908] text-white'}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(214,177,90,.42),transparent_30%)]" />
        <div className="absolute left-4 top-4 h-7 w-7 rounded-lg border border-white/20 bg-white/10" />
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[7px] uppercase tracking-[.28em] text-white/45">BLACK MEMBER</p>
          <p className="mt-1 text-lg font-semibold tracking-tight">Luxury, simplified.</p>
          <div className="mt-2 h-px w-20 bg-[#D6B15A]" />
        </div>
      </div>
    );
  }

  if (preset.id === 'editorial') {
    return (
      <div className={base + ' bg-[#F4EDE1] text-[#2B241D]'}>
        <div className="absolute inset-x-4 top-4 border-t border-[#2B241D]/20" />
        <div className="absolute left-4 top-7">
          <p className="text-[7px] uppercase tracking-[.3em] opacity-45">MEMBERSHIP</p>
          <p className="mt-2 font-serif text-xl leading-none">The art of staying.</p>
          <p className="mt-2 max-w-[170px] text-[7px] leading-3 opacity-55">Des privilèges pensés pour chaque visite.</p>
        </div>
        <span className="absolute bottom-4 right-4 text-[7px] uppercase tracking-[.2em] opacity-40">No. 01</span>
      </div>
    );
  }

  if (preset.id === 'glass') {
    return (
      <div className={base + ' bg-[#17372D] text-white'}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_15%,rgba(255,255,255,.25),transparent_28%),linear-gradient(135deg,rgba(255,255,255,.08),transparent_45%)]" />
        <div className="absolute inset-3 rounded-2xl border border-white/25 bg-white/10 p-3 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <span className="h-5 w-5 rounded-full border border-white/40 bg-white/20" />
            <span className="text-[7px] uppercase tracking-[.2em] text-white/55">VIP</span>
          </div>
          <p className="mt-4 text-[7px] uppercase tracking-[.2em] text-white/55">YOUR BALANCE</p>
          <p className="mt-1 text-xl font-light">720 pts</p>
        </div>
      </div>
    );
  }

  if (preset.id === 'titanium') {
    return (
      <div className={base + ' bg-[#0D0D0C] text-white'}>
        <div className="absolute inset-0 opacity-60" style={{ background: 'linear-gradient(135deg,transparent 0%,rgba(255,255,255,.18) 48%,transparent 50%)' }} />
        <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
          <span className="text-[8px] font-semibold tracking-[.2em]">ESTABLISHMENT</span>
          <span className="text-[7px] tracking-[.18em]" style={{ color: preset.secondary }}>BLACK MEMBER</span>
        </div>
        <div className="absolute bottom-4 left-4 right-4">
          <p className="text-[7px] uppercase tracking-[.3em] text-white/40">SIGNATURE SERIES</p>
          <div className="mt-2 h-px w-full" style={{ background: preset.secondary }} />
        </div>
      </div>
    );
  }

  if (preset.id === 'hospitality') {
    return (
      <div className={base + ' bg-[#4A2A1B] text-white'}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_75%_20%,rgba(226,182,109,.45),transparent_32%),linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.45))]" />
        <div className="absolute left-4 top-4 flex items-center gap-2">
          <span className="h-7 w-7 rounded-xl bg-white/15" />
          <div><p className="font-serif text-sm">The Club</p><p className="text-[6px] uppercase tracking-[.25em] text-white/55">HOSPITALITY</p></div>
        </div>
        <div className="absolute bottom-4 left-4">
          <p className="font-serif text-lg">More than a visit.</p>
        </div>
        <span className="absolute right-4 bottom-4 rounded-full border border-white/25 px-2 py-1 text-[6px] uppercase tracking-[.18em]">GOLD</span>
      </div>
    );
  }

  return (
    <div className={base + ' bg-[#F2EEE6] text-[#1B1A18]'}>
      <div className="absolute inset-x-4 top-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><span className="h-7 w-7 rounded-lg border border-black/10 bg-white" /><span className="text-[8px] font-semibold">ESTABLISHMENT</span></div>
        <span className="text-[6px] uppercase tracking-[.2em] opacity-45">PRIVILEGE</span>
      </div>
      <div className="absolute bottom-4 left-4 right-4">
        <p className="text-[7px] uppercase tracking-[.22em] opacity-45">YOUR LOYALTY</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-black/10"><div className="h-full w-[72%] bg-[#403A32]" /></div>
      </div>
    </div>
  );
}

function AssetPicker({ title, description, value, fallback, loading, inputRef }: { title: string; description: string; value?: string | null; fallback?: string | null; loading: boolean; inputRef: React.RefObject<HTMLInputElement | null> }) {
  const image = value || fallback;
  return (
    <button type="button" onClick={() => inputRef.current?.click()} className="group overflow-hidden rounded-2xl border border-dashed border-ink/15 bg-[#fafaf8] text-left">
      <div className="flex min-h-[150px] items-center justify-center p-4">
        {image ? <img src={image} alt="" className="h-[120px] w-full rounded-xl object-cover" /> : <div className="text-center text-ink/35"><ImagePlus className="mx-auto" size={28}/><p className="mt-2 text-xs font-semibold">Importer une image</p></div>}
      </div>
      <div className="flex items-center justify-between border-t border-ink/10 bg-white px-3 py-3">
        <div><p className="text-xs font-semibold text-forest">{title}</p><p className="mt-1 text-[10px] text-ink/40">{description}</p></div>
        {loading ? <Loader2 className="animate-spin text-gold" size={18}/> : <Upload size={16} className="text-ink/35"/>}
      </div>
    </button>
  );
}

function ModeButton({ active, icon, title, description, onClick }: { active: boolean; icon: React.ReactNode; title: string; description: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition ${active ? 'border-forest bg-forest/[0.04] ring-2 ring-forest/10' : 'border-ink/10 bg-white hover:border-forest/30'}`}>
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${active ? 'bg-forest text-white' : 'bg-[#f7f7f3] text-ink/45'}`}>{icon}</span>
      <span><span className="block text-sm font-semibold text-forest">{title}</span><span className="mt-1 block text-[10px] leading-4 text-ink/45">{description}</span></span>
      <span className={`ml-auto h-4 w-4 rounded-full border-2 ${active ? 'border-forest bg-forest' : 'border-ink/25'}`}>{active && <Check size={11} className="m-auto text-white" />}</span>
    </button>
  );
}