import { useEffect, useMemo, useRef, useState } from 'react';
import type { RefObject } from 'react';
import {
  Check,
  ChevronRight,
  Gift,
  ImagePlus,
  Loader2,
  Percent,
  Save,
  Sparkles,
  Star,
  Stamp,
  Upload,
  Trophy,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_BUILDER_CONFIG, RESTAURANT_TEMPLATES } from './templates';
import type { LoyaltyBuilderConfig, LoyaltyTemplate, LoyaltyType } from './types';

type Props = { establishmentId: string };

const TYPE_OPTIONS: { id: LoyaltyType; title: string; description: string; icon: typeof Stamp }[] = [
  { id: 'STAMP', title: 'Tampons', description: 'Carte avec tampons de visite', icon: Stamp },
  { id: 'POINTS', title: 'Points', description: 'Cumulez des points à chaque achat', icon: Star },
  { id: 'DISCOUNT', title: 'Réduction', description: 'Offrez des réductions à vos clients', icon: Percent },
  { id: 'REWARD', title: 'Récompense', description: 'Des cadeaux à chaque palier', icon: Gift },
  { id: 'TIER', title: 'Paliers', description: 'Bronze, Silver, Gold et avantages', icon: Trophy },
];

const TABS = ['Design', 'Contenu', 'Récompense', 'Aperçu'] as const;
type Tab = typeof TABS[number];

export default function LoyaltyBuilder({ establishmentId }: Props) {
  const [config, setConfig] = useState<LoyaltyBuilderConfig>(DEFAULT_BUILDER_CONFIG);
  const [establishment, setEstablishment] = useState({ name: 'Votre établissement', logoUrl: null as string | null });
  const [activeTab, setActiveTab] = useState<Tab>('Design');
  const [filter, setFilter] = useState('Tous');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<'logo' | 'cover' | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!establishmentId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ data: place }, { data: saved }] = await Promise.all([
        supabase.from('establishments').select('name,logo_url').eq('id', establishmentId).maybeSingle(),
        supabase.rpc('get_loyalty_card_builder_config', { p_establishment_id: establishmentId }),
      ]);
      if (cancelled) return;
      if (place) setEstablishment({ name: place.name || 'Votre établissement', logoUrl: place.logo_url || null });
      const row = Array.isArray(saved) ? saved[0] : saved;
      if (row?.design_config) {
        setConfig({ ...DEFAULT_BUILDER_CONFIG, ...row.design_config, published: Boolean(row.published) });
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [establishmentId]);

  const update = (patch: Partial<LoyaltyBuilderConfig>) => {
    setConfig(current => ({ ...current, ...patch, published: false }));
  };

  const applyTemplate = (template: LoyaltyTemplate) => {
    update({
      templateId: template.id,
      primaryColor: template.primaryColor,
      secondaryColor: template.secondaryColor,
      backgroundColor: template.backgroundColor,
      textColor: template.textColor,
      buttonColor: template.buttonColor,
      borderRadius: template.borderRadius,
      stampStyle: template.stampStyle,
    });
    setActiveTab('Design');
  };

  async function uploadAsset(file: File, kind: 'logo' | 'cover') {
    if (!file.type.startsWith('image/')) return alert('Choisissez une image PNG, JPG ou WEBP.');
    if (file.size > 5 * 1024 * 1024) return alert('L’image doit faire moins de 5 Mo.');
    setUploading(kind);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `loyalty-cards/${establishmentId}/${kind}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('promotion-images').upload(path, file, {
        upsert: true,
        contentType: file.type,
      });
      if (error) throw error;
      const { data } = supabase.storage.from('promotion-images').getPublicUrl(path);
      update(kind === 'logo' ? { logoUrl: data.publicUrl } : { coverImageUrl: data.publicUrl });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Impossible d’envoyer cette image.');
    } finally {
      setUploading(null);
    }
  }

  async function save(published: boolean) {
    if (!establishmentId) return;
    setSaving(true);
    const next = { ...config, published };
    const { error } = await supabase.rpc('save_loyalty_card_builder_config', {
      p_establishment_id: establishmentId,
      p_design_config: next,
      p_template_id: next.templateId,
      p_primary_color: next.primaryColor,
      p_secondary_color: next.secondaryColor,
      p_background_color: next.backgroundColor,
      p_text_color: next.textColor,
      p_button_color: next.buttonColor,
      p_border_radius: next.borderRadius,
      p_published: published,
    });
    setSaving(false);
    if (error) return alert(error.message);
    setConfig(next);
  }

  const visibleTemplates = useMemo(
    () => filter === 'Tous' ? RESTAURANT_TEMPLATES : RESTAURANT_TEMPLATES.filter(t => t.category === filter),
    [filter],
  );

  if (loading) {
    return <div className="grid min-h-[520px] place-items-center rounded-[28px] bg-white ring-1 ring-ink/5"><Loader2 className="animate-spin text-gold" /></div>;
  }

  return (
    <section className="rounded-[28px] bg-white p-4 shadow-soft ring-1 ring-ink/5 md:p-6">
      <div className="mb-6 flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">Fidélité</p>
          <h2 className="mt-1 font-display text-3xl text-forest">Personnaliser la carte fidélité</h2>
          <p className="mt-1 text-sm text-ink/45">Créez une carte unique qui reflète votre établissement.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void save(false)} disabled={saving} className="rounded-xl border border-forest/15 bg-white px-4 py-2.5 text-xs font-semibold text-forest">
            Enregistrer
          </button>
          <button type="button" onClick={() => void save(true)} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">
            <Save size={14} /> {saving ? 'Enregistrement…' : 'Publier la carte'}
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(310px,0.95fr)_minmax(330px,0.85fr)_minmax(320px,1fr)]">
        <BuilderPanel
          config={config}
          establishment={establishment}
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          update={update}
          logoInput={logoInput}
          coverInput={coverInput}
          uploading={uploading}
          onUpload={uploadAsset}
        />

        <ClientPreview config={config} establishment={establishment} />

        <TemplateGallery
          filter={filter}
          setFilter={setFilter}
          templates={visibleTemplates}
          selectedId={config.templateId}
          onSelect={applyTemplate}
        />
      </div>

      <input ref={logoInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f=e.target.files?.[0]; if (f) void uploadAsset(f, 'logo'); e.currentTarget.value=''; }} />
      <input ref={coverInput} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={e => { const f=e.target.files?.[0]; if (f) void uploadAsset(f, 'cover'); e.currentTarget.value=''; }} />
    </section>
  );
}

function BuilderPanel({
  config, establishment, activeTab, setActiveTab, update, logoInput, coverInput, uploading,
}: {
  config: LoyaltyBuilderConfig;
  establishment: { name: string; logoUrl: string | null };
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  update: (patch: Partial<LoyaltyBuilderConfig>) => void;
  logoInput: RefObject<HTMLInputElement | null>;
  coverInput: RefObject<HTMLInputElement | null>;
  uploading: 'logo' | 'cover' | null;
  onUpload: (file: File, kind: 'logo' | 'cover') => Promise<void>;
}) {
  return (
    <div className="min-w-0">
      <div className="flex overflow-x-auto rounded-2xl bg-[#f7f7f3] p-1">
        {TABS.map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-xs font-semibold transition ${activeTab === tab ? 'bg-white text-forest shadow-sm' : 'text-ink/40 hover:text-forest'}`}>
            {tab}
          </button>
        ))}
      </div>

      {activeTab === 'Design' && (
        <div className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <AssetButton title="Logo de l’établissement" image={config.logoUrl || establishment.logoUrl} loading={uploading === 'logo'} onClick={() => logoInput.current?.click()} />
            <AssetButton title="Photo de fond" image={config.coverImageUrl} loading={uploading === 'cover'} onClick={() => coverInput.current?.click()} />
          </div>

          <div className="rounded-2xl border border-ink/8 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">Couleurs</p>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {([
                ['Principale', 'primaryColor'], ['Secondaire', 'secondaryColor'],
                ['Fond', 'backgroundColor'], ['Texte', 'textColor'],
              ] as const).map(([label, key]) => (
                <label key={key} className="text-[10px] font-semibold text-ink/45">
                  {label}
                  <div className="mt-1 flex items-center gap-2 rounded-xl border border-ink/10 p-2">
                    <input type="color" value={config[key]} onChange={e => update({ [key]: e.target.value })} className="h-7 w-7 rounded-lg border-0 p-0" />
                    <span>{config[key]}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-ink/8 p-4">
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink/40">Type de fidélité</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {TYPE_OPTIONS.map(option => {
                const Icon = option.icon;
                const active = config.loyaltyType === option.id;
                return (
                  <button key={option.id} type="button" onClick={() => update({ loyaltyType: option.id })} className={`flex items-center gap-3 rounded-2xl border p-3 text-left ${active ? 'border-forest bg-forest/[0.04] ring-2 ring-forest/10' : 'border-ink/10 hover:border-forest/25'}`}>
                    <span className={`grid h-9 w-9 place-items-center rounded-xl ${active ? 'bg-forest text-white' : 'bg-[#f7f7f3] text-ink/40'}`}><Icon size={18} /></span>
                    <span className="min-w-0"><span className="block text-xs font-semibold text-forest">{option.title}</span><span className="mt-0.5 block text-[9px] leading-4 text-ink/40">{option.description}</span></span>
                    {active && <Check className="ml-auto shrink-0 text-gold" size={15} />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'Contenu' && (
        <div className="mt-4 space-y-3">
          <Field label="Nom du programme" value={config.programName} onChange={v => update({ programName: v })} />
          <Field label="Titre de la carte" value={config.cardTitle} onChange={v => update({ cardTitle: v })} />
          <Field label="Sous-titre" value={config.cardSubtitle} onChange={v => update({ cardSubtitle: v })} />
          <Field label="Message de progression" value={config.progressText} onChange={v => update({ progressText: v })} />
          <Field label="Titre de la récompense" value={config.rewardTitle} onChange={v => update({ rewardTitle: v })} />
          <Field label="Description de la récompense" value={config.rewardDescription} onChange={v => update({ rewardDescription: v })} />
        </div>
      )}

      {activeTab === 'Récompense' && (
        <div className="mt-4 space-y-4">
          {config.loyaltyType === 'STAMP' && (
            <div className="grid gap-3 rounded-2xl bg-[#f7f7f3] p-4 sm:grid-cols-2">
              <NumberField label="Nombre de tampons" value={config.stampGoal} min={1} max={12} onChange={v => update({ stampGoal: v })} />
              <Field label="Récompense" value={config.rewardName} onChange={v => update({ rewardName: v })} />
            </div>
          )}
          {config.loyaltyType === 'POINTS' && (
            <NumberField label="Points nécessaires" value={config.rewardThreshold} min={1} max={100000} onChange={v => update({ rewardThreshold: v })} />
          )}
          {config.loyaltyType === 'DISCOUNT' && (
            <div className="grid gap-3 rounded-2xl bg-[#f7f7f3] p-4 sm:grid-cols-2">
              <NumberField label="Pourcentage de réduction" value={config.discountPercent} min={1} max={100} onChange={v => update({ discountPercent: v })} />
              <Field label="Condition" value={config.progressText} onChange={v => update({ progressText: v })} />
            </div>
          )}
          {config.loyaltyType === 'REWARD' && (
            <div className="grid gap-3 rounded-2xl bg-[#f7f7f3] p-4 sm:grid-cols-2">
              <NumberField label="Seuil de visites / achats" value={config.stampGoal} min={1} max={100} onChange={v => update({ stampGoal: v })} />
              <Field label="Récompense" value={config.rewardName} onChange={v => update({ rewardName: v })} />
            </div>
          )}
          {config.loyaltyType === 'TIER' && (
            <div className="rounded-2xl bg-[#f7f7f3] p-4 text-xs text-ink/50">
              Les niveaux Bronze, Silver et Gold sont prévisualisés dans la carte. Les seuils peuvent être branchés au moteur de points existant.
            </div>
          )}
          {config.loyaltyType === 'CHALLENGE' || config.loyaltyType === 'CASHBACK' ? (
            <div className="rounded-2xl bg-[#f7f7f3] p-4 text-xs text-ink/50">
              Cette mécanique est préparée dans l'interface et peut être activée lorsque le moteur correspondant sera disponible.
            </div>
          ) : null}
        </div>
      )}

      {activeTab === 'Aperçu' && (
        <div className="mt-4 rounded-2xl bg-[#f7f7f3] p-5 text-center">
          <Sparkles className="mx-auto text-gold" size={22} />
          <p className="mt-3 text-sm font-semibold text-forest">Aperçu côté client</p>
          <p className="mt-1 text-xs text-ink/45">La carte centrale est mise à jour en temps réel à chaque modification.</p>
        </div>
      )}
    </div>
  );
}

function ClientPreview({ config, establishment }: { config: LoyaltyBuilderConfig; establishment: { name: string; logoUrl: string | null } }) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#f7f7f3] p-4">
      <div className="text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-ink">Aperçu côté client</p>
        <p className="mt-1 text-xs text-ink/45">Voici exactement ce que vos clients verront.</p>
      </div>
      <div className="mx-auto mt-4 max-w-[360px] rounded-[2.4rem] border-[7px] border-[#171b1a] bg-[#171b1a] p-2 shadow-2xl">
        <div className="overflow-hidden rounded-[1.8rem] bg-white">
          <DigitalLoyaltyCard config={config} establishment={establishment} />
        </div>
      </div>
    </div>
  );
}

function DigitalLoyaltyCard({ config, establishment }: { config: LoyaltyBuilderConfig; establishment: { name: string; logoUrl: string | null } }) {
  const stamps = config.loyaltyType === 'STAMP' ? Math.min(4, config.stampGoal) : 0;
  const cardBg = config.coverImageUrl
    ? `linear-gradient(145deg, ${config.primaryColor}${Math.round(255 * 0.78).toString(16)}, ${config.primaryColor}cc), url(${config.coverImageUrl}) center/cover`
    : config.primaryColor;

  return (
    <div className="min-h-[690px] text-white" style={{ background: config.backgroundColor }}>
      <div className="relative overflow-hidden px-5 pb-5 pt-6" style={{ background: cardBg }}>
        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {config.logoUrl || establishment.logoUrl ? (
                <img src={config.logoUrl || establishment.logoUrl || ''} alt="" className="h-12 w-12 rounded-full bg-white object-contain p-1.5" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-full border border-white/30 text-xs font-bold">{establishment.name.slice(0, 2).toUpperCase()}</div>
              )}
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.15em]">{establishment.name}</p>
                <p className="mt-1 text-[8px] uppercase tracking-[0.25em] opacity-60">{config.programName}</p>
              </div>
            </div>
            <span className="text-[8px] uppercase tracking-[0.2em] opacity-60">Carte fidélité</span>
          </div>
          <p className="mt-8 max-w-[270px] font-display text-3xl leading-tight">{config.cardTitle}</p>
          <p className="mt-2 max-w-[280px] text-[10px] leading-4 opacity-70">{config.cardSubtitle}</p>
        </div>
      </div>

      <div className="bg-white px-5 pb-5 pt-4 text-ink">
        <div className="flex items-center justify-between">
          <div><p className="text-[9px] text-ink/40">Bonjour</p><p className="text-lg font-semibold text-forest">Mohamed</p></div>
          <span className="rounded-full px-3 py-1.5 text-[9px] font-semibold" style={{ background: `${config.secondaryColor}22`, color: config.primaryColor }}>Client fidèle</span>
        </div>

        {config.loyaltyType === 'STAMP' && (
          <div className="mt-5">
            <div className="flex items-end justify-between"><div><p className="text-[9px] uppercase tracking-[0.15em] text-ink/40">Progression</p><p className="mt-1 text-xs font-semibold">{stamps} / {config.stampGoal} tampons</p></div><span className="text-[9px] text-ink/40">{Math.max(0, config.stampGoal - stamps)} restants</span></div>
            <div className="mt-3 grid grid-cols-4 gap-2">
              {Array.from({ length: config.stampGoal }).map((_, i) => <StampIcon key={i} filled={i < stamps} config={config} />)}
            </div>
          </div>
        )}

        {config.loyaltyType === 'POINTS' && (
          <div className="mt-6 rounded-2xl p-4" style={{ background: `${config.secondaryColor}18` }}>
            <p className="text-[9px] uppercase tracking-[0.15em] text-ink/40">Vos points</p>
            <p className="mt-1 text-4xl font-bold" style={{ color: config.primaryColor }}>320</p>
            <p className="mt-2 text-[10px] text-ink/45">{config.rewardThreshold} points = {config.rewardName}</p>
          </div>
        )}

        {config.loyaltyType === 'DISCOUNT' && (
          <div className="mt-6 rounded-2xl p-5" style={{ background: config.secondaryColor, color: config.primaryColor }}>
            <Percent className="mb-2" size={20} />
            <p className="text-3xl font-bold">-{config.discountPercent}%</p>
            <p className="mt-1 text-[10px] font-medium">{config.progressText}</p>
          </div>
        )}

        {config.loyaltyType === 'REWARD' && (
          <div className="mt-6 rounded-2xl p-5" style={{ background: `${config.secondaryColor}18` }}>
            <Gift size={22} style={{ color: config.secondaryColor }} />
            <p className="mt-2 text-xl font-bold text-forest">{config.rewardName}</p>
            <p className="mt-1 text-[10px] text-ink/45">Après {config.stampGoal} visites</p>
          </div>
        )}

        {config.loyaltyType === 'TIER' && (
          <div className="mt-6 grid grid-cols-3 gap-2">
            {['Bronze', 'Silver', 'Gold'].map((tier, i) => <div key={tier} className={`rounded-2xl p-3 text-center ${i === 2 ? 'ring-2 ring-gold' : 'bg-[#f7f7f3]'}`}><p className="text-[9px] font-semibold">{tier}</p><p className="mt-1 text-sm font-bold">{i === 0 ? '-5%' : i === 1 ? '-10%' : '-20%'}</p></div>)}
          </div>
        )}

        <div className="mt-6 rounded-2xl border border-ink/8 p-4">
          <p className="text-[9px] uppercase tracking-[0.15em] text-ink/35">Prochaine récompense</p>
          <p className="mt-1 text-sm font-semibold text-forest">{config.rewardTitle}</p>
          <p className="mt-1 text-[10px] text-ink/45">{config.rewardDescription}</p>
        </div>

        <button type="button" className="mt-4 flex w-full items-center justify-between rounded-xl px-4 py-3 text-xs font-semibold text-white" style={{ background: config.buttonColor }}>
          Voir mes récompenses <ChevronRight size={15} />
        </button>

        <div className="mt-5 flex items-center justify-center gap-2 text-[8px] uppercase tracking-[0.2em] text-ink/35">
          <span className="h-px w-8 bg-ink/10" /> by TAP MARRAKECH <span className="h-px w-8 bg-ink/10" />
        </div>
      </div>
    </div>
  );
}

function StampIcon({ filled, config }: { filled: boolean; config: LoyaltyBuilderConfig }) {
  return (
    <span className="grid aspect-square place-items-center rounded-full border-2 text-xs" style={{ borderColor: config.secondaryColor, background: filled ? config.secondaryColor : 'transparent', color: filled ? '#fff' : config.secondaryColor }}>
      {filled ? <Check size={14} /> : null}
    </span>
  );
}

function TemplateGallery({ filter, setFilter, templates, selectedId, onSelect }: { filter: string; setFilter: (v: string) => void; templates: LoyaltyTemplate[]; selectedId: string; onSelect: (t: LoyaltyTemplate) => void }) {
  const filters = ['Tous', 'Élégant', 'Moderne', 'Minimaliste', 'Gastronomique', 'Premium', 'Authentique'];
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-ink">Modèles de cartes restaurant</p>
      <p className="mt-1 text-xs text-ink/45">Choisissez un modèle et personnalisez-le selon votre univers.</p>
      <div className="mt-3 flex gap-1.5 overflow-x-auto pb-1">
        {filters.map(item => <button key={item} type="button" onClick={() => setFilter(item)} className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[9px] font-semibold ${filter === item ? 'bg-forest text-white' : 'bg-[#f7f7f3] text-ink/50'}`}>{item}</button>)}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {templates.map(template => (
          <button key={template.id} type="button" onClick={() => onSelect(template)} className={`overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${selectedId === template.id ? 'border-forest ring-2 ring-forest/10' : 'border-ink/8'}`}>
            <TemplateThumb template={template} />
            <div className="bg-white p-3"><p className="text-xs font-semibold text-forest">{template.name}</p><p className="mt-1 text-[9px] text-ink/40">{template.description}</p></div>
          </button>
        ))}
      </div>
    </div>
  );
}

function TemplateThumb({ template }: { template: LoyaltyTemplate }) {
  return (
    <div className="relative aspect-[0.82] overflow-hidden p-3 text-white" style={{ background: template.primaryColor }}>
      <div className="absolute inset-x-0 top-0 h-[46%] opacity-30" style={{ background: template.secondaryColor }} />
      <div className="relative">
        <div className="flex items-center justify-between"><span className="text-[7px] font-bold uppercase tracking-[0.2em]">RESTAURANT</span><span className="text-[9px]">✦</span></div>
        <p className="mt-6 max-w-[120px] font-display text-sm leading-tight">Une expérience à chaque visite.</p>
        <div className="mt-5 grid grid-cols-4 gap-1.5">
          {Array.from({ length: 8 }).map((_, i) => <span key={i} className="aspect-square rounded-full border" style={{ borderColor: template.secondaryColor, background: i < 3 ? template.secondaryColor : 'transparent' }} />)}
        </div>
      </div>
    </div>
  );
}

function AssetButton({ title, image, loading, onClick }: { title: string; image: string | null; loading: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="overflow-hidden rounded-2xl border border-dashed border-ink/15 bg-[#fafaf8] text-left">
      <div className="flex h-28 items-center justify-center p-2">
        {image ? <img src={image} alt="" className="h-full w-full rounded-xl object-cover" /> : <ImagePlus className="text-ink/25" size={25} />}
      </div>
      <div className="flex items-center justify-between border-t border-ink/8 bg-white px-3 py-2.5"><span className="text-[10px] font-semibold text-forest">{title}</span>{loading ? <Loader2 className="animate-spin text-gold" size={15} /> : <Upload size={14} className="text-ink/35" />}</div>
    </button>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="block text-xs font-medium text-ink/50">{label}<input value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-gold" /></label>;
}

function NumberField({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return <label className="block text-xs font-medium text-ink/50">{label}<input type="number" min={min} max={max} value={value} onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm text-ink outline-none focus:border-gold" /></label>;
}
