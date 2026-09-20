import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Edit3,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Plus,
  Save,
  Trash2,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Establishment = {
  id: string;
  name: string;
  ai_business_type_id: string | null;
};

type MenuCategory = {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type MenuItem = {
  id: string;
  establishment_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type CategoryForm = {
  name: string;
  description: string;
};

type ItemForm = {
  categoryId: string;
  name: string;
  description: string;
  price: string;
  imageUrl: string;
};

const emptyCategoryForm: CategoryForm = {
  name: '',
  description: '',
};

const emptyItemForm: ItemForm = {
  categoryId: '',
  name: '',
  description: '',
  price: '',
  imageUrl: '',
};

export default function Menu() {
  const { user } = useAuth();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [categoryForm, setCategoryForm] =
    useState<CategoryForm>(emptyCategoryForm);
  const [itemForm, setItemForm] = useState<ItemForm>(emptyItemForm);

  const [expandedCategoryIds, setExpandedCategoryIds] = useState<string[]>([]);

  useEffect(() => {
    if (user?.id) {
      loadEstablishments();
    }
  }, [user?.id]);

  useEffect(() => {
    if (establishmentId) {
      loadMenu();
    }
  }, [establishmentId]);

  async function loadEstablishments() {
    setLoading(true);
    setErrorMessage('');

    const { data, error } = await supabase.rpc('get_my_establishments');

    if (error) {
      console.error('Erreur chargement établissements:', error);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const baseEstablishments = (data ?? []).map(
      (establishment: {
        id: string;
        name: string;
        ai_business_type_id?: string | null;
      }) => ({
        id: establishment.id,
        name: establishment.name,
        ai_business_type_id: establishment.ai_business_type_id ?? null,
      })
    );

    setEstablishments(baseEstablishments);

    if (baseEstablishments.length > 0) {
      setEstablishmentId((current) => current || baseEstablishments[0].id);
    }

    setLoading(false);
  }

  async function loadMenu() {
    setLoading(true);
    setErrorMessage('');

    const [categoriesResult, itemsResult] = await Promise.all([
      supabase
        .from('menu_categories')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('menu_items')
        .select('*')
        .eq('establishment_id', establishmentId)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (categoriesResult.error) {
      console.error('Erreur catégories menu:', categoriesResult.error);
      setErrorMessage(categoriesResult.error.message);
    }

    if (itemsResult.error) {
      console.error('Erreur produits menu:', itemsResult.error);
      setErrorMessage(itemsResult.error.message);
    }

    setCategories((categoriesResult.data as MenuCategory[]) ?? []);
    setItems(
      ((itemsResult.data as MenuItem[]) ?? []).map((item) => ({
        ...item,
        price: Number(item.price),
      }))
    );

    setLoading(false);
  }

  const selectedEstablishment = establishments.find(
    (establishment) => establishment.id === establishmentId
  );

  const itemsByCategory = useMemo(() => {
    const map: Record<string, MenuItem[]> = {};

    for (const item of items) {
      if (!map[item.category_id]) {
        map[item.category_id] = [];
      }

      map[item.category_id].push(item);
    }

    return map;
  }, [items]);

  function toggleCategory(categoryId: string) {
    setExpandedCategoryIds((current) =>
      current.includes(categoryId)
        ? current.filter((id) => id !== categoryId)
        : [...current, categoryId]
    );
  }

  function openNewCategory() {
    setEditingCategoryId(null);
    setCategoryForm(emptyCategoryForm);
    setShowCategoryForm(true);
  }

  function openEditCategory(category: MenuCategory) {
    setEditingCategoryId(category.id);
    setCategoryForm({
      name: category.name,
      description: category.description ?? '',
    });
    setShowCategoryForm(true);
  }

  async function saveCategory(event: FormEvent) {
    event.preventDefault();

    const name = categoryForm.name.trim();

    if (!establishmentId || !name) {
      alert('Le nom de la catégorie est obligatoire.');
      return;
    }

    setSaving(true);

    const payload = {
      establishment_id: establishmentId,
      name,
      description: categoryForm.description.trim() || null,
    };

    const result = editingCategoryId
      ? await supabase
          .from('menu_categories')
          .update(payload)
          .eq('id', editingCategoryId)
          .eq('establishment_id', establishmentId)
      : await supabase.from('menu_categories').insert({
          ...payload,
          display_order: categories.length,
        });

    if (result.error) {
      alert(result.error.message);
      setSaving(false);
      return;
    }

    setShowCategoryForm(false);
    setCategoryForm(emptyCategoryForm);
    setEditingCategoryId(null);

    await loadMenu();
    setSaving(false);
  }

  async function toggleCategoryActive(category: MenuCategory) {
    const { error } = await supabase
      .from('menu_categories')
      .update({ active: !category.active })
      .eq('id', category.id)
      .eq('establishment_id', establishmentId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadMenu();
  }

  async function deleteCategory(category: MenuCategory) {
    const categoryItems = itemsByCategory[category.id] ?? [];

    const confirmed = window.confirm(
      categoryItems.length > 0
        ? `Supprimer « ${category.name} » et ses ${categoryItems.length} produit(s) ?`
        : `Supprimer la catégorie « ${category.name} » ?`
    );

    if (!confirmed) return;

    const { error } = await supabase
      .from('menu_categories')
      .delete()
      .eq('id', category.id)
      .eq('establishment_id', establishmentId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadMenu();
  }

  function openNewItem(categoryId?: string) {
    setEditingItemId(null);
    setItemForm({
      ...emptyItemForm,
      categoryId: categoryId ?? categories[0]?.id ?? '',
    });
    setShowItemForm(true);
  }

  function openEditItem(item: MenuItem) {
    setEditingItemId(item.id);
    setItemForm({
      categoryId: item.category_id,
      name: item.name,
      description: item.description ?? '',
      price: String(item.price),
      imageUrl: item.image_url ?? '',
    });
    setShowItemForm(true);
  }

  async function saveItem(event: FormEvent) {
    event.preventDefault();

    const name = itemForm.name.trim();
    const categoryId = itemForm.categoryId;
    const price = Number(itemForm.price.replace(',', '.'));

    if (!establishmentId || !categoryId || !name) {
      alert('La catégorie et le nom du produit sont obligatoires.');
      return;
    }

    if (!Number.isFinite(price) || price < 0) {
      alert('Veuillez saisir un prix valide.');
      return;
    }

    setSaving(true);

    const payload = {
      establishment_id: establishmentId,
      category_id: categoryId,
      name,
      description: itemForm.description.trim() || null,
      price,
      image_url: itemForm.imageUrl.trim() || null,
    };

    const result = editingItemId
      ? await supabase
          .from('menu_items')
          .update(payload)
          .eq('id', editingItemId)
          .eq('establishment_id', establishmentId)
      : await supabase.from('menu_items').insert({
          ...payload,
          display_order: (itemsByCategory[categoryId] ?? []).length,
        });

    if (result.error) {
      alert(result.error.message);
      setSaving(false);
      return;
    }

    setShowItemForm(false);
    setItemForm(emptyItemForm);
    setEditingItemId(null);

    await loadMenu();
    setSaving(false);
  }

  async function toggleItemActive(item: MenuItem) {
    const { error } = await supabase
      .from('menu_items')
      .update({ active: !item.active })
      .eq('id', item.id)
      .eq('establishment_id', establishmentId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadMenu();
  }

  async function deleteItem(item: MenuItem) {
    if (!window.confirm(`Supprimer « ${item.name} » du menu ?`)) {
      return;
    }

    const { error } = await supabase
      .from('menu_items')
      .delete()
      .eq('id', item.id)
      .eq('establishment_id', establishmentId);

    if (error) {
      alert(error.message);
      return;
    }

    await loadMenu();
  }

  async function moveCategory(category: MenuCategory, direction: -1 | 1) {
    const index = categories.findIndex((item) => item.id === category.id);
    const targetIndex = index + direction;

    if (index < 0 || targetIndex < 0 || targetIndex >= categories.length) {
      return;
    }

    const reordered = [...categories];
    const [moved] = reordered.splice(index, 1);
    reordered.splice(targetIndex, 0, moved);

    setCategories(
      reordered.map((item, position) => ({
        ...item,
        display_order: position,
      }))
    );

    const updates = reordered.map((item, position) =>
      supabase
        .from('menu_categories')
        .update({ display_order: position })
        .eq('id', item.id)
        .eq('establishment_id', establishmentId)
    );

    const results = await Promise.all(updates);
    const failed = results.find((result) => result.error);

    if (failed?.error) {
      alert(failed.error.message);
      await loadMenu();
    }
  }

  if (loading && establishments.length === 0) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-sm text-ink/50">Chargement du menu…</div>
      </div>
    );
  }

  if (errorMessage && establishments.length === 0) {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-8 text-red-700">
        <p className="font-semibold">Impossible de charger le menu.</p>
        <p className="mt-2 text-sm">{errorMessage}</p>
      </div>
    );
  }

  if (establishments.length === 0) {
    return (
      <div className="rounded-3xl border border-ink/10 bg-white p-10 text-center">
        <UtensilsCrossed className="mx-auto mb-4 text-gold" size={34} />
        <h1 className="text-2xl font-semibold text-forest">
          Aucun établissement
        </h1>
        <p className="mt-2 text-sm text-ink/50">
          Crée d’abord ton établissement pour gérer son menu.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <section className="rounded-[28px] bg-forest p-6 text-white shadow-xl md:p-8">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
              <UtensilsCrossed size={15} />
              Menu
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Ton menu digital
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              Organise tes catégories et tes produits. Les modifications sont
              enregistrées directement pour ton établissement.
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <select
              value={establishmentId}
              onChange={(event) => setEstablishmentId(event.target.value)}
              className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none"
            >
              {establishments.map((establishment) => (
                <option
                  key={establishment.id}
                  value={establishment.id}
                  className="text-ink"
                >
                  {establishment.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={openNewCategory}
              className="flex items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-semibold text-forest transition hover:brightness-105"
            >
              <Plus size={17} />
              Nouvelle catégorie
            </button>
          </div>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="space-y-4">
        {categories.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-ink/15 bg-white p-12 text-center">
            <UtensilsCrossed className="mx-auto mb-4 text-gold" size={36} />
            <h2 className="text-xl font-semibold text-forest">
              Ton menu est vide
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/50">
              Commence par créer une catégorie comme Entrées, Plats, Burgers,
              Desserts ou Boissons.
            </p>
            <button
              type="button"
              onClick={openNewCategory}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white"
            >
              <Plus size={17} />
              Créer ma première catégorie
            </button>
          </div>
        ) : (
          categories.map((category, index) => {
            const categoryItems = itemsByCategory[category.id] ?? [];
            const expanded = expandedCategoryIds.includes(category.id);

            return (
              <article
                key={category.id}
                className={`overflow-hidden rounded-3xl border bg-white shadow-sm ${
                  category.active
                    ? 'border-ink/8'
                    : 'border-dashed border-ink/15 opacity-75'
                }`}
              >
                <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:p-6">
                  <button
                    type="button"
                    onClick={() => toggleCategory(category.id)}
                    className="flex min-w-0 items-center gap-4 text-left"
                  >
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-cream text-forest">
                      <UtensilsCrossed size={19} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-lg font-semibold text-forest">
                          {category.name}
                        </h2>
                        {!category.active && (
                          <span className="rounded-full bg-ink/5 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink/45">
                            Masquée
                          </span>
                        )}
                      </div>

                      <p className="mt-1 text-xs text-ink/45">
                        {categoryItems.length}{' '}
                        {categoryItems.length > 1 ? 'produits' : 'produit'}
                        {category.description
                          ? ` · ${category.description}`
                          : ''}
                      </p>
                    </div>
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      title="Monter"
                      disabled={index === 0}
                      onClick={() => moveCategory(category, -1)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 text-ink/50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronUp size={16} />
                    </button>

                    <button
                      type="button"
                      title="Descendre"
                      disabled={index === categories.length - 1}
                      onClick={() => moveCategory(category, 1)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 text-ink/50 disabled:cursor-not-allowed disabled:opacity-30"
                    >
                      <ChevronDown size={16} />
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCategoryActive(category)}
                      className="flex items-center gap-2 rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/60"
                    >
                      {category.active ? <EyeOff size={15} /> : <Eye size={15} />}
                      {category.active ? 'Masquer' : 'Afficher'}
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditCategory(category)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 text-ink/50"
                    >
                      <Edit3 size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteCategory(category)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-red-100 text-red-500"
                    >
                      <Trash2 size={15} />
                    </button>

                    <button
                      type="button"
                      onClick={() => openNewItem(category.id)}
                      className="flex items-center gap-2 rounded-xl bg-forest px-3 py-2 text-xs font-semibold text-white"
                    >
                      <Plus size={15} />
                      Produit
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleCategory(category.id)}
                      className="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 text-ink/50"
                    >
                      {expanded ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-ink/5 bg-[#fbfbf8] p-4 md:p-6">
                    {categoryItems.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-ink/10 bg-white p-8 text-center">
                        <p className="text-sm text-ink/45">
                          Aucun produit dans cette catégorie.
                        </p>
                        <button
                          type="button"
                          onClick={() => openNewItem(category.id)}
                          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white"
                        >
                          <Plus size={15} />
                          Ajouter un produit
                        </button>
                      </div>
                    ) : (
                      <div className="grid gap-3">
                        {categoryItems.map((item) => (
                          <div
                            key={item.id}
                            className={`flex flex-col gap-4 rounded-2xl border bg-white p-4 md:flex-row md:items-center ${
                              item.active
                                ? 'border-ink/7'
                                : 'border-dashed border-ink/15 opacity-65'
                            }`}
                          >
                            <div className="flex min-w-0 flex-1 items-center gap-4">
                              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-2xl bg-cream">
                                {item.image_url ? (
                                  <img
                                    src={item.image_url}
                                    alt={item.name}
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="grid h-full w-full place-items-center text-ink/25">
                                    <ImageIcon size={20} />
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <h3 className="truncate font-semibold text-forest">
                                    {item.name}
                                  </h3>
                                  {!item.active && (
                                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink/35">
                                      Masqué
                                    </span>
                                  )}
                                </div>

                                {item.description && (
                                  <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink/45">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-3 md:justify-end">
                              <p className="text-sm font-bold text-gold">
                                {item.price.toFixed(2)} MAD
                              </p>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => toggleItemActive(item)}
                                  className="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 text-ink/50"
                                  title={item.active ? 'Masquer' : 'Afficher'}
                                >
                                  {item.active ? (
                                    <EyeOff size={15} />
                                  ) : (
                                    <Eye size={15} />
                                  )}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => openEditItem(item)}
                                  className="grid h-9 w-9 place-items-center rounded-xl border border-ink/10 text-ink/50"
                                  title="Modifier"
                                >
                                  <Edit3 size={15} />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => deleteItem(item)}
                                  className="grid h-9 w-9 place-items-center rounded-xl border border-red-100 text-red-500"
                                  title="Supprimer"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })
        )}
      </section>

      {showCategoryForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                  Menu
                </p>
                <h2 className="mt-1 text-xl font-semibold text-forest">
                  {editingCategoryId
                    ? 'Modifier la catégorie'
                    : 'Nouvelle catégorie'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowCategoryForm(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink/50"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={saveCategory} className="space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink/60">
                  Nom
                </span>
                <input
                  value={categoryForm.name}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ex. Burgers"
                  className="w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink/60">
                  Description <span className="font-normal">(optionnel)</span>
                </span>
                <textarea
                  value={categoryForm.description}
                  onChange={(event) =>
                    setCategoryForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={3}
                  placeholder="Une courte présentation de la catégorie"
                  className="w-full resize-none rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
              >
                <Save size={16} />
                {saving ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showItemForm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
                  Menu
                </p>
                <h2 className="mt-1 text-xl font-semibold text-forest">
                  {editingItemId ? 'Modifier le produit' : 'Nouveau produit'}
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setShowItemForm(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink/50"
              >
                <X size={17} />
              </button>
            </div>

            <form onSubmit={saveItem} className="grid gap-4 md:grid-cols-2">
              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-ink/60">
                  Catégorie
                </span>
                <select
                  value={itemForm.categoryId}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      categoryId: event.target.value,
                    }))
                  }
                  className="w-full rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-gold"
                >
                  <option value="">Choisir une catégorie</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-ink/60">
                  Nom du produit
                </span>
                <input
                  value={itemForm.name}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }))
                  }
                  placeholder="Ex. Cheeseburger"
                  className="w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                  autoFocus
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink/60">
                  Prix (MAD)
                </span>
                <input
                  value={itemForm.price}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      price: event.target.value,
                    }))
                  }
                  inputMode="decimal"
                  placeholder="69"
                  className="w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink/60">
                  URL de la photo <span className="font-normal">(optionnel)</span>
                </span>
                <input
                  value={itemForm.imageUrl}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      imageUrl: event.target.value,
                    }))
                  }
                  placeholder="https://…"
                  className="w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-xs font-semibold text-ink/60">
                  Description <span className="font-normal">(optionnel)</span>
                </span>
                <textarea
                  value={itemForm.description}
                  onChange={(event) =>
                    setItemForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  rows={4}
                  placeholder="Décris le produit simplement. L’IA pourra aider à reformuler plus tard."
                  className="w-full resize-none rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
                />
              </label>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 md:col-span-2"
              >
                <Save size={16} />
                {saving ? 'Enregistrement…' : 'Enregistrer le produit'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
