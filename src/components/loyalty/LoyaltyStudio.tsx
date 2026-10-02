import { useEffect, useMemo, useRef, useState } from 'react';
import { Gift, ImagePlus, Loader2, Save, Settings2, Sparkles, Stamp, Star, Percent, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useLoyaltyManager, type LoyaltyProgramType, type LoyaltyReferralBonusType, type LoyaltyReferralConfig } from '@/hooks/useLoyaltyManager';
import LoyaltyPreview from './LoyaltyPreview';
import { WALLET_TEMPLATES } from '@/components/LoyaltyCardVisual';
import type { LoyaltyExperienceConfig, LoyaltyExperienceReward } from './LoyaltyExperience';

type Props = { establishmentId: string };

type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
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

const TYPES: { id: LoyaltyProgramType; label: string; description: string; icon: typeof Stamp }[] = [
  { id: 'STAMP', label: 'Tampons', description: '1 tampon par visite ou selon votre règle.', icon: Stamp },
  { id: 'POINTS_REWARD', label: 'Points', description: 'X MAD = Y points, puis récompenses.', icon: Star },
  { id: 'POINTS_DISCOUNT', label: 'Réduction', description: 'Cumulez des points jusqu’au seuil défini.', icon: Percent },
];

function bonusLabel(type: LoyaltyReferralBonusType, value: number) {
  if (type === 'STAMP') return `${value} tampon(s)`;
  if (type === 'REDUCTION') return `${value}% de réduction`;
  return `${value} point(s)`;
}

export default function LoyaltyStudio({ establishmentId }: Props) {
  const manager = useLoyaltyManager(establishmentId);
  const [tab, setTab] = useState<'structure' | 'design'>('structure');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [program, setProgram] = useState<{
    programType: LoyaltyProgramType;
    stampGoal: number;
    stampRewardName: string;
    stampRewardDescription: string;
    pointsPerCurrency: number;
    discountPointsThreshold: number;
    discountPercent: number;
    discountValidDays: number;
    enabled: boolean;
  }>({
    programType: 'POINTS_REWARD',
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
  const [design, setDesign] = useState<DesignState>(DEFAULT_DESIGN);
  const [establishment, setEstablishment] = useState({ name: 'Votre établissement', logoUrl: null as string | null });
  const wallpaperInput = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!establishmentId) return;
    setLoading(true);
    const [{ data: place }, settings, referralState, { data: designData }, { data: rewardData }] = await Promise.all([
      supabase.from('establishments').select('name,logo_url').eq('id', establishmentId).maybeSingle(),
      manager.getProgramSettings(),
      manager.getReferralConfig(),
      supabase.rpc('get_loyalty_card_builder_config', { p_establishment_id: establishmentId }),
      supabase.from('loyalty_rewards').select('id,name,description,points_required,active').eq('establishment_id', establishmentId).order('points_required', { ascending: true }),
    ]);
    if (place) setEstablishment({ name: place.name || 'Votre établissement', logoUrl: place.logo_url || null });
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
    setReferral(referralState.draftConfig);
    setRewards((rewardData ?? []) as Reward[]);
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
    setLoading(false);
  };

  useEffect(() => { void load(); }, [establishmentId]);

  const template = WALLET_TEMPLATES[design.templateId] ?? WALLET_TEMPLATES['onyx-black'];

  const previewConfig = useMemo<LoyaltyExperienceConfig>(() => ({
    type: program.programType,
    establishmentName: establishment.name,
    logoUrl: design.logoUrl || establishment.logoUrl,
    coverImageUrl: design.wallpaperUrl,
    primaryColor: design.primaryColor,
    secondaryColor: design.secondaryColor,
    backgroundColor: design.backgroundColor,
    textColor: design.textColor,
    borderRadius: 34,
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
      id: r.id, name: r.name, description: r.description, points_required: r.points_required,
    })) as LoyaltyExperienceReward[],
    qrValue: 'https://tapmarrakech.vercel.app/',
    templateId: design.templateId,
    published: design.published,
    stampStyle: design.stampStyle,
  }), [program, design, establishment, rewards]);

  const selectTemplate = (id: string) => {
    const t = WALLET_TEMPLATES[id];
    if (!t) return;
    setDesign(d => ({
      ...d,
      templateId: id,
      primaryColor: t.primary,
      secondaryColor: t.accent,
      backgroundColor: t.background,
      textColor: t.text,
    }));
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
      const { error } = await supabase.storage.from('promotion-images').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('promotion-images').getPublicUrl(path);
      setDesign(d => ({ ...d, wallpaperUrl: data.publicUrl, published: false }));
      setMessage('Wallpaper enregistré dans le brouillon.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Upload impossible.');
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
      await supabase.rpc('save_loyalty_card_builder_config', {
        p_establishment_id: establishmentId,
        p_design_config: designConfig,
        p_template_id: design.templateId,
        p_primary_color: design.primaryColor,
        p_secondary_color: design.secondaryColor,
        p_background_color: design.backgroundColor,
        p_text_color: design.textColor,
        p_button_color: design.buttonColor,
        p_border_radius: 34,
        p_published: publish,
      });
      setDesign(d => ({ ...d, published: publish }));
      setMessage(publish ? 'Configuration publiée.' : 'Brouillon enregistré.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Impossible d’enregistrer.');
    } finally {
      setSaving(false);
    }
  };

  const saveReward = async (name: string, points: number) => {
    if (!name.trim() || points <= 0) return;
    const { error } = await supabase.from('loyalty_rewards').insert({
      establishment_id: establishmentId,
      name: name.trim(),
      description: null,
      points_required: Math.floor(points),
      active: true,
    });
    if (!error) await load();
    else setMessage(error.message);
  };

  const deleteReward = async (id: string) => {
    const { error } = await supabase.from('loyalty_rewards').delete().eq('id', id).eq('establishment_id', establishmentId);
    if (!error) setRewards(r => r.filter(item => item.id !== id));
    else setMessage(error.message);
  };

  if (loading) return <div className="grid min-h-[560px] place-items-center rounded-[28px] bg-white"><Loader2 className="animate-spin text-gold" /></div>;

  return (
    <section className="rounded-[30px] border border-ink/5 bg-white p-4 shadow-soft md:p-6">
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-gold">Loyalty Studio</p>
          <h2 className="mt-1 font-display text-3xl text-forest">Carte fidélité</h2>
          <p className="mt-1 text-sm text-ink/45">Structure, réglages précis et design Wallet dans un seul studio.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void saveAll(false)} disabled={saving} className="rounded-xl border border-forest/15 bg-white px-4 py-2.5 text-xs font-semibold text-forest">Enregistrer</button>
          <button type="button" onClick={() => void saveAll(true)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white"><Save size={14}/>{saving ? '...' : 'Publier'}</button>
        </div>
      </div>

      {message && <div className="mb-4 rounded-xl bg-[#f7f7f3] px-4 py-3 text-xs text-forest">{message}</div>}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div>
          <div className="mb-5 flex rounded-2xl bg-[#f7f7f3] p-1">
            <button type="button" onClick={() => setTab('structure')} className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold ${tab === 'structure' ? 'bg-white text-forest shadow-sm' : 'text-ink/45'}`}><Settings2 size={14} className="mr-2 inline"/>Structure</button>
            <button type="button" onClick={() => setTab('design')} className={`flex-1 rounded-xl px-4 py-2.5 text-xs font-semibold ${tab === 'design' ? 'bg-white text-forest shadow-sm' : 'text-ink/45'}`}><Sparkles size={14} className="mr-2 inline"/>Design</button>
          </div>

          {tab === 'structure' ? (
            <div className="space-y-5">
              <div className="rounded-2xl border border-ink/8 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-gold">Type de carte</p>
                <div className="mt-3 grid gap-3 md:grid-cols-3">
                  {TYPES.map(item => {
                    const Icon = item.icon;
                    return <button key={item.id} type="button" onClick={() => setProgram(p => ({ ...p, programType: item.id }))} className={`rounded-2xl border p-4 text-left ${program.programType === item.id ? 'border-forest bg-forest/[.04] ring-2 ring-forest/10' : 'border-ink/10'}`}><Icon size={18} className="text-gold"/><p className="mt-3 text-sm font-semibold text-forest">{item.label}</p><p className="mt-1 text-[10px] leading-4 text-ink/45">{item.description}</p></button>;
                  })}
                </div>
              </div>

              <div className="rounded-2xl border border-ink/8 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-gold">Moteur de points</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <label className="text-xs font-semibold text-ink/55">MAD dépensés<input type="number" min="1" step=".01" value={1} readOnly className="mt-2 w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-3 py-3 text-sm"/></label>
                  <label className="text-xs font-semibold text-ink/55">Points gagnés<input type="number" min=".01" step=".01" value={program.pointsPerCurrency} onChange={e => setProgram(p => ({ ...p, pointsPerCurrency: Number(e.target.value) || 0.01 }))} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-3 text-sm"/></label>
                </div>
                <p className="mt-3 text-[10px] text-ink/40">Règle active : 1 MAD = {program.pointsPerCurrency} point(s). L’administrateur contrôle ce taux.</p>
              </div>

              {program.programType === 'STAMP' && <div className="rounded-2xl border border-ink/8 bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-gold">Tampons</p><div className="mt-4 grid gap-4 md:grid-cols-3"><label className="text-xs font-semibold text-ink/55">Objectif<input type="number" min="1" max="10" value={program.stampGoal} onChange={e=>setProgram(p=>({...p,stampGoal:Math.min(10,Math.max(1,Number(e.target.value)||1))}))} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-3 text-sm"/></label><label className="md:col-span-2 text-xs font-semibold text-ink/55">Récompense<input value={program.stampRewardName} onChange={e=>setProgram(p=>({...p,stampRewardName:e.target.value}))} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-3 text-sm"/></label></div></div>}

              {program.programType === 'POINTS_DISCOUNT' && <div className="rounded-2xl border border-ink/8 bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[.18em] text-gold">Seuil de réduction</p><div className="mt-4 grid gap-4 md:grid-cols-3"><label className="text-xs font-semibold text-ink/55">Seuil points<input type="number" min="1" value={program.discountPointsThreshold} onChange={e=>setProgram(p=>({...p,discountPointsThreshold:Math.max(1,Number(e.target.value)||1)}))} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-3 text-sm"/></label><label className="text-xs font-semibold text-ink/55">% réduction<input type="number" min="1" max="100" value={program.discountPercent} onChange={e=>setProgram(p=>({...p,discountPercent:Math.min(100,Math.max(1,Number(e.target.value)||1))}))} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-3 text-sm"/></label><label className="text-xs font-semibold text-ink/55">Validité (jours)<input type="number" min="1" max="365" value={program.discountValidDays} onChange={e=>setProgram(p=>({...p,discountValidDays:Math.min(365,Math.max(1,Number(e.target.value)||1))}))} className="mt-2 w-full rounded-xl border border-ink/10 px-3 py-3 text-sm"/></label></div></div>}

              <div className="rounded-2xl border border-ink/8 bg-white p-5">
                <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-gold">Récompenses</p><p className="mt-1 text-[10px] text-ink/40">Nom et seuil de points affichés sur la carte.</p></div></div>
                <div className="mt-4 space-y-2">{rewards.map(r=><div key={r.id} className="flex items-center gap-3 rounded-xl border border-ink/8 bg-[#fafaf8] p-3"><Gift size={15} className="text-gold"/><div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-forest">{r.name}</p><p className="text-[10px] text-ink/40">{r.points_required} points</p></div><button type="button" onClick={()=>void deleteReward(r.id)} className="p-2 text-ink/30 hover:text-red-500"><Trash2 size={14}/></button></div>)}</div>
                <RewardQuickAdd onAdd={saveReward}/>
              </div>

              <div className="rounded-2xl border border-ink/8 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-gold">Parrainage</p>
                <label className="mt-4 flex items-center gap-3 text-xs font-semibold text-forest"><input type="checkbox" checked={referral.enabled} onChange={e=>setReferral(r=>({...r,enabled:e.target.checked}))}/> Activer le parrainage</label>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <ReferralField label="Bonus du parrain" type={referral.referrer_bonus_type} value={referral.referrer_bonus_value} onChange={(type,value)=>setReferral(r=>({...r,referrer_bonus_type:type,referrer_bonus_value:value}))}/>
                  <ReferralField label="Bonus du filleul" type={referral.referee_bonus_type} value={referral.referee_bonus_value} onChange={(type,value)=>setReferral(r=>({...r,referee_bonus_type:type,referee_bonus_value:value}))}/>
                </div>
                <p className="mt-3 text-[10px] text-ink/40">{referral.enabled ? `Parrain : ${bonusLabel(referral.referrer_bonus_type, referral.referrer_bonus_value)} · Filleul : ${bonusLabel(referral.referee_bonus_type, referral.referee_bonus_value)}` : 'Parrainage désactivé.'}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-2xl border border-ink/8 bg-white p-5">
                <p className="text-[10px] font-bold uppercase tracking-[.18em] text-gold">8 Wallet Premium</p>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {Object.values(WALLET_TEMPLATES).map(t=><button key={t.id} type="button" onClick={()=>selectTemplate(t.id)} className={`overflow-hidden rounded-2xl border text-left ${design.templateId===t.id?'border-forest ring-2 ring-forest/10':'border-ink/10'}`}><div className="h-20" style={{background:t.background}}/><div className="bg-white px-3 py-2"><p className="text-[10px] font-semibold text-forest">{t.name}</p></div></button>)}
                </div>
              </div>
              <div className="rounded-2xl border border-ink/8 bg-white p-5">
                <div className="flex items-center gap-3"><ImagePlus size={17} className="text-gold"/><div><p className="text-sm font-semibold text-forest">Wallpaper</p><p className="text-[10px] text-ink/40">Le wallpaper du brouillon est appliqué en cover sur la carte.</p></div></div>
                <div className="mt-4 flex gap-3"><button type="button" onClick={()=>wallpaperInput.current?.click()} className="rounded-xl border border-forest/15 px-4 py-2.5 text-xs font-semibold text-forest">Choisir une image</button>{design.wallpaperUrl && <button type="button" onClick={()=>setDesign(d=>({...d,wallpaperUrl:null,published:false}))} className="rounded-xl border border-red-100 px-4 py-2.5 text-xs text-red-600">Retirer</button>}</div>
                <input ref={wallpaperInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e=>{const f=e.target.files?.[0];if(f)void uploadWallpaper(f);e.currentTarget.value='';}}/>
                {design.wallpaperUrl && <img src={design.wallpaperUrl} alt="" className="mt-4 h-28 w-full rounded-2xl object-cover"/>}
              </div>
            </div>
          )}
        </div>

        <aside className="sticky top-6 h-fit rounded-[28px] bg-[#f1f3f0] p-5">
          <div className="mb-4 flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-gold">Preview permanent</p><p className="mt-1 text-xs text-ink/40">300 × 450 px</p></div><span className="rounded-full bg-white px-3 py-1 text-[9px] font-semibold text-forest">Wallet</span></div>
          <div className="flex w-full items-center justify-center overflow-visible"><LoyaltyPreview config={previewConfig}/></div>
          <div className="mt-4 rounded-2xl bg-white p-4"><p className="text-[10px] uppercase tracking-[.16em] text-gold">Récompense visible</p><p className="mt-1 text-sm font-semibold text-forest">{program.stampRewardName || rewards[0]?.name || 'Cadeau fidélité'}</p></div>
        </aside>
      </div>
    </section>
  );
}

function RewardQuickAdd({ onAdd }: { onAdd: (name: string, points: number) => Promise<void> }) {
  const [name,setName]=useState('');
  const [points,setPoints]=useState('100');
  return <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_130px_auto]"><input value={name} onChange={e=>setName(e.target.value)} placeholder="Nom de la récompense" className="rounded-xl border border-ink/10 px-3 py-2.5 text-xs"/><input type="number" min="1" value={points} onChange={e=>setPoints(e.target.value)} placeholder="Points" className="rounded-xl border border-ink/10 px-3 py-2.5 text-xs"/><button type="button" onClick={async()=>{await onAdd(name,Number(points));setName('');}} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Ajouter</button></div>;
}

function ReferralField({ label, type, value, onChange }: { label:string; type:LoyaltyReferralBonusType; value:number; onChange:(type:LoyaltyReferralBonusType,value:number)=>void }) {
  return <div><p className="text-xs font-semibold text-ink/55">{label}</p><div className="mt-2 grid grid-cols-[1fr_110px] gap-2"><select value={type} onChange={e=>onChange(e.target.value as LoyaltyReferralBonusType,value)} className="rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs"><option value="POINTS">Points</option><option value="STAMP">Tampons</option><option value="REDUCTION">Réduction</option></select><input type="number" min="0" value={value} onChange={e=>onChange(type,Math.max(0,Number(e.target.value)||0))} className="rounded-xl border border-ink/10 px-3 py-2.5 text-xs"/></div></div>;
}
