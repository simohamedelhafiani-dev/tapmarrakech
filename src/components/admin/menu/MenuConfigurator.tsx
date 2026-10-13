import { useRef, useState } from 'react';
import { Check, ChevronDown, ImagePlus, Loader2, Upload, X } from 'lucide-react';
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
};

const navigationModes: Array<{ id: MenuNavigationMode; label: string; description: string }> = [
  { id: 'scroll', label: 'Page unique', description: 'Défilement classique' },
  { id: 'book', label: 'Mode livre', description: 'Pagination par catégorie' },
  { id: 'app', label: 'Catégories en haut', description: 'Cliquez sur une catégorie pour afficher ses plats' },
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
}: MenuConfiguratorProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

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
    <section className="space-y-4 rounded-3xl border border-ink/5 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Design</p>
          <h3 className="mt-1 text-xl font-semibold text-forest">Studio visuel</h3>
          <p className="mt-1 text-xs leading-5 text-ink/40">
            Toutes les modifications restent locales jusqu’à la publication.
          </p>
        </div>


      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink/35">Template</p>
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
                  active ? 'border-gold bg-gold/10 ring-1 ring-gold/20' : 'border-ink/8 bg-[#fafaf7] hover:border-forest/20',
                ].join(' ')}
              >
                <div className={"mb-3 overflow-hidden rounded-xl border p-2.5 " + (["dark", "onyx", "royal-gold", "deep-ocean"].includes(template.family) ? "border-white/10 bg-[#101b18]" : "border-black/5 bg-[#f7f3ea"])}>
                  {template.layout === "product-grid" || template.layout === "magazine-grid" ? (
                    <div className={template.layout === "magazine-grid" ? "grid grid-cols-2 gap-1.5" : "grid grid-cols-3 gap-1.5"}>
                      {Array.from({ length: template.layout === "magazine-grid" ? 2 : 3 }).map((_, index) => <div key={index} className="overflow-hidden rounded-md bg-black/5"><div className={"h-8 " + (index === 0 ? "bg-gold/35" : "bg-forest/10")} /><div className="space-y-1 p-1.5"><div className="h-1 w-full rounded bg-current/15" /><div className="h-1 w-1/2 rounded bg-gold/60" /></div></div>)}
                    </div>
                  ) : template.layout === "stacked-photo" ? (
                    <div className="space-y-1.5"><div className="h-12 rounded-md bg-gold/25" /><div className="flex items-center justify-between"><div className="h-1.5 w-2/5 rounded bg-current/20" /><div className="h-1.5 w-1/5 rounded bg-gold/70" /></div><div className="h-1 w-3/4 rounded bg-current/10" /></div>
                  ) : template.layout === "split-catalog" ? (
                    <div className="space-y-1.5">{[0, 1].map(index => <div key={index} className="flex gap-2 rounded-md bg-black/5 p-1.5"><div className={"h-9 w-10 rounded " + (index ? "bg-forest/15" : "bg-gold/30")} /><div className="flex-1 space-y-1.5 py-1"><div className="h-1.5 w-3/4 rounded bg-current/20" /><div className="h-1 w-1/2 rounded bg-current/10" /></div><div className="h-1.5 w-1/6 rounded bg-gold/70" /></div>)}</div>
                  ) : template.layout === "service-table" ? (
                    <div className="space-y-2 rounded-md border border-current/10 p-2">{[0, 1, 2].map(index => <div key={index} className="flex items-center justify-between border-b border-current/10 pb-1.5"><div className="h-1.5 w-2/5 rounded bg-current/20" /><div className="h-1.5 w-1/5 rounded bg-gold/70" /></div>)}</div>
                  ) : template.layout === "price-list" ? (
                    <div className="space-y-3 px-2 py-1"><div className="mx-auto h-1.5 w-1/3 rounded bg-gold/70" /><div className="h-px bg-gold/40" />{[0, 1, 2].map(index => <div key={index} className="flex items-center gap-2"><div className="h-1.5 w-2/5 rounded bg-current/20" /><div className="flex-1 border-b border-dotted border-current/20" /><div className="h-1.5 w-1/6 rounded bg-gold/60" /></div>)}</div>
                  ) : (
                    <div className={template.layout === "compact-list" ? "space-y-1" : "space-y-2.5 px-1 py-1"}>{[0, 1, 2].map(index => <div key={index} className={"flex items-center justify-between gap-3 " + (template.layout === "compact-list" ? "border-b border-current/10 pb-1" : "")}><div className="h-1.5 w-2/5 rounded bg-current/20" /><div className="h-1.5 w-1/6 rounded bg-gold/70" /></div>)}</div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-forest">{template.label}</span>
                  {active && <Check size={14} className="text-gold" />}
                </div>
                <p className="mt-1 text-[10px] leading-4 text-ink/40">{template.description}</p>
                <p className="mt-2 text-[9px] font-semibold uppercase tracking-wider text-gold">{template.sector}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-gold/15 bg-gold/5 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold">Expérience</p>
            <h4 className="mt-1 text-sm font-semibold text-forest">Navigation du menu</h4>
            <p className="mt-1 text-[10px] leading-4 text-ink/40">
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
                    ? 'border-forest/20 bg-white shadow-sm ring-1 ring-gold/20'
                    : 'border-ink/5 bg-white/60 hover:border-forest/15 hover:bg-white',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-forest">{mode.label}</span>
                  <span
                    className={[
                      'grid h-5 w-5 place-items-center rounded-full border',
                      active ? 'border-gold bg-gold text-white' : 'border-ink/10 bg-white',
                    ].join(' ')}
                  >
                    {active && <Check size={11} />}
                  </span>
                </div>
                <span className="mt-1 block text-[9px] leading-4 text-ink/35">{mode.description}</span>
              </button>
            );
          })}
        </div>

        <p className="mt-3 text-[9px] leading-4 text-ink/35">
          Le choix est synchronisé avec le Draft, l’aperçu et la page publique.
        </p>
      </div>

      <div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-ink/35">Wallpaper</p>
            <p className="mt-1 text-[10px] text-ink/35">Aucun upload réseau avant « Publier ».</p>
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
          <div className="relative mt-3 overflow-hidden rounded-2xl border border-ink/10">
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
            className="mt-3 flex aspect-[3/4] w-full flex-col items-center justify-center rounded-2xl border border-dashed border-ink/10 bg-[#fafaf7] text-center"
          >
            <ImagePlus size={24} className="text-gold" />
            <span className="mt-2 text-xs font-semibold text-forest">Aucun wallpaper</span>
            <span className="mt-1 text-[10px] text-ink/35">Ajoute ton image verticale</span>
          </button>
        )}

        <div className="mt-4">
          <div className="flex items-center justify-between text-[10px] font-semibold text-ink/45">
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
