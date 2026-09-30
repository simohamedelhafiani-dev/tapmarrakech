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
    template: 'editorial',
    wallpaperUrl: null,
    wallpaperFile: null,
    wallpaperObjectUrl: null,
    wallpaperRemoved: false,
    overlayOpacity: 0.35,
    aiDesign: null,
  };

  const colors = theme[activeDraft.template];

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

          <div className="relative p-5 sm:p-6">
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
              {categories.filter(category => category.active).map((category) => {
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
          </div>
        </div>
      </div>
    </aside>
  );
}
