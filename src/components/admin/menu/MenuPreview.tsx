import { useEffect, useMemo, useState } from 'react';
import { BookOpen, LayoutGrid, ScrollText, Sparkle, Waves, UtensilsCrossed, Search } from 'lucide-react';
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

const palettes = {
  editorial: { page: 'bg-[#f5f1e8] text-[#26362b]', panel: 'bg-[#fffdf8]', accent: 'text-[#9c7a32]', muted: 'text-[#74776e]', line: 'border-[#26362b]/15', card: 'bg-white' },
  luxury: { page: 'bg-[#11100d] text-[#f7f0df]', panel: 'bg-[#171510]', accent: 'text-[#d2b46a]', muted: 'text-white/60', line: 'border-[#c8a75d]/30', card: 'bg-[#1b1914]' },
  cards: { page: 'bg-[#f7f7f3] text-[#24352a]', panel: 'bg-white', accent: 'text-[#a17d31]', muted: 'text-[#777b73]', line: 'border-black/10', card: 'bg-white' },
  dark: { page: 'bg-[#080c09] text-white', panel: 'bg-[#101510]', accent: 'text-[#d6b86b]', muted: 'text-white/60', line: 'border-white/15', card: 'bg-white/[0.06]' },
  onyx: { page: 'bg-[#050505] text-white', panel: 'bg-[#101010]', accent: 'text-[#E1C27A]', muted: 'text-white/60', line: 'border-white/15', card: 'bg-white/[0.05]' },
  'royal-gold': { page: 'bg-[#0B0906] text-[#FFF9E8]', panel: 'bg-[#17110A]', accent: 'text-[#E1C27A]', muted: 'text-[#FFF9E8]/60', line: 'border-[#E1C27A]/30', card: 'bg-[#17110A]' },
  'deep-ocean': { page: 'bg-[#06151B] text-[#F2FCFF]', panel: 'bg-[#0A222B]', accent: 'text-[#8ED9E8]', muted: 'text-white/60', line: 'border-[#8ED9E8]/25', card: 'bg-[#0A222B]' },
  pearl: { page: 'bg-[#F5F1E8] text-[#1B1A17]', panel: 'bg-[#fffdf8]', accent: 'text-[#9A7A3C]', muted: 'text-[#74716a]', line: 'border-[#B59A67]/25', card: 'bg-white' },
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
    template: '01_cafe_classic',
    navigation: 'app' as const,
    wallpaperUrl: null,
    wallpaperFile: null,
    wallpaperObjectUrl: null,
    wallpaperRemoved: false,
    overlayOpacity: 0.35,
    aiDesign: null,
  };
  const family = getMenuTemplateFamily(activeDraft.template);
  const layout = getMenuTemplateLayout(activeDraft.template);
  const palette = palettes[family];
  const TemplateIcon = family === 'deep-ocean' ? Waves : family === 'cards' ? LayoutGrid : family === 'pearl' ? Sparkle : family === 'editorial' ? ScrollText : BookOpen;
  const aiDesign = activeDraft.aiDesign;
  const showPhotos = !aiDesign || aiDesign.photo_mode !== 'without_photos';
  const hero = aiDesign && typeof aiDesign.hero === 'object' && aiDesign.hero !== null
    ? aiDesign.hero as { title?: string; subtitle?: string | null }
    : null;
  const displayName = hero?.title || establishmentName || 'Votre établissement';
  const displaySubtitle = hero?.subtitle || 'Notre carte';
  const activeCategories = useMemo(() => categories.filter(category => category.active), [categories]);
  const [categoryId, setCategoryId] = useState('all');
  const [search, setSearch] = useState('');
  useEffect(() => {
    if (categoryId !== 'all' && !activeCategories.some(category => category.id === categoryId)) setCategoryId('all');
  }, [activeCategories, categoryId]);
  const items = activeCategories.flatMap(category =>
    (itemsByCategory[category.id] ?? []).filter(item => item.active).map(item => ({
      ...item,
      categoryId: category.id,
      categoryName: category.name,
    })),
  ).filter(item =>
    (categoryId === 'all' || item.categoryId === categoryId) &&
    (item.name + ' ' + (item.description || '') + ' ' + item.categoryName).toLowerCase().includes(search.toLowerCase()),
  );
  const heroImage = items.find(item => item.image_url)?.image_url;
  const isGrid = layout === 'product-grid' || layout === 'magazine-grid';
  const isEditorial = layout === 'editorial-center';
  const isPriceList = layout === 'price-list';
  const isCompact = layout === 'compact-list';
  const isMinimal = layout === 'minimal-list';
  const isService = layout === 'service-table';
  const isStacked = layout === 'stacked-photo';
  const isSplit = layout === 'split-catalog';

  const renderItem = (item: typeof items[number], index: number) => {
    const photo = showPhotos && item.image_url;
    if (isGrid) {
      return <article key={item.id} className={`overflow-hidden rounded-xl ${palette.card} shadow-sm ring-1 ring-black/5`}>
        {photo ? <img src={item.image_url!} alt="" className={`w-full object-cover ${layout === 'magazine-grid' && index === 0 ? 'aspect-[4/5]' : 'aspect-square'}`} /> : <div className="grid aspect-square place-items-center bg-black/5"><UtensilsCrossed size={22} className={palette.muted}/></div>}
        <div className="p-2.5"><h4 className="text-xs font-bold leading-snug">{item.name}</h4>{item.description && <p className={`mt-1 line-clamp-2 text-[10px] leading-4 ${palette.muted}`}>{item.description}</p>}<p className={`mt-2 text-sm font-extrabold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</p></div>
      </article>;
    }
    if (isStacked) {
      return <article key={item.id} className={`overflow-hidden rounded-2xl ${palette.card} shadow-md`}>
        {photo ? <img src={item.image_url!} alt="" className="h-36 w-full object-cover"/> : <div className="grid h-16 place-items-center bg-black/5"><UtensilsCrossed size={20}/></div>}
        <div className="flex items-start justify-between gap-3 p-3"><div className="min-w-0"><h4 className="text-sm font-bold">{item.name}</h4>{item.description && <p className={`mt-1 text-xs leading-5 ${palette.muted}`}>{item.description}</p>}</div><span className={`shrink-0 text-sm font-bold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</span></div>
      </article>;
    }
    if (isSplit) {
      return <article key={item.id} className={`flex gap-3 rounded-2xl p-2.5 ${palette.card} ring-1 ring-black/5`}>
        {photo ? <img src={item.image_url!} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover"/> : <div className="grid h-24 w-16 shrink-0 place-items-center rounded-xl bg-black/5"><UtensilsCrossed size={18}/></div>}
        <div className="flex min-w-0 flex-1 flex-col justify-center"><h4 className="text-sm font-bold leading-snug">{item.name}</h4>{item.description && <p className={`mt-1 line-clamp-3 text-[11px] leading-4 ${palette.muted}`}>{item.description}</p>}<p className={`mt-2 text-sm font-bold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</p></div>
      </article>;
    }
    if (isService) {
      return <article key={item.id} className={`flex items-center justify-between gap-3 border-b py-3 ${palette.line}`}><div className="min-w-0"><h4 className="text-xs font-semibold">{item.name}</h4>{item.description && <p className={`mt-1 text-[10px] leading-4 ${palette.muted}`}>{item.description}</p>}</div><span className={`shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold ${palette.accent} ${palette.panel}`}>{Number(item.price).toLocaleString('fr-FR')} DH</span></article>;
    }
    if (isPriceList) {
      return <article key={item.id} className="py-3"><div className="flex items-baseline gap-2"><h4 className="text-sm font-medium">{item.name}</h4><span className={`min-w-[12px] flex-1 border-b border-dotted ${palette.line}`}/><span className={`shrink-0 text-sm font-bold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</span></div>{item.description && <p className={`mt-1 pr-12 text-[10px] leading-4 ${palette.muted}`}>{item.description}</p>}</article>;
    }
    if (isMinimal) {
      return <article key={item.id} className={`border-l-2 py-2 pl-3 ${palette.line}`}><div className="flex items-start justify-between gap-3"><h4 className="text-sm font-medium">{item.name}</h4><span className={`shrink-0 text-xs font-semibold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</span></div>{item.description && <p className={`mt-1 text-[10px] leading-4 ${palette.muted}`}>{item.description}</p>}</article>;
    }
    if (isCompact) {
      return <article key={item.id} className={`flex items-center gap-2 border-b py-2 ${palette.line}`}><span className="min-w-0 flex-1 text-xs font-semibold">{item.name}</span>{item.description && <span className={`hidden min-w-0 flex-1 truncate text-[9px] sm:block ${palette.muted}`}>{item.description}</span>}<span className={`shrink-0 text-xs font-bold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</span></article>;
    }
    return <article key={item.id} className={`overflow-hidden rounded-xl ${palette.card} ring-1 ring-black/5`}>
      {photo && <img src={item.image_url!} alt="" className="h-28 w-full object-cover"/>}
      <div className="p-3"><div className="flex items-start justify-between gap-2"><h4 className="text-sm font-bold">{item.name}</h4><span className={`shrink-0 text-xs font-bold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</span></div>{item.description && <p className={`mt-1 text-[10px] leading-4 ${palette.muted}`}>{item.description}</p>}</div>
    </article>;
  };

  return <aside className={`min-w-0 overflow-hidden border border-white/10 bg-[#111] shadow-soft ${fullScreen ? 'rounded-[32px]' : 'rounded-3xl lg:sticky lg:top-24 lg:self-start'}`}>
    {!compact && <div className="border-b border-ink/5 bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Aperçu en direct</p><h3 className="mt-1 text-base font-semibold text-forest">{establishmentName || 'Menu public'}</h3><p className="mt-1 text-[11px] text-ink/35">Miroir KELYANI · synchronisé avec le Studio</p></div>}
    <div className={compact ? 'p-0' : 'p-3 sm:p-4'}>
      <div className={`relative mx-auto h-[min(680px,78vh)] min-h-[480px] w-full max-w-[360px] overflow-hidden rounded-[28px] border-[5px] border-[#202020] shadow-xl ${palette.page}`}>
        <div className="absolute inset-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ paddingBottom: activeDraft.navigation === 'app' ? 76 : 20 }}>
          <header className={`relative overflow-hidden ${isEditorial ? 'px-5 pb-5 pt-8 text-center' : isPriceList ? 'px-4 pb-4 pt-7' : isStacked ? 'p-3' : 'px-4 pb-4 pt-5'} ${palette.panel}`}>
            {isStacked && showPhotos && heroImage && <img src={heroImage} alt="" className="mb-3 h-32 w-full rounded-xl object-cover"/>}
            <div className={`flex gap-3 ${isEditorial || isPriceList ? 'flex-col items-center text-center' : 'items-center justify-between'}`}>
              {!(isEditorial || isPriceList) && <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl border ${palette.line} ${palette.accent}`}><TemplateIcon size={17}/></div>}
              <div className={`min-w-0 ${isEditorial || isPriceList ? 'w-full' : 'flex-1'}`}>
                <p className={`text-[9px] font-bold uppercase tracking-[0.22em] ${palette.accent}`}>{isService ? 'Prestations & tarifs' : isGrid ? 'Collections' : isEditorial ? 'Menu signature' : isPriceList ? 'La carte' : isStacked ? 'Nos spécialités' : isCompact ? 'Carte rapide' : 'Menu'}</p>
                <h2 className={`mt-1 whitespace-normal leading-tight ${isEditorial ? 'font-serif text-3xl' : isPriceList ? 'font-serif text-2xl' : isGrid ? 'text-lg font-extrabold' : 'text-xl font-bold'}`}>{displayName}</h2>
                <p className={`mt-1 text-[10px] leading-4 ${palette.muted}`}>{displaySubtitle}</p>
              </div>
            </div>
            {showPhotos && heroImage && !isStacked && !isGrid && !isMinimal && <div className={`relative mt-3 overflow-hidden ${isEditorial ? 'h-28 rounded-none' : 'h-24 rounded-xl'}`}><img src={heroImage} alt="" className="h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"/></div>}
            <label className={`mt-3 flex h-10 items-center gap-2 rounded-xl px-3 ${palette.page}`}><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher un article…" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-60"/>{search && <button type="button" onClick={() => setSearch('')} className="text-xs">✕</button>}</label>
          </header>
          <section className={`px-3 pb-4 pt-3 ${isEditorial ? 'pt-5' : ''}`}>
            <div className={`mb-2 flex items-center justify-between ${isEditorial || isPriceList ? 'justify-center' : ''}`}><h3 className={`font-bold ${isEditorial || isPriceList ? 'font-serif text-lg' : isService ? 'text-[10px] uppercase tracking-[0.18em]' : 'text-sm'}`}>{categoryId === 'all' ? (isService ? 'Prestations' : isGrid ? 'À découvrir' : 'Nos articles') : activeCategories.find(category => category.id === categoryId)?.name}</h3><span className={`text-[9px] ${palette.muted}`}>{items.length} articles</span></div>
            <div className={` ${isGrid ? 'grid grid-cols-2 gap-2' : isStacked ? 'space-y-3' : isService || isPriceList || isMinimal || isCompact ? 'space-y-0' : 'space-y-2.5'}`}>
              {items.map(renderItem)}
              {!items.length && <p className={`p-5 text-center text-xs ${palette.muted}`}>Aucun article trouvé.</p>}
            </div>
          </section>
        </div>
        {activeDraft.navigation === 'app' && <nav aria-label="Catégories du menu" className={`absolute bottom-0 left-0 right-0 z-20 flex gap-1.5 overflow-x-auto border-t px-2 pt-2 pb-2.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${palette.panel} ${palette.line}`}>
          <button type="button" onClick={() => setCategoryId('all')} className={`shrink-0 rounded-full px-3 py-2 text-[9px] font-semibold ${categoryId === 'all' ? 'bg-[#d4af37] text-[#1f3025]' : 'border border-current/15'}`}>Tout</button>
          {activeCategories.map(category => <button key={category.id} type="button" onClick={() => setCategoryId(category.id)} className={`shrink-0 rounded-full px-3 py-2 text-[9px] font-semibold ${categoryId === category.id ? 'bg-[#d4af37] text-[#1f3025]' : 'border border-current/15'}`}>{category.name}</button>)}
        </nav>}
      </div>
    </div>
  </aside>;
}
