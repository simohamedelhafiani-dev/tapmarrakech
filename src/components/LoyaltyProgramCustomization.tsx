import { useEffect, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, QrCode, Stamp, Upload } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { defaultLoyaltyDesignConfig, LoyaltyCardVisual, type LoyaltyDesignConfig } from './LoyaltyCardVisual';

type CardMode = 'QR' | 'STAMP';

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
  template_id: 'custom',
  primary_color: '#173D32',
  secondary_color: '#D3A84C',
  background_color: '#F7F7F3',
  text_color: '#FFFFFF',
  button_color: '#173D32',
  border_radius: 24,
  design_config: {
    ...defaultLoyaltyDesignConfig,
    card_mode: 'QR',
    front_title: 'CARTE FIDÉLITÉ',
    front_subtitle: 'Une expérience qui mérite de revenir.',
  },
  published: false,
};

export default function LoyaltyProgramCustomization({ establishmentId }: { establishmentId: string }) {
  const [design, setDesign] = useState<Design>(baseDesign);
  const [establishment, setEstablishment] = useState<{ name: string; logo_url: string | null }>({ name: 'Votre établissement', logo_url: null });
  const [cardMode, setCardMode] = useState<CardMode>('QR');
  const [stampGoal, setStampGoal] = useState('10');
  const [stampRewardName, setStampRewardName] = useState('Cadeau fidélité');
  const [stampRewardDescription, setStampRewardDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'photo' | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const photoInput = useRef<HTMLInputElement>(null);

  async function load() {
    if (!establishmentId) return;
    const [{ data: designData }, { data: place }, { data: programData }] = await Promise.all([
      supabase.rpc('get_loyalty_card_config', { p_establishment_id: establishmentId }),
      supabase.from('establishments').select('name,logo_url').eq('id', establishmentId).maybeSingle(),
      supabase.rpc('get_loyalty_program_settings', { p_establishment_id: establishmentId }),
    ]);

    const row = Array.isArray(designData) ? designData[0] : designData;
    if (row) {
      const nextConfig = { ...defaultLoyaltyDesignConfig, ...(row.design_config ?? {}) };
      setDesign({
        template_id: 'custom',
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
    if (place) setEstablishment({ name: place.name || 'Votre établissement', logo_url: place.logo_url || null });

    const program = Array.isArray(programData) ? programData[0] : programData;
    if (program) {
      setStampGoal(String(program.stamp_goal ?? 10));
      setStampRewardName(program.stamp_reward_name ?? 'Cadeau fidélité');
      setStampRewardDescription(program.stamp_reward_description ?? '');
      if (!row?.design_config?.card_mode) setCardMode(program.program_type === 'STAMP' ? 'STAMP' : 'QR');
    }
  }

  useEffect(() => { void load(); }, [establishmentId]);

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

  async function uploadAsset(file: File, kind: 'logo' | 'photo') {
    if (!file.type.startsWith('image/')) return alert('Choisis une image PNG, JPG ou WEBP.');
    if (file.size > 5 * 1024 * 1024) return alert('L’image doit faire moins de 5 Mo.');
    setUploading(kind);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `loyalty-cards/${establishmentId}/${kind}-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from('loyalty-assets').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('promotion-images').getPublicUrl(path);
      updateConfig(kind === 'logo' ? { logo_url: data.publicUrl } : { background_image_url: data.publicUrl, ai_generation_id: undefined });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Impossible d’envoyer cette image.');
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
      p_template_id: 'custom',
      p_primary_color: design.primary_color,
      p_secondary_color: design.secondary_color,
      p_background_color: design.background_color,
      p_text_color: design.text_color,
      p_button_color: design.button_color,
      p_border_radius: design.border_radius,
      p_design_config: { ...design.design_config, card_mode: cardMode, show_qr: cardMode === 'QR', show_points: false },
      p_published: publish,
    });
    setSaving(false);
    if (error) return alert(error.message);
    setDesign(d => ({ ...d, template_id: 'custom', published: publish }));
    alert(publish ? 'Carte fidélité publiée.' : 'Brouillon enregistré.');
  }

  const visualDesign = { ...design, config: { ...design.design_config, card_mode: cardMode } };
  const visualCard = {
    establishmentName: establishment.name,
    logoUrl: design.design_config.logo_url || establishment.logo_url,
    points: 0,
    customerName: 'Mohamed Elhafiani',
    loyaltyNumber: 'TM-000250',
    cardUrl: window.location.origin + '/loyalty/preview-' + establishmentId,
    stampsBalance: cardMode === 'STAMP' ? 4 : 0,
    stampGoal: Number(stampGoal) || 10,
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
              {['Design', 'Contenu', 'Récompense', 'Aperçu'].map((tab, index) => (
                <div key={tab} className={`flex-1 rounded-xl px-3 py-2.5 text-center text-[10px] font-semibold ${index === 0 ? 'bg-white text-forest shadow-sm' : 'text-ink/35'}`}>{tab}</div>
              ))}
            </div>

            <div className="rounded-2xl border border-ink/10 p-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <AssetPicker title="Logo de l’établissement" description="PNG, JPG ou WEBP · 5 Mo max" value={design.design_config.logo_url || establishment.logo_url} fallback={establishment.logo_url} loading={uploading === 'logo'} inputRef={logoInput} />
                <AssetPicker title="Photo de fond" description="Une photo qui représente votre établissement" value={design.design_config.background_image_url} loading={uploading === 'photo'} inputRef={photoInput} />
              </div>
              <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const file=e.target.files?.[0]; if(file) void uploadAsset(file,'logo'); e.currentTarget.value=''; }} />
              <input ref={photoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const file=e.target.files?.[0]; if(file) void uploadAsset(file,'photo'); e.currentTarget.value=''; }} />

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

              {cardMode === 'STAMP' && (
                <div className="mt-4 grid gap-3 rounded-2xl bg-[#fafaf8] p-4 sm:grid-cols-3">
                  <label className="text-xs text-ink/50">Nombre de tampons<input type="number" min="1" max="12" value={stampGoal} onChange={e=>setStampGoal(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5"/></label>
                  <label className="text-xs text-ink/50">Récompense<input value={stampRewardName} onChange={e=>setStampRewardName(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5"/></label>
                  <label className="text-xs text-ink/50">Description<input value={stampRewardDescription} onChange={e=>setStampRewardDescription(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5"/></label>
                </div>
              )}

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-ink/50">Coins arrondis <span className="float-right">{design.border_radius}px</span><input type="range" min="12" max="36" value={design.border_radius} onChange={e=>setDesign(d=>({...d,border_radius:Number(e.target.value),published:false}))} className="mt-3 w-full"/></label>
                <label className="text-xs text-ink/50">Style des tampons<select disabled={cardMode !== 'STAMP'} value={design.design_config.stamp_style} onChange={e=>updateConfig({stamp_style:e.target.value as LoyaltyDesignConfig['stamp_style']})} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 disabled:opacity-40"><option value="circles">Cercles</option><option value="squares">Carrés</option><option value="stars">Étoiles</option><option value="hearts">Cœurs</option></select></label>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-ink/10 bg-[#f7f7f3] p-4">
            <div className="flex items-center justify-between">
              <div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-gold">Aperçu en temps réel</p><p className="mt-1 text-xs text-ink/45">Voici exactement ce que vos clients verront.</p></div>
              <span className="rounded-full bg-white px-3 py-1.5 text-[10px] font-semibold text-forest shadow-sm">Client</span>
            </div>
            <div className="mt-5 mx-auto max-w-[390px] rounded-[2.5rem] border-[8px] border-[#20252b] bg-[#20252b] p-2 shadow-2xl">
              <div className="overflow-hidden rounded-[1.9rem] bg-white p-3">
                <LoyaltyCardVisual design={visualDesign} card={visualCard} side="front" programType={cardMode === 'STAMP' ? 'STAMP' : 'POINTS'} />
              </div>
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
