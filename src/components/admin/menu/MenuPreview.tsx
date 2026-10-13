import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, BookOpen, LayoutGrid, ScrollText, Sparkle, Waves } from 'lucide-react';
import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';
import type { MenuDesignDraft } from '@/components/admin/menu/MenuConfigurator';
import { getMenuTemplateFamily, getMenuTemplateLayout } from '@/components/admin/menu/menuTemplates';

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
  onyx: {
    shell: 'bg-[#050505] text-white',
    header: 'bg-[#050505]',
    card: 'border border-white/10 bg-white/[0.05] rounded-2xl px-4 py-3 backdrop-blur-xl',
    accent: 'text-[#E1C27A]',
    muted: 'text-white/55',
    heading: 'font-display',
    category: 'border-b border-[#C9A45C]/25 pb-2',
    icon: BookOpen,
  },
  'royal-gold': {
    shell: 'bg-[#0B0906] text-[#FFF9E8]',
    header: 'bg-[#0B0906]',
    card: 'border border-[#C9A45C]/25 bg-[#17110A] rounded-2xl px-4 py-3',
    accent: 'text-[#E1C27A]',
    muted: 'text-[#FFF9E8]/55',
    heading: 'font-display',
    category: 'border-b border-[#E1C27A]/30 pb-2',
    icon: Sparkle,
  },
  'deep-ocean': {
    shell: 'bg-[#06151B] text-[#F2FCFF]',
    header: 'bg-[#06151B]',
    card: 'border border-[#8ED9E8]/20 bg-[#0A222B] rounded-2xl px-4 py-3',
    accent: 'text-[#8ED9E8]',
    muted: 'text-white/55',
    heading: 'font-display',
    category: 'border-b border-[#8ED9E8]/25 pb-2',
    icon: Waves,
  },
  pearl: {
    shell: 'bg-[#F5F1E8] text-[#1B1A17]',
    header: 'bg-[#F5F1E8]',
    card: 'border border-[#B59A67]/20 bg-white/70 rounded-2xl px-4 py-3 shadow-sm',
    accent: 'text-[#9A7A3C]',
    muted: 'text-[#1B1A17]/50',
    heading: 'font-display',
    category: 'border-b border-[#B59A67]/25 pb-2',
    icon: Sparkle,
  },
} as const;

export default function MenuPreview({
  establishmentName,
  categories,
  itemsByCategory,
  draft,
  compact = false,
  fullScreen = false,
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

  const templateFamily = getMenuTemplateFamily(activeDraft.template);
  const templateLayout = getMenuTemplateLayout(activeDraft.template);
  const colors = theme[templateFamily];

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

    if (['product-grid', 'magazine-grid'].includes(templateLayout)) {
      return (
        <div className={templateLayout === 'magazine-grid' ? 'grid grid-cols-1 gap-4 sm:grid-cols-2' : 'grid grid-cols-2 gap-3'}>
          {items.map(item => (
            <article key={item.id} className={`${colors.card} overflow-hidden ${templateLayout === 'magazine-grid' ? 'rounded-[22px]' : ''}`}>
              {showPhotos && item.image_url && (
                <img src={item.image_url} alt="" className={templateLayout === 'magazine-grid' ? 'h-44 w-full object-cover' : 'aspect-[4/3] w-full object-cover'} />
              )}
              <div className={templateLayout === 'magazine-grid' ? 'p-4' : 'p-3'}>
                <p className="text-xs font-bold">{item.name}</p>
                {item.description && <p className={`mt-1 text-[10px] leading-4 ${colors.muted}`}>{item.description}</p>}
                <p className={`mt-3 text-sm font-bold ${colors.accent}`}>{item.price} DH</p>
              </div>
            </article>
          ))}
        </div>
      );
    }

    if (templateLayout === 'stacked-photo') {
      return (
        <div className="space-y-4">
          {items.map(item => (
            <article key={item.id} className={`${colors.card} overflow-hidden rounded-2xl`}>
              {showPhotos && item.image_url && <img src={item.image_url} alt="" className="h-44 w-full object-cover" />}
              <div className="flex items-start justify-between gap-3 p-4">
                <div className="min-w-0">
                  <p className="text-sm font-bold">{item.name}</p>
                  {item.description && <p className={`mt-1 text-[10px] leading-4 ${colors.muted}`}>{item.description}</p>}
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold ${colors.accent}`}>{item.price} DH</span>
              </div>
            </article>
          ))}
        </div>
      );
    }

    if (templateLayout === 'split-catalog') {
      return (
        <div className="space-y-3">
          {items.map(item => (
            <article key={item.id} className={`flex gap-3 overflow-hidden rounded-xl ${colors.card}`}>
              {showPhotos && item.image_url && <img src={item.image_url} alt="" className="h-24 w-24 shrink-0 object-cover sm:h-28 sm:w-28" />}
              <div className="flex min-w-0 flex-1 items-start justify-between gap-2 py-3 pr-3">
                <div className="min-w-0">
                  <p className="text-xs font-bold">{item.name}</p>
                  {item.description && <p className={`mt-1 text-[10px] leading-4 ${colors.muted}`}>{item.description}</p>}
                </div>
                <span className={`shrink-0 text-[11px] font-bold ${colors.accent}`}>{item.price} DH</span>
              </div>
            </article>
          ))}
        </div>
      );
    }

    if (templateLayout === 'service-table') {
      return (
        <div className={`overflow-hidden rounded-xl border ${colors.category}`}>
          {items.map((item, index) => (
            <article key={item.id} className={`flex items-start justify-between gap-4 px-3 py-3 ${index ? 'border-t border-current/10' : ''}`}>
              <div className="min-w-0">
                <p className="text-xs font-semibold">{item.name}</p>
                {item.description && <p className={`mt-1 text-[10px] leading-4 ${colors.muted}`}>{item.description}</p>}
              </div>
              <span className={`shrink-0 text-xs font-bold ${colors.accent}`}>{item.price} DH</span>
            </article>
          ))}
        </div>
      );
    }

    if (templateLayout === 'compact-list' || templateLayout === 'minimal-list' || templateLayout === 'price-list') {
      return (
        <div className={templateLayout === 'compact-list' ? 'space-y-1' : 'space-y-3'}>
          {items.map(item => (
            <article key={item.id} className={`flex items-baseline gap-2 ${templateLayout === 'compact-list' ? 'border-b border-current/10 py-2' : 'py-1'}`}>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold">{item.name}</p>
                {item.description && <p className={`mt-1 text-[10px] leading-4 ${colors.muted}`}>{item.description}</p>}
              </div>
              <span className={`shrink-0 text-[11px] font-bold ${colors.accent}`}>{item.price} DH</span>
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

            {showPhotos && templateFamily === 'luxury' && item.image_url && (
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

  const [menuSearch, setMenuSearch] = useState('');
  const [mobileCategoryId, setMobileCategoryId] = useState('all');
  const allMobileItems = activeCategories.flatMap(category =>
    (itemsByCategory[category.id] ?? []).filter(item => item.active).map(item => ({
      ...item,
      categoryId: category.id,
      categoryName: category.name,
    })),
  );
  const filteredMobileItems = allMobileItems.filter(item =>
    (mobileCategoryId === 'all' || item.categoryId === mobileCategoryId) &&
    (item.name + ' ' + (item.description || '') + ' ' + item.categoryName)
      .toLowerCase().includes(menuSearch.toLowerCase()),
  );
  const heroPhoto = allMobileItems.find(item => item.image_url)?.image_url;
  const mobileDark = ['dark', 'onyx', 'royal-gold', 'deep-ocean'].includes(templateFamily);

  return (
    <aside className={`min-w-0 overflow-hidden border border-white/[.08] bg-[#111111] shadow-soft ${fullScreen ? 'rounded-[32px]' : 'rounded-3xl lg:sticky lg:top-24 lg:self-start'}`}>
      {!compact && (
        <div className="border-b border-ink/5 bg-white p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Aperçu en direct</p>
          <h3 className="mt-1 text-base font-semibold text-forest">{establishmentName || 'Menu public'}</h3>
          <p className="mt-1 text-[11px] text-ink/35">Miroir KELYANI · synchronisé avec le Studio</p>
        </div>
      )}

      <div className={compact ? 'p-0' : fullScreen ? 'p-3 sm:p-5' : 'p-3'}>
        <div className={`relative mx-auto h-[520px] w-full max-w-[360px] overflow-hidden rounded-[28px] border-[5px] border-[#202020] shadow-xl ${mobileDark ? 'bg-[#10130f] text-white' : 'bg-[#fffdf8] text-[#26362b]'}`}>
          <div className="absolute inset-0 overflow-y-auto pb-20 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <header className={`px-4 pb-3 pt-5 ${mobileDark ? 'bg-[#171b16]' : 'bg-[#fffdf8]'}`}>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className={`text-[9px] font-bold uppercase tracking-[0.22em] ${mobileDark ? 'text-[#d4af37]' : 'text-[#9c7a32]'}`}>Menu</p>
                  <h4 className="mt-1 truncate text-xl font-bold leading-tight">{displayName}</h4>
                  <p className={`mt-1 text-[10px] leading-4 ${mobileDark ? 'text-white/45' : 'text-[#8b8f84]'}`}>{displaySubtitle}</p>
                </div>
                <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border ${mobileDark ? 'border-white/10 text-[#d4af37]' : 'border-black/10 text-[#9c7a32]'}`}>
                  <TemplateIcon size={17}/>
                </div>
              </div>
              {showPhotos && heroPhoto && (
                <div className="relative mt-3 h-28 overflow-hidden rounded-2xl bg-[#e8e0d1]">
                  <img src={heroPhoto} alt="" className="h-full w-full object-cover"/>
                  <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/20 to-transparent"/>
                  <div className="absolute bottom-3 left-3 text-white">
                    <p className="text-[8px] font-semibold uppercase tracking-[0.18em] text-white/75">À découvrir</p>
                    <p className="mt-1 text-base font-bold">Nos incontournables</p>
                  </div>
                </div>
              )}
              <label className={`mt-3 flex h-10 items-center gap-2 rounded-xl px-3 ${mobileDark ? 'bg-white/10 text-white/65' : 'bg-[#f0eee8] text-[#6b7068]'}`}>
                <span className="text-sm">⌕</span>
                <input value={menuSearch} onChange={event => setMenuSearch(event.target.value)} placeholder="Rechercher un plat…" className={`min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-70 ${mobileDark ? 'text-white' : 'text-[#26362b]'}`}/>
                {menuSearch && <button type="button" onClick={() => setMenuSearch('')} className="text-xs">✕</button>}
              </label>
            </header>

            <section className="px-3 pb-4 pt-2">
              <div className="mb-2 flex items-center justify-between px-1">
                <h5 className="text-sm font-bold">{mobileCategoryId === 'all' ? 'Nos plats' : activeCategories.find(category => category.id === mobileCategoryId)?.name}</h5>
                <span className={`text-[9px] ${mobileDark ? 'text-white/45' : 'text-[#85877f]'}`}>{filteredMobileItems.length} articles</span>
              </div>
              <div className={`${['product-grid', 'magazine-grid'].includes(templateLayout) ? 'grid grid-cols-2 gap-2' : 'space-y-2'}`}>
                {filteredMobileItems.map(item => {
                  const image = showPhotos && item.image_url;
                  const grid = ['product-grid', 'magazine-grid'].includes(templateLayout);
                  const stacked = templateLayout === 'stacked-photo';
                  const service = ['service-table', 'minimal-list', 'compact-list', 'price-list'].includes(templateLayout);
                  const split = templateLayout === 'split-catalog';
                  return (
                    <article key={item.id} className={`overflow-hidden ${grid ? 'rounded-xl' : service ? 'rounded-none border-b py-2' : 'rounded-2xl'} ${mobileDark ? (grid ? 'bg-white/[0.06] ring-1 ring-white/10' : service ? 'border-white/10' : 'bg-white/[0.05] ring-1 ring-white/10') : (grid ? 'bg-white shadow-sm ring-1 ring-black/[0.06]' : service ? 'border-black/10' : 'bg-white shadow-sm ring-1 ring-black/[0.06]')}`}>
                      {stacked && image && <img src={item.image_url!} alt="" className="h-28 w-full object-cover"/>}
                      {grid && image && <img src={item.image_url!} alt="" className="aspect-square w-full object-cover"/>}
                      <div className={`${grid ? 'p-2' : 'p-2.5'} ${split ? 'flex gap-2' : ''}`}>
                        {split && image && <img src={item.image_url!} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover"/>}
                        {!grid && !stacked && !split && image && <img src={item.image_url!} alt="" className="mb-2 h-16 w-full rounded-lg object-cover"/>}
                        {!grid && !service && <p className={`text-[8px] font-semibold uppercase tracking-wide ${mobileDark ? 'text-[#d4af37]' : 'text-[#8b8f84]'}`}>{item.categoryName}</p>}
                        <div className="min-w-0 flex-1">
                          <p className={`${grid ? 'text-[10px]' : 'text-[11px]'} font-bold leading-snug`}>{item.name}</p>
                          {item.description && <p className={`mt-1 ${grid ? 'line-clamp-2 text-[8px]' : 'line-clamp-2 text-[9px]'} leading-3.5 ${mobileDark ? 'text-white/55' : 'text-[#7c8179]'}`}>{item.description}</p>}
                          <p className="mt-1.5 text-[11px] font-extrabold text-[#bd7d28]">{Number(item.price).toLocaleString('fr-FR')} DH</p>
                        </div>
                      </div>
                    </article>
                  );
                })}
                {!filteredMobileItems.length && <p className="p-5 text-center text-xs opacity-60">Aucun article trouvé.</p>}
              </div>
            </section>
          </div>

          {activeDraft.navigation === 'app' && (
            <nav className={`absolute bottom-0 left-0 right-0 z-20 flex gap-1.5 overflow-x-auto border-t px-2 pt-2 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${mobileDark ? 'border-white/10 bg-[#10130f]/95' : 'border-black/10 bg-[#fffdf8]/95'} backdrop-blur-xl`}>
              {activeCategories.map(category => (
                <button key={category.id} type="button" onClick={() => setMobileCategoryId(category.id)} className={`shrink-0 rounded-full px-3 py-2 text-[9px] font-semibold ${mobileCategoryId === category.id ? 'bg-[#d4af37] text-[#1f3025]' : mobileDark ? 'border border-white/15 text-white/70' : 'border border-black/10 text-[#4c554c]'}`}>
                  {category.name}
                </button>
              ))}
            </nav>
          )}
        </div>
      </div>
    </aside>
  );
}
