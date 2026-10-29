import { useRef, useState } from 'react';
import { Check, ChevronDown, ImagePlus, Loader2, Upload, X, Sparkles } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import MenuPreview from '@/components/admin/menu/MenuPreview';
import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';
import { MENU_TEMPLATES } from '@/components/admin/menu/menuTemplates';

export type MenuTemplate = string;
export type MenuNavigationMode = 'scroll' | 'book' | 'app';

export type MenuDesignDraft = {
  template: MenuTemplate;
  navigation: MenuNavigationMode;
  wallpaperUrl: string | null;
  wallpaperFile: File | null;
  wallpaperObjectUrl: string | null;
  wallpaperRemoved: boolean;
  overlayOpacity: number;
  themeColors: { background: string; surface: string; text: string; accent: string };
  aiDesign: Record<string, unknown> | null;
};

type MenuConfiguratorProps = {
  draft: MenuDesignDraft;
  hasChanges: boolean;
  publishing: boolean;
  onChange: (patch: Partial<MenuDesignDraft>) => void;
  onPublish: () => void;
  categories: MenuCategory[];
  itemsByCategory: Record<string, MenuItem[]>;
  establishmentName?: string;
  establishmentId: string;
  logoUrl: string | null;
};

const navigationModes: Array<{ id: MenuNavigationMode; label: string; description: string }> = [
  { id: 'scroll', label: 'Page unique', description: 'Défilement classique' },
  { id: 'book', label: 'Mode livre', description: 'Pagination par catégorie' },
  { id: 'app', label: 'Barre en bas', description: 'Catégories accessibles au pouce en bas du menu' },
];

const templates = MENU_TEMPLATES;

export default function MenuConfigurator({
  draft,
  hasChanges,
  publishing,
  onChange,
  onPublish,
  categories,
  itemsByCategory,
  establishmentName,
  establishmentId,
  logoUrl,
}: MenuConfiguratorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [paletteBusy, setPaletteBusy] = useState(false);
  const [paletteNotice, setPaletteNotice] = useState<string | null>(null);

  const chooseWallpaper = (file: File) => {
    setError(null);
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Format accepté : JPG, PNG ou WebP.');
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError('Wallpaper trop lourd : 12 Mo maximum.');
      return;
    }

    if (draft.wallpaperObjectUrl) URL.revokeObjectURL(draft.wallpaperObjectUrl);
    const objectUrl = URL.createObjectURL(file);
    onChange({
      wallpaperFile: file,
      wallpaperObjectUrl: objectUrl,
      wallpaperUrl: objectUrl,
      wallpaperRemoved: false,
    });
  };

  const removeWallpaper = () => {
    if (draft.wallpaperObjectUrl) URL.revokeObjectURL(draft.wallpaperObjectUrl);
    onChange({
      wallpaperFile: null,
      wallpaperObjectUrl: null,
      wallpaperUrl: null,
      wallpaperRemoved: true,
    });
  };

  return (
    <section className="space-y-4 rounded-3xl border border-white/10 bg-[#111111] p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Design</p>
          <h3 className="mt-1 text-xl font-semibold text-forest">Studio visuel</h3>
          <p className="mt-1 text-xs leading-5 text-white/40">
            La structure du modèle reste verrouillée. Tu peux personnaliser les couleurs et le fond, puis publier.
          </p>
        </div>


      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">Template</p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
          {templates.map((template) => {
            const active = draft.template === template.id;
            return (
              <button
                key={template.id}
                type="button"
                disabled={publishing}
                onClick={() => onChange({ template: template.id })}
                className={[
                  'rounded-2xl border p-3 text-left transition',
                  active ? 'border-gold bg-gold/10 ring-1 ring-gold/20' : 'border-[#D4AF37]/20 bg-[#111111] hover:border-forest/20',
                ].join(' ')}
              >
                <div className={`mb-3 min-h-[86px] overflow-hidden rounded-xl border p-2.5 ${['dark', 'onyx', 'royal-gold', 'deep-ocean'].includes(template.family) ? 'border-white/10 bg-[#111111] text-white' : 'border-black/5 bg-[#f7f3ea] text-forest'}`}>
                  {['04_menu_luxe', '17_fine_dining'].includes(template.id) ? (
                    <div className="flex h-[86px] flex-col items-center justify-center bg-[#11100d] px-3 text-center text-[#f7f0df]"><div className="mb-2 h-px w-8 bg-[#d2b46a]" /><div className="font-serif text-[10px] tracking-[0.2em]">MENU SIGNATURE</div><div className="my-2 h-px w-12 bg-[#d2b46a]/60" /><div className="space-y-1"><div className="h-1 w-20 bg-white/50" /><div className="mx-auto h-1 w-12 bg-[#d2b46a]" /><div className="mx-auto h-1 w-16 bg-white/25" /></div></div>
                  ) : template.id === '11_brunch_cafe' ? (
                    <div className="grid h-[86px] grid-cols-2 gap-2 bg-[#e9e5d7] p-2 text-[#3A3328]"><div className="flex flex-col justify-end rounded-md bg-[#c4b99d] p-1.5"><div className="h-1 w-3/4 rounded bg-[#3A3328]/60" /><div className="mt-1 h-1 w-1/2 rounded bg-[#3A3328]/30" /></div><div className="space-y-2 py-1"><div className="font-serif text-[9px]">BRUNCH CLUB</div><div className="h-1 w-full bg-[#3A3328]/35" /><div className="h-1 w-2/3 bg-[#3A3328]/20" /><div className="h-1 w-1/2 bg-[#9d8150]" /></div></div>
                  ) : template.id === '12_sushi_bar' ? (
                    <div className="h-[86px] space-y-2 bg-[#17110f] p-2 text-[#fff4e7]"><div className="flex items-center gap-2 border-b border-[#c74a3b]/60 pb-1"><div className="h-7 w-9 rounded-sm bg-[#a83b30]" /><div className="flex-1 space-y-1"><div className="h-1 w-3/4 bg-white/60" /><div className="h-1 w-1/2 bg-white/20" /></div><div className="h-1 w-5 bg-[#d6a45b]" /></div><div className="flex items-center gap-2"><div className="h-7 w-9 rounded-sm bg-[#5b3428]" /><div className="flex-1 space-y-1"><div className="h-1 w-2/3 bg-white/60" /><div className="h-1 w-1/3 bg-white/20" /></div><div className="h-1 w-5 bg-[#d6a45b]" /></div></div>
                  ) : template.id === '06_beauty_studio' ? (
                    <div className="h-[86px] bg-[#f5e8e5] px-3 py-2 text-[#694d4a]"><div className="text-center font-serif text-[10px]">Beauty rituals</div><div className="mx-auto my-2 h-px w-8 bg-[#bd8f8b]" />{[0, 1, 2].map(index => <div key={index} className="mb-2 flex items-center justify-between border-b border-[#bd8f8b]/30 pb-1"><div className="h-1 w-2/5 bg-[#694d4a]/30" /><div className="h-1 w-1/6 bg-[#bd8f8b]" /></div>)}</div>
                  ) : ['02_burger_house', '16_tacos'].includes(template.id) ? (
                    <div className="h-[86px] bg-[#15130f] p-2 text-[#fff6dd]"><div className="font-black uppercase leading-none text-[#f2c94c]">{template.id === '02_burger_house' ? 'BURGER HOUSE' : 'TACOS CLUB'}</div><div className="my-2 h-px w-full bg-[#f2c94c]/60" /><div className="flex items-end justify-between"><div className="space-y-1"><div className="h-1 w-16 bg-white/70" /><div className="h-1 w-10 bg-white/30" /></div><div className="font-black text-[#f2c94c]">89 DH</div></div></div>
                  ) : ['25_perfume', '26_jewelry'].includes(template.id) ? (
                    <div className="h-[86px] bg-[#f2ead9] p-2 text-[#453b2b]"><div className="mb-2 text-center font-serif text-[9px] tracking-[0.16em]">{template.id === '25_perfume' ? 'PARFUMS' : 'COLLECTION'}</div><div className="grid grid-cols-3 gap-2">{[0, 1, 2].map(index => <div key={index} className="rounded-sm border border-[#b59a67]/50 bg-[#fffaf0] p-1"><div className={`h-7 ${index === 1 ? 'bg-[#c9b17c]/50' : 'bg-[#ded1b6]'}`} /><div className="mt-1 h-1 w-full bg-[#453b2b]/30" /><div className="mt-1 h-1 w-1/2 bg-[#b59a67]" /></div>)}</div></div>
                  ) : template.layout === 'product-grid' || template.layout === 'magazine-grid' ? (
                    <div className={template.layout === 'magazine-grid' ? 'grid grid-cols-2 gap-2' : 'grid grid-cols-3 gap-2'}>
                      {[0, 1, 2].slice(0, template.layout === 'magazine-grid' ? 2 : 3).map(index => (
                        <div key={index} className="overflow-hidden rounded-md bg-black/5">
                          <div className={`h-8 ${index === 0 ? 'bg-gold/40' : 'bg-forest/10'}`} />
                          <div className="space-y-1 p-1.5"><div className="h-1 w-full rounded bg-current/20" /><div className="h-1 w-1/2 rounded bg-gold/70" /></div>
                        </div>
                      ))}
                    </div>
                  ) : template.layout === 'stacked-photo' ? (
                    <div className="space-y-2"><div className="h-10 rounded-md bg-gold/30" /><div className="h-1.5 w-2/3 rounded bg-current/20" /><div className="h-1 w-1/2 rounded bg-current/10" /></div>
                  ) : template.layout === 'split-catalog' ? (
                    <div className="space-y-2">{[0, 1].map(index => <div key={index} className="flex gap-2"><div className="h-8 w-10 rounded bg-gold/25" /><div className="flex-1 space-y-2 py-1"><div className="h-1 w-3/4 rounded bg-current/20" /><div className="h-1 w-1/2 rounded bg-current/10" /></div></div>)}</div>
                  ) : template.layout === 'service-table' ? (
                    <div className="space-y-2 rounded-md border border-current/10 p-2">{[0, 1, 2].map(index => <div key={index} className="flex justify-between border-b border-current/10 pb-1"><div className="h-1 w-2/5 rounded bg-current/20" /><div className="h-1 w-1/5 rounded bg-gold/70" /></div>)}</div>
                  ) : template.layout === 'price-list' ? (
                    <div className="space-y-3 px-2 py-1"><div className="mx-auto h-1.5 w-1/3 rounded bg-gold/70" />{[0, 1, 2].map(index => <div key={index} className="flex items-center gap-2"><div className="h-1 w-2/5 rounded bg-current/20" /><div className="flex-1 border-b border-dotted border-current/20" /><div className="h-1 w-1/6 rounded bg-gold/60" /></div>)}</div>
                  ) : (
                    <div className="space-y-2 px-1 py-1">{[0, 1, 2].map(index => <div key={index} className="flex items-center justify-between"><div className="h-1.5 w-2/5 rounded bg-current/20" /><div className="h-1.5 w-1/6 rounded bg-gold/70" /></div>)}</div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-forest">{template.label}</span>
                  {active && <Check size={14} className="text-gold" />}
                </div>
                <p className="mt-1 text-[10px] leading-4 text-white/40">{template.description}</p>
                <p className="mt-2 text-[9px] font-semibold uppercase tracking-wider text-gold">{template.sector}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#171717] p-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold">Textes du menu</p>
        <h4 className="mt-1 text-sm font-semibold text-forest">Personnaliser les titres</h4>
        <p className="mt-1 text-[10px] leading-4 text-white/45">Modifie le titre et le sous-titre affichés en haut du menu. Les modifications apparaissent directement dans l’aperçu et seront enregistrées avec « Publier ».</p>
        {(() => {
          const ai = draft.aiDesign && typeof draft.aiDesign === 'object' ? draft.aiDesign : {};
          const hero = ai.hero && typeof ai.hero === 'object' ? ai.hero as Record<string, unknown> : {};
          const updateHero = (key: 'title' | 'subtitle', value: string) => {
            const nextHero = { ...hero, [key]: value };
            onChange({ aiDesign: { ...ai, hero: nextHero } });
          };
          return <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="mb-1 block text-[10px] font-medium text-forest">Titre principal</span><input type="text" maxLength={70} value={typeof hero.title === 'string' ? hero.title : ''} placeholder={establishmentName || 'Nom de votre établissement'} disabled={publishing} onChange={event => updateHero('title', event.target.value)} className="w-full rounded-xl border border-[#D4AF37]/20 bg-[#111111] px-3 py-2.5 text-xs text-forest outline-none focus:border-gold"/></label>
            <label className="block"><span className="mb-1 block text-[10px] font-medium text-forest">Sous-titre</span><input type="text" maxLength={100} value={typeof hero.subtitle === 'string' ? hero.subtitle : ''} placeholder="Notre carte" disabled={publishing} onChange={event => updateHero('subtitle', event.target.value)} className="w-full rounded-xl border border-[#D4AF37]/20 bg-[#111111] px-3 py-2.5 text-xs text-forest outline-none focus:border-gold"/></label>
          </div>;
        })()}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#171717] p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold">Personnalisation</p><h4 className="mt-1 text-sm font-semibold text-forest">Couleurs du modèle</h4><p className="mt-1 text-[10px] leading-4 text-white/45">Le layout reste verrouillé ; seules les couleurs et le fond changent.</p></div>
          <span className="rounded-full border border-white/10 bg-[#111111] px-2.5 py-1 text-[9px] font-semibold text-forest">Structure verrouillée</span>
        </div>
        <div className="mt-4 rounded-xl border border-gold/20 bg-gradient-to-r from-gold/10 to-transparent p-3">
          <div className="flex items-center gap-3">
            {logoUrl ? <img src={logoUrl} alt="Logo de l’établissement" className="h-11 w-11 rounded-lg border border-[#D4AF37]/20 bg-[#111111] object-contain p-1" /> : <div className="grid h-11 w-11 place-items-center rounded-lg border border-dashed border-[#D4AF37]/20 bg-[#111111] text-white/30"><ImagePlus size={18}/></div>}
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-forest">Palette de marque par IA</p>
              <p className="mt-1 text-[10px] leading-4 text-white/45">{logoUrl ? 'Analyse le logo et propose 4 couleurs harmonisées, avec un contraste lisible.' : 'Ajoute d’abord le logo dans les informations de ton établissement.'}</p>
            </div>
            <button type="button" disabled={publishing || paletteBusy || !logoUrl} onClick={async () => {
              setPaletteBusy(true); setPaletteNotice(null); setError(null);
              try {
                const { data, error: invokeError } = await supabase.functions.invoke('generate-brand-palette', { body: { establishment_id: establishmentId } });
                if (invokeError) throw new Error(invokeError.message);
                if (!data?.success || !data?.colors) throw new Error(data?.error || 'La palette n’a pas pu être générée.');
                const valid = (value: unknown) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
                const next = data.colors;
                if (!valid(next.background) || !valid(next.surface) || !valid(next.text) || !valid(next.accent)) throw new Error('La palette reçue est incomplète. Relance la génération.');
                onChange({ themeColors: { background: next.background, surface: next.surface, text: next.text, accent: next.accent } });
                setPaletteNotice('Palette de marque générée. Vérifie l’aperçu puis publie pour l’appliquer au menu.');
              } catch (cause) { setError(cause instanceof Error ? cause.message : 'Erreur lors de la génération de la palette.'); }
              finally { setPaletteBusy(false); }
            }} className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-forest px-3 py-2.5 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40">
              {paletteBusy ? <Loader2 size={13} className="animate-spin"/> : <Sparkles size={13}/>}
              {paletteBusy ? 'Analyse…' : 'Générer'}
            </button>
          </div>
          {paletteNotice && <p className="mt-3 rounded-lg bg-[#D4AF37]/10 px-3 py-2 text-[10px] leading-4 text-[#D4AF37]">{paletteNotice}</p>}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {([{key:'background',label:'Arrière-plan'},{key:'surface',label:'Blocs / cartes'},{key:'text',label:'Texte'},{key:'accent',label:'Accent / prix'}] as const).map(color => (
            <label key={color.key} className="flex min-w-0 items-center gap-2 rounded-xl border border-white/10 bg-[#111111] p-2.5">
              <input type="color" value={draft.themeColors[color.key]} onChange={event => onChange({themeColors:{...draft.themeColors,[color.key]:event.target.value}})} className="h-9 w-10 shrink-0 cursor-pointer rounded-lg border-0 bg-transparent p-0" aria-label={color.label}/>
              <span className="text-[10px] font-medium text-forest">{color.label}</span>
            </label>
          ))}
        </div>
        <button type="button" disabled={publishing} onClick={() => onChange({themeColors:{background:'#F5F1E8',surface:'#FFFDFA',text:'#24211C',accent:'#D4AF37'}})} className="mt-3 rounded-full border border-white/10 bg-[#111111] px-3 py-2 text-[10px] font-semibold text-forest disabled:opacity-50">Réinitialiser les couleurs</button>
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#171717] p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold">Wallpaper</p><p className="mt-1 text-xs text-white/50">Règle l’intensité du voile sur l’image de fond.</p></div><span className="text-xs font-bold text-forest">{Math.round(draft.overlayOpacity * 100)}%</span></div>
        <input aria-label="Intensité du voile du wallpaper" type="range" min="0" max="70" step="5" value={Math.round(draft.overlayOpacity * 100)} onChange={event => onChange({overlayOpacity:Number(event.target.value)/100})} disabled={publishing} className="mt-3 w-full accent-[#D4AF37]"/>
      </div>

      <div className="rounded-2xl border border-gold/15 bg-gold/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold">Expérience</p>
            <h4 className="mt-1 text-sm font-semibold text-forest">Navigation du menu</h4>
            <p className="mt-1 text-[10px] leading-4 text-white/40">
              Choisis comment le visiteur parcourt ton menu.
            </p>
          </div>
          <ChevronDown size={16} className="mt-0.5 text-gold" />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {navigationModes.map((mode) => {
            const active = draft.navigation === mode.id;

            return (
              <button
                key={mode.id}
                type="button"
                disabled={publishing}
                onClick={() => onChange({ navigation: mode.id })}
                className={[
                  'rounded-xl border px-3 py-3 text-left transition-all duration-200',
                  active
                    ? 'border-gold/40 bg-gold/10 shadow-sm ring-1 ring-gold/20'
                    : 'border-white/10 bg-white/[.03] hover:border-gold/30 hover:bg-white/[.06]',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-forest">{mode.label}</span>
                  <span
                    className={[
                      'grid h-5 w-5 place-items-center rounded-full border',
                      active ? 'border-gold bg-gold text-[#0D0D0D]' : 'border-white/10 bg-[#111111]',
                    ].join(' ')}
                  >
                    {active && <Check size={11} />}
                  </span>
                </div>
                <span className="mt-1 block text-[9px] leading-4 text-white/35">{mode.description}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[9px] leading-4 text-white/35">
          Le choix est synchronisé avec le Draft, l’aperçu et la page publique.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-white/35">Wallpaper</p>
            <p className="mt-1 text-[10px] text-white/35">Aucun upload réseau avant « Publier ».</p>
          </div>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={publishing}
            className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-50"
          >
            <Upload size={13} /> Choisir
          </button>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) chooseWallpaper(file);
            event.currentTarget.value = '';
          }}
        />

        {error && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-[11px] text-red-700">{error}</div>}

        {draft.wallpaperUrl ? (
          <div className="relative mt-3 overflow-hidden rounded-2xl border border-[#D4AF37]/20">
            <img src={draft.wallpaperUrl} alt="" className="aspect-[3/4] w-full object-cover" />
            <button
              type="button"
              onClick={removeWallpaper}
              disabled={publishing}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white disabled:opacity-50"
              aria-label="Retirer le wallpaper"
            >
              <X size={14} />
            </button>
            {draft.wallpaperFile && (
              <div className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2.5 py-1 text-[9px] font-semibold text-white">
                Nouveau · sera uploadé à la publication
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={publishing}
            className="mt-3 flex aspect-[3/4] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-[#D4AF37]/20 bg-[#111111] text-center"
          >
            <ImagePlus size={24} className="text-gold" />
            <span className="mt-2 text-xs font-semibold text-forest">Aucun wallpaper</span>
            <span className="mt-1 text-[10px] text-white/35">Ajoute ton image verticale</span>
          </button>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] font-semibold text-white/45">
            <span>Voile de contraste</span>
            <span>{Math.round(draft.overlayOpacity * 100)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="0.7"
            step="0.05"
            value={draft.overlayOpacity}
            onChange={(event) => onChange({ overlayOpacity: Number(event.target.value) })}
            className="mt-2 w-full accent-[var(--color-forest)]"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={onPublish}
        disabled={!hasChanges || publishing}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-forest px-4 py-3 text-xs font-semibold text-white shadow-sm disabled:cursor-not-allowed disabled:opacity-35"
      >
        {publishing && <Loader2 size={14} className="animate-spin" />}
        {publishing ? 'Publication…' : hasChanges ? 'Publier les modifications' : 'Design publié'}
      </button>
    </section>
  );
}
