import { useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Sparkles, Upload, X } from 'lucide-react';

export type MenuTemplate = 'editorial' | 'luxury' | 'cards' | 'dark';

export type MenuDesignDraft = {
  template: MenuTemplate;
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
  aiLoading: boolean;
  onChange: (patch: Partial<MenuDesignDraft>) => void;
  onPublish: () => void;
  onGenerateAi: () => void;
};

const templates: Array<{ id: MenuTemplate; label: string; description: string }> = [
  { id: 'editorial', label: 'Editorial', description: 'Élégant, lumineux, typographique' },
  { id: 'luxury', label: 'Luxury', description: 'Premium, sombre, doré' },
  { id: 'cards', label: 'Cards', description: 'Moderne, structuré, convivial' },
  { id: 'dark', label: 'Dark', description: 'Immersif, contrasté, impactant' },
];

export default function MenuConfigurator({
  draft,
  hasChanges,
  publishing,
  aiLoading,
  onChange,
  onPublish,
  onGenerateAi,
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

        <button
          type="button"
          onClick={onGenerateAi}
          disabled={aiLoading || publishing}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-3 py-2 text-[11px] font-semibold text-forest disabled:opacity-50"
        >
          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {aiLoading ? 'Analyse IA…' : 'Design IA'}
        </button>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink/35">Template</p>
        <div className="grid grid-cols-2 gap-2">
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
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-forest">{template.label}</span>
                  {active && <Check size={14} className="text-gold" />}
                </div>
                <p className="mt-1 text-[10px] leading-4 text-ink/40">{template.description}</p>
              </button>
            );
          })}
        </div>
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
