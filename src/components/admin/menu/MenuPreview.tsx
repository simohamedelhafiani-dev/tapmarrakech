import { useEffect, useMemo, useState } from 'react';
import { BookOpen, LayoutGrid, ScrollText, Sparkle, Waves, UtensilsCrossed, Search } from 'lucide-react';
import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';
import type { MenuDesignDraft } from '@/components/admin/menu/MenuConfigurator';
import { getMenuTemplateFamily, getMenuTemplateLayout } from '@/components/admin/menu/menuTemplates';

type MenuPreviewProps = {
  establishmentName?: string;
  logoUrl?: string | null;
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
  logoUrl,
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
    themeColors: { background: '#F5F1E8', surface: '#FFFDFA', text: '#26362B', accent: '#D4AF37' },
    aiDesign: null,
  };
  const family = getMenuTemplateFamily(activeDraft.template);
  const layout = getMenuTemplateLayout(activeDraft.template);
  const templateNumber = Number(activeDraft.template.match(/^\d+/)?.[0] ?? 1);
  const designVariant = (templateNumber - 1) % 5;
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
  const isLuxuryPilot = activeDraft.template === '04_menu_luxe' || activeDraft.template === '17_fine_dining';
  const isBrunchPilot = activeDraft.template === '11_brunch_cafe';
  const isSushiPilot = activeDraft.template === '12_sushi_bar';
  const isBeautyPilot = activeDraft.template === '06_beauty_studio';
  const isStreetPilot = activeDraft.template === '02_burger_house' || activeDraft.template === '16_tacos';
  const isBoutiquePilot = activeDraft.template === '25_perfume' || activeDraft.template === '26_jewelry';

  const renderItem = (item: typeof items[number], index: number) => {
    const photo = showPhotos && item.image_url;

    if (isLuxuryPilot) {
      return <article key={item.id} className="relative border-b py-4 text-center" style={{ borderColor: activeDraft.themeColors.accent + '55' }}>
        <span className="mb-2 block text-[8px] uppercase tracking-[0.3em]" style={{ color: activeDraft.themeColors.accent }}>— {String(index + 1).padStart(2, '0')} —</span>
        <h4 className="font-serif text-base leading-snug">{item.name}</h4>
        {item.description && <p className="mx-auto mt-1 max-w-[230px] text-[10px] leading-5 opacity-65">{item.description}</p>}
        <p className="mt-2 font-serif text-sm" style={{ color: activeDraft.themeColors.accent }}>{Number(item.price).toLocaleString('fr-FR')} DH</p>
      </article>;
    }

    if (isBrunchPilot) {
      return <article key={item.id} className={`grid grid-cols-[88px_minmax(0,1fr)] gap-3 overflow-hidden border-b py-3 ${index % 2 ? 'pl-2' : ''}`} style={{ borderColor: activeDraft.themeColors.accent + '35' }}>
        {photo ? <img src={item.image_url!} alt="" className="h-[88px] w-[88px] rounded-2xl object-cover" /> : <div className="grid h-[88px] w-[88px] place-items-center rounded-2xl" style={{ backgroundColor: activeDraft.themeColors.accent + '18' }}><UtensilsCrossed size={20} /></div>}
        <div className="flex min-w-0 flex-col justify-center">
          <div className="flex items-start justify-between gap-2"><h4 className="font-serif text-sm leading-snug">{item.name}</h4><span className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold" style={{ color: activeDraft.themeColors.text, backgroundColor: activeDraft.themeColors.accent + '30' }}>{Number(item.price).toLocaleString('fr-FR')}</span></div>
          {item.description && <p className="mt-1 line-clamp-3 text-[10px] leading-4 opacity-65">{item.description}</p>}
          <span className="mt-2 text-[8px] uppercase tracking-[0.18em]" style={{ color: activeDraft.themeColors.accent }}>Préparé avec soin</span>
        </div>
      </article>;
    }

    if (isSushiPilot) {
      return <article key={item.id} className="flex min-h-[94px] overflow-hidden rounded-sm border" style={{ borderColor: activeDraft.themeColors.accent + '55', backgroundColor: activeDraft.themeColors.surface }}>
        {photo ? <img src={item.image_url!} alt="" className="w-[96px] shrink-0 object-cover" /> : <div className="grid w-[52px] shrink-0 place-items-center" style={{ backgroundColor: activeDraft.themeColors.accent + '20' }}><Waves size={18} style={{ color: activeDraft.themeColors.accent }} /></div>}
        <div className="flex min-w-0 flex-1 flex-col justify-center p-3">
          <span className="text-[8px] uppercase tracking-[0.2em] opacity-50">Sélection</span>
          <h4 className="mt-1 text-sm font-semibold">{item.name}</h4>
          {item.description && <p className="mt-1 line-clamp-2 text-[10px] leading-4 opacity-65">{item.description}</p>}
          <span className="mt-2 text-xs font-bold" style={{ color: activeDraft.themeColors.accent }}>{Number(item.price).toLocaleString('fr-FR')} DH</span>
        </div>
      </article>;
    }

    if (isBeautyPilot) {
      return <article key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 border-b py-4" style={{ borderColor: activeDraft.themeColors.accent + '40' }}>
        <div className="min-w-0"><span className="text-[8px] uppercase tracking-[0.2em] opacity-50">Soin & prestation</span><h4 className="mt-1 font-serif text-sm">{item.name}</h4>{item.description && <p className="mt-1 text-[10px] leading-4 opacity-65">{item.description}</p>}</div>
        <div className="flex items-center"><span className="rounded-full border px-3 py-2 text-xs font-medium" style={{ borderColor: activeDraft.themeColors.accent + '75', color: activeDraft.themeColors.accent }}>{Number(item.price).toLocaleString('fr-FR')} DH</span></div>
      </article>;
    }

    if (isStreetPilot) {
      return <article key={item.id} className="relative overflow-hidden rounded-2xl border-2" style={{ borderColor: activeDraft.themeColors.accent, backgroundColor: activeDraft.themeColors.surface }}>
        {photo && <img src={item.image_url!} alt="" className="h-32 w-full object-cover" />}
        <div className="p-3"><div className="flex items-start justify-between gap-2"><h4 className="text-base font-black uppercase leading-tight">{item.name}</h4><span className="shrink-0 px-2 py-1 text-xs font-black" style={{ backgroundColor: activeDraft.themeColors.accent, color: activeDraft.themeColors.background }}>{Number(item.price).toLocaleString('fr-FR')} DH</span></div>{item.description && <p className="mt-2 text-[10px] leading-4 opacity-70">{item.description}</p>}</div>
        <div className="h-1.5 w-full" style={{ backgroundColor: activeDraft.themeColors.accent }} />
      </article>;
    }

    if (isBoutiquePilot) {
      return <article key={item.id} className="overflow-hidden border" style={{ borderColor: activeDraft.themeColors.accent + '45', backgroundColor: activeDraft.themeColors.surface }}>
        {photo ? <img src={item.image_url!} alt="" className="aspect-[4/5] w-full object-cover" /> : <div className="grid aspect-[4/5] place-items-center" style={{ backgroundColor: activeDraft.themeColors.accent + '12' }}><Sparkle size={22} style={{ color: activeDraft.themeColors.accent }} /></div>}
        <div className="p-2.5"><span className="text-[8px] uppercase tracking-[0.18em] opacity-50">Collection</span><h4 className="mt-1 font-serif text-xs leading-snug">{item.name}</h4>{item.description && <p className="mt-1 line-clamp-2 text-[9px] leading-4 opacity-65">{item.description}</p>}<div className="mt-2 border-t pt-2 text-xs font-semibold" style={{ borderColor: activeDraft.themeColors.accent + '55', color: activeDraft.themeColors.accent }}>{Number(item.price).toLocaleString('fr-FR')} DH</div></div>
      </article>;
    }
    if (isGrid) {
      return <article key={item.id} className={`overflow-hidden ${designVariant === 0 ? 'rounded-xl' : designVariant === 1 ? 'rounded-[28px] rounded-t-md' : designVariant === 2 ? 'rounded-none border-y' : designVariant === 3 ? 'rounded-3xl' : 'rounded-lg'} ${palette.card} shadow-sm ring-1 ring-black/5`}>
        {photo ? <img src={item.image_url!} alt="" className={`w-full object-cover ${layout === 'magazine-grid' && index === 0 ? 'aspect-[4/5]' : designVariant === 0 ? 'aspect-square' : designVariant === 1 ? 'aspect-[3/4]' : designVariant === 2 ? 'aspect-[5/4]' : designVariant === 3 ? 'aspect-[4/3]' : 'aspect-[2/3]'}`} /> : <div className="grid aspect-square place-items-center bg-black/5"><UtensilsCrossed size={22} className={palette.muted}/></div>}
        <div className="p-2.5"><h4 className="text-xs font-bold leading-snug">{item.name}</h4>{item.description && <p className={`mt-1 line-clamp-2 text-[10px] leading-4 ${palette.muted}`}>{item.description}</p>}<p className={`mt-2 text-sm font-extrabold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</p></div>
      </article>;
    }
    if (isStacked) {
      return <article key={item.id} className={`overflow-hidden ${designVariant === 0 ? 'rounded-2xl' : designVariant === 1 ? 'rounded-none' : designVariant === 2 ? 'rounded-[28px]' : designVariant === 3 ? 'rounded-t-[32px]' : 'rounded-lg'} ${palette.card} shadow-md`}>
        {photo ? <img src={item.image_url!} alt="" className="h-36 w-full object-cover"/> : <div className="grid h-16 place-items-center bg-black/5"><UtensilsCrossed size={20}/></div>}
        <div className="flex items-start justify-between gap-3 p-3"><div className="min-w-0"><h4 className="text-sm font-bold">{item.name}</h4>{item.description && <p className={`mt-1 text-xs leading-5 ${palette.muted}`}>{item.description}</p>}</div><span className="shrink-0 text-sm font-bold" style={{ color: activeDraft.themeColors.accent }}>{Number(item.price).toLocaleString('fr-FR')} DH</span></div>
      </article>;
    }
    if (isSplit) {
      return <article key={item.id} className={`flex gap-3 ${designVariant === 0 ? 'rounded-2xl p-2.5' : designVariant === 1 ? 'rounded-none border-b py-3' : designVariant === 2 ? 'rounded-[28px] p-3' : designVariant === 3 ? 'rounded-lg p-2' : 'rounded-3xl p-3'} ${palette.card} ring-1 ring-black/5`}>
        {photo ? <img src={item.image_url!} alt="" className="h-24 w-24 shrink-0 rounded-xl object-cover"/> : <div className="grid h-24 w-16 shrink-0 place-items-center rounded-xl bg-black/5"><UtensilsCrossed size={18}/></div>}
        <div className="flex min-w-0 flex-1 flex-col justify-center"><h4 className="text-sm font-bold leading-snug">{item.name}</h4>{item.description && <p className={`mt-1 line-clamp-3 text-[11px] leading-4 ${palette.muted}`}>{item.description}</p>}<p className={`mt-2 text-sm font-bold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</p></div>
      </article>;
    }
    if (isService) {
      return <article key={item.id} className={`flex items-center justify-between gap-3 border-b py-3 ${palette.line}`}><div className="min-w-0"><h4 className="text-xs font-semibold">{item.name}</h4>{item.description && <p className={`mt-1 text-[10px] leading-4 ${palette.muted}`}>{item.description}</p>}</div><span className="shrink-0 rounded-lg px-2.5 py-1.5 text-xs font-bold" style={{ color: activeDraft.themeColors.accent, backgroundColor: activeDraft.themeColors.surface }}>{Number(item.price).toLocaleString('fr-FR')} DH</span></article>;
    }
    if (isPriceList) {
      return <article key={item.id} className="py-3"><div className="flex items-baseline gap-2"><h4 className="text-sm font-medium">{item.name}</h4><span className={`min-w-[12px] flex-1 border-b border-dotted ${palette.line}`}/><span className={`shrink-0 text-sm font-bold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</span></div>{item.description && <p className={`mt-1 pr-12 text-[10px] leading-4 ${palette.muted}`}>{item.description}</p>}</article>;
    }
    if (isMinimal) {
      return <article key={item.id} className={`border-l-2 py-2 pl-3 ${palette.line}`}><div className="flex items-start justify-between gap-3"><h4 className="text-sm font-medium">{item.name}</h4><span className="shrink-0 text-xs font-semibold" style={{ color: activeDraft.themeColors.accent }}>{Number(item.price).toLocaleString('fr-FR')} DH</span></div>{item.description && <p className={`mt-1 text-[10px] leading-4 ${palette.muted}`}>{item.description}</p>}</article>;
    }
    if (isCompact) {
      return <article key={item.id} className={`flex items-center gap-2 border-b py-2 ${palette.line}`}><span className="min-w-0 flex-1 text-xs font-semibold">{item.name}</span>{item.description && <span className={`hidden min-w-0 flex-1 truncate text-[9px] sm:block ${palette.muted}`}>{item.description}</span>}<span className="shrink-0 text-xs font-bold" style={{ color: activeDraft.themeColors.accent }}>{Number(item.price).toLocaleString('fr-FR')} DH</span></article>;
    }
    return <article key={item.id} className={`overflow-hidden rounded-xl ${palette.card} ring-1 ring-black/5`}>
      {photo && <img src={item.image_url!} alt="" className="h-28 w-full object-cover"/>}
      <div className="p-3"><div className="flex items-start justify-between gap-2"><h4 className="text-sm font-bold">{item.name}</h4><span className={`shrink-0 text-xs font-bold ${palette.accent}`}>{Number(item.price).toLocaleString('fr-FR')} DH</span></div>{item.description && <p className={`mt-1 text-[10px] leading-4 ${palette.muted}`}>{item.description}</p>}</div>
    </article>;
  };

  return <aside className={`min-w-0 overflow-hidden border border-white/10 bg-[#111] shadow-soft ${fullScreen ? 'rounded-[32px]' : 'rounded-3xl lg:sticky lg:top-24 lg:self-start'}`}>
    {!compact && <div className="border-b border-ink/5 bg-white p-5"><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Aperçu en direct</p><h3 className="mt-1 text-base font-semibold text-forest">{establishmentName || 'Menu public'}</h3><p className="mt-1 text-[11px] text-ink/35">Miroir KELYANI · synchronisé avec le Studio</p></div>}
    <div className={compact ? 'p-0' : 'p-3 sm:p-4'}>
      <div className={`relative mx-auto h-[min(680px,78vh)] min-h-[480px] w-full max-w-[360px] overflow-hidden rounded-[28px] border-[5px] border-[#202020] shadow-xl ${palette.page}`} style={{ backgroundColor: activeDraft.themeColors.background, color: activeDraft.themeColors.text, backgroundImage: activeDraft.wallpaperUrl ? `linear-gradient(rgba(0,0,0,${activeDraft.overlayOpacity}), rgba(0,0,0,${activeDraft.overlayOpacity})), url("${activeDraft.wallpaperUrl}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
        <div className="absolute inset-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" style={{ paddingBottom: activeDraft.navigation === 'app' ? 76 : 20 }}>
          <header className={`relative overflow-hidden ${isLuxuryPilot ? 'px-5 pb-7 pt-10 text-center border-b' : isBrunchPilot ? 'px-4 pb-5 pt-7 text-left' : isSushiPilot ? 'px-4 pb-5 pt-6 border-l-4' : isBeautyPilot ? 'px-5 pb-6 pt-8 text-center' : isStreetPilot ? 'px-4 pb-5 pt-6 border-b-4' : isBoutiquePilot ? 'px-4 pb-5 pt-7 text-center' : isEditorial ? (designVariant % 2 === 0 ? 'px-5 pb-5 pt-8 text-center' : 'px-4 pb-5 pt-8 text-left border-b') : isPriceList ? (designVariant % 2 === 0 ? 'px-4 pb-4 pt-7' : 'px-5 pb-6 pt-5') : isStacked ? 'p-3' : 'px-4 pb-4 pt-5'} ${palette.panel}`} style={{ backgroundColor: activeDraft.wallpaperUrl ? 'transparent' : activeDraft.themeColors.surface, color: activeDraft.themeColors.text, borderColor: activeDraft.themeColors.accent + '55', borderLeftColor: isSushiPilot ? activeDraft.themeColors.accent : undefined, borderBottomColor: isStreetPilot || isLuxuryPilot ? activeDraft.themeColors.accent : undefined }}>
            {isStacked && showPhotos && heroImage && <img src={heroImage} alt="" className="mb-3 h-32 w-full rounded-xl object-cover"/>}
            {logoUrl && <div className="absolute left-1/2 top-3 z-10 grid h-11 w-11 -translate-x-1/2 place-items-center overflow-hidden rounded-lg border border-black/10 bg-white p-1 shadow-sm"><img src={logoUrl} alt="Logo de l’établissement" className="h-full w-full object-contain" /></div>}
            <div className={`flex gap-3 ${logoUrl ? 'pt-10' : ''} ${isLuxuryPilot || isBeautyPilot || isBoutiquePilot || isEditorial || isPriceList ? 'flex-col items-center text-center' : isStreetPilot ? 'items-end justify-between' : 'items-center justify-between'}`}>
              <div className={`min-w-0 ${isEditorial || isPriceList ? 'w-full' : 'flex-1'}`}>
                <p className={`text-[9px] font-bold uppercase tracking-[0.22em] ${palette.accent}`}>{isLuxuryPilot ? 'Une expérience culinaire' : isBrunchPilot ? 'Brunch · Café · Douceur' : isSushiPilot ? '寿司 · Cuisine japonaise' : isBeautyPilot ? 'Rituels & soins' : isStreetPilot ? 'Street food · Fait pour vous' : isBoutiquePilot ? 'Sélection signature' : isService ? 'Prestations & tarifs' : isGrid ? 'Collections' : isEditorial ? 'Menu signature' : isPriceList ? 'La carte' : isStacked ? 'Nos spécialités' : isCompact ? 'Carte rapide' : 'Menu'}</p>
                <h2 className={`mt-1 whitespace-normal leading-tight ${isLuxuryPilot || isBrunchPilot || isBeautyPilot || isBoutiquePilot ? 'font-serif text-3xl' : isStreetPilot ? 'text-2xl font-black uppercase tracking-tight' : isSushiPilot ? 'font-serif text-2xl' : isEditorial ? 'font-serif text-3xl' : isPriceList ? 'font-serif text-2xl' : isGrid ? 'text-lg font-extrabold' : 'text-xl font-bold'}`}>{displayName}</h2>
                <p className={`mt-1 text-[10px] leading-4 ${palette.muted}`}>{displaySubtitle}</p>
              </div>
            </div>
            {showPhotos && heroImage && !isStacked && !isGrid && !isMinimal && <div className={`relative mt-3 overflow-hidden ${isEditorial ? 'h-28 rounded-none' : 'h-24 rounded-xl'}`}><img src={heroImage} alt="" className="h-full w-full object-cover"/><div className="absolute inset-0 bg-gradient-to-t from-black/55 to-transparent"/></div>}
            <label className={`mt-4 flex h-10 items-center gap-2 px-3 ${isLuxuryPilot || isBeautyPilot || isBoutiquePilot ? 'rounded-full border' : isStreetPilot ? 'rounded-lg border-2' : isSushiPilot ? 'rounded-none border-l-2' : 'rounded-xl'}`} style={{ backgroundColor: activeDraft.themeColors.background + '20', borderColor: activeDraft.themeColors.accent + '55' }}><Search size={14} style={{ color: activeDraft.themeColors.accent }}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Rechercher un article…" className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:opacity-60"/>{search && <button type="button" onClick={() => setSearch('')} className="text-xs">✕</button>}</label>
          </header>
          <section className={`px-3 pb-4 pt-4 ${isEditorial || isLuxuryPilot || isBeautyPilot ? 'pt-5' : ''} ${designVariant === 2 ? 'border-t border-current/10' : ''}`}>
            <div className={`mb-3 flex items-end justify-between gap-2 ${isLuxuryPilot || isBeautyPilot || isBoutiquePilot || isEditorial || isPriceList ? 'flex-col items-center text-center' : ''}`}>
              <div className={`min-w-0 ${isLuxuryPilot || isBeautyPilot || isBoutiquePilot || isEditorial || isPriceList ? 'w-full' : ''}`}>
                {(isLuxuryPilot || isBrunchPilot || isSushiPilot || isBeautyPilot || isStreetPilot || isBoutiquePilot) && <p className="mb-1 text-[8px] font-semibold uppercase tracking-[0.24em]" style={{ color: activeDraft.themeColors.accent }}>{isLuxuryPilot ? 'La sélection du chef' : isBrunchPilot ? 'Fresh & homemade' : isSushiPilot ? 'Nos créations' : isBeautyPilot ? 'Prendre soin de soi' : isStreetPilot ? 'Les incontournables' : 'La collection'}</p>}
                <h3 className={`font-bold leading-tight ${isLuxuryPilot || isBeautyPilot || isBoutiquePilot || isEditorial || isPriceList ? 'font-serif text-lg' : isStreetPilot ? 'text-base font-black uppercase tracking-tight' : isService ? 'text-[10px] uppercase tracking-[0.18em]' : 'text-sm'}`}>{categoryId === 'all' ? (isService ? 'Prestations' : isGrid ? 'À découvrir' : isLuxuryPilot ? 'Nos signatures' : isBrunchPilot ? 'Les favoris du moment' : isSushiPilot ? 'La carte' : isStreetPilot ? 'Choisis ton plaisir' : isBoutiquePilot ? 'Pièces sélectionnées' : 'Nos articles') : activeCategories.find(category => category.id === categoryId)?.name}</h3>
              </div>
              <span className={`shrink-0 text-[9px] ${palette.muted}`}>{items.length} articles</span>
            </div>
            {(isLuxuryPilot || isBeautyPilot || isBoutiquePilot) && <div className="mx-auto mb-3 h-px w-12" style={{ backgroundColor: activeDraft.themeColors.accent }} />}
            <div className={` ${isGrid || isBoutiquePilot ? 'grid grid-cols-2 gap-2.5' : isBrunchPilot || isSushiPilot ? 'space-y-2.5' : isStreetPilot ? 'space-y-3' : isStacked ? 'space-y-3' : isService || isPriceList || isMinimal || isCompact || isLuxuryPilot || isBeautyPilot ? 'space-y-0' : 'space-y-2.5'}`}>
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
