import { useCallback, useEffect, useMemo, useState } from 'react';
import { Palette, Wrench } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useMenuManager } from '@/hooks/useMenuManager';
import CategorySidebar from '@/components/admin/menu/CategorySidebar';
import ItemEditor from '@/components/admin/menu/ItemEditor';
import MenuPreview from '@/components/admin/menu/MenuPreview';
import MenuConfigurator, {
  type MenuDesignDraft,
  type MenuNavigationMode,
  type MenuTemplate,
} from '@/components/admin/menu/MenuConfigurator';

type MenuStudioProps = {
  establishmentId: string;
};

type RawDesign = Record<string, unknown>;

const TEMPLATE_VALUES: MenuTemplate[] = ['editorial', 'luxury', 'cards', 'dark'];
const NAVIGATION_VALUES: MenuNavigationMode[] = ['scroll', 'book', 'app'];

const normalizeObject = (value: unknown): RawDesign =>
  value && typeof value === 'object' && !Array.isArray(value) ? (value as RawDesign) : {};

const stable = (value: unknown) => JSON.stringify(value ?? null);

const mapAiStyleToTemplate = (style: unknown): MenuTemplate | null => {
  if (style === 'editorial') return 'editorial';
  if (style === 'luxury') return 'luxury';
  if (style === 'immersive') return 'dark';
  if (style === 'minimal') return 'cards';
  return null;
};

const extractAiDesign = (value: unknown): Record<string, unknown> | null => {
  const raw = normalizeObject(value);
  return Object.keys(raw).length ? raw : null;
};

type StudioTab = 'structure' | 'design';

export default function MenuStudio({ establishmentId }: MenuStudioProps) {
  const menu = useMenuManager(establishmentId);
  const [activeTab, setActiveTab] = useState<StudioTab>('structure');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [establishmentName, setEstablishmentName] = useState('');
  const [loadingDesign, setLoadingDesign] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [designError, setDesignError] = useState<string | null>(null);
  const [publishedSnapshot, setPublishedSnapshot] = useState<{
    template: MenuTemplate;
    wallpaperUrl: string | null;
    overlayOpacity: number;
    aiDesign: Record<string, unknown> | null;
  } | null>(null);

  const [draft, setDraft] = useState<MenuDesignDraft>({
    template: 'editorial',
    navigation: 'scroll',
    wallpaperUrl: null,
    wallpaperFile: null,
    wallpaperObjectUrl: null,
    wallpaperRemoved: false,
    overlayOpacity: 0.35,
    aiDesign: null,
  });

  const loadDesign = useCallback(async () => {
    setLoadingDesign(true);
    setDesignError(null);

    const { data, error } = await supabase
      .from('establishments')
      .select('name, menu_template_id, menu_ai_design')
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
      : 'editorial';
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

    setEstablishmentName(data?.name ?? '');
    setDraft({
      template,
      navigation,
      wallpaperUrl:
      wallpaperFile: null,
      wallpaperObjectUrl: null,
      wallpaperRemoved: false,
      overlayOpacity,
      aiDesign,
    });
    setPublishedSnapshot({ template, wallpaperUrl, overlayOpacity, aiDesign });
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
      draft.wallpaperUrl !== publishedSnapshot.wallpaperUrl ||
      draft.overlayOpacity !== publishedSnapshot.overlayOpacity ||
      stable(draft.aiDesign) !== stable(publishedSnapshot.aiDesign)
    );
  }, [draft, publishedSnapshot]);

  const changeDraft = (patch: Partial<MenuDesignDraft>) => {
    setDraft(current => ({ ...current, ...patch }));
  };

  const buildMenuForAi = () => ({
    categories: menu.categories
      .filter(category => category.active)
      .map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        items: (menu.itemsByCategory[category.id] ?? [])
          .filter(item => item.active)
          .map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            price: item.price,
            image_url: item.image_url,
          })),
      })),
  });

  const generateAiDesign = async () => {
    if (!establishmentId || aiLoading) return;
    setAiLoading(true);
    setDesignError(null);

    try {
      const { data, error } = await supabase.functions.invoke('design-menu', {
        body: {
          establishment_id: establishmentId,
          menu: buildMenuForAi(),
        },
      });

      if (error) throw error;

      const ai = extractAiDesign(data?.design);
      if (!ai) throw new Error('L’IA n’a pas retourné de design exploitable.');

      const mappedTemplate = mapAiStyleToTemplate(ai.style);
      setDraft(current => ({
        ...current,
        aiDesign: ai,
        ...(mappedTemplate ? { template: mappedTemplate } : {}),
      }));
    } catch (cause) {
      setDesignError(cause instanceof Error ? cause.message : 'Impossible de générer le design IA.');
    } finally {
      setAiLoading(false);
    }
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
        wallpaperUrl: publishedWallpaper,
        overlayOpacity: draft.overlayOpacity,
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
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Menu Studio</p>
          <h3 className="mt-1 font-display text-3xl text-forest">Construis ton menu</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/45">
            Sépare la structure du contenu et l’apparence du menu, avec un aperçu toujours visible.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-full bg-white px-3 py-2 text-[10px] font-semibold text-forest shadow-sm md:self-auto">
          <span className={menu.loading || loadingDesign ? 'h-2 w-2 animate-pulse rounded-full bg-amber-400' : 'h-2 w-2 rounded-full bg-green-500'} />
          {menu.loading || loadingDesign ? 'Synchronisation…' : hasChanges ? 'Modifications locales' : 'Design publié'}
        </div>
      </div>

      <div className="rounded-2xl border border-ink/5 bg-[#f8f8f4] p-1.5 shadow-sm">
        <div className="grid grid-cols-2 gap-1">
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
                    ? 'bg-white text-forest shadow-sm ring-1 ring-gold/25'
                    : 'text-ink/45 hover:bg-white/70 hover:text-forest',
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
          ) : (
            <div className="min-h-[620px] rounded-3xl border border-ink/5 bg-white p-2 shadow-sm sm:p-4">
              <MenuConfigurator
                draft={draft}
                hasChanges={hasChanges}
                publishing={publishing}
                aiLoading={aiLoading}
                onChange={changeDraft}
                onPublish={() => void publish()}
                onGenerateAi={() => void generateAiDesign()}
              />
            </div>
          )}
        </div>

        <MenuPreview
          establishmentName={establishmentName}
          categories={menu.categories}
          itemsByCategory={menu.itemsByCategory}
          draft={draft}
        />
      </div>
    </div>
  );
}
