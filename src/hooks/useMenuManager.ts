import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export type MenuCategory = {
  id: string; establishment_id: string; name: string; description: string | null;
  display_order: number; active: boolean; created_at: string; updated_at: string;
};
export type MenuItem = {
  id: string; establishment_id: string; category_id: string; name: string;
  description: string | null; price: number; image_url: string | null;
  display_order: number; active: boolean; created_at: string; updated_at: string;
};
type NewCategory = { name: string; description?: string | null; active?: boolean };
type NewItem = { category_id: string; name: string; description?: string | null; price: number; image_url?: string | null; active?: boolean };
type UpdateCategory = Partial<NewCategory>;
type UpdateItem = Partial<Omit<NewItem, 'category_id'>> & { category_id?: string };

const normalizeCategoryOrder = (rows: MenuCategory[]) =>
  [...rows].sort((a,b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));
const normalizeItemOrder = (rows: MenuItem[]) =>
  [...rows].sort((a,b) => a.display_order - b.display_order || a.created_at.localeCompare(b.created_at));
const normalizeCategoryName = (name: string) => name.trim().replace(/\s+/g, ' ').toLocaleLowerCase();

export function useMenuManager(establishmentId: string | null) {
  const mutationVersionRef = useRef(0); // stale-load guard
  const [categories,setCategories] = useState<MenuCategory[]>([]);
  const [items,setItems] = useState<MenuItem[]>([]);
  const [loading,setLoading] = useState(false);
  const [saving,setSaving] = useState(false);
  const [error,setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!establishmentId) { setCategories([]); setItems([]); return; }
    setLoading(true); setError(null);
    const loadVersion = mutationVersionRef.current;
    try {
      const [{data: categoryRows,error: categoryError},{data:itemRows,error:itemError}] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('establishment_id',establishmentId).order('display_order'),
        supabase.from('menu_items').select('*').eq('establishment_id',establishmentId).order('display_order'),
      ]);
      if (categoryError) throw categoryError;
      if (itemError) throw itemError;
      if (loadVersion !== mutationVersionRef.current) {
        console.log('[MenuManager] LOAD IGNORED: stale snapshot after mutation', {
          establishmentId,
          loadVersion,
          currentVersion: mutationVersionRef.current,
        });
        return;
      }
      const nextCategories=normalizeCategoryOrder((categoryRows??[]) as MenuCategory[]);
      const nextItems=normalizeItemOrder((itemRows??[]) as MenuItem[]);
      setCategories(nextCategories); setItems(nextItems);
      console.log('[MenuManager] LOAD SUCCESS:',{establishmentId,categories:nextCategories.length,items:nextItems.length});
    } catch(cause) {
      const message=cause instanceof Error?cause.message:'Impossible de charger le menu.';
      setError(message); console.error('[MenuManager] LOAD ERROR:',cause);
    } finally { setLoading(false); }
  },[establishmentId]);

  useEffect(()=>{ void load(); },[load]);

  const itemsByCategory=useMemo(()=>{
    const grouped:Record<string,MenuItem[]>={};
    for(const category of categories) grouped[category.id]=[];
    for(const item of items) if(grouped[item.category_id]) grouped[item.category_id].push(item);
    for(const id of Object.keys(grouped)) grouped[id]=normalizeItemOrder(grouped[id]);
    return grouped;
  },[categories,items]);

  const reindexCategory=useCallback(async(categoryId:string,sourceItems:MenuItem[])=>{
    const group=normalizeItemOrder(sourceItems.filter(item=>item.category_id===categoryId));
    for(let index=0;index<group.length;index++) {
      const {error:updateError}=await supabase.from('menu_items').update({display_order:index})
        .eq('id',group[index].id).eq('establishment_id',establishmentId);
      if(updateError) throw updateError;
    }
  },[establishmentId]);

  const reindexAll=useCallback(async()=>{
    console.log('[HOOK] Executing reindexAll()', { establishmentId, categories: categories.length, items: items.length });
    if(!establishmentId)return;
    mutationVersionRef.current += 1;
    setSaving(true);setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('reindex_menu', {
        p_establishment_id: establishmentId,
      });
      if(rpcError)throw rpcError;
      await load();
      console.log('[HOOK] Result: REINDEX -> SUCCESS', data);
      console.log('[MenuManager] ACTION: REINDEX -> RESULT: SUCCESS (Server transaction)', data);
    } catch(cause) {
      setError(cause instanceof Error?cause.message:'Impossible de réindexer le menu.');
      console.error('[HOOK] Result: REINDEX -> ERROR', cause);
      console.error('[MenuManager] ACTION: REINDEX -> RESULT: ERROR',cause);
      throw cause;
    } finally { setSaving(false); }
  },[categories.length,establishmentId,items.length,load]);

  const addCategory=useCallback(async(input:NewCategory)=>{
    console.log('[HOOK] Executing addCategory()', { establishmentId, input });
    if(!establishmentId)throw new Error('Établissement requis.');
    const name=input.name.trim(); if(!name)throw new Error('Le nom de la catégorie est requis.');
    const normalizedName=normalizeCategoryName(name);
    if(categories.some(category=>normalizeCategoryName(category.name)===normalizedName)) {
      throw new Error(`La catégorie « ${name} » existe déjà.`);
    }
    mutationVersionRef.current += 1;
    setSaving(true);setError(null);
    try {
      const maxOrder=categories.reduce((max,c)=>Math.max(max,c.display_order),-1);
      const {data,error:e}=await supabase.from('menu_categories').insert({
        establishment_id:establishmentId,name,description:input.description?.trim()||null,
        display_order:maxOrder+1,active:input.active??true
      }).select('*').single();
      if(e)throw e;
      setCategories(rows=>normalizeCategoryOrder([...rows,data as MenuCategory]));
      console.log('[HOOK] Result: ADD_CATEGORY -> SUCCESS', { id: (data as MenuCategory).id, display_order: (data as MenuCategory).display_order });
      console.log('[MenuManager] ACTION: CREATE_CATEGORY -> RESULT: SUCCESS (Pos:',(data as MenuCategory).display_order,')');
      return data as MenuCategory;
    } catch(cause){setError(cause instanceof Error?cause.message:'Impossible de créer la catégorie.');console.error('[MenuManager] CATEGORY CREATE ERROR:',cause);throw cause;}
    finally{setSaving(false);}
  },[categories,establishmentId]);

  const updateCategory=useCallback(async(categoryId:string,input:UpdateCategory)=>{
    if(!establishmentId)throw new Error('Établissement requis.');
    const current=categories.find(c=>c.id===categoryId);if(!current)throw new Error('Catégorie introuvable.');
    const name=input.name===undefined?current.name:input.name.trim();if(!name)throw new Error('Le nom de la catégorie est requis.');
    const normalizedName=normalizeCategoryName(name);
    if(categories.some(category=>category.id!==categoryId&&normalizeCategoryName(category.name)===normalizedName)) {
      throw new Error(`La catégorie « ${name} » existe déjà.`);
    }
    mutationVersionRef.current += 1;
    setSaving(true);setError(null);
    try{
      const {data,error:e}=await supabase.from('menu_categories').update({
        name,description:input.description===undefined?current.description:input.description?.trim()||null,
        active:input.active===undefined?current.active:input.active
      }).eq('id',categoryId).eq('establishment_id',establishmentId).select('*').single();
      if(e)throw e;setCategories(rows=>normalizeCategoryOrder(rows.map(r=>r.id===categoryId?data as MenuCategory:r)));
      console.log('[MenuManager] ACTION: UPDATE_CATEGORY -> RESULT: SUCCESS',{categoryId});return data as MenuCategory;
    }catch(cause){setError(cause instanceof Error?cause.message:'Impossible de modifier la catégorie.');console.error('[MenuManager] CATEGORY UPDATE ERROR:',cause);throw cause;}
    finally{setSaving(false);}
  },[categories,establishmentId]);

  const toggleCategoryActive=useCallback(async(categoryId:string)=>{
    const category=categories.find(c=>c.id===categoryId);if(!category)throw new Error('Catégorie introuvable.');
    return updateCategory(categoryId,{active:!category.active});
  },[categories,updateCategory]);

  const deleteCategory=useCallback(async(categoryId:string,action:'move'|'delete'='delete',destinationCategoryId?:string)=>{
    console.log('[HOOK] Executing deleteCategory()', { establishmentId, categoryId, action, destinationCategoryId });
    if(!establishmentId)throw new Error('Établissement requis.');
    const category=categories.find(c=>c.id===categoryId);
    if(!category)throw new Error('Catégorie introuvable.');
    const categoryItems=items.filter(i=>i.category_id===categoryId);

    if(action==='move'){
      if(!destinationCategoryId)throw new Error('Catégorie destination requise.');
      const destination=categories.find(c=>c.id===destinationCategoryId);
      if(!destination||destination.id===categoryId)throw new Error('Catégorie destination invalide.');
      if(!destination.active)throw new Error('La catégorie destination doit être active.');
    }

    mutationVersionRef.current += 1;
    setSaving(true);setError(null);
    try{
      if(categoryItems.length>0){
        if(action==='move'){
          const {error:e}=await supabase.from('menu_items').update({category_id:destinationCategoryId!})
            .eq('establishment_id',establishmentId).eq('category_id',categoryId);
          if(e)throw e;
        }else{
          const {error:e}=await supabase.from('menu_items').delete()
            .eq('establishment_id',establishmentId).eq('category_id',categoryId);
          if(e)throw e;
        }
      }

      const {error:e}=await supabase.from('menu_categories').delete()
        .eq('id',categoryId).eq('establishment_id',establishmentId);
      if(e)throw e;

      mutationVersionRef.current += 1;
      await reindexAll();

      if(action==='move'){
        setItems(rows=>rows.map(item=>item.category_id===categoryId?{...item,category_id:destinationCategoryId!}:item));
      }else{
        setItems(rows=>rows.filter(item=>item.category_id!==categoryId));
      }
      setCategories(rows=>rows.filter(row=>row.id!==categoryId));

      console.log('[HOOK] Result: DELETE_CATEGORY -> SUCCESS', { categoryId, action, itemsAffected: categoryItems.length });
      console.log('[MenuManager] ACTION: DELETE_CATEGORY -> RESULT: SUCCESS',{categoryId,action,itemsAffected:categoryItems.length});
      return true;
    }catch(cause){
      setError(cause instanceof Error?cause.message:'Impossible de supprimer la catégorie.');
      console.error('[MenuManager] CATEGORY DELETE ERROR:',cause);
      await load();
      throw cause;
    }finally{setSaving(false);}
  },[categories,establishmentId,items,load,reindexAll]);

  const addItem=useCallback(async(input:NewItem)=>{
    if(!establishmentId)throw new Error('Établissement requis.');
    const category=categories.find(c=>c.id===input.category_id);if(!category||!category.active)throw new Error('La catégorie sélectionnée doit être active.');
    const name=input.name.trim();const price=Number(input.price);
    if(!name)throw new Error('Le nom du produit est requis.');
    if(!Number.isFinite(price)||price<0)throw new Error('Le prix doit être un nombre positif ou nul.');
    mutationVersionRef.current += 1;
    setSaving(true);setError(null);
    try{
      const maxOrder=items.filter(i=>i.category_id===input.category_id).reduce((max,i)=>Math.max(max,i.display_order),-1);
      const {data,error:e}=await supabase.from('menu_items').insert({
        establishment_id:establishmentId,category_id:input.category_id,name,description:input.description?.trim()||null,
        price,image_url:input.image_url??null,display_order:maxOrder+1,active:input.active??true
      }).select('*').single();
      if(e)throw e;setItems(rows=>normalizeItemOrder([...rows,data as MenuItem]));
      console.log('[MenuManager] ACTION: CREATE_ITEM -> RESULT: SUCCESS (Pos:',(data as MenuItem).display_order,')');return data as MenuItem;
    }catch(cause){setError(cause instanceof Error?cause.message:'Impossible de créer l’article.');console.error('[MenuManager] ITEM CREATE ERROR:',cause);throw cause;}
    finally{setSaving(false);}
  },[categories,establishmentId,items]);

  const updateItem=useCallback(async(itemId:string,input:UpdateItem)=>{
    if(!establishmentId)throw new Error('Établissement requis.');
    const current=items.find(i=>i.id===itemId);if(!current)throw new Error('Article introuvable.');
    if(input.category_id!==undefined)throw new Error('Utilisez moveItem pour changer la catégorie d’un article.');
    const category=categories.find(c=>c.id===current.category_id);if(!category||!category.active)throw new Error('La catégorie de l’article doit être active.');
    const name=input.name===undefined?current.name:input.name.trim();const price=input.price===undefined?current.price:Number(input.price);
    if(!name)throw new Error('Le nom du produit est requis.');if(!Number.isFinite(price)||price<0)throw new Error('Le prix doit être un nombre positif ou nul.');
    mutationVersionRef.current += 1;
    setSaving(true);setError(null);
    try{
      const {data,error:e}=await supabase.from('menu_items').update({
        name,description:input.description===undefined?current.description:input.description?.trim()||null,
        price,image_url:input.image_url===undefined?current.image_url:input.image_url,
        active:input.active===undefined?current.active:input.active
      }).eq('id',itemId).eq('establishment_id',establishmentId).select('*').single();
      if(e)throw e;setItems(rows=>normalizeItemOrder(rows.map(r=>r.id===itemId?data as MenuItem:r)));
      console.log('[MenuManager] ACTION: UPDATE_ITEM -> RESULT: SUCCESS',{itemId});return data as MenuItem;
    }catch(cause){setError(cause instanceof Error?cause.message:'Impossible de modifier l’article.');console.error('[MenuManager] ITEM UPDATE ERROR:',cause);throw cause;}
    finally{setSaving(false);}
  },[categories,establishmentId,items]);

  const moveItem=useCallback(async(itemId:string,destinationCategoryId:string)=>{
    if(!establishmentId)throw new Error('Établissement requis.');
    const item=items.find(i=>i.id===itemId);const source=item&&categories.find(c=>c.id===item.category_id);const destination=categories.find(c=>c.id===destinationCategoryId);
    if(!item||!source||!destination)throw new Error('Article ou catégorie introuvable.');
    if(!destination.active)throw new Error('La catégorie destination doit être active.');
    if(item.category_id===destinationCategoryId)return item;
    mutationVersionRef.current += 1;
    setSaving(true);setError(null);
    try{
      const maxOrder=items.filter(i=>i.category_id===destinationCategoryId).reduce((max,i)=>Math.max(max,i.display_order),-1);
      const {data,error:e}=await supabase.from('menu_items').update({category_id:destinationCategoryId,display_order:maxOrder+1})
        .eq('id',itemId).eq('establishment_id',establishmentId).select('*').single();
      if(e)throw e;
      const nextItems=items.map(i=>i.id===itemId?data as MenuItem:i);
      await reindexCategory(source.id,nextItems);await reindexCategory(destination.id,nextItems);await load();
      const finalPosition=nextItems.filter(i=>i.category_id===destinationCategoryId).length-1;
      const finalItem={...(data as MenuItem),display_order:finalPosition};
      console.log('[MenuManager] ACTION: MOVE_ITEM -> RESULT: SUCCESS (Pos:',finalPosition,')');return finalItem;
    }catch(cause){setError(cause instanceof Error?cause.message:'Impossible de déplacer l’article.');console.error('[MenuManager] MOVE ITEM ERROR:',cause);await load();throw cause;}
    finally{setSaving(false);}
  },[categories,establishmentId,items,load,reindexCategory]);

  const toggleItemActive=useCallback(async(itemId:string)=>{
    const item=items.find(i=>i.id===itemId);if(!item)throw new Error('Article introuvable.');
    return updateItem(itemId,{active:!item.active});
  },[items,updateItem]);

  const deleteItem=useCallback(async(itemId:string)=>{
    if(!establishmentId)throw new Error('Établissement requis.');
    const item=items.find(i=>i.id===itemId);if(!item)throw new Error('Article introuvable.');
    mutationVersionRef.current += 1;
    setSaving(true);setError(null);
    try{
      const {error:e}=await supabase.from('menu_items').delete().eq('id',itemId).eq('establishment_id',establishmentId);if(e)throw e;
      await reindexCategory(item.category_id,items.filter(i=>i.id!==itemId));await load();
      console.log('[MenuManager] ACTION: DELETE_ITEM -> RESULT: SUCCESS',{itemId});return true;
    }catch(cause){setError(cause instanceof Error?cause.message:'Impossible de supprimer l’article.');console.error('[MenuManager] DELETE ITEM ERROR:',cause);await load();throw cause;}
    finally{setSaving(false);}
  },[establishmentId,items,load,reindexCategory]);

  return {categories,items,itemsByCategory,loading,saving,error,reload:load,reindexAll,addCategory,updateCategory,deleteCategory,toggleCategoryActive,addItem,updateItem,moveItem,deleteItem,toggleItemActive};
}
