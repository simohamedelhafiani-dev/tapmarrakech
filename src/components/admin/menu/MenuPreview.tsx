import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, LayoutGrid, ScrollText } from 'lucide-react';
import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';
import type { MenuDesignDraft } from '@/components/admin/menu/MenuConfigurator';

type MenuPreviewProps = {
  establishmentName?: string;
  categories: MenuCategory[];
  itemsByCategory: Record<string, MenuItem[]>;
  draft?: MenuDesignDraft;
  compact?: boolean;
  fullScreen?: boolean;
};

const theme = {
  editorial: {
    shell: 'bg-[#f4f0e6] text-[#26362b]',
    header: 'bg-[#f4f0e6]',
    card: 'border-b border-[#26362b]/10 bg-transparent rounded-none px-1 py-3',
    accent: 'text-[#9c7a32]',
    muted: 'text-[#26362b]/55',
    heading: 'font-display',
    category: 'border-b border-[#9c7a32]/30 pb-2',
    icon: ScrollText,
  },
  luxury: {
    shell: 'bg-[#111611] text-[#f7f0df]',
    header: 'bg-[#111611]',
    card: 'border border-[#c8a75d]/25 bg-[#1b211b] rounded-xl px-4 py-3',
    accent: 'text-[#d2b46a]',
    muted: 'text-white/55',
    heading: 'font-display',
    category: 'border-b border-[#c8a75d]/30 pb-2',
    icon: BookOpen,
  },
  cards: {
    shell: 'bg-[#f7f7f3] text-[#24352a]',
    header: 'bg-white',
    card: 'border border-black/5 bg-white rounded-2xl p-3 shadow-sm',
    accent: 'text-[#a17d31]',
    muted: 'text-[#24352a]/50',
    heading: '',
    category: 'border-b border-black/5 pb-2',
    icon: LayoutGrid,
  },
  dark: {
    shell: 'bg-[#080c09] text-white',
    header: 'bg-[#080c09]',
    card: 'border border-white/10 bg-white/[0.06] rounded-2xl px-4 py-3 backdrop-blur-sm',
    accent: 'text-[#d6b86b]',
    muted: 'text-white/55',
    heading: 'font-display',
    category: 'border-b border-white/10 pb-2',
    icon: BookOpen,
  },
} as const;

export default function MenuPreview({
  establishmentName,
  categories,
  itemsByCategory,
  draft,
  compact = false,
}: MenuPreviewProps) {
  const activeDraft = draft ?? {
    template: 'editorial' as const,
    navigation: 'scroll' as const,
    wallpaperUrl: null,
    wallpaperFile: null,
    wallpaperObjectUrl: null,
    wallpaperRemoved: false,
    overlayOpacity: 0.35,
    aiDesign: null,
  };

  const colors = theme[activeDraft.template];

  const aiDesign = activeDraft.aiDesign;
  const showPhotos = aiDesign?.photo_mode !== 'without_photos';
  const aiHero =
    aiDesign && typeof aiDesign.hero === 'object' && aiDesign.hero !== null
      ? (aiDesign.hero as { title?: string; subtitle?: string | null })
      : null;

  const aiSections = Array.isArray(aiDesign?.sections)
    ? aiDesign.sections.filter(
        (section): section is { category_id?: string; item_ids?: string[] } =>
          !!section && typeof section === 'object',
      )
    : [];

  const orderedCategories = useMemo(() => {
    if (!aiSections.length) return categories.filter(category => category.active);

    const byId = new Map(categories.map(category => [category.id, category]));
    const ordered = aiSections
      .map(section => (section.category_id ? byId.get(section.category_id) : undefined))
      .filter((category): category is MenuCategory => !!category && category.active);

    const used = new Set(ordered.map(category => category.id));
    return [
      ...ordered,
      ...categories.filter(category => category.active && !used.has(category.id)),
    ];
  }, [categories, aiSections]);

  const displayName = aiHero?.title || establishmentName || 'Votre établissement';
  const displaySubtitle = aiHero?.subtitle || 'Une carte pensée pour votre expérience client.';

  const activeCategories = useMemo(
    () => orderedCategories,
    [categories],
  );

  const [bookPage, setBookPage] = useState(0);
  const [appCategoryId, setAppCategoryId] = useState('');

  useEffect(() => {
    if (!activeCategories.length) {
      setBookPage(0);
      setAppCategoryId('');
      return;
    }

    setBookPage(current => Math.min(current, activeCategories.length - 1));

    setAppCategoryId(current =>
      activeCategories.some(category => category.id === current)
        ? current
        : activeCategories[0].id,
    );
  }, [activeCategories]);

  useEffect(() => {
    setBookPage(0);
  }, [activeDraft.navigation, activeDraft.template]);

  const visibleCategories =
    activeDraft.navigation === 'book'
      ? activeCategories.slice(bookPage, bookPage + 1)
      : activeDraft.navigation === 'app'
        ? activeCategories.filter(category => category.id === appCategoryId)
        : activeCategories;

  const currentBookPage = activeCategories.length ? bookPage + 1 : 0;
  const TemplateIcon = colors.icon;

  const renderItems = (category: MenuCategory) => {
    const items = (itemsByCategory[category.id] ?? []).filter(item => item.active);

    if (!items.length) {
      return <p className={`text-[10px] ${colors.muted}`}>Aucun article actif.</p>;
    }

    if (activeDraft.template === 'cards') {
      return (
        <div className="grid gap-3">
          {items.map(item => (
            <article key={item.id} className={colors.card}>
              {showPhotos && item.image_url && (
                <img
                  src={item.image_url}
                  alt=""
                  className="mb-3 h-32 w-full rounded-xl object-cover"
                />
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold">{item.name}</p>
                  {item.description && (
                    <p className={`mt-1 text-[10px] leading-4 ${colors.muted}`}>{item.description}</p>
                  )}
                </div>
                <span className={`shrink-0 text-[11px] font-bold ${colors.accent}`}>
                  {item.price} DH
                </span>
              </div>
            </article>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-1">
        {items.map(item => (
          <article key={item.id} className={colors.card}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold">{item.name}</p>
                {item.description && (
                  <p className={`mt-1 text-[10px] leading-4 ${colors.muted}`}>{item.description}</p>
                )}
              </div>
              <span className={`shrink-0 text-[11px] font-bold ${colors.accent}`}>
                {item.price} DH
              </span>
            </div>

            {showPhotos && activeDraft.template === 'luxury' && item.image_url && (
              <img
                src={item.image_url}
                alt=""
                className="mt-3 h-24 w-full rounded-lg object-cover opacity-90"
              />
            )}
          </article>
        ))}
      </div>
    );
  };

  return (
    <aside className={`min-w-0 overflow-hidden border border-white/[.08] bg-[#111111] shadow-soft ${fullScreen ? "rounded-[32px]" : "rounded-3xl lg:sticky lg:top-24 lg:self-start"}`}>
      {!compact && <div className="border-b border-ink/5 bg-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Aperçu en direct</p>
        <h3 className="mt-1 text-base font-semibold text-forest">
          {establishmentName || 'Menu public'}
        </h3>
        <p className="mt-1 text-[11px] text-ink/35">
          Miroir KELYANI · synchronisé avec le Studio
        </p>
      </div>}

      <div className={compact ? "p-0" : fullScreen ? "p-3 sm:p-5" : "p-3"}>
        <div className={`relative overflow-y-auto ${fullScreen ? "min-h-[calc(100vh-190px)] max-h-[calc(100vh-140px)] rounded-[28px]" : "max-h-[520px] min-h-[360px] rounded-[26px]"} ${colors.shell}`}>
          {activeDraft.wallpaperUrl && (
            <>
              <div
                className="absolute inset-0 bg-cover bg-center"
                style={{ backgroundImage: `url("${activeDraft.wallpaperUrl}")` }}
              />
              <div
                className="absolute inset-0 bg-black"
                style={{ opacity: activeDraft.overlayOpacity }}
              />
            </>
          )}

          <div className="relative">
            <header className={`${fullScreen ? "px-6 py-14 sm:px-12 sm:py-20" : "p-6"} text-center ${colors.header}`}>
              <div className={`mx-auto mb-3 grid h-9 w-9 place-items-center rounded-full border border-current/10 ${colors.accent}`}>
                <TemplateIcon size={15} />
              </div>
              <p className={`text-[9px] font-bold uppercase tracking-[0.32em] ${colors.accent}`}>
                Menu
              </p>
              <h4 className={`mt-2 ${fullScreen ? 'text-5xl sm:text-7xl' : compact ? 'text-xl' : 'text-3xl'} leading-tight ${colors.heading}`}>
                {displayName}
              </h4>
              <p className={`mt-2 text-[10px] leading-4 ${colors.muted}`}>
                {displaySubtitle}
              </p>

              <div className="mt-4 flex justify-center">
                <span className={`rounded-full border border-current/10 px-2.5 py-1 text-[8px] font-semibold uppercase tracking-[0.12em] ${colors.muted}`}>
                  {activeDraft.template}
                </span>
              </div>
            </header>

            {activeDraft.navigation === 'app' && activeCategories.length > 0 && (
              <nav className="sticky top-0 z-20 border-y border-current/10 bg-black/10 px-3 py-2 backdrop-blur-md">
                <div className="flex gap-1.5 overflow-x-auto">
                  {activeCategories.map(category => {
                    const active = category.id === appCategoryId;

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setAppCategoryId(category.id)}
                        className={[
                          'shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-semibold transition-all',
                          active
                            ? 'border-gold bg-gold text-white shadow-sm'
                            : 'border-current/10 bg-black/5 text-current/60 hover:border-gold/40',
                        ].join(' ')}
                      >
                        {category.name}
                      </button>
                    );
                  })}
                </div>
              </nav>
            )}

            <div className={compact ? "p-3" : "p-5 sm:p-6"}>
              {activeDraft.navigation === 'book' && (
                <div className="mb-5 flex items-center justify-between rounded-xl border border-current/10 bg-black/5 px-3 py-2">
                  <span className={`text-[9px] font-semibold ${colors.muted}`}>Mode livre</span>
                  <span className={`text-[10px] font-bold ${colors.accent}`}>
                    Page {currentBookPage}/{activeCategories.length || 1}
                  </span>
                </div>
              )}

              <div className={compact ? 'space-y-4' : 'space-y-7'}>
                {visibleCategories.map(category => (
                  <section key={category.id}>
                    <div className={compact ? `mb-2 ${colors.category}` : `mb-3 ${colors.category}`}>
                      <h5 className={`${compact ? 'text-sm' : 'text-lg'} font-semibold ${colors.heading}`}>
                        {category.name}
                      </h5>
                      {category.description && (
                        <p className={`mt-1 text-[9px] leading-4 ${colors.muted}`}>
                          {category.description}
                        </p>
                      )}
                    </div>

                    {renderItems(category)}
                  </section>
                ))}

                {!visibleCategories.length && (
                  <div className={`rounded-2xl border border-current/10 p-5 text-center text-[10px] ${colors.muted}`}>
                    Aucune catégorie active.
                  </div>
                )}
              </div>

              {activeDraft.navigation === 'book' && activeCategories.length > 0 && (
                <div className="mt-7 border-t border-current/10 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <button
                      type="button"
                      disabled={bookPage === 0}
                      onClick={() => setBookPage(page => Math.max(0, page - 1))}
                      className="inline-flex items-center gap-1 rounded-full border border-current/10 px-3 py-2 text-[9px] font-semibold transition hover:border-gold/50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronLeft size={12} />
                      Précédent
                    </button>

                    <span className={`text-[9px] font-semibold ${colors.muted}`}>
                      {bookPage + 1} / {activeCategories.length}
                    </span>

                    <button
                      type="button"
                      disabled={bookPage >= activeCategories.length - 1}
                      onClick={() =>
                        setBookPage(page => Math.min(activeCategories.length - 1, page + 1))
                      }
                      className="inline-flex items-center gap-1 rounded-full border border-current/10 px-3 py-2 text-[9px] font-semibold transition hover:border-gold/50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      Suivant
                      <ChevronRight size={12} />
                    </button>
                  </div>
                </div>
              )}

              {activeDraft.navigation === 'app' && activeCategories.length > 0 && (
                <div className={`mt-6 text-center text-[9px] ${colors.muted}`}>
                  Catégorie {Math.max(1, activeCategories.findIndex(c => c.id === appCategoryId) + 1)} / {activeCategories.length}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
