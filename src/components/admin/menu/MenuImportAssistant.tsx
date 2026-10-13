import { useRef, useState } from 'react';
import { FileUp, Loader2, ScanText, CheckCircle2, AlertCircle, Trash2, Plus, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { MenuCategory, MenuItem } from '@/hooks/useMenuManager';

type ImportedItem = { name: string; description: string | null; price: number };
type ImportedCategory = { name: string; description: string | null; items: ImportedItem[] };
type ImportMenuResult = { categories: ImportedCategory[] };

type Props = {
  establishmentId: string;
  categories: MenuCategory[];
  items: MenuItem[];
  onAddCategory: (input: { name: string; description?: string | null }) => Promise<MenuCategory>;
  onAddItem: (input: { category_id: string; name: string; description?: string | null; price: number; image_url?: string | null }) => Promise<MenuItem>;
};

const ACCEPTED = '.pdf,.png,.jpg,.jpeg,.webp';
const MAX_FILES = 10;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const normalize = (value: string) => value.trim().replace(/\\s+/g, ' ').toLocaleLowerCase();

export default function MenuImportAssistant({ establishmentId, categories, items, onAddCategory, onAddItem }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [draft, setDraft] = useState<ImportMenuResult | null>(null);

  const chooseFiles = (selected: FileList | null) => {
    if (!selected) return;
    const next = Array.from(selected);
    setError('');
    setNotice('');
    setDraft(null);
    if (next.length > MAX_FILES) {
      setError(`Tu peux importer jusqu’à ${MAX_FILES} fichiers à la fois.`);
      return;
    }
    const oversized = next.find(candidate => candidate.size > MAX_FILE_SIZE);
    if (oversized) {
      setError(`Le fichier « ${oversized.name} » dépasse la limite de 20 Mo.`);
      return;
    }
    setFiles(next);
  };

  const analyze = async () => {
    if (!files.length || busy) return;
    setBusy(true); setError(''); setNotice(''); setDraft(null);
    try {
      const combined: ImportedCategory[] = [];
      for (const file of files) {
        const form = new FormData();
        form.append('file', file, file.name);
        form.append('establishment_id', establishmentId);
        const { data, error: invokeError } = await supabase.functions.invoke('import-menu', { body: form });
        if (invokeError) throw new Error(`${file.name} : ${invokeError.message}`);
        if (!data?.success || !Array.isArray(data?.menu?.categories)) {
          throw new Error(`${file.name} : ${data?.error || 'aucun menu exploitable détecté.'}`);
        }
        for (const rawCategory of data.menu.categories as ImportedCategory[]) {
          const name = String(rawCategory.name ?? '').trim();
          if (!name) continue;
          const key = normalize(name);
          let target = combined.find(category => normalize(category.name) === key);
          if (!target) {
            target = { name, description: rawCategory.description ? String(rawCategory.description).trim() : null, items: [] };
            combined.push(target);
          } else if (!target.description && rawCategory.description) {
            target.description = String(rawCategory.description).trim();
          }
          for (const rawItem of Array.isArray(rawCategory.items) ? rawCategory.items : []) {
            const itemName = String(rawItem.name ?? '').trim();
            if (!itemName) continue;
            const itemKey = normalize(itemName);
            const existing = target.items.find(item => normalize(item.name) === itemKey && item.price === Number(rawItem.price));
            if (!existing) target.items.push({
              name: itemName,
              description: rawItem.description ? String(rawItem.description).trim() : null,
              price: Number.isFinite(Number(rawItem.price)) && Number(rawItem.price) >= 0 ? Number(rawItem.price) : 0,
            });
          }
        }
      }
      if (!combined.length) throw new Error('Aucune catégorie n’a été détectée. Essaie avec un PDF plus net ou des photos prises bien de face.');
      setDraft({ categories: combined });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'L’analyse du menu a échoué.');
    } finally { setBusy(false); }
  };

  const updateCategory = (index: number, patch: Partial<ImportedCategory>) => setDraft(current => current ? ({
    categories: current.categories.map((category, i) => i === index ? { ...category, ...patch } : category),
  }) : current);

  const updateItem = (categoryIndex: number, itemIndex: number, patch: Partial<ImportedItem>) => setDraft(current => current ? ({
    categories: current.categories.map((category, i) => i === categoryIndex ? {
      ...category, items: category.items.map((item, j) => j === itemIndex ? { ...item, ...patch } : item),
    } : category),
  }) : current);

  const importDraft = async () => {
    if (!draft || saving) return;
    setSaving(true); setError(''); setNotice('');
    let categoryCount = 0; let itemCount = 0;
    try {
      const knownCategories = new Map(categories.map(category => [normalize(category.name), category]));
      const knownItems = new Set(items.map(item => `${item.category_id}::${normalize(item.name)}`));
      for (const importedCategory of draft.categories) {
        const name = importedCategory.name.trim();
        if (!name) continue;
        const key = normalize(name);
        const existing = knownCategories.get(key);
        let category = existing;
        if (!category) {
          category = await onAddCategory({ name, description: importedCategory.description });
          categoryCount++;
          knownCategories.set(key, category);
        }
        if (!category.active) {
          throw new Error(`La catégorie « ${category.name} » existe mais est désactivée. Active-la avant d’y importer ses produits.`);
        }
        for (const importedItem of importedCategory.items) {
          const itemName = importedItem.name.trim();
          if (!itemName) continue;
          const itemKey = `${category.id}::${normalize(itemName)}`;
          if (knownItems.has(itemKey)) continue;
          await onAddItem({
            category_id: category.id,
            name: itemName,
            description: importedItem.description,
            price: Number.isFinite(importedItem.price) && importedItem.price >= 0 ? importedItem.price : 0,
          });
          knownItems.add(itemKey);
          itemCount++;
        }
      }
      setNotice(`Import terminé : ${categoryCount} nouvelle(s) catégorie(s) et ${itemCount} produit(s) ajouté(s). Les éléments déjà présents ont été conservés.`);
      setDraft(null); setFiles([]);
      if (inputRef.current) inputRef.current.value = '';
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Import incomplet. Vérifie les éléments enregistrés avant de relancer.');
      setNotice(`Import partiel : ${categoryCount} nouvelle(s) catégorie(s), ${itemCount} produit(s) enregistré(s). Vérifie le menu avant de relancer.`);
    } finally { setSaving(false); }
  };

  const productCount = draft?.categories.reduce((total, category) => total + category.items.length, 0) ?? 0;

  return (
    <section className="rounded-3xl border border-gold/20 bg-[#111111] p-4 text-white shadow-soft sm:p-5">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/10 text-gold"><ScanText size={21} /></div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.18em] text-gold">Import intelligent · IA</p>
          <h3 className="mt-1 text-lg font-semibold">Récupérer un menu existant</h3>
          <p className="mt-1 text-xs leading-5 text-white/50">Ajoute plusieurs photos ou un PDF. L’IA extrait les catégories, produits, descriptions et prix. Tu vérifies les résultats avant de les enregistrer.</p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-dashed border-white/15 bg-white/[.025] p-4">
        <input ref={inputRef} type="file" accept={ACCEPTED} multiple className="hidden" onChange={event => chooseFiles(event.target.files)} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={busy || saving} className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[.05] px-4 py-3 text-sm font-semibold hover:bg-white/[.08] disabled:opacity-50">
          <FileUp size={17} /> {files.length ? `${files.length} fichier(s) sélectionné(s)` : 'Choisir photos ou PDF'}
        </button>
        <p className="mt-2 text-center text-[10px] text-white/35">PDF, JPG, PNG ou WebP · 10 fichiers maximum · 20 Mo par fichier</p>
        {files.length > 0 && <div className="mt-3 space-y-1.5">
          {files.map((file, index) => <div key={`${file.name}-${index}`} className="flex items-center gap-2 rounded-lg bg-white/[.04] px-3 py-2 text-xs">
            <span className="min-w-0 flex-1 truncate text-white/75">{file.name}</span>
            <span className="shrink-0 text-white/35">{(file.size / (1024 * 1024)).toFixed(1)} Mo</span>
            <button type="button" aria-label={`Retirer ${file.name}`} disabled={busy || saving} onClick={() => setFiles(current => current.filter((_, i) => i !== index))} className="text-white/40 hover:text-red-300"><X size={14}/></button>
          </div>)}
        </div>}
        <button type="button" onClick={() => void analyze()} disabled={!files.length || busy || saving} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-[#111] disabled:opacity-40">
          {busy ? <Loader2 size={16} className="animate-spin" /> : <ScanText size={16} />}
          {busy ? 'Analyse des fichiers en cours…' : 'Analyser avec l’IA'}
        </button>
      </div>

      {error && <div className="mt-3 flex gap-2 rounded-xl border border-red-400/20 bg-red-500/10 p-3 text-xs text-red-200"><AlertCircle size={15} className="shrink-0" />{error}</div>}
      {notice && <div className="mt-3 flex gap-2 rounded-xl border border-emerald-400/20 bg-emerald-500/10 p-3 text-xs text-emerald-200"><CheckCircle2 size={15} className="shrink-0" />{notice}</div>}

      {draft && (
        <div className="mt-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div><h4 className="text-sm font-semibold">Vérifier l’extraction</h4><p className="mt-1 text-[10px] text-white/40">{draft.categories.length} catégories · {productCount} produits détectés</p></div>
            <button type="button" onClick={() => setDraft(null)} className="text-xs text-white/40 underline">Annuler</button>
          </div>
          <p className="rounded-xl bg-amber-400/10 p-3 text-[11px] leading-5 text-amber-100/80">Vérifie les prix avant l’enregistrement. Un prix absent ou illisible peut être extrait à 0.</p>
          {draft.categories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="rounded-2xl border border-white/10 p-3 sm:p-4">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1 space-y-2">
                  <input aria-label="Nom de catégorie" value={category.name} onChange={e => updateCategory(categoryIndex,{name:e.target.value})} className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-sm font-semibold outline-none focus:border-gold" />
                  <input aria-label="Description de catégorie" value={category.description ?? ''} onChange={e => updateCategory(categoryIndex,{description:e.target.value || null})} placeholder="Description de catégorie (facultative)" className="w-full rounded-lg border border-white/10 bg-white/[.04] px-3 py-2 text-xs outline-none focus:border-gold" />
                </div>
                <button type="button" aria-label="Supprimer la catégorie" onClick={() => setDraft(current => current ? ({categories:current.categories.filter((_,i)=>i!==categoryIndex)}) : current)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-white/40 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={15}/></button>
              </div>
              <div className="mt-3 space-y-2">
                {category.items.map((item,itemIndex) => (
                  <div key={itemIndex} className="grid grid-cols-[minmax(0,1fr)_88px_32px] gap-2">
                    <div className="min-w-0 space-y-1.5">
                      <input aria-label="Nom du produit" value={item.name} onChange={e=>updateItem(categoryIndex,itemIndex,{name:e.target.value})} className="w-full rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-2 text-xs outline-none focus:border-gold" />
                      <input aria-label="Description du produit" value={item.description ?? ''} onChange={e=>updateItem(categoryIndex,itemIndex,{description:e.target.value || null})} placeholder="Description (facultative)" className="w-full rounded-lg border border-white/10 bg-white/[.04] px-2.5 py-2 text-[10px] outline-none focus:border-gold" />
                    </div>
                    <label className="text-[9px] text-white/40">Prix
                      <input type="number" min="0" step="0.01" aria-label="Prix du produit" value={item.price} onChange={e=>updateItem(categoryIndex,itemIndex,{price:Math.max(0,Number(e.target.value))})} className="mt-1 w-full rounded-lg border border-white/10 bg-white/[.04] px-2 py-2 text-xs text-white outline-none focus:border-gold" />
                    </label>
                    <button type="button" aria-label="Supprimer le produit" onClick={() => updateCategory(categoryIndex,{items:category.items.filter((_,i)=>i!==itemIndex)})} className="mt-4 grid h-8 w-8 place-items-center rounded-lg text-white/40 hover:bg-red-500/10 hover:text-red-300"><Trash2 size={14}/></button>
                  </div>
                ))}
                <button type="button" onClick={() => updateCategory(categoryIndex,{items:[...category.items,{name:'Nouveau produit',description:null,price:0}]})} className="inline-flex items-center gap-1.5 py-1 text-[10px] font-semibold text-gold"><Plus size={12}/> Ajouter un produit</button>
              </div>
            </div>
          ))}
          <button type="button" onClick={() => setDraft(current => current ? ({categories:[...current.categories,{name:'Nouvelle catégorie',description:null,items:[]}]}) : current)} className="inline-flex items-center gap-2 text-xs font-semibold text-gold"><Plus size={14}/> Ajouter une catégorie</button>
          <button type="button" onClick={() => void importDraft()} disabled={saving || !draft.categories.length} className="flex w-full items-center justify-center gap-2 rounded-xl bg-gold px-4 py-3 text-sm font-bold text-[#111] disabled:opacity-40">
            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16}/>}
            {saving ? 'Enregistrement…' : 'Confirmer et ajouter au menu'}
          </button>
        </div>
      )}
    </section>
  );
}
