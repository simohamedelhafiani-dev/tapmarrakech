import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';

type MenuPreviewProps = {
  establishmentName?: string;
  category: MenuCategory | null;
  items: MenuItem[];
};

export default function MenuPreview({ establishmentName, category, items }: MenuPreviewProps) {
  return (
    <aside className="min-w-0 rounded-3xl border border-ink/5 bg-slate-50 shadow-sm lg:sticky lg:top-4 lg:self-start">
      <div className="border-b border-ink/5 bg-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Aperçu</p>
        <h3 className="mt-1 text-base font-semibold text-forest">{establishmentName || 'Menu public'}</h3>
        <p className="mt-1 text-[11px] text-ink/35">Miroir de la sélection actuelle</p>
      </div>

      <div className="p-5">
        <div className="rounded-3xl bg-white p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/35">Catégorie</p>
          <h4 className="mt-2 text-2xl font-semibold text-forest">
            {category?.name || 'Aucune catégorie'}
          </h4>
          <div className="mt-5 space-y-3">
            {items.map(item => (
              <div key={item.id} className="border-b border-ink/5 pb-3 last:border-0">
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-semibold text-forest">{item.name}</span>
                  <span className="shrink-0 text-sm font-semibold text-forest">{item.price} DH</span>
                </div>
              </div>
            ))}
            {!items.length && (
              <p className="text-xs text-ink/35">Aucun article dans cette catégorie.</p>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
