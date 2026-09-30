import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type MenuCategory = {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type MenuItem = {
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

type NewCategory = {
  name: string;
  description?: string | null;
  active?: boolean;
};

type NewItem = {
  category_id: string;
  name: string;
  description?: string | null;
  price: number;
  image_url?: string | null;
  active?: boolean;
};

const normalizeCategoryOrder = (rows: MenuCategory[]) =>
  [...rows].sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));

const normalizeItemOrder = (rows: MenuItem[]) =>
  [...rows].sort((a, b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));

export function useMenuManager(establishmentId: string | null) {
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!establishmentId) {
      setCategories([]);
      setItems([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const [{ data: categoryRows, error: categoryError }, { data: itemRows, error: itemError }] =
        await Promise.all([
          supabase.from('menu_categories').select('*').eq('establishment_id', establishmentId).order('display_order'),
          supabase.from('menu_items').select('*').eq('establishment_id', establishmentId).order('display_order'),
        ]);

      if (categoryError) throw categoryError;
      if (itemError) throw itemError;

      const nextCategories = normalizeCategoryOrder((categoryRows ?? []) as MenuCategory[]);
      const nextItems = normalizeItemOrder((itemRows ?? []) as MenuItem[]);

      setCategories(nextCategories);
      setItems(nextItems);

      console.log('[MenuManager] LOAD SUCCESS:', {
        establishmentId,
        categories: nextCategories.length,
        items: nextItems.length,
      });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible de charger le menu.';
      console.error('[MenuManager] LOAD ERROR:', cause);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [establishmentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};
    for (const category of categories) grouped[category.id] = [];
    for (const item of items) {
      if (grouped[item.category_id]) grouped[item.category_id].push(item);
    }
    for (const categoryId of Object.keys(grouped)) {
      grouped[categoryId] = normalizeItemOrder(grouped[categoryId]);
    }
    return grouped;
  }, [categories, items]);

  const reindexAll = useCallback(async () => {
    if (!establishmentId) return;
    setSaving(true);
    setError(null);

    try {
      const orderedCategories = normalizeCategoryOrder(categories);
      for (let index = 0; index < orderedCategories.length; index += 1) {
        const category = orderedCategories[index];
        const { error: updateError } = await supabase
          .from('menu_categories')
          .update({ display_order: index })
          .eq('id', category.id)
          .eq('establishment_id', establishmentId);
        if (updateError) throw updateError;
      }

      const orderedItems = normalizeItemOrder(items);
      const grouped = new Map<string, MenuItem[]>();
      for (const item of orderedItems) {
        const group = grouped.get(item.category_id) ?? [];
        group.push(item);
        grouped.set(item.category_id, group);
      }

      for (const group of grouped.values()) {
        for (let index = 0; index < group.length; index += 1) {
          const item = group[index];
          const { error: updateError } = await supabase
            .from('menu_items')
            .update({ display_order: index })
            .eq('id', item.id)
            .eq('establishment_id', establishmentId);
          if (updateError) throw updateError;
        }
      }

      await load();
      console.log('[MenuManager] REINDEX SUCCESS:', { establishmentId });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Impossible de réindexer le menu.';
      console.error('[MenuManager] REINDEX ERROR:', cause);
      setError(message);
    } finally {
      setSaving(false);
    }
  }, [categories, establishmentId, items, load]);

  const addCategory = useCallback(async (input: NewCategory) => {
    if (!establishmentId) throw new Error('Établissement requis.');
    const name = input.name.trim();
    if (!name) throw new Error('Le nom de la catégorie est requis.');

    setSaving(true);
    setError(null);
    try {
      const maxOrder = categories.reduce((max, category) => Math.max(max, category.display_order), -1);
      const { data, error: insertError } = await supabase
        .from('menu_categories')
        .insert({
          establishment_id: establishmentId,
          name,
          description: input.description?.trim() || null,
          display_order: maxOrder + 1,
          active: input.active ?? true,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;
      setCategories((current) => normalizeCategoryOrder([...current, data as MenuCategory]));
      console.log('[MenuManager] CATEGORY CREATE SUCCESS:', data);
      return data as MenuCategory;
    } finally {
      setSaving(false);
    }
  }, [categories, establishmentId]);

  const addItem = useCallback(async (input: NewItem) => {
    if (!establishmentId) throw new Error('Établissement requis.');
    if (!input.category_id) throw new Error('Une catégorie est requise.');

    const category = categories.find((entry) => entry.id === input.category_id);
    if (!category || !category.active) throw new Error('La catégorie sélectionnée doit être active.');

    const name = input.name.trim();
    if (!name) throw new Error('Le nom du produit est requis.');

    setSaving(true);
    setError(null);
    try {
      const siblings = items.filter((item) => item.category_id === input.category_id);
      const maxOrder = siblings.reduce((max, item) => Math.max(max, item.display_order), -1);

      const { data, error: insertError } = await supabase
        .from('menu_items')
        .insert({
          establishment_id: establishmentId,
          category_id: input.category_id,
          name,
          description: input.description?.trim() || null,
          price: Number(input.price),
          image_url: input.image_url ?? null,
          display_order: maxOrder + 1,
          active: input.active ?? true,
        })
        .select('*')
        .single();

      if (insertError) throw insertError;
      setItems((current) => normalizeItemOrder([...current, data as MenuItem]));
      console.log('[MenuManager] ITEM CREATE SUCCESS:', data);
      return data as MenuItem;
    } finally {
      setSaving(false);
    }
  }, [categories, establishmentId, items]);

  return {
    categories,
    items,
    itemsByCategory,
    loading,
    saving,
    error,
    reload: load,
    reindexAll,
    addCategory,
    addItem,
  };
}
