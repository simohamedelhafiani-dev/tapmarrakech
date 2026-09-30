import { useEffect, useState } from 'react';
import { useMenuManager } from '@/hooks/useMenuManager';
import CategorySidebar from '@/components/admin/menu/CategorySidebar';
import ItemEditor from '@/components/admin/menu/ItemEditor';
import MenuPreview from '@/components/admin/menu/MenuPreview';

type MenuStudioProps = {
  establishmentId: string;
};

export default function MenuStudio({ establishmentId }: MenuStudioProps) {
  const menu = useMenuManager(establishmentId);
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  useEffect(() => {
    if (!menu.categories.length) {
      setSelectedCategoryId('');
      return;
    }

    const selectedStillExists = menu.categories.some(
      category => category.id === selectedCategoryId,
    );

    if (!selectedStillExists) {
      const firstActive = menu.categories.find(category => category.active);
      setSelectedCategoryId((firstActive ?? menu.categories[0]).id);
    }
  }, [menu.categories, selectedCategoryId]);

  const selectedCategory =
    menu.categories.find(category => category.id === selectedCategoryId) ?? null;

  const selectedItems = selectedCategory
    ? (menu.itemsByCategory[selectedCategory.id] ?? [])
    : [];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">
            Menu Studio
          </p>
          <h3 className="mt-1 font-display text-3xl text-forest">
            Construis ton menu
          </h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/45">
            Navigue à gauche, travaille au centre et visualise immédiatement à droite.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-full bg-white px-3 py-2 text-[10px] font-semibold text-forest shadow-sm md:self-auto">
          <span
            className={
              menu.loading
                ? 'h-2 w-2 animate-pulse rounded-full bg-amber-400'
                : 'h-2 w-2 rounded-full bg-green-500'
            }
          />
          {menu.loading ? 'Synchronisation…' : 'Moteur synchronisé'}
        </div>
      </div>

      {menu.error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
          {menu.error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)_320px] lg:items-start">
        <CategorySidebar
          categories={menu.categories}
          selectedCategoryId={selectedCategoryId}
          saving={menu.saving}
          onSelect={setSelectedCategoryId}
          onAdd={menu.addCategory}
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

        <MenuPreview
          category={selectedCategory}
          items={selectedItems}
        />
      </div>
    </div>
  );
}
