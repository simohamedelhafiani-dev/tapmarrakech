import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';
import type { MenuDesignDraft } from '@/components/admin/menu/MenuConfigurator';

type MenuPreviewProps = {
  establishmentName?: string;
  categories: MenuCategory[];
  itemsByCategory: Record<string, MenuItem[]>;
  draft?: MenuDesignDraft;
};

const theme = {
  editorial: {
    shell: 'bg-[#f4f0e6] text-[#26362b]',
    card: 'bg-white/85 border-black/5',
    accent: 'text-[#9c7a32]',
    muted: 'text-[#26362b]/55',
    heading: 'font-display',
  },
  luxury: {
    shell: 'bg-[#121712] text-white',
    card: 'bg-black/25 border-white/10',
    accent: 'text-gold',
    muted: 'text-white/55',
    heading: 'font-display',
  },
  cards: {
    shell: 'bg-[#f7f7f3] text-forest',
    card: 'bg-white border-black/5 shadow-sm',
    accent: 'text-gold',
    muted: 'text-ink/45',
    heading: '',
  },
  dark: {
    shell: 'bg-[#101610] text-white',
    card: 'bg-white/8 border-white/10',
    accent: 'text-gold',
    muted: 'text-white/55',
    heading: 'font-display',
  },
} as const;

export default function MenuPreview({
  establishmentName,
  categories,
  itemsByCategory,
  draft,
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
  const activeCategories = useMemo(
    () => categories.filter(category => category.active),
    [categories],
  );
  const [bookPage, setBookPage] = useState(0);
  const [appCategoryId, setAppCategoryId] = useState(activeCategories[0]?.id ?? '');

  useEffect(() => {
    if (!activeCategories.length) {
      setBookPage(0);
      setAppCategoryId('');
      return;
    }

    setBookPage(current => Math.min(current, activeCategories.length - 1));

    if (!activeCategories.some(category => category.id === appCategoryId)) {
      setAppCategoryId(activeCategories[0].id);
    }
  }, [activeCategories, appCategoryId]);

  const visibleCategories =
    activeDraft.navigation === 'book'
      ? activeCategories.slice(bookPage, bookPage + 1)
      : activeDraft.navigation === 'app'
        ? activeCategories.filter(category => category.id === appCategoryId)
        : activeCategories;

  const currentBookPage = activeCategories.length ? bookPage + 1 : 0;

  return (
    <aside className="min-w-0 overflow-hidden rounded-3xl border border-ink/5 bg-white shadow-sm lg:sticky lg:top-4 lg:self-start">
      <div className="border-b border-ink/5 bg-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Aperçu en direct</p>
        <h3 className="mt-1 text-base font-semibold text-forest">{establishmentName || 'Menu public'}</h3>
        <p className="mt-1 text-[11px] text-ink/35">Miroir du Draft · aucune sauvegarde automatique</p>
      </div>

      <div className="p-3">
        <div className={`relative max-h-[calc(100vh-180px)] min-h-[520px] overflow-y-auto rounded-[26px] ${colors.shell}`}>
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
            <header className="p-5 pb-4 text-center sm:p-6 sm:pb-4">
              <p className={`text-[9px] font-bold uppercase tracking-[0.32em] ${colors.accent}`}>Menu</p>
              <h4 className={`mt-2 text-3xl leading-tight ${colors.heading}`}>
                {establishmentName || 'Votre établissement'}
              </h4>
              <p className={`mt-2 text-[10px] leading-4 ${colors.muted}`}>
                Une carte pensée pour votre expérience client.
              </p>
            </header>

            {activeDraft.navigation === 'app' && activeCategories.length > 0 && (
              <nav className="sticky top-0 z-10 border-y border-current/10 bg-black/10 px-3 py-2 backdrop-blur-md">
                <div className="flex gap-1.5 overflow-x-auto">
                  {activeCategories.map(category => {
                    const active = category.id === appCategoryId;
                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setAppCategoryId(category.id)}
                        className={[
                          'shrink-0 rounded-full border px-3 py-1.5 text-[9px] font-semibold transition',
                          active
                            ? 'border-gold bg-gold text-white'
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

            <div className="p-5 sm:p-6">
            <header className="border-b border-current/10 pb-5 text-center">
              <p className={`text-[9px] font-bold uppercase tracking-[0.32em] ${colors.accent}`}>Menu</p>
              <h4 className={`mt-2 text-3xl leading-tight ${colors.heading}`}>
                {establishmentName || 'Votre établissement'}
              </h4>
              <p className={`mt-2 text-[10px] leading-4 ${colors.muted}`}>
                Une carte pensée pour votre expérience client.
              </p>
            </header>

            <div className="mt-5 space-y-6">
              {visibleCategories.map((category) => {
                const items = (itemsByCategory[category.id] ?? []).filter(item => item.active);
                return (
                  <section key={category.id}>
                    <div className="mb-3 flex items-end justify-between gap-3">
                      <h5 className={`text-lg font-semibold ${colors.heading}`}>{category.name}</h5>
                      <span className={`text-[8px] uppercase tracking-[0.18em] ${colors.accent}`}>Carte</span>
                    </div>

                    <div className={activeDraft.template === 'cards' ? 'grid gap-2' : 'space-y-2'}>
                      {items.map((item) => (
                        <article key={item.id} className={`rounded-2xl border p-3 ${colors.card}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-semibold">{item.name}</p>
                              {item.description && (
                                <p className={`mt-1 text-[10px] leading-4 ${colors.muted}`}>{item.description}</p>
                              )}
                            </div>
                            <span className={`shrink-0 text-[11px] font-bold ${colors.accent}`}>{item.price} DH</span>
                          </div>
                          {item.image_url && activeDraft.template === 'cards' && (
                            <img src={item.image_url} alt="" className="mt-3 h-28 w-full rounded-xl object-cover" />
                          )}
                        </article>
                      ))}
                      {!items.length && <p className={`text-[10px] ${colors.muted}`}>Aucun article actif.</p>}
                    </div>
                  </section>
                );
              })}
              </div>

              {activeDraft.navigation === 'book' && (
                <div className="mt-7 border-t border-current/10 pt-4">
                  <div className="flex items-center justify-between gap-3">
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
                      Page {currentBookPage}/{activeCategories.length || 1}
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
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
