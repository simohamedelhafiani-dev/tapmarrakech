import { useEffect, useState } from 'react';
import { Check, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';

type ItemManagerProps = {
  establishmentId: string;
  categories: MenuCategory[];
  itemsByCategory: Record<string, MenuItem[]>;
  saving: boolean;
  onAdd: (input: { category_id: string; name: string; description?: string | null; price: number; image_url?: string | null; active?: boolean }) => Promise<MenuItem>;
  onUpdate: (itemId: string, input: { name?: string; description?: string | null; price?: number; image_url?: string | null; active?: boolean }) => Promise<MenuItem>;
  onMove: (itemId: string, categoryId: string) => Promise<MenuItem>;
  onToggleActive: (itemId: string) => Promise<MenuItem>;
  onDelete: (itemId: string) => Promise<boolean>;
};

export default function ItemManager({ establishmentId, categories, itemsByCategory, saving, onAdd, onUpdate, onMove, onToggleActive, onDelete }: ItemManagerProps) {
  const activeCategories = categories.filter(c => c.active);
  const [selectedCategoryId, setSelectedCategoryId] = useState(activeCategories[0]?.id ?? '');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', price: '', image_url: '' });
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const selectedItems = selectedCategoryId ? (itemsByCategory[selectedCategoryId] ?? []) : [];

  useEffect(() => {
    if (!activeCategories.length) {
      setSelectedCategoryId('');
      return;
    }
    if (!activeCategories.some(category => category.id === selectedCategoryId)) {
      setSelectedCategoryId(activeCategories[0].id);
      setEditingId(null);
      setAdding(false);
    }
  }, [activeCategories, selectedCategoryId]);

  const reset = () => { setEditingId(null); setAdding(false); setForm({ name: '', description: '', price: '', image_url: '' }); };
  const startEdit = (item: MenuItem) => { setEditingId(item.id); setAdding(false); setSelectedCategoryId(item.category_id); setForm({ name: item.name, description: item.description ?? '', price: String(item.price ?? ''), image_url: item.image_url ?? '' }); setError(null); };
  const upload = async (file: File) => {
    if (!editingId) { setError('Enregistre d’abord l’article avant d’ajouter une photo.'); return; }
    setUploading(true); setError(null);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      if (!['jpg', 'jpeg', 'png', 'webp'].includes(ext)) throw new Error('Format image accepté : JPG, PNG ou WebP.');
      if (file.size > 5 * 1024 * 1024) throw new Error('Image trop lourde : 5 Mo maximum.');
      const path = establishmentId + '/' + editingId + '-' + Date.now() + '.' + ext;
      const { error: uploadError } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '31536000' });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
      setForm(current => ({ ...current, image_url: data.publicUrl }));
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’envoyer la photo.'); }
    finally { setUploading(false); }
  };
  const save = async () => {
    setError(null);
    try {
      const name = form.name.trim(); const price = Number(form.price);
      if (!name) throw new Error('Le nom de l’article est obligatoire.');
      if (!Number.isFinite(price) || price < 0) throw new Error('Le prix doit être positif ou nul.');
      if (!selectedCategoryId) throw new Error('Sélectionne une catégorie active.');
      if (editingId) {
        const current = categories.flatMap(c => itemsByCategory[c.id] ?? []).find(i => i.id === editingId);
        if (!current) throw new Error('Article introuvable.');
        await onUpdate(editingId, { name, description: form.description, price, image_url: form.image_url || null });
        if (current.category_id !== selectedCategoryId) await onMove(editingId, selectedCategoryId);
      } else {
        await onAdd({ category_id: selectedCategoryId, name, description: form.description, price, image_url: form.image_url || null });
      }
      reset();
    } catch (e) { setError(e instanceof Error ? e.message : 'Impossible d’enregistrer l’article.'); }
  };
  return (
    <section className='rounded-3xl border border-ink/5 bg-white shadow-sm'>
      <div className='border-b border-ink/5 p-5 sm:p-6'>
        <p className='text-[10px] font-bold uppercase tracking-[0.18em] text-gold'>Gestionnaire</p>
        <h3 className='mt-1 text-xl font-semibold text-forest'>Articles</h3>
        <div className='mt-4 flex flex-col gap-3 sm:flex-row'>
          <select value={selectedCategoryId} onChange={e => { setSelectedCategoryId(e.target.value); reset(); }} className='flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm'>
            {activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button type='button' onClick={() => { reset(); setAdding(true); }} disabled={saving || !selectedCategoryId} className='inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white disabled:opacity-40'><Plus size={15} /> Ajouter un article</button>
        </div>
      </div>
      {error && <div className='mx-5 mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700'>{error}</div>}
      {(adding || editingId) && (
        <div className='mx-5 mt-5 rounded-2xl border border-forest/10 bg-white p-5 shadow-sm sm:mx-6'>
  <div className='flex items-center justify-between'><h4 className='text-sm font-semibold text-forest'>{editingId ? 'Modifier l’article' : 'Nouvel article'}</h4><button type='button' onClick={reset}><X size={16} /></button></div>
  <div className='mt-4 grid gap-3 md:grid-cols-2'>
    <input value={form.name} onChange={e => setForm({...form, name:e.target.value})} placeholder='Nom de l’article' className='rounded-xl border border-ink/10 px-4 py-3 text-sm' />
    <input value={form.price} onChange={e => setForm({...form, price:e.target.value})} placeholder='Prix (DH)' type='number' min='0' className='rounded-xl border border-ink/10 px-4 py-3 text-sm' />
    <textarea value={form.description} onChange={e => setForm({...form, description:e.target.value})} placeholder='Description' className='min-h-24 rounded-xl border border-ink/10 px-4 py-3 text-sm md:col-span-2' />
    <select value={selectedCategoryId} onChange={e => setSelectedCategoryId(e.target.value)} className='rounded-xl border border-ink/10 px-4 py-3 text-sm'>{activeCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
    {editingId && <input type='file' accept='image/png,image/jpeg,image/webp' onChange={e => e.target.files?.[0] && void upload(e.target.files[0])} disabled={uploading} className='rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs' />}
  </div>
  {form.image_url && <img src={form.image_url} alt='' className='mt-3 h-24 w-24 rounded-xl object-cover' />}
  <div className='mt-4 flex justify-end gap-2'><button type='button' onClick={reset} className='rounded-xl bg-[#f7f7f3] px-4 py-2.5 text-xs font-semibold'>Annuler</button><button type='button' onClick={() => void save()} disabled={saving || uploading} className='inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white'><Check size={14} /> Enregistrer</button></div>
        </div>
      )}

      <div className='space-y-2 p-5 sm:p-6'>
        {selectedItems.length === 0 && !adding && <div className='rounded-2xl border border-dashed border-ink/10 bg-[#f7f7f3] p-8 text-center text-xs text-ink/40'>Aucun article dans cette catégorie.</div>}
        {selectedItems.map((item, index) => <div key={item.id} className='flex flex-col gap-3 rounded-2xl border border-ink/5 bg-[#f7f7f3] p-4 md:flex-row md:items-center'>
          <div className='grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-xs font-bold text-forest'>{index + 1}</div>
          {item.image_url ? <img src={item.image_url} alt='' className='h-12 w-12 rounded-xl object-cover' /> : <div className='grid h-12 w-12 place-items-center rounded-xl bg-white text-ink/25'><ImagePlus size={17} /></div>}
          <div className='min-w-0 flex-1'><p className='truncate text-sm font-semibold text-forest'>{item.name}</p><p className='text-[11px] text-ink/40'>{item.price} DH · {item.active ? 'Actif' : 'Inactif'}</p>{item.description && <p className='mt-1 truncate text-xs text-ink/45'>{item.description}</p>}</div>
          <div className='flex gap-2'><button type='button' onClick={() => startEdit(item)} disabled={saving} className='inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-forest'><Pencil size={13} /> Modifier</button><button type='button' onClick={() => void onToggleActive(item.id)} disabled={saving} className={item.active ? 'rounded-full bg-green-100 px-3 py-1.5 text-[10px] font-semibold text-green-700' : 'rounded-full bg-ink/10 px-3 py-1.5 text-[10px] font-semibold text-ink/45'}>{item.active ? 'Actif' : 'Inactif'}</button><button type='button' onClick={() => void onDelete(item.id)} disabled={saving} className='grid h-8 w-8 place-items-center rounded-lg bg-white text-ink/35 hover:text-red-600'><Trash2 size={14} /></button></div>
        </div>)}

      </div>
    </section>
  );
}