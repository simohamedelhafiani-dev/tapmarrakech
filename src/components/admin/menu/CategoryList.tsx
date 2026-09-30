import { useState } from 'react';
import { Check, ChevronDown, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';

type CategoryListProps = {
  categories: MenuCategory[];
  itemsByCategory: Record<string, MenuItem[]>;
  saving: boolean;
  onAdd: (input: { name: string; description?: string | null; active?: boolean }) => Promise<MenuCategory>;
  onUpdate: (categoryId: string, input: { name?: string; description?: string | null; active?: boolean }) => Promise<MenuCategory>;
  onToggleActive: (categoryId: string) => Promise<MenuCategory>;
  onDelete: (categoryId: string, action?: 'move' | 'delete', destinationCategoryId?: string) => Promise<boolean>;
  onReindex: () => Promise<void>;
};

export default function CategoryList({
  categories,
  itemsByCategory,
  saving,
  onAdd,
  onUpdate,
  onToggleActive,
  onDelete,
  onReindex,
}: CategoryListProps) {
  const [newName, setNewName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MenuCategory | null>(null);
  const [deleteMode, setDeleteMode] = useState<'move' | 'delete'>('move');
  const [destinationId, setDestinationId] = useState('');

  const submitNewCategory = async () => {
    console.log('[UI] Click: ADD_CATEGORY', { newName, saving });
    setActionError(null);
    try {
      console.log('[UI] ADD_CATEGORY -> calling onAdd');
      const created = await onAdd({ name: newName });
      console.log('[UI] ADD_CATEGORY -> SUCCESS', { id: created.id, name: created.name, display_order: created.display_order });
      setNewName('');
    } catch (error) {
      console.error('[UI] ADD_CATEGORY -> ERROR', error);
      setActionError(error instanceof Error ? error.message : 'Impossible de créer la catégorie.');
    }
  };

  const startEditing = (category: MenuCategory) => {
    setActionError(null);
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingName('');
  };

  const saveEditing = async () => {
    if (!editingId) return;
    setActionError(null);
    try {
      await onUpdate(editingId, { name: editingName });
      cancelEditing();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible de modifier la catégorie.');
    }
  };

  const toggle = async (categoryId: string) => {
    setActionError(null);
    try {
      await onToggleActive(categoryId);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible de modifier le statut.');
    }
  };

  const openDelete = (category: MenuCategory) => {
    setActionError(null); setDeleteTarget(category); setDeleteMode('move');
    setDestinationId(categories.find(c => c.id !== category.id && c.active)?.id ?? '');
  };
  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      setActionError(null);
      if (deleteMode === 'move' && !destinationId) throw new Error('Choisis une catégorie destination.');
      await onDelete(deleteTarget.id, deleteMode, deleteMode === 'move' ? destinationId : undefined);
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible de supprimer la catégorie.');
    }
  };

  const reindex = async () => {
    console.log('[UI] Click: REINDEX', { categoryCount: categories.length, saving });
    setActionError(null);
    try {
      console.log('[UI] REINDEX -> calling onReindex');
      await onReindex();
      console.log('[UI] REINDEX -> RESOLVED');
    } catch (error) {
      console.error('[UI] REINDEX -> ERROR', error);
      setActionError(error instanceof Error ? error.message : 'Impossible de réindexer le menu.');
    }
  };

  return (
    <section className="rounded-3xl border border-ink/5 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-ink/5 p-5 sm:p-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Structure</p>
          <h3 className="mt-1 text-xl font-semibold text-forest">Catégories</h3>
          <p className="mt-1 text-xs text-ink/45">Organise le menu par catégories. Les articles seront gérés dans l’étape suivante.</p>
        </div>

        <button
          type="button"
          onClick={() => void reindex()}
          disabled={saving || categories.length === 0}
          title={categories.length === 0 ? 'Aucune catégorie à réindexer.' : saving ? 'Une opération est en cours.' : 'Réindexer les catégories et articles'}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-forest/10 bg-[#f7f7f3] px-4 py-2.5 text-xs font-semibold text-forest disabled:cursor-not-allowed disabled:opacity-40"
        >
          <RefreshCw size={14} />
          Réindexer l’ordre
        </button>
      </div>

      <div className="p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && newName.trim()) void submitNewCategory();
            }}
            placeholder="Ex. Entrées, Plats, Desserts…"
            className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none transition focus:border-forest/30 focus:ring-2 focus:ring-forest/10"
          />
          <button
            type="button"
            onClick={() => void submitNewCategory()}
            disabled={saving || !newName.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus size={15} />
            Ajouter
          </button>
        </div>

        {actionError && (
          <div className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">
            {actionError}
          </div>
        )}

        <div className="mt-5 space-y-2">
          {categories.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-ink/10 bg-[#f7f7f3] px-5 py-10 text-center">
              <p className="text-sm font-semibold text-forest">Aucune catégorie</p>
              <p className="mt-1 text-xs text-ink/40">Crée la première catégorie pour commencer ton menu.</p>
            </div>
          ) : (
            categories.map((category, index) => {
              const isEditing = editingId === category.id;
              const itemCount = itemsByCategory[category.id]?.length ?? 0;

              return (
                <div key={category.id} className="space-y-2">
                  <div className="flex flex-col gap-3 rounded-2xl border border-ink/5 bg-[#f7f7f3] p-4 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold text-forest shadow-sm">
                        {index + 1}
                      </div>

                      {isEditing ? (
                        <input
                          autoFocus
                          value={editingName}
                          onChange={(event) => setEditingName(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' && editingName.trim()) void saveEditing();
                            if (event.key === 'Escape') cancelEditing();
                          }}
                          className="min-w-0 flex-1 rounded-lg border border-forest/20 bg-white px-3 py-2 text-sm outline-none ring-2 ring-forest/5"
                        />
                      ) : (
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-forest">{category.name}</p>
                          <p className="mt-0.5 text-[11px] text-ink/40">
                            {itemCount} article{itemCount > 1 ? 's' : ''}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 sm:shrink-0">
                      {isEditing ? (
                        <>
                          <button type="button" onClick={() => void saveEditing()} disabled={saving || !editingName.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40">
                            <Check size={13} /> Enregistrer
                          </button>
                          <button type="button" onClick={cancelEditing} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-ink/55">
                            <X size={13} /> Annuler
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEditing(category)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-forest disabled:opacity-40">
                            <Pencil size={13} /> Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggle(category.id)}
                            disabled={saving}
                            className={category.active ? 'rounded-lg bg-red-50 px-3 py-2 text-[11px] font-semibold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40' : 'rounded-lg bg-forest px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-40'}
                          >
                            {category.active ? 'Désactiver' : 'Activer'}
                          </button>
                          <button type="button" onClick={() => setExpandedId(expandedId === category.id ? null : category.id)} disabled={saving} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-forest disabled:opacity-40">
                            <ChevronDown size={13} className={expandedId === category.id ? 'rotate-180 transition-transform' : 'transition-transform'} /> Articles
                          </button>
                          <button type="button" onClick={() => openDelete(category)} disabled={saving} title="Supprimer" className="grid h-8 w-8 place-items-center rounded-lg bg-white text-ink/35 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30">
                            <Trash2 size={14} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {expandedId === category.id && (
                    <div className="rounded-2xl border border-ink/5 bg-white p-4">
                      {itemCount === 0 ? (
                        <p className="text-xs text-ink/40">Aucun article dans cette catégorie.</p>
                      ) : (
                        <div className="space-y-2">
                          {itemsByCategory[category.id].map((item, itemIndex) => (
                            <div key={item.id} className="flex items-center justify-between rounded-xl bg-[#f7f7f3] px-3 py-2.5">
                              <div className="min-w-0">
                                <p className="truncate text-xs font-semibold text-forest">{itemIndex + 1}. {item.name}</p>
                                <p className="mt-0.5 text-[10px] text-ink/40">{item.price} DH · {item.active ? 'Actif' : 'Inactif'}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
      {deleteTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Suppression</p>
            <h4 className="mt-2 text-lg font-semibold text-forest">Supprimer « {deleteTarget.name} » ?</h4>
            <p className="mt-2 text-xs text-ink/50">{itemsByCategory[deleteTarget.id]?.length ?? 0} article(s) concerné(s).</p>
            {(itemsByCategory[deleteTarget.id]?.length ?? 0) > 0 && <>
              <div className="mt-4 space-y-2">
                <label className="flex gap-3 rounded-xl border p-3"><input type="radio" checked={deleteMode === 'move'} onChange={() => setDeleteMode('move')} /><span className="text-xs"><b>Déplacer les articles</b><span className="block text-ink/40">Ils restent dans le menu.</span></span></label>
                <label className="flex gap-3 rounded-xl border border-red-100 p-3"><input type="radio" checked={deleteMode === 'delete'} onChange={() => setDeleteMode('delete')} /><span className="text-xs"><b className="text-red-700">Tout supprimer</b><span className="block text-ink/40">Les articles seront supprimés.</span></span></label>
              </div>
              {deleteMode === 'move' && <select value={destinationId} onChange={e => setDestinationId(e.target.value)} className="mt-3 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-xs"><option value="">Choisir une destination…</option>{categories.filter(c => c.id !== deleteTarget.id && c.active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}
              {deleteMode === 'delete' && <p className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-[10px] text-red-700">Suppression définitive des articles concernés.</p>}
            </>}
            {actionError && <div className="mt-3 rounded-xl bg-red-50 px-3 py-2.5 text-xs text-red-700">{actionError}</div>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleteTarget(null)} className="rounded-xl bg-[#f7f7f3] px-4 py-2.5 text-xs font-semibold">Annuler</button><button type="button" onClick={() => void confirmDelete()} disabled={saving || ((itemsByCategory[deleteTarget.id]?.length ?? 0) > 0 && deleteMode === 'move' && !destinationId)} className="rounded-xl bg-red-600 px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40">Confirmer</button></div>
          </div>
        </div>
      )}
    </section>
  );
}
