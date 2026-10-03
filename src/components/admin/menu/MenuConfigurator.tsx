import { useRef, useState } from 'react';
import { Check, ChevronDown, ImagePlus, Loader2, Sparkles, Upload, X, Wand2 } from 'lucide-react';
import MenuPreview from '@/components/admin/menu/MenuPreview';
import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';

export type MenuTemplate = 'editorial' | 'luxury' | 'cards' | 'dark' | 'onyx' | 'royal-gold' | 'deep-ocean' | 'pearl';
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
  aiLoading: boolean;
  aiPhotoMode: 'with_photos' | 'without_photos';
  onAiPhotoModeChange: (mode: 'with_photos' | 'without_photos') => void;
  onChange: (patch: Partial<MenuDesignDraft>) => void;
  onPublish: () => void;
  onGenerateAi: () => void;
  aiCandidates: Array<{ id: string; design: Record<string, unknown>; template: MenuTemplate; photoMode: 'with_photos' | 'without_photos' }>;
  categories: MenuCategory[];
  itemsByCategory: Record<string, MenuItem[]>;
  establishmentName?: string;
  onApplyAiCandidate: (candidate: { design: Record<string, unknown>; template: MenuTemplate }) => void;
};

const navigationModes: Array<{ id: MenuNavigationMode; label: string; description: string }> = [
  { id: 'scroll', label: 'Page unique', description: 'Défilement classique' },
  { id: 'book', label: 'Mode livre', description: 'Pagination par catégorie' },
  { id: 'app', label: 'Catégories en haut', description: 'Cliquez sur une catégorie pour afficher ses plats' },
];

const templates: Array<{ id: MenuTemplate; label: string; description: string }> = [
  { id: 'editorial', label: 'Editorial', description: 'Élégant, lumineux, typographique' },
  { id: 'luxury', label: 'Luxury', description: 'Premium, sombre, doré' },
  { id: 'cards', label: 'Cards', description: 'Moderne, structuré, convivial' },
  { id: 'dark', label: 'Dark', description: 'Immersif, contrasté, impactant' },
  { id: 'onyx', label: 'Onyx', description: 'Noir minéral, glassmorphism' },
  { id: 'royal-gold', label: 'Royal Gold', description: 'Or royal, lignes éditoriales' },
  { id: 'deep-ocean', label: 'Deep Ocean', description: 'Bleu profond, premium contemporain' },
  { id: 'pearl', label: 'Pearl', description: 'Ivoire, minimalisme couture' },
];

export default function MenuConfigurator({
  draft,
  hasChanges,
  publishing,
  aiLoading,
  aiPhotoMode,
  onAiPhotoModeChange,
  onChange,
  onPublish,
  onGenerateAi,
  aiCandidates,
  categories,
  itemsByCategory,
  establishmentName,
  onApplyAiCandidate,
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

      <div className="rounded-2xl border border-forest/10 bg-forest/[0.03] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-gold">Assistant IA</p>
            <h4 className="mt-1 text-sm font-semibold text-forest">Générer plusieurs directions</h4>
            <p className="mt-1 max-w-xl text-[10px] leading-4 text-ink/40">
              L’IA prépare 3 propositions à partir de ton menu. Rien n’est appliqué ni publié tant que tu n’as pas choisi une proposition.
            </p>
          </div>
          <Wand2 size={18} className="shrink-0 text-gold" />
        </div>

<div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {([
            { id: 'with_photos' as const, label: 'Avec photos', description: 'Utilise les photos disponibles' },
            { id: 'without_photos' as const, label: 'Sans photos', description: 'Design 100% texte' },
          ]).map((mode) => {
            const active = aiPhotoMode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => onAiPhotoModeChange(mode.id)}
                disabled={aiLoading || publishing}
                className={[
                  'rounded-xl border px-3 py-2.5 text-left transition',
                  active ? 'border-gold bg-gold/10 ring-1 ring-gold/20' : 'border-ink/8 bg-white hover:border-forest/20',
                ].join(' ')}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-forest">{mode.label}</span>
                  {active && <Check size={12} className="text-gold" />}
                </div>
                <p className="mt-1 text-[9px] leading-4 text-ink/35">{mode.description}</p>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={onGenerateAi}
          disabled={aiLoading || publishing}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-[11px] font-semibold text-white transition hover:bg-forest/90 disabled:opacity-50"
        >
          {aiLoading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {aiLoading ? 'Génération de 3 propositions…' : 'Générer 3 propositions IA'}
        </button>

        {aiCandidates.length > 0 && (
          <div className="mt-4 grid gap-4 xl:grid-cols-3">
            {aiCandidates.map((candidate, index) => {
              const previewDraft: MenuDesignDraft = {
                ...draft,
                template: candidate.template,
                aiDesign: { ...candidate.design, photo_mode: candidate.photoMode },
                wallpaperFile: null,
                wallpaperObjectUrl: null,
                wallpaperRemoved: false,
              };

              const hero = candidate.design.hero as { title?: string; subtitle?: string | null } | undefined;
              const sections = Array.isArray(candidate.design.sections) ? candidate.design.sections : [];

              return (
                <article key={candidate.id} className="overflow-hidden rounded-2xl border border-ink/8 bg-white shadow-sm">
                  <div className="flex items-center justify-between gap-2 border-b border-ink/5 px-3 py-2.5">
                    <span className="rounded-full bg-gold/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-gold">
                      Proposition {index + 1}
                    </span>
                    <span className="text-[9px] font-semibold uppercase text-ink/35">{candidate.template}</span>
                  </div>

                  <div className="p-2">
                    <MenuPreview
                      establishmentName={establishmentName}
                      categories={categories}
                      itemsByCategory={itemsByCategory}
                      draft={previewDraft}
                      compact
                    />
                  </div>

                  <div className="border-t border-ink/5 p-3">
                    <h5 className="text-xs font-semibold text-forest">{hero?.title || 'Direction créative'}</h5>
                    <p className="mt-1 min-h-8 text-[9px] leading-4 text-ink/40">{hero?.subtitle || 'Proposition générée par l’IA.'}</p>
                    <div className="mt-2 flex items-center justify-between gap-2 text-[9px] text-ink/35">
                      <span>{sections.length} section{sections.length > 1 ? 's' : ''}</span>
                      <span>{candidate.photoMode === 'without_photos' ? 'Sans photos' : 'Avec photos'}</span>
                    </div>
                    <button
                      type="button"
                      disabled={publishing}
                      onClick={() => onApplyAiCandidate(candidate)}
                      className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-3 py-2.5 text-[10px] font-semibold text-white transition hover:bg-forest/90 disabled:opacity-50"
                    >
                      <Check size={13} />
                      Utiliser cette proposition
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
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
