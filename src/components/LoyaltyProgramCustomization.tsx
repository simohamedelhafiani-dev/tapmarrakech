import { useEffect, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Gift, ImagePlus, Loader2, QrCode, Sparkles, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { defaultLoyaltyDesignConfig, LoyaltyCardVisual, type LoyaltyDesignConfig } from './LoyaltyCardVisual';

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

type Reward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  reward_type: 'GIFT' | 'DISCOUNT';
  discount_percent: number | null;
  discount_max_amount: number | null;
};

const templates = [
  { id: 'luxury', name: 'Signature Luxe', description: 'Vert profond, or, identité premium', colors: ['#173D32','#D3A84C','#F7F7F3'] },
  { id: 'minimal', name: 'Pure', description: 'Minimaliste, lumineux, très épuré', colors: ['#111827','#94A3B8','#FFFFFF'] },
  { id: 'elegant', name: 'Maison', description: 'Chaleureux, boutique, intemporel', colors: ['#5B4636','#B89470','#F6F0E7'] },
  { id: 'modern', name: 'Contemporary', description: 'Frais, moderne, digital premium', colors: ['#164E63','#06B6D4','#ECFEFF'] },
  { id: 'bold', name: 'Night Club', description: 'Sombre, contrasté, spectaculaire', colors: ['#3B1D5A','#E879F9','#FAF5FF'] },
  { id: 'classic', name: 'Heritage', description: 'Élégant, traditionnel, maison', colors: ['#1F2937','#C9A227','#F9FAFB'] },
] as const;

const baseDesign: Design = {
  template_id: 'luxury',
  primary_color: '#173D32',
  secondary_color: '#D3A84C',
  background_color: '#F7F7F3',
  text_color: '#173D32',
  button_color: '#173D32',
  border_radius: 24,
  design_config: defaultLoyaltyDesignConfig,
  published: false,
};

export default function LoyaltyProgramCustomization({ establishmentId }: { establishmentId: string }) {
  const [design, setDesign] = useState<Design>(baseDesign);
  const [establishment, setEstablishment] = useState<{ name: string; logo_url: string | null; phone?: string | null; address?: string | null }>({ name: 'Votre établissement', logo_url: null });
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [side, setSide] = useState<'front' | 'back'>('front');
  const [mobile, setMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showNewReward, setShowNewReward] = useState(false);
  const [rewardName, setRewardName] = useState('');
  const [rewardDescription, setRewardDescription] = useState('');
  const [rewardPoints, setRewardPoints] = useState('500');
  const [rewardType, setRewardType] = useState<'GIFT' | 'DISCOUNT'>('GIFT');
  const [discountPercent, setDiscountPercent] = useState('10');
  const [discountMaxAmount, setDiscountMaxAmount] = useState('');

  async function load() {
    if (!establishmentId) return;
    const [{ data: designData }, { data: rewardsData }, { data: place }] = await Promise.all([
      supabase.rpc('get_loyalty_card_config', { p_establishment_id: establishmentId }),
      supabase.from('loyalty_rewards').select('id,name,description,points_required,reward_type,discount_percent,discount_max_amount').eq('establishment_id', establishmentId).eq('active', true).order('points_required'),
      supabase.from('establishments').select('name,logo_url,phone,address').eq('id', establishmentId).maybeSingle(),
    ]);
    const row = Array.isArray(designData) ? designData[0] : designData;
    if (row) {
      setDesign({
        template_id: row.template_id ?? 'luxury',
        primary_color: row.primary_color ?? '#173D32',
        secondary_color: row.secondary_color ?? '#D3A84C',
        background_color: row.background_color ?? '#F7F7F3',
        text_color: row.text_color ?? '#173D32',
        button_color: row.button_color ?? '#173D32',
        border_radius: Number(row.border_radius ?? 24),
        design_config: { ...defaultLoyaltyDesignConfig, ...(row.design_config ?? {}) },
        published: Boolean(row.published),
      });
    }
    if (place) setEstablishment({ name: place.name || 'Votre établissement', logo_url: place.logo_url || null, phone: place.phone, address: place.address });
    setRewards((rewardsData ?? []) as Reward[]);
  }

  useEffect(() => { void load(); }, [establishmentId]);

  function applyTemplate(id: string) {
    const t = templates.find(x => x.id === id);
    if (!t) return;
    setDesign(d => ({ ...d, template_id: t.id, primary_color: t.colors[0], secondary_color: t.colors[1], background_color: t.colors[2], text_color: t.colors[0], button_color: t.colors[0], published: false }));
  }

  function updateConfig(patch: Partial<LoyaltyDesignConfig>) {
    setDesign(d => ({ ...d, design_config: { ...d.design_config, ...patch }, published: false }));
  }

  async function save(publish: boolean) {
    setSaving(true);
    const { error } = await supabase.rpc('save_loyalty_card_design', {
      p_establishment_id: establishmentId,
      p_template_id: design.template_id,
      p_primary_color: design.primary_color,
      p_secondary_color: design.secondary_color,
      p_background_color: design.background_color,
      p_text_color: design.text_color,
      p_button_color: design.button_color,
      p_border_radius: design.border_radius,
      p_design_config: design.design_config,
      p_published: publish,
    });
    setSaving(false);
    if (error) return alert(error.message);
    setDesign(d => ({ ...d, published: publish }));
    alert(publish ? 'Carte fidélité publiée.' : 'Brouillon enregistré.');
  }

  async function generateAI() {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-loyalty-template', {
        body: { establishment_id: establishmentId, prompt: aiPrompt.trim() || 'Carte fidélité premium, élégante, adaptée à mon établissement.' },
      });
      if (error || !data?.success) throw new Error(data?.error || error?.message || 'Génération IA impossible.');
      setDesign(d => ({
        ...d,
        template_id: data.template_id || 'luxury',
        primary_color: data.primary_color || d.primary_color,
        secondary_color: data.secondary_color || d.secondary_color,
        background_color: data.background_color || d.background_color,
        text_color: data.text_color || d.text_color,
        button_color: data.button_color || d.button_color,
        design_config: { ...d.design_config, ...(data.design_config || {}), background_image_url: data.image_url || d.design_config.background_image_url, ai_prompt: aiPrompt },
        published: false,
      }));
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Génération IA impossible.');
    } finally { setAiLoading(false); }
  }

  async function createReward() {
    const points = Number(rewardPoints);
    const percent = Number(discountPercent);
    const maxAmount = discountMaxAmount.trim() ? Number(discountMaxAmount) : null;
    if (!rewardName.trim() || !Number.isInteger(points) || points <= 0) return alert('Saisis un nom et un nombre de points valide.');
    if (rewardType === 'DISCOUNT' && (!Number.isFinite(percent) || percent <= 0 || percent > 20)) return alert('La réduction doit être comprise entre 1% et 20%.');
    const { error } = await supabase.rpc('create_loyalty_reward', { p_establishment_id: establishmentId, p_name: rewardName.trim(), p_description: rewardDescription.trim() || null, p_points_required: points, p_reward_type: rewardType, p_discount_percent: rewardType === 'DISCOUNT' ? percent : null, p_discount_max_amount: rewardType === 'DISCOUNT' ? maxAmount : null });
    if (error) return alert(error.message);
    setRewardName(''); setRewardDescription(''); setRewardPoints('500'); setRewardType('GIFT'); setDiscountPercent('10'); setDiscountMaxAmount(''); setShowNewReward(false); await load();
  }

  async function removeReward(id: string) {
    if (!window.confirm('Désactiver cette récompense ?')) return;
    const { error } = await supabase.from('loyalty_rewards').update({ active: false }).eq('id', id).eq('establishment_id', establishmentId);
    if (error) return alert(error.message);
    await load();
  }

  const visualDesign = { ...design, config: design.design_config };
  const visualCard = { establishmentName: establishment.name, logoUrl: establishment.logo_url, points: 250, customerName: 'Votre client', loyaltyNumber: 'TM-000250', phone: establishment.phone, address: establishment.address, cardUrl: window.location.origin + '/loyalty/preview-' + establishmentId };

  return (
    <section className="space-y-6">
      <div className="rounded-[2rem] border border-ink/5 bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Fidélité</p><h2 className="mt-1 font-display text-3xl text-forest">Créer votre carte fidélité</h2><p className="mt-1 text-sm text-ink/45">Concevez le recto, le verso et l’expérience mobile avant publication.</p></div>
          <div className="flex gap-2"><button type="button" onClick={() => void save(false)} disabled={saving} className="rounded-xl border border-forest/20 bg-white px-4 py-3 text-xs font-semibold text-forest">Enregistrer brouillon</button><button type="button" onClick={() => void save(true)} disabled={saving} className="rounded-xl bg-forest px-5 py-3 text-xs font-semibold text-white">{saving ? 'Publication…' : '✓ Valider et publier'}</button></div>
        </div>

        <div className="mt-6 grid gap-5 xl:grid-cols-[1.05fr_.9fr_1.35fr]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-ink/10 p-4">
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-gold">1 · Templates</p><p className="mt-1 text-xs text-ink/45">Choisissez un style ou créez-en un avec l’IA.</p></div><span className="rounded-full bg-[#f7f7f3] px-3 py-1 text-[10px]">{templates.length} modèles</span></div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {templates.map(t => <button key={t.id} type="button" onClick={() => applyTemplate(t.id)} className={`relative overflow-hidden rounded-xl border p-2 text-left ${design.template_id === t.id ? 'border-gold ring-2 ring-gold/20' : 'border-ink/10'}`}>
                  <div className="relative h-24 overflow-hidden rounded-lg p-3" style={{ background: t.colors[0] }}><div className="absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20" style={{ background: t.colors[1] }} />{establishment.logo_url && <img src={establishment.logo_url} alt="" className="relative h-7 w-7 rounded-full bg-white object-contain p-1" />}<p className="relative mt-3 truncate text-[9px] font-semibold uppercase tracking-wider text-white">{establishment.name}</p></div>
                  <p className="mt-2 text-xs font-semibold text-forest">{t.name}</p><p className="mt-0.5 text-[10px] text-ink/40">{t.description}</p>
                  {design.template_id === t.id && <span className="absolute right-2 top-2 grid h-5 w-5 place-items-center rounded-full bg-gold text-white"><Check size={12}/></span>}
                </button>)}
              </div>
            </div>

            <div className="rounded-2xl border border-gold/20 bg-[#fbf8ee] p-4">
              <div className="flex items-start gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-gold text-white"><Sparkles size={18}/></div><div><p className="font-semibold text-forest">Générer un template avec l’IA</p><p className="mt-1 text-xs leading-5 text-ink/45">Décrivez le style souhaité. L’IA crée le visuel et applique une direction artistique à la carte.</p></div></div>
              <input value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} placeholder="Ex. luxe marocain contemporain, vert profond et or, très premium…" className="mt-4 w-full rounded-xl border border-ink/10 bg-white px-3 py-3 text-xs outline-none focus:border-gold" />
              <div className="mt-2 flex flex-wrap gap-2">{['Élégant','Moderne','Traditionnel','Minimaliste','Luxueux'].map(x => <button key={x} type="button" onClick={() => setAiPrompt(x)} className="rounded-full bg-white px-3 py-1.5 text-[10px] text-ink/55">{x}</button>)}</div>
              <button type="button" onClick={() => void generateAI()} disabled={aiLoading} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-xs font-bold text-forest disabled:opacity-50">{aiLoading ? <><Loader2 size={15} className="animate-spin"/> Génération…</> : <><Sparkles size={15}/> Générer avec l’IA</>}</button>
            </div>
          </div>

          <div className="rounded-2xl border border-ink/10 bg-[#f7f7f3] p-4">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-gold">2 · Personnaliser</p><p className="mt-1 text-xs text-ink/45">Logo, texte, couleurs et éléments.</p></div><button type="button" onClick={() => setShowAdvanced(v => !v)} className="text-[10px] font-semibold text-forest">{showAdvanced ? 'Simple' : 'Mode avancé'}</button></div>
            <div className="mt-4 flex rounded-xl bg-white p-1"><button onClick={() => setSide('front')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${side==='front'?'bg-forest text-white':'text-ink/45'}`}>Recto</button><button onClick={() => setSide('back')} className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${side==='back'?'bg-forest text-white':'text-ink/45'}`}>Verso</button></div>
            <div className="mt-4 space-y-4">
              <label className="block text-xs font-medium text-ink/50">Titre {side}<input value={side==='front'?design.design_config.front_title:design.design_config.back_title} onChange={e => updateConfig(side==='front'?{front_title:e.target.value}:{back_title:e.target.value})} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"/></label>
              <label className="block text-xs font-medium text-ink/50">{side==='front'?'Sous-titre':'Message'}<textarea value={side==='front'?design.design_config.front_subtitle:design.design_config.back_message} onChange={e => updateConfig(side==='front'?{front_subtitle:e.target.value}:{back_message:e.target.value})} rows={3} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"/></label>
              <div className="grid grid-cols-3 gap-2">{[['principal','primary_color'],['accent','secondary_color'],['fond','background_color']].map(([label,key])=><label key={key} className="text-[10px] uppercase text-ink/40">{label}<input type="color" value={(design as any)[key]} onChange={e=>setDesign(d=>({...d,[key]:e.target.value},published:false))} className="mt-1 h-9 w-full cursor-pointer rounded-lg border-0 bg-transparent p-0"/></label>)}</div>
              <div className="rounded-xl border border-ink/10 bg-white p-3"><p className="text-[10px] font-semibold uppercase tracking-wider text-ink/40">Logo</p><p className="mt-1 text-xs text-ink/45">Position horizontale / verticale</p><div className="mt-3 grid grid-cols-3 gap-1">{[-24,0,24].map(y=><button key={y} type="button" onClick={()=>updateConfig({logo_y:y})} className={`h-7 rounded border text-[9px] ${design.design_config.logo_y===y?'border-gold bg-gold/10':'border-ink/10'}`}>{y===0?'Centre':y<0?'Haut':'Bas'}</button>)}</div><input type="range" min="-50" max="50" value={design.design_config.logo_x} onChange={e=>updateConfig({logo_x:Number(e.target.value)})} className="mt-3 w-full"/></div>
              <label className="flex items-center justify-between rounded-xl border border-ink/10 bg-white p-3 text-xs"><span className="flex items-center gap-2"><QrCode size={15}/> QR fidélité</span><input type="checkbox" checked={design.design_config.show_qr} onChange={e=>updateConfig({show_qr:e.target.checked})}/></label>
              <label className="flex items-center justify-between rounded-xl border border-ink/10 bg-white p-3 text-xs"><span>Afficher le solde</span><input type="checkbox" checked={design.design_config.show_points} onChange={e=>updateConfig({show_points:e.target.checked})}/></label>
              {showAdvanced && <div className="space-y-3 rounded-xl border border-ink/10 bg-white p-3"><label className="block text-[10px] uppercase text-ink/40">Style des tampons<select value={design.design_config.stamp_style} onChange={e=>updateConfig({stamp_style:e.target.value as LoyaltyDesignConfig['stamp_style']})} className="mt-1 w-full rounded-lg border border-ink/10 px-2 py-2 text-xs"><option value="circles">Cercles</option><option value="squares">Carrés</option><option value="stars">Étoiles</option><option value="hearts">Cœurs</option></select></label><label className="block text-[10px] uppercase text-ink/40">Rayon<select value={design.border_radius} onChange={e=>setDesign(d=>({...d,border_radius:Number(e.target.value),published:false}))} className="mt-1 w-full rounded-lg border border-ink/10 px-2 py-2 text-xs">{[12,16,20,24,28,32].map(x=><option key={x}>{x}</option>)}</select></label></div>}
            </div>
          </div>

          <div className="rounded-2xl border border-ink/10 bg-white p-4">
            <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-gold">3 · Aperçu</p><p className="mt-1 text-xs text-ink/45">{design.published ? 'Publié' : 'Brouillon non publié'}</p></div><div className="flex gap-1 rounded-xl bg-[#f7f7f3] p-1"><button onClick={()=>setMobile(false)} className={`rounded-lg px-3 py-2 text-[10px] ${!mobile?'bg-white shadow-sm text-forest':'text-ink/40'}`}>Carte</button><button onClick={()=>setMobile(true)} className={`rounded-lg px-3 py-2 text-[10px] ${mobile?'bg-white shadow-sm text-forest':'text-ink/40'}`}>Mobile</button></div></div>
            <div className={`mt-5 mx-auto transition-all ${mobile?'max-w-[280px] rounded-[2rem] border-[8px] border-[#20252b] bg-[#20252b] p-2':'max-w-2xl'}`}>
              <div className={mobile?'overflow-hidden rounded-[1.4rem] bg-white p-3':''}>
                <div className="space-y-4">
                  <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Recto de la carte</p><LoyaltyCardVisual design={visualDesign} card={visualCard} side="front" compact={mobile}/></div>
                  {!mobile && <div><p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink/40">Verso de la carte</p><LoyaltyCardVisual design={visualDesign} card={visualCard} side="back" compact={false}/></div>}
                </div>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-xs text-green-800"><strong>Prêt à publier.</strong> Vérifiez le recto, le verso, le logo et le QR puis cliquez sur « Valider et publier ».</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-ink/5 bg-white p-5">
        <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-wider text-gold">Récompenses</p><h3 className="mt-1 text-lg font-semibold text-forest">Récompenses du programme</h3></div><button onClick={()=>setShowNewReward(v=>!v)} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">{showNewReward?'Fermer':'+ Nouvelle récompense'}</button></div>
        {showNewReward && <div className="mt-4 grid gap-3 rounded-xl bg-[#f7f7f3] p-4 md:grid-cols-2"><input value={rewardName} onChange={e=>setRewardName(e.target.value)} placeholder="Nom" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/><input value={rewardPoints} onChange={e=>setRewardPoints(e.target.value)} type="number" placeholder="Points requis" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/><input value={rewardDescription} onChange={e=>setRewardDescription(e.target.value)} placeholder="Description" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/><select value={rewardType} onChange={e=>setRewardType(e.target.value as 'GIFT'|'DISCOUNT')} className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm"><option value="GIFT">Cadeau</option><option value="DISCOUNT">Réduction</option></select><input value={discountPercent} onChange={e=>setDiscountPercent(e.target.value)} type="number" placeholder="% réduction" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/><input value={discountMaxAmount} onChange={e=>setDiscountMaxAmount(e.target.value)} type="number" placeholder="Plafond MAD" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm"/><button onClick={()=>void createReward()} className="rounded-xl bg-gold px-4 py-2.5 text-xs font-bold text-forest md:col-span-2">Créer la récompense</button></div>}
        <div className="mt-4 grid gap-2 md:grid-cols-2">{rewards.length===0?<p className="text-sm text-ink/45">Aucune récompense.</p>:rewards.map(r=><div key={r.id} className="flex items-center justify-between rounded-xl bg-[#f7f7f3] p-3"><div><p className="text-sm font-semibold text-forest">{r.name}</p><p className="text-[11px] text-ink/40">{r.points_required} pts</p></div><button onClick={()=>void removeReward(r.id)} className="rounded-lg p-2 text-red-500"><Trash2 size={15}/></button></div>)}</div>
      </div>
    </section>
  );
}
