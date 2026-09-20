import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Eye,
  LayoutTemplate,
  Menu,
  Pencil,
  Plus,
  Power,
  Save,
  Star,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type TemplateKind = 'page' | 'menu';

type Template = {
  id: string;
  kind: TemplateKind;
  name: string;
  description: string | null;
  thumbnail_url: string | null;
  config: Record<string, any>;
  active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
};

type Establishment = {
  id: string;
  name: string;
  page_template_id: string | null;
  menu_template_id: string | null;
};

const PAGE_PRESETS = [
  {
    label: 'Premium',
    config: {
      layout: 'premium',
      header: { showLogo: true, showRating: true, showDescription: true },
      actions: { showCall: true, showWhatsapp: true, showDirections: true, showReviews: true },
      modules: { style: 'cards', showIcons: true },
      navigation: { style: 'bottom' },
      theme: { primary: '#173F35', accent: '#C9A45C', background: '#F7F3EA', radius: 'xl' },
    },
  },
  {
    label: 'Minimal',
    config: {
      layout: 'minimal',
      header: { showLogo: true, showRating: true, showDescription: false },
      actions: { showCall: true, showWhatsapp: true, showDirections: true, showReviews: true },
      modules: { style: 'list', showIcons: false },
      navigation: { style: 'tabs' },
      theme: { primary: '#173F35', accent: '#C9A45C', background: '#FFFFFF', radius: 'lg' },
    },
  },
];

const MENU_PRESETS = [
  {
    label: 'Editorial Luxe',
    config: {
      layout: 'luxury',
      categoryStyle: 'editorial',
      itemStyle: 'editorial-list',
      showPhotos: false,
      showDescriptions: true,
      showPrices: true,
      showSearch: false,
      hero: { style: 'typographic', eyebrow: 'La carte', titleStyle: 'display' },
      theme: { primary: '#173F35', accent: '#C9A45C', background: '#F3EEE2' },
    },
  },
  {
    label: 'Maison Gastronomique',
    config: {
      layout: 'cards',
      categoryStyle: 'section-title',
      itemStyle: 'image-card',
      showPhotos: true,
      showDescriptions: true,
      showPrices: true,
      showSearch: false,
      hero: { style: 'image', overlay: true },
      theme: { primary: '#173F35', accent: '#C9A45C', background: '#F7F3EA' },
    },
  },
  {
    label: 'Immersive',
    config: {
      layout: 'immersive',
      categoryStyle: 'tabs',
      itemStyle: 'feature-card',
      showPhotos: true,
      showDescriptions: true,
      showPrices: true,
      showSearch: false,
      hero: { style: 'image', fullBleed: true },
      theme: { primary: '#173F35', accent: '#C9A45C', background: '#EBE5D8' },
    },
  },
  {
    label: 'Noir Signature',
    config: {
      layout: 'dark',
      categoryStyle: 'editorial',
      itemStyle: 'premium-list',
      showPhotos: true,
      showDescriptions: true,
      showPrices: true,
      showSearch: false,
      hero: { style: 'dark', accent: 'gold' },
      theme: { primary: '#102B24', accent: '#C9A45C', background: '#102B24' },
    },
  },
];

function prettyJson(value: Record<string, any>) {
  return JSON.stringify(value, null, 2);
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [kind, setKind] = useState<TemplateKind>('page');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Template | null>(null);
  const [previewing, setPreviewing] = useState<Template | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [configText, setConfigText] = useState('{}');
  const [active, setActive] = useState(true);
  const [isDefault, setIsDefault] = useState(false);

  const filteredTemplates = useMemo(
    () => templates.filter((template) => template.kind === kind),
    [templates, kind]
  );

  const load = async () => {
    setLoading(true);

    const [{ data: templateRows, error: templateError }, { data: establishmentRows, error: establishmentError }] =
      await Promise.all([
        supabase
          .from('templates')
          .select('id, kind, name, description, thumbnail_url, config, active, is_default, created_at, updated_at')
          .order('kind', { ascending: true })
          .order('created_at', { ascending: false }),
        supabase
          .from('establishments')
          .select('id, name, page_template_id, menu_template_id')
          .order('name', { ascending: true }),
      ]);

    if (templateError) {
      console.error(templateError);
      alert(`Impossible de charger les templates : ${templateError.message}`);
    }

    if (establishmentError) {
      console.error(establishmentError);
      alert(`Impossible de charger les établissements : ${establishmentError.message}`);
    }

    setTemplates((templateRows ?? []) as Template[]);
    setEstablishments((establishmentRows ?? []) as Establishment[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const resetForm = () => {
    setEditing(null);
    setName('');
    setDescription('');
    setThumbnailUrl('');
    setConfigText('{}');
    setActive(true);
    setIsDefault(false);
  };

  const startCreate = () => {
    resetForm();
    const preset = kind === 'page' ? PAGE_PRESETS[0] : MENU_PRESETS[0];
    setConfigText(prettyJson(preset.config));
    setName(kind === 'page' ? 'Nouveau template de page' : 'Nouveau template de menu');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEdit = (template: Template) => {
    setEditing(template);
    setKind(template.kind);
    setName(template.name);
    setDescription(template.description ?? '');
    setThumbnailUrl(template.thumbnail_url ?? '');
    setConfigText(prettyJson(template.config ?? {}));
    setActive(template.active);
    setIsDefault(template.is_default);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!name.trim()) {
      alert('Donne un nom au template.');
      return;
    }

    let config: Record<string, any>;

    try {
      config = JSON.parse(configText || '{}');
    } catch {
      alert('La configuration JSON est invalide.');
      return;
    }

    setSaving(true);

    if (isDefault) {
      await supabase
        .from('templates')
        .update({ is_default: false })
        .eq('kind', kind);
    }

    const payload = {
      kind,
      name: name.trim(),
      description: description.trim() || null,
      thumbnail_url: thumbnailUrl.trim() || null,
      config,
      active,
      is_default: isDefault,
      updated_at: new Date().toISOString(),
    };

    const result = editing
      ? await supabase.from('templates').update(payload).eq('id', editing.id)
      : await supabase.from('templates').insert(payload);

    setSaving(false);

    if (result.error) {
      console.error(result.error);
      alert(`Impossible d'enregistrer le template : ${result.error.message}`);
      return;
    }

    alert(editing ? 'Template modifié.' : 'Template créé.');
    resetForm();
    await load();
  };

  const duplicate = async (template: Template) => {
    const { error } = await supabase.from('templates').insert({
      kind: template.kind,
      name: `${template.name} — Copie`,
      description: template.description,
      thumbnail_url: template.thumbnail_url,
      config: template.config,
      active: false,
      is_default: false,
    });

    if (error) {
      alert(`Impossible de dupliquer : ${error.message}`);
      return;
    }

    await load();
  };

  const toggleActive = async (template: Template) => {
    const { error } = await supabase
      .from('templates')
      .update({ active: !template.active, updated_at: new Date().toISOString() })
      .eq('id', template.id);

    if (error) {
      alert(`Impossible de modifier le statut : ${error.message}`);
      return;
    }

    await load();
  };

  const makeDefault = async (template: Template) => {
    const { error: clearError } = await supabase
      .from('templates')
      .update({ is_default: false })
      .eq('kind', template.kind);

    if (clearError) {
      alert(`Impossible de définir le défaut : ${clearError.message}`);
      return;
    }

    const { error } = await supabase
      .from('templates')
      .update({ is_default: true, active: true, updated_at: new Date().toISOString() })
      .eq('id', template.id);

    if (error) {
      alert(`Impossible de définir le défaut : ${error.message}`);
      return;
    }

    await load();
  };

  const remove = async (template: Template) => {
    const usedBy = establishments.filter(
      (establishment) =>
        establishment.page_template_id === template.id ||
        establishment.menu_template_id === template.id
    );

    if (usedBy.length > 0) {
      alert(
        `Ce template est utilisé par ${usedBy.length} établissement(s). Désaffecte-le d'abord avant de le supprimer.`
      );
      return;
    }

    if (!window.confirm(`Supprimer « ${template.name} » ?`)) return;

    const { error } = await supabase.from('templates').delete().eq('id', template.id);

    if (error) {
      alert(`Impossible de supprimer : ${error.message}`);
      return;
    }

    await load();
  };

  const assign = async (establishmentId: string, templateId: string) => {
    const column = kind === 'page' ? 'page_template_id' : 'menu_template_id';

    const { error } = await supabase
      .from('establishments')
      .update({ [column]: templateId || null })
      .eq('id', establishmentId);

    if (error) {
      alert(`Impossible d'affecter le template : ${error.message}`);
      return;
    }

    await load();
  };

  const currentColumn = kind === 'page' ? 'page_template_id' : 'menu_template_id';

  return (
    <div className="space-y-8">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            Personnalisation
          </p>
          <h1 className="mt-1 font-display text-3xl text-forest">Templates</h1>
          <p className="mt-2 max-w-3xl text-sm text-ink/50">
            Crée et gère les présentations publiques de TapMarrakech sans modifier le code.
          </p>
        </div>

        <button
          onClick={startCreate}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-forest/90"
        >
          <Plus size={17} />
          Nouveau template
        </button>
      </div>

      <div className="flex gap-2 rounded-2xl border border-ink/10 bg-white p-2 shadow-sm">
        <button
          onClick={() => setKind('page')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
            kind === 'page' ? 'bg-forest text-white' : 'text-ink/50 hover:bg-[#f7f7f3]'
          }`}
        >
          <LayoutTemplate size={17} />
          Pages publiques
        </button>
        <button
          onClick={() => setKind('menu')}
          className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold ${
            kind === 'menu' ? 'bg-forest text-white' : 'text-ink/50 hover:bg-[#f7f7f3]'
          }`}
        >
          <Menu size={17} />
          Menus
        </button>
      </div>

      {(editing || name) && (
        <section className="rounded-2xl border border-gold/20 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                {editing ? 'Modification' : 'Création'}
              </p>
              <h2 className="mt-1 font-display text-2xl text-forest">
                {editing ? editing.name : 'Nouveau template'}
              </h2>
            </div>
            <button
              onClick={resetForm}
              className="rounded-xl border border-ink/10 p-2 text-ink/45 hover:bg-[#f7f7f3]"
            >
              <X size={17} />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold">Nom</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold">Type</label>
              <select
                value={kind}
                disabled={Boolean(editing)}
                onChange={(e) => {
                  const nextKind = e.target.value as TemplateKind;
                  setKind(nextKind);
                  const preset = nextKind === 'page' ? PAGE_PRESETS[0] : MENU_PRESETS[0];
                  setConfigText(prettyJson(preset.config));
                }}
                className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none"
              >
                <option value="page">Page publique</option>
                <option value="menu">Menu</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold">Description</label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold">URL de miniature (optionnel)</label>
              <input
                value={thumbnailUrl}
                onChange={(e) => setThumbnailUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
              />
            </div>

            <div className="md:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-xs font-semibold">Configuration du template</label>
                <div className="flex flex-wrap gap-2">
                  {(kind === 'page' ? PAGE_PRESETS : MENU_PRESETS).map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => setConfigText(prettyJson(preset.config))}
                      className="rounded-lg border border-ink/10 px-3 py-1.5 text-[11px] font-semibold text-ink/60 hover:bg-[#f7f7f3]"
                    >
                      Preset {preset.label}
                    </button>
                  ))}
                </div>
              </div>
              <textarea
                rows={18}
                value={configText}
                onChange={(e) => setConfigText(e.target.value)}
                className="w-full rounded-xl border border-ink/10 bg-[#171c19] px-4 py-3 font-mono text-xs leading-5 text-white outline-none focus:border-gold"
              />
              <p className="mt-2 text-[11px] text-ink/35">
                Cette configuration définit la présentation. Le contenu de chaque établissement reste indépendant du template.
              </p>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#f7f7f3] p-4">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-[#173d32]"
              />
              <span>
                <span className="block text-sm font-semibold text-forest">Template actif</span>
                <span className="mt-1 block text-xs text-ink/40">Disponible pour les établissements.</span>
              </span>
            </label>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#f7f7f3] p-4">
              <input
                type="checkbox"
                checked={isDefault}
                onChange={(e) => setIsDefault(e.target.checked)}
                className="h-4 w-4 accent-[#173d32]"
              />
              <span>
                <span className="block text-sm font-semibold text-forest">Template par défaut</span>
                <span className="mt-1 block text-xs text-ink/40">Un seul défaut par type.</span>
              </span>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={resetForm}
              className="rounded-xl border border-ink/10 px-5 py-3 text-sm font-semibold text-ink/55 hover:bg-[#f7f7f3]"
            >
              Annuler
            </button>
            <button
              disabled={saving}
              onClick={save}
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              <Save size={17} />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </section>
      )}

      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-2xl text-forest">
              {kind === 'page' ? 'Templates de page' : 'Templates de menu'}
            </h2>
            <p className="mt-1 text-xs text-ink/40">
              {filteredTemplates.length} template(s)
            </p>
          </div>
        </div>

        {loading ? (
          <div className="rounded-2xl border border-ink/10 bg-white p-8 text-center text-sm text-ink/40">
            Chargement...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-10 text-center">
            <p className="text-sm font-semibold text-forest">Aucun template</p>
            <p className="mt-1 text-xs text-ink/40">Crée ton premier template.</p>
          </div>
        ) : (
          <div className="grid gap-5 xl:grid-cols-2">
            {filteredTemplates.map((template) => (
              <article
                key={template.id}
                className="overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-sm"
              >
                <div className="flex min-h-[150px] items-center justify-center bg-[#f7f7f3] p-6">
                  {template.thumbnail_url ? (
                    <img
                      src={template.thumbnail_url}
                      alt=""
                      className="h-28 w-full rounded-xl object-cover"
                    />
                  ) : (
                    <div className="grid h-28 w-full place-items-center rounded-xl border border-dashed border-ink/10">
                      {kind === 'page' ? (
                        <LayoutTemplate className="text-gold" size={34} />
                      ) : (
                        <Menu className="text-gold" size={34} />
                      )}
                    </div>
                  )}
                </div>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-xl text-forest">{template.name}</h3>
                        {template.is_default && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-semibold text-forest">
                            <Star size={11} />
                            Défaut
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${
                            template.active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {template.active ? 'Actif' : 'Inactif'}
                        </span>
                      </div>
                      <p className="mt-2 text-xs leading-5 text-ink/45">
                        {template.description || 'Aucune description.'}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <button
                      onClick={() => setPreviewing(template)}
                      className="inline-flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/60 hover:bg-[#f7f7f3]"
                    >
                      <Eye size={14} />
                      Prévisualiser
                    </button>
                    <button
                      onClick={() => startEdit(template)}
                      className="inline-flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/60 hover:bg-[#f7f7f3]"
                    >
                      <Pencil size={14} />
                      Modifier
                    </button>
                    <button
                      onClick={() => duplicate(template)}
                      className="inline-flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/60 hover:bg-[#f7f7f3]"
                    >
                      <Copy size={14} />
                      Dupliquer
                    </button>
                    <button
                      onClick={() => toggleActive(template)}
                      className="inline-flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/60 hover:bg-[#f7f7f3]"
                    >
                      <Power size={14} />
                      {template.active ? 'Désactiver' : 'Activer'}
                    </button>
                    {!template.is_default && (
                      <button
                        onClick={() => makeDefault(template)}
                        className="inline-flex items-center gap-2 rounded-lg border border-gold/30 px-3 py-2 text-xs font-semibold text-forest hover:bg-gold/10"
                      >
                        <Check size={14} />
                        Définir par défaut
                      </button>
                    )}
                    <button
                      onClick={() => remove(template)}
                      className="inline-flex items-center gap-2 rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-50"
                    >
                      <Trash2 size={14} />
                      Supprimer
                    </button>
                  </div>

                  <div className="mt-5 border-t border-ink/5 pt-4">
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/35">
                      Affectation aux établissements
                    </p>
                    <div className="space-y-2">
                      {establishments.length === 0 ? (
                        <p className="text-xs text-ink/35">Aucun établissement.</p>
                      ) : (
                        establishments.map((establishment) => {
                          const selected = establishment[currentColumn] === template.id;

                          return (
                            <div
                              key={establishment.id}
                              className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f7f3] px-3 py-2"
                            >
                              <span className="truncate text-xs font-medium text-ink">
                                {establishment.name}
                              </span>
                              <button
                                onClick={() =>
                                  assign(
                                    establishment.id,
                                    selected ? '' : template.id
                                  )
                                }
                                className={`shrink-0 rounded-lg px-3 py-1.5 text-[10px] font-semibold ${
                                  selected
                                    ? 'bg-forest text-white'
                                    : 'border border-ink/10 bg-white text-ink/55'
                                }`}
                              >
                                {selected ? 'Affecté' : 'Affecter'}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {previewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-5">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-auto rounded-2xl bg-white shadow-2xl">
            <div className="sticky top-0 flex items-center justify-between border-b border-ink/10 bg-white px-5 py-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-gold">
                  Prévisualisation
                </p>
                <h3 className="font-display text-xl text-forest">{previewing.name}</h3>
              </div>
              <button
                onClick={() => setPreviewing(null)}
                className="rounded-xl border border-ink/10 p-2 text-ink/45 hover:bg-[#f7f7f3]"
              >
                <X size={17} />
              </button>
            </div>

            <div className="p-5">
              <div className="rounded-2xl border border-ink/10 bg-[#f7f7f3] p-5">
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-xs font-semibold text-forest">
                    {previewing.kind === 'page' ? 'Page publique' : 'Menu digital'}
                  </span>
                  <span className="rounded-full bg-gold/15 px-2.5 py-1 text-[10px] font-semibold text-forest">
                    Configuration actuelle
                  </span>
                </div>
                <pre className="overflow-auto rounded-xl bg-[#171c19] p-4 text-xs leading-5 text-white">
                  {prettyJson(previewing.config ?? {})}
                </pre>
                <p className="mt-4 text-xs leading-5 text-ink/45">
                  Cette prévisualisation affiche la configuration enregistrée. Le rendu final
                  sera branché sur le moteur de rendu public TapMarrakech.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
