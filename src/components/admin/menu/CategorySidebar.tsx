import { CheckCircle2, CircleOff, Plus } from 'lucide-react';
import type { MenuCategory } from '@/hooks/useMenuManager';

type CategorySidebarProps = {
  categories: MenuCategory[];
  selectedCategoryId: string;
  saving: boolean;
  onSelect: (categoryId: string) => void;
  onAdd: (input: { name: string; description?: string | null; active?: boolean }) => Promise<MenuCategory>;
  onToggleActive: (categoryId: string) => Promise<MenuCategory>;
};

export default function CategorySidebar({
  categories,
  selectedCategoryId,
  saving,
  onSelect,
  onAdd,
  onToggleActive,
}: CategorySidebarProps) {
  const addCategory = async () => {
    const name = window.prompt('Nom de la catégorie');
    if (!name?.trim()) return;
    await onAdd({ name: name.trim() });
  };

  return (
    <aside className="min-w-0 rounded-3xl border border-ink/5 bg-white shadow-sm lg:sticky lg:top-4 lg:self-start">
      <div className="border-b border-ink/5 p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Navigation</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold text-forest">Catégories</h3>
          <button
            type="button"
            onClick={() => void addCategory()}
            disabled={saving}
            className="grid h-8 w-8 place-items-center rounded-xl bg-forest text-white disabled:opacity-40"
            title="Ajouter une catégorie"
          >
            <Plus size={15} />
          </button>
        </div>
      </div>

      <div className="max-h-[60vh] space-y-1 overflow-y-auto p-2 lg:max-h-[calc(100vh-260px)]">
        {categories.length === 0 ? (
          <div className="px-3 py-8 text-center text-xs text-ink/40">
            Aucune catégorie.
          </div>
        ) : (
          categories.map((category, index) => {
            const selected = category.id === selectedCategoryId;
            return (
              <div
                key={category.id}
                className={[
                  'flex w-full items-center gap-2 rounded-2xl px-2 py-2 transition',
                  selected
                    ? 'bg-forest text-white shadow-sm'
                    : 'text-forest hover:bg-[#f7f7f3]',
                  !category.active ? 'opacity-60' : '',
                ].join(' ')}
              >
                <button
                  type="button"
                  onClick={() => onSelect(category.id)}
                  disabled={saving}
                  className="flex min-w-0 flex-1 items-center gap-3 rounded-xl px-1 py-1 text-left"
                >
                  <span className={[
                    'grid h-7 w-7 shrink-0 place-items-center rounded-lg text-[10px] font-bold',
                    selected ? 'bg-white/15 text-white' : 'bg-[#f7f7f3] text-forest',
                  ].join(' ')}>
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold">{category.name}</span>
                    <span className={selected ? 'text-[10px] text-white/60' : 'text-[10px] text-ink/35'}>
                      {category.active ? 'Actif' : 'Inactif'}
                    </span>
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => void onToggleActive(category.id)}
                  disabled={saving}
                  title={category.active ? 'Désactiver la catégorie' : 'Activer la catégorie'}
                  aria-label={category.active ? 'Désactiver la catégorie' : 'Activer la catégorie'}
                  className={[
                    'grid h-8 w-8 shrink-0 place-items-center rounded-xl transition disabled:opacity-40',
                    selected
                      ? 'bg-white/10 text-white hover:bg-white/20'
                      : 'bg-white text-forest shadow-sm hover:bg-[#eef1e9]',
                  ].join(' ')}
                >
                  {category.active ? <CircleOff size={14} /> : <CheckCircle2 size={14} />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
