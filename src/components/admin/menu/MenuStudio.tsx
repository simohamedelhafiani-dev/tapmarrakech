import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Check, Eye, Palette, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useMenuManager } from '@/hooks/useMenuManager';
import CategorySidebar from '@/components/admin/menu/CategorySidebar';
import ItemEditor from '@/components/admin/menu/ItemEditor';
import MenuPreview from '@/components/admin/menu/MenuPreview';
import MenuImportAssistant from '@/components/admin/menu/MenuImportAssistant';
import { MENU_TEMPLATES } from '@/components/admin/menu/menuTemplates';
import MenuConfigurator, {
  type MenuDesignDraft,
  type MenuNavigationMode,
  type MenuTemplate,
} from '@/components/admin/menu/MenuConfigurator';

type MenuStudioProps = {
  establishmentId: string;
};

type RawDesign = Record<string, unknown>;

const TEMPLATE_VALUES: MenuTemplate[] = MENU_TEMPLATES.map(template => template.id);
const NAVIGATION_VALUES: MenuNavigationMode[] = ['scroll', 'book', 'app'];

const normalizeObject = (value: unknown): RawDesign =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RawDesign) : {};

const stable = (value: unknown) => JSON.stringify(value ?? null);

const extractAiDesign = (value: unknown): Record<string, unknown> | null => {
  const raw = normalizeObject(value);
  return Object.keys(raw).length ? raw : null;
};

type StudioTab = 'structure' | 'design' | 'preview';

export default function MenuStudio({ establishmentId }: MenuStudioProps) {
  const menu = useMenuManager(establishmentId);
  const [activeTab, setActiveTab] = useState<StudioTab>('structure');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [establishmentLogoUrl, setEstablishmentLogoUrl] = useState<string | null>(null);
  const [loadingDesign, setLoadingDesign] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [designError, setDesignError] = useState<string | null>(null);
  const [publishedSnapshot, setPublishedSnapshot] = useState<{
    template: MenuTemplate;
    navigation: MenuNavigationMode;
    wallpaperUrl: string | null;
    overlayOpacity: number;
    themeColors: MenuDesignDraft['themeColors'];
    aiDesign: Record<string, unknown> | null;
  } | null>(null);

  const [draft, setDraft] = useState<MenuDesignDraft>({
    template: '01_cafe_classic',
    navigation: 'scroll',
    wallpaperUrl: null,
    wallpaperFile: null,
    wallpaperObjectUrl: null,
    wallpaperRemoved: false,
    overlayOpacity: 0.35,
    themeColors: { background: '#F5F1E8', surface: '#FFFDFA', text: '#26362B', accent: '#D4AF37' },
    aiDesign: null,
  });

  const loadDesign = useCallback(async () => {
    setLoadingDesign(true);
    setDesignError(null);

    const { data, error } = await supabase
      .from('establishments')
      .select('name, logo_url, menu_template_id, menu_ai_design')
      .eq('id', establishmentId)
      .maybeSingle();

    if (error) {
      setDesignError(error.message);
      setLoadingDesign(false);
      return;
    }

    const raw = normalizeObject(data?.menu_ai_design);
    const rawTemplate = data?.menu_template_id;
    const template: MenuTemplate = TEMPLATE_VALUES.includes(rawTemplate as MenuTemplate)
      ? (rawTemplate as MenuTemplate)
      : '01_cafe_classic';
    const rawNavigation = raw.navigation_mode;
    const navigation: MenuNavigationMode = NAVIGATION_VALUES.includes(rawNavigation as MenuNavigationMode)
      ? (rawNavigation as MenuNavigationMode)
      : 'scroll';
    const wallpaperUrl = typeof raw.background_image_url === 'string' ? raw.background_image_url : null;
    const overlayOpacity =
      typeof raw.overlay_opacity === 'number'
        ? Math.min(0.7, Math.max(0, raw.overlay_opacity))
        : 0.35;
    const aiDesign = extractAiDesign(raw.ai_design);
    const rawColors = normalizeObject(raw.theme_colors);
    const validHex = (value: unknown, fallback: string) => typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback;
    const themeColors = {
      background: validHex(rawColors.background, '#F5F1E8'),
      surface: validHex(rawColors.surface, '#FFFDFA'),
      text: validHex(rawColors.text, '#26362B'),
      accent: validHex(rawColors.accent, '#D4AF37'),
    };

    setEstablishmentName(data?.name ?? '');
    setEstablishmentLogoUrl(typeof data?.logo_url === 'string' && data.logo_url.trim() ? data.logo_url : null);
    setDraft({
      template,
      navigation,
      wallpaperUrl,
      wallpaperFile: null,
      wallpaperObjectUrl: null,
      wallpaperRemoved: false,
      overlayOpacity,
      themeColors,
      aiDesign,
    });
    setPublishedSnapshot({ template, navigation, wallpaperUrl, overlayOpacity, themeColors, aiDesign });
    setLoadingDesign(false);
  }, [establishmentId]);

  useEffect(() => {
    void loadDesign();
  }, [loadDesign]);

  useEffect(() => {
    if (!menu.categories.length) {
      setSelectedCategoryId('');
      return;
    }

    if (!menu.categories.some(category => category.id === selectedCategoryId)) {
      const firstActive = menu.categories.find(category => category.active);
      setSelectedCategoryId((firstActive ?? menu.categories[0]).id);
    }
  }, [menu.categories, selectedCategoryId]);

  useEffect(() => {
    return () => {
      if (draft.wallpaperObjectUrl) URL.revokeObjectURL(draft.wallpaperObjectUrl);
    };
  }, [draft.wallpaperObjectUrl]);

  const selectedCategory = useMemo(
    () => menu.categories.find(category => category.id === selectedCategoryId) ?? null,
    [menu.categories, selectedCategoryId],
  );

  const selectedItems = selectedCategory
    ? (menu.itemsByCategory[selectedCategory.id] ?? [])
    : [];

  const hasChanges = useMemo(() => {
    if (!publishedSnapshot) return false;
    if (draft.wallpaperFile || draft.wallpaperRemoved) return true;
    return (
      draft.template !== publishedSnapshot.template ||
      draft.navigation !== publishedSnapshot.navigation ||
      draft.wallpaperUrl !== publishedSnapshot.wallpaperUrl ||
      draft.overlayOpacity !== publishedSnapshot.overlayOpacity ||
      stable(draft.themeColors) !== stable(publishedSnapshot.themeColors) ||
      stable(draft.aiDesign) !== stable(publishedSnapshot.aiDesign)
    );
  }, [draft, publishedSnapshot]);

  const changeDraft = (patch: Partial<MenuDesignDraft>) => {
    setDraft(current => ({ ...current, ...patch }));
  };

  const publish = async () => {
    if (!hasChanges || publishing) return;

    setPublishing(true);
    setDesignError(null);

    try {
      let wallpaperUrl = draft.wallpaperUrl;

      if (draft.wallpaperFile) {
        const file = draft.wallpaperFile;
        const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path =
          'loyalty-cards/' +
          establishmentId +
          '/wallpaper-' +
          Date.now() +
          '-' +
          Math.random().toString(36).slice(2) +
          '.' +
          extension;

        const { error: uploadError } = await supabase.storage
          .from('loyalty-assets')
          .upload(path, file, {
            upsert: false,
            contentType: file.type,
            cacheControl: '31536000',
          });

        if (uploadError) throw uploadError;

        wallpaperUrl = supabase.storage.from('loyalty-assets').getPublicUrl(path).data.publicUrl;
      }

      const { data: currentRow, error: readError } = await supabase
        .from('establishments')
        .select('menu_ai_design')
        .eq('id', establishmentId)
        .maybeSingle();

      if (readError) throw readError;

      const currentDesign = normalizeObject(currentRow?.menu_ai_design);
      const nextDesign: RawDesign = {
        ...currentDesign,
        ...(draft.aiDesign ? { ai_design: draft.aiDesign } : {}),
        overlay_opacity: draft.overlayOpacity,
        theme_colors: draft.themeColors,
        navigation_mode: draft.navigation,
        background_image_url: draft.wallpaperRemoved ? null : wallpaperUrl,
      };

      const { error: templateError } = await supabase
        .from('establishments')
        .update({ menu_template_id: draft.template })
        .eq('id', establishmentId);

      if (templateError) throw templateError;

      const { error: designError } = await supabase.rpc('update_establishment_menu_design', {
        p_establishment_id: establishmentId,
        p_menu_ai_design: nextDesign,
      });

      if (designError) throw designError;

      const publishedWallpaper = draft.wallpaperRemoved ? null : wallpaperUrl;
      const nextSnapshot = {
        template: draft.template,
        navigation: draft.navigation,
        wallpaperUrl: publishedWallpaper,
        overlayOpacity: draft.overlayOpacity,
        themeColors: draft.themeColors,
        aiDesign: draft.aiDesign,
      };

      setDraft(current => ({
        ...current,
        wallpaperUrl: publishedWallpaper,
        wallpaperFile: null,
        wallpaperObjectUrl: null,
        wallpaperRemoved: false,
      }));
      setPublishedSnapshot(nextSnapshot);
    } catch (cause) {
      setDesignError(cause instanceof Error ? cause.message : 'Impossible de publier le design.');
    } finally {
      setPublishing(false);
    }
  };

  const tabs: Array<{ id: StudioTab; label: string; icon: typeof Wrench }> = [
    { id: 'structure', label: 'Structure', icon: Wrench },
    { id: 'design', label: 'Design', icon: Palette },
    { id: 'preview', label: 'Preview', icon: Eye },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-gold">KELYANI · MENU STUDIO</p>
          <h3 className="mt-1 font-display text-4xl tracking-tight text-white">Construis ton menu</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-white/45">
            Sépare la structure du contenu et l’apparence du menu, avec un aperçu toujours visible.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-full border border-white/10 bg-white/[.04] px-3 py-2 text-[10px] font-semibold text-white/70 shadow-soft md:self-auto">
          <span className={menu.loading || loadingDesign ? 'h-2 w-2 animate-pulse rounded-full bg-amber-400' : 'h-2 w-2 rounded-full bg-green-500'} />
          {menu.loading || loadingDesign ? 'Synchronisation…' : hasChanges ? 'Modifications locales' : 'Design publié'}
        </div>
      </div>

      <div className="rounded-[22px] border border-white/[.08] bg-white/[.035] p-1.5 shadow-soft">
        <div className="grid grid-cols-3 gap-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={[
                  'group flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-xs font-semibold transition-all duration-200',
                  active
                    ? 'bg-gold-gradient text-[#050505] shadow-gold'
                    : 'text-white/45 hover:bg-white/[.06] hover:text-white',
                ].join(' ')}
                aria-selected={active}
                role="tab"
              >
                <Icon size={15} className={active ? 'text-gold' : 'text-ink/35 transition-colors group-hover:text-gold'} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {(menu.error || designError) && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
          {menu.error || designError}
        </div>
      )}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
        <div className="min-w-0">
          {activeTab === 'structure' ? (
            <div className="space-y-4">
              <MenuImportAssistant
                establishmentId={establishmentId}
                categories={menu.categories}
                items={menu.items}
                onAddCategory={menu.addCategory}
                onAddItem={menu.addItem}
              />
              <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)] xl:items-start">
              <CategorySidebar
                categories={menu.categories}
                selectedCategoryId={selectedCategoryId}
                saving={menu.saving}
                onSelect={setSelectedCategoryId}
                onAdd={menu.addCategory}
                onToggleActive={menu.toggleCategoryActive}
              />

              <ItemEditor
                establishmentId={establishmentId}
                categories={menu.categories}
                category={selectedCategory}
                items={selectedItems}
                saving={menu.saving}
                onAdd={menu.addItem}
                onUpdate={menu.updateItem}
                onMove={menu.moveItem}
                onToggleActive={menu.toggleItemActive}
                onDelete={menu.deleteItem}
              />
              </div>
            </div>
          ) : activeTab === 'design' ? (
            <div className="min-h-[620px] rounded-[28px] border border-white/[.08] bg-[#111111] p-2 shadow-soft sm:p-4">
              <MenuConfigurator
                draft={draft}
                hasChanges={hasChanges}
                publishing={publishing}
                onChange={changeDraft}
                onPublish={() => void publish()}
                categories={menu.categories}
                itemsByCategory={menu.itemsByCategory}
                establishmentName={establishmentName}
                establishmentId={establishmentId}
                logoUrl={establishmentLogoUrl}
              />
            </div>
          ) : null}
        </div>

        {activeTab === 'preview' ? (
          <div className="xl:col-span-2 space-y-4">
            <section className="flex flex-col gap-4 rounded-3xl border border-gold/20 bg-[#111111] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Vérification avant publication</p>
                <h3 className="mt-1 text-lg font-semibold text-white">Voici le menu tel que tes clients le verront</h3>
                <p className="mt-1 text-xs leading-5 text-white/45">
                  Vérifie les catégories, les prix, les photos et le rendu sur mobile avant de publier le design.
                </p>
                <p className="mt-2 text-[10px] font-medium text-white/60">
                  {hasChanges ? 'Des modifications de design sont encore en attente.' : 'Le design affiché correspond à la dernière version publiée.'}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-2 sm:min-w-[190px]">
                <button
                  type="button"
                  onClick={() => setActiveTab('design')}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold text-white transition hover:bg-white/[.06]"
                >
                  <ArrowLeft size={14} /> Retour au design
                </button>
                <button
                  type="button"
                  onClick={() => void publish()}
                  disabled={!hasChanges || publishing || loadingDesign}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-gold-gradient px-4 py-3 text-xs font-bold text-[#090909] shadow-gold transition disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {publishing ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/25 border-t-black" />
                  ) : (
                    <Check size={14} />
                  )}
                  {publishing ? 'Publication…' : hasChanges ? 'Valider et publier' : 'Design déjà publié'}
                </button>
              </div>
            </section>
            <MenuPreview
              establishmentName={establishmentName}
              logoUrl={establishmentLogoUrl}
              categories={menu.categories}
              itemsByCategory={menu.itemsByCategory}
              draft={draft}
              fullScreen
            />
          </div>
        ) : (
          <MenuPreview
            establishmentName={establishmentName}
            logoUrl={establishmentLogoUrl}
            categories={menu.categories}
            itemsByCategory={menu.itemsByCategory}
            draft={draft}
          />
        )}
      </div>
    </div>
  );
}
