import { useEffect, useRef, useState } from 'react';
import { Check, Gift, ImagePlus, Loader2, Pencil, Plus, QrCode, Stamp, Trash2, Upload, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { defaultLoyaltyDesignConfig, type LoyaltyDesignConfig } from './LoyaltyCardVisual';
import { LoyaltyExperience, type LoyaltyExperienceConfig } from './loyalty/LoyaltyExperience';

type CardMode = 'QR' | 'STAMP';

type LoyaltyRewardAdmin = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
  reward_type: 'GIFT' | 'DISCOUNT';
  discount_percent: number | null;
  discount_max_amount: number | null;
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
  template_id: 'luxury',
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
  const [cardMode, setCardMode] = useState<CardMode>('QR');
  const [stampGoal, setStampGoal] = useState('10');
  const [stampRewardName, setStampRewardName] = useState('Cadeau fidélité');
  const [stampRewardDescription, setStampRewardDescription] = useState('');
  const [rewards, setRewards] = useState<LoyaltyRewardAdmin[]>([]);
  const [rewardEditorOpen, setRewardEditorOpen] = useState(false);
  const [editingReward, setEditingReward] = useState<LoyaltyRewardAdmin | null>(null);
  const [rewardName, setRewardName] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [rewardPoints, setRewardPoints] = useState('500');
  const [rewardType, setRewardType] = useState<'GIFT' | 'DISCOUNT'>('GIFT');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [discountMaxAmount, setDiscountMaxAmount] = useState('');
  const [rewardSaving, setRewardSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'photo' | 'wallpapers' | null>(null);
  const [activeTab, setActiveTab] = useState<'Design' | 'Contenu' | 'Récompense' | 'Aperçu'>('Design');
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);
  const wallpapersInput = useRef<HTMLInputElement>(null);

  async function load() {
    if (!establishmentId) return;
    const [{ data: designData }, { data: place }, { data: programData }, { data: rewardData }] = await Promise.all([
      supabase.rpc('get_loyalty_card_config', { p_establishment_id: establishmentId }),
      supabase.from('establishments').select('name,logo_url,business_type').eq('id', establishmentId).maybeSingle(),
      supabase.rpc('get_loyalty_program_settings', { p_establishment_id: establishmentId }),
      supabase.from('loyalty_rewards').select('id,name,description,points_required,active,reward_type,discount_percent,discount_max_amount').eq('establishment_id', establishmentId).order('points_required', { ascending: true }),
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
      setCardMode(nextConfig.card_mode === 'STAMP' ? 'STAMP' : 'QR');
    }
    if (place) setEstablishment({ name: place.name || 'Votre établissement', logo_url: place.logo_url || null, business_type: place.business_type || null });
    setRewards((rewardData ?? []) as LoyaltyRewardAdmin[]);

    const program = Array.isArray(programData) ? programData[0] : programData;
    if (program) {
      setStampGoal(String(program.stamp_goal ?? 10));
      setStampRewardName(program.stamp_reward_name ?? 'Cadeau fidélité');
      setStampRewardDescription(program.stamp_reward_description ?? '');
      if (!row?.design_config?.card_mode) setCardMode(program.program_type === 'STAMP' ? 'STAMP' : 'QR');
    }
  }

  useEffect(() => { void load(); }, [establishmentId]);

  function openRewardEditor(reward?: LoyaltyRewardAdmin) {
    setEditingReward(reward ?? null);
    setRewardName(reward?.name ?? '');
    setRewardDescription(reward?.description ?? '');
    setRewardPoints(String(reward?.points_required ?? 500));
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
    const { error } = editingReward
      ? await supabase.rpc('update_loyalty_reward', {
          p_reward_id: editingReward.id, p_name: rewardName.trim(), p_description: rewardDescription.trim() || null,
          p_points_required: points, p_reward_type: rewardType,
          p_discount_percent: rewardType === 'DISCOUNT' ? discount : null,
          p_discount_max_amount: rewardType === 'DISCOUNT' ? Number(discountMaxAmount) || null : null,
          p_active: editingReward.active,
        })
      : await supabase.rpc('create_loyalty_reward', {
          p_establishment_id: establishmentId, p_name: rewardName.trim(), p_description: rewardDescription.trim(),
          p_points_required: points, p_reward_type: rewardType,
          p_discount_percent: rewardType === 'DISCOUNT' ? discount : null,
          p_discount_max_amount: rewardType === 'DISCOUNT' ? Number(discountMaxAmount) || null : null,
        });
    setRewardSaving(false);
    if (error) return alert(error.message);
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
    updateConfig({
      card_mode: mode,
      show_qr: mode === 'QR',
      show_points: false,
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
        card_mode: preset.mode,
        show_qr: preset.mode === 'QR',
        show_points: false,
      },
    }));
    setCardMode(preset.mode);
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

  async function save(publish: boolean) {
    setSaving(true);
    const { error: programError } = await supabase.rpc('save_loyalty_program_settings', {
      p_establishment_id: establishmentId,
      p_program_type: cardMode === 'STAMP' ? 'STAMP' : 'POINTS',
      p_stamp_goal: Number(stampGoal) || 10,
      p_stamp_reward_name: cardMode === 'STAMP' ? stampRewardName.trim() : null,
      p_stamp_reward_description: cardMode === 'STAMP' ? stampRewardDescription.trim() || null : null,
      p_discount_percent: null,
      p_discount_valid_days: 7,
      p_points_per_currency: 1,
      p_currency: 'MAD',
      p_enabled: true,
    });
    if (programError) {
      setSaving(false);
      return alert(programError.message);
    }

    const { error } = await supabase.rpc('save_loyalty_card_design', {
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
    type: cardMode === 'STAMP' ? 'STAMP' : 'POINTS',
    businessType: design.design_config.business_type || establishment.business_type,
    establishmentName: establishment.name,
    logoUrl: design.design_config.logo_url || establishment.logo_url,
    coverImageUrl: design.design_config.background_image_url,
    primaryColor: design.primary_color,
    secondaryColor: design.secondary_color,
    backgroundColor: design.background_color,
    textColor: '#17201c',
    borderRadius: design.border_radius,
    customerName: 'Mohamed Elhafiani',
    pointsBalance: 720,
    pointsGoal: 1000,
    visits: cardMode === 'STAMP' ? 6 : 0,
    visitGoal: Number(stampGoal) || 8,
    rewardName: cardMode === 'STAMP' ? stampRewardName : '1 récompense offerte',
    rewardDescription: cardMode === 'STAMP' ? stampRewardDescription || 'À partir de 8 visites' : 'Encore 280 points avant votre prochaine récompense.',
    intro: design.design_config.front_subtitle,
    benefits: [
      { title: 'Offre anniversaire', description: 'Une attention spéciale le jour J.' },
      { title: 'Invitations privées', description: 'Accès aux nouveautés avant les autres.' },
      { title: 'Accès prioritaire', description: 'Un traitement privilégié lors de vos visites.' },
    ],
    rewards: [
      { id: 'preview-dessert', name: 'Dessert offert', description: 'Un dessert au choix offert', points_required: 500, reward_type: 'GIFT', discount_percent: null },
      { id: 'preview-discount', name: 'Réduction', description: '10% sur votre prochaine visite', points_required: 600, reward_type: 'DISCOUNT', discount_percent: 10 },
      { id: 'preview-drink', name: 'Boisson offerte', description: 'Une boisson au choix offerte', points_required: 750, reward_type: 'GIFT', discount_percent: null },
    ],
    history: [
      { id: 'demo-1', title: 'Visite', date: '12/08', points: 0 },
      { id: 'demo-2', title: 'Visite', date: '18/08', points: 0 },
      { id: 'demo-3', title: 'Visite', date: '24/08', points: 0 },
      { id: 'demo-4', title: 'Visite', date: '02/09', points: 0 },
      { id: 'demo-5', title: 'Visite', date: '10/09', points: 0 },
      { id: 'demo-6', title: 'Visite', date: '17/09', points: 0 },
    ],
    qrValue: window.location.origin + '/loyalty/preview-' + establishmentId,
  };

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-ink/5 bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Fidélité</p>
            <h2 className="mt-1 font-display text-3xl text-forest">Personnaliser la carte fidélité</h2>
            <p className="mt-1 text-sm text-ink/45">Une seule carte. Votre logo, votre photo, vos couleurs. Le client ne voit que sa carte.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void save(false)} disabled={saving} className="rounded-xl border border-forest/20 bg-white px-4 py-3 text-xs font-semibold text-forest">Enregistrer</button>
            <button type="button" onClick={() => void save(true)} disabled={saving} className="rounded-xl bg-forest px-5 py-3 text-xs font-semibold text-white">{saving ? 'Publication…' : 'Publier la carte'}</button>
          </div>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.9fr]">
          <div className="space-y-5">
            <div className="flex items-center gap-2 rounded-2xl border border-ink/10 bg-[#fafaf8] p-1">
              {(['Design', 'Contenu', 'Récompense', 'Aperçu'] as const).map(tab => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab);
                    const targetId = tab === 'Design' ? 'loyalty-design' : tab === 'Contenu' ? 'loyalty-content' : tab === 'Récompense' ? 'loyalty-rewards' : 'loyalty-preview';
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
                {LOYALTY_PRESETS.map(preset => {
                  const active = design.template_id === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => applyPreset(preset)}
                      className={`overflow-hidden rounded-2xl border text-left transition ${active ? 'border-forest ring-2 ring-forest/10' : 'border-ink/10 hover:border-forest/30'}`}
                    >
                      <div className="h-20 p-3" style={{ background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary}55)` }}>
                        <div className="flex h-full items-end justify-between">
                          <span className="text-[10px] font-bold uppercase tracking-[.16em]" style={{ color: preset.text }}>{preset.name}</span>
                          <span className="rounded-full px-2 py-1 text-[8px] font-semibold" style={{ color: preset.primary, background: preset.background }}>{preset.mode}</span>
                        </div>
                      </div>
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
                    ].filter(Boolean)),
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

              <div id="loyalty-rewards" className="mt-4 scroll-mt-6 rounded-2xl border border-ink/10 bg-[#fafaf8] p-4">
                {cardMode === 'STAMP' ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="text-xs text-ink/50">Nombre de tampons<input type="number" min="1" max="12" value={stampGoal} onChange={e=>setStampGoal(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5"/></label>
                    <label className="text-xs text-ink/50">Récompense<input value={stampRewardName} onChange={e=>setStampRewardName(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5"/></label>
                    <label className="text-xs text-ink/50">Description<input value={stampRewardDescription} onChange={e=>setStampRewardDescription(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5"/></label>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="text-sm font-semibold text-forest">Récompenses en points</p><p className="mt-1 text-[10px] text-ink/45">Ajoute des cadeaux ou des réductions que les clients débloquent avec leurs points.</p></div>
                      <button type="button" onClick={() => openRewardEditor()} className="inline-flex items-center gap-2 rounded-xl bg-forest px-3 py-2.5 text-[10px] font-semibold text-white"><Plus size={14}/> Ajouter</button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {rewards.filter(r => r.active).map(r => (
                        <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-ink/10 bg-white p-3.5">
                          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest/5 text-forest">{r.reward_type === 'DISCOUNT' ? <span className="text-xs font-bold">%</span> : <Gift size={17}/>}</div>
                          <div className="min-w-0 flex-1"><p className="text-xs font-semibold text-forest">{r.name}</p><p className="mt-1 text-[10px] text-ink/45">{r.points_required} points · {r.reward_type === 'DISCOUNT' ? '-' + r.discount_percent + '%' : 'Cadeau'}</p>{r.description && <p className="mt-1 truncate text-[10px] text-ink/35">{r.description}</p>}</div>
                          <button type="button" onClick={() => openRewardEditor(r)} className="rounded-xl p-2 text-ink/40 hover:bg-[#f7f7f3] hover:text-forest"><Pencil size={15}/></button>
                          <button type="button" onClick={() => void removeReward(r)} className="rounded-xl p-2 text-ink/40 hover:bg-red-50 hover:text-red-600"><Trash2 size={15}/></button>
                        </div>
                      ))}
                      {!rewards.some(r => r.active) && <div className="rounded-xl border border-dashed border-ink/10 px-4 py-6 text-center text-xs text-ink/35">Aucune récompense configurée.</div>}
                    </div>
                  </>
                )}
              </div>

              {rewardEditorOpen && (
                <div className="fixed inset-0 z-[120] grid place-items-center bg-black/60 p-4" onClick={() => !rewardSaving && setRewardEditorOpen(false)}>
                  <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center justify-between"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-gold">Fidélité points</p><h3 className="mt-1 text-xl font-semibold text-forest">{editingReward ? 'Modifier la récompense' : 'Ajouter une récompense'}</h3></div><button type="button" onClick={() => setRewardEditorOpen(false)} className="rounded-xl p-2 text-ink/40"><X size={18}/></button></div>
                    <div className="mt-5 space-y-3">
                      <label className="block text-xs text-ink/50">Nom<input value={rewardName} onChange={e=>setRewardName(e.target.value)} placeholder="Dessert offert" className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/></label>
                      <label className="block text-xs text-ink/50">Description<input value={rewardDescription} onChange={e=>setRewardDescription(e.target.value)} placeholder="Un dessert au choix" className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/></label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <label className="text-xs text-ink/50">Points nécessaires<input type="number" min="1" value={rewardPoints} onChange={e=>setRewardPoints(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5"/></label>
                        <label className="text-xs text-ink/50">Type<select value={rewardType} onChange={e=>setRewardType(e.target.value as 'GIFT'|'DISCOUNT')} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5"><option value="GIFT">🎁 Cadeau</option><option value="DISCOUNT">% Réduction</option></select></label>
                      </div>
                      {rewardType === 'DISCOUNT' && <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs text-ink/50">Réduction (%)<input type="number" min="1" max="20" value={discountPercent} onChange={e=>setDiscountPercent(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5"/></label><label className="text-xs text-ink/50">Plafond (MAD)<input type="number" min="0" value={discountMaxAmount} onChange={e=>setDiscountMaxAmount(e.target.value)} placeholder="Aucun" className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5"/></label></div>}
                    </div>
                    <button type="button" disabled={rewardSaving} onClick={() => void saveReward()} className="mt-5 w-full rounded-xl bg-forest py-3.5 text-sm font-semibold text-white disabled:opacity-50">{rewardSaving ? 'Enregistrement...' : editingReward ? 'Enregistrer les modifications' : 'Créer la récompense'}</button>
                  </div>
                </div>
              )}

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

          <div id="loyalty-preview" className="scroll-mt-6 rounded-2xl border border-ink/10 bg-[#f7f7f3] p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-gold">Aperçu en temps réel</p><p className="mt-1 text-xs text-ink/45">Voici exactement ce que vos clients verront.</p></div>
              <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-forest shadow-sm">Client</span>
            </div>
            <div className="mx-auto mt-5 w-full max-w-[430px]">
              <LoyaltyExperience config={visualExperience} />
            </div>
          </div>
        </div>
      </div>
    </section>
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
