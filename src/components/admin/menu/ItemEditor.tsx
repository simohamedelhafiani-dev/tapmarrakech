import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';

type ItemEditorProps = {
  category: MenuCategory | null;
  items: MenuItem[];
  saving: boolean;
};

export default function ItemEditor({ category, items, saving }: ItemEditorProps) {
  if (!category) {
    return (
      <section className="min-w-0 rounded-3xl border border-dashed border-ink/10 bg-white/70 p-8 text-center">
        <p className="text-sm font-semibold text-forest">Sélectionne une catégorie</p>
        <p className="mt-1 text-xs text-ink/40">Les articles apparaîtront ici.</p>
      </section>
    );
  }

  return (
    <section className="min-w-0 rounded-3xl border border-ink/5 bg-white shadow-sm">
      <div className="border-b border-ink/5 p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Édition</p>
        <div className="mt-1 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-forest">{category.name}</h3>
            <p className="mt-1 text-xs text-ink/40">
              {items.length} article{items.length > 1 ? 's' : ''}
            </p>
          </div>
          {saving && <span className="text-[10px] font-semibold text-ink/40">Enregistrement…</span>}
        </div>
      </div>

      <div className="space-y-2 p-5">
        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/10 bg-[#f7f7f3] p-8 text-center">
            <p className="text-sm font-semibold text-forest">Aucun article</p>
            <p className="mt-1 text-xs text-ink/40">Les outils d’édition seront modernisés à l’étape C.</p>
          </div>
        ) : (
          items.map((item, index) => (
            <div key={item.id} className="flex items-center gap-3 rounded-2xl border border-ink/5 bg-[#f7f7f3] p-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-[10px] font-bold text-forest">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-forest">{item.name}</p>
                <p className="mt-0.5 truncate text-[11px] text-ink/40">
                  {item.price} DH · {item.active ? 'Actif' : 'Inactif'}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
