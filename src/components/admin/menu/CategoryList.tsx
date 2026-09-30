import { useState } from 'react';
import { Check, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';

type CategoryListProps = {
  categories: MenuCategory[];
  itemsByCategory: Record<string, MenuItem[]>;
  saving: boolean;
  onAdd: (input: { name: string; description?: string | null; active?: boolean }) => Promise<MenuCategory>;
  onUpdate: (categoryId: string, input: { name?: string; description?: string | null; active?: boolean }) => Promise<MenuCategory>;
  onToggleActive: (categoryId: string) => Promise<MenuCategory>;
  onDelete: (categoryId: string) => Promise<boolean>;
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

  const submitNewCategory = async () => {
    setActionError(null);
    try {
      await onAdd({ name: newName });
      setNewName('');
    } catch (error) {
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

  const remove = async (category: MenuCategory) => {
    setActionError(null);
    try {
      await onDelete(category.id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Impossible de supprimer la catégorie.');
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
          onClick={() => void onReindex()}
          disabled={saving || categories.length === 0}
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
                <div
                  key={category.id}
                  className="flex flex-col gap-3 rounded-2xl border border-ink/5 bg-[#f7f7f3] p-4 sm:flex-row sm:items-center"
                >
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
                        <button
                          type="button"
                          onClick={() => void saveEditing()}
                          disabled={saving || !editingName.trim()}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-forest px-3 py-2 text-[11px] font-semibold text-white disabled:opacity-40"
                        >
                          <Check size={13} />
                          Enregistrer
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-ink/55"
                        >
                          <X size={13} />
                          Annuler
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          onClick={() => startEditing(category)}
                          disabled={saving}
                          className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-forest disabled:opacity-40"
                        >
                          <Pencil size={13} />
                          Modifier
                        </button>
                        <button
                          type="button"
                          onClick={() => void toggle(category.id)}
                          disabled={saving}
                          className={category.active ? 'rounded-full bg-green-100 px-3 py-1.5 text-[10px] font-semibold text-green-700' : 'rounded-full bg-ink/10 px-3 py-1.5 text-[10px] font-semibold text-ink/45'}
                        >
                          {category.active ? 'Actif' : 'Inactif'}
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(category)}
                          disabled={saving || itemCount > 0}
                          title={itemCount > 0 ? 'Supprime d’abord les articles de cette catégorie.' : 'Supprimer'}
                          className="grid h-8 w-8 place-items-center rounded-lg bg-white text-ink/35 transition hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-30"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
