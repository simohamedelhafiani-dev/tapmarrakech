import { useMenuManager } from '@/hooks/useMenuManager';
import CategoryList from '@/components/admin/menu/CategoryList';

type MenuStudioProps = {
  establishmentId: string;
};

export default function MenuStudio({ establishmentId }: MenuStudioProps) {
  const menu = useMenuManager(establishmentId);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Menu Studio</p>
          <h3 className="mt-1 font-display text-3xl text-forest">Construis ton menu</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink/45">
            Le Studio centralise la structure du menu. Les règles de données, d’ordre et de publication restent dans le moteur.
          </p>
        </div>

        <div className="inline-flex items-center gap-2 self-start rounded-full bg-white px-3 py-2 text-[10px] font-semibold text-forest shadow-sm md:self-auto">
          <span className={menu.loading ? 'h-2 w-2 animate-pulse rounded-full bg-amber-400' : 'h-2 w-2 rounded-full bg-green-500'} />
          {menu.loading ? 'Synchronisation…' : 'Moteur synchronisé'}
        </div>
      </div>

      {menu.error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs text-red-700">
          {menu.error}
        </div>
      )}

      <CategoryList
        categories={menu.categories}
        itemsByCategory={menu.itemsByCategory}
        saving={menu.saving}
        onAdd={menu.addCategory}
        onUpdate={menu.updateCategory}
        onToggleActive={menu.toggleCategoryActive}
        onDelete={menu.deleteCategory}
        onReindex={menu.reindexAll}
      />

      <section className="rounded-3xl border border-dashed border-forest/15 bg-white/70 p-8 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Étape suivante</p>
        <h4 className="mt-2 text-lg font-semibold text-forest">Articles</h4>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-5 text-ink/40">
          Le gestionnaire d’articles sera branché directement sur le même moteur certifié : création, édition, déplacement et publication.
        </p>
      </section>
    </div>
  );
}
