import { useEffect, useState } from 'react';
import {
  Eye,
  EyeOff,
  Gift,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Establishment = {
  id: string;
  name: string;
  slug: string;
};

type Promotion = {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  normal_price: number | null;
  promo_price: number | null;
  start_at: string | null;
  end_at: string | null;
  active: boolean;
  display_order: number;
};

const emptyForm = {
  name: '',
  description: '',
  normal_price: '',
  promo_price: '',
};

export default function Promotions() {
  const { user } = useAuth();
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    if (user?.id) void loadEstablishments();
  }, [user?.id]);

  useEffect(() => {
    if (establishmentId) void loadPromotions();
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

    const rows = ((data ?? []) as Array<Record<string, unknown>>)
      .map((row) => ({
        id: String(row.id ?? ''),
        name: String(row.name ?? 'Établissement'),
        slug: String(row.slug ?? ''),
      }))
      .filter((row) => row.id);

    setEstablishments(rows);
    if (rows.length > 0) {
      setEstablishmentId((current) => current || rows[0].id);
    }
    setLoading(false);
  }

  async function loadPromotions() {
    setErrorMessage('');

    const { data, error } = await supabase
      .from('promotions')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur chargement promotions:', error);
      setErrorMessage(error.message);
      return;
    }

    setPromotions((data as Promotion[]) ?? []);
  }

  function updateForm(field: keyof typeof emptyForm, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function generateAndPublish() {
    const name = form.name.trim();
    const description = form.description.trim();

    if (!establishmentId || !name) {
      setErrorMessage('Le nom de la promotion est obligatoire.');
      return;
    }

    setSaving(true);
    setErrorMessage('');

    const { data, error } = await supabase.functions.invoke(
      'generate-promotion-image',
      {
        body: {
          establishment_id: establishmentId,
          name,
          description: description || null,
          normal_price: form.normal_price ? Number(form.normal_price) : null,
          promo_price: form.promo_price ? Number(form.promo_price) : null,
        },
      }
    );

    if (error || !data?.success) {
      console.error('Erreur génération promotion IA:', error ?? data);
      setErrorMessage(
        data?.error ||
          error?.message ||
          'Impossible de générer la promotion avec l’IA.'
      );
      setSaving(false);
      return;
    }

    setForm(emptyForm);
    await loadPromotions();
    setSaving(false);
  }

  async function regeneratePromotion(promotion: Promotion) {
    if (!window.confirm(`Générer un nouveau visuel pour « ${promotion.name} » ?`)) return;

    setRegeneratingId(promotion.id);
    setErrorMessage('');

    const { data, error } = await supabase.functions.invoke(
      'generate-promotion-image',
      {
        body: {
          promotion_id: promotion.id,
          establishment_id: establishmentId,
        },
      }
    );

    if (error || !data?.success) {
      console.error('Erreur régénération promotion IA:', error ?? data);
      setErrorMessage(
        data?.error || error?.message || 'Impossible de régénérer le visuel.'
      );
      setRegeneratingId(null);
      return;
    }

    await loadPromotions();
    setRegeneratingId(null);
  }

  async function togglePromotion(promotion: Promotion) {
    const { error } = await supabase
      .from('promotions')
      .update({ active: !promotion.active })
      .eq('id', promotion.id)
      .eq('establishment_id', establishmentId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await loadPromotions();
  }

  async function deletePromotion(promotion: Promotion) {
    if (!window.confirm(`Supprimer « ${promotion.name} » ?`)) return;

    const { error } = await supabase
      .from('promotions')
      .delete()
      .eq('id', promotion.id)
      .eq('establishment_id', establishmentId);

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    await loadPromotions();
  }

  if (loading && establishments.length === 0) {
    return (
      <div className="grid min-h-[400px] place-items-center">
        <Loader2 className="animate-spin text-forest" size={28} />
      </div>
    );
  }

  if (establishments.length === 0) {
    return (
      <div className="rounded-3xl border border-ink/10 bg-white p-10 text-center">
        <Gift className="mx-auto mb-4 text-gold" size={36} />
        <h1 className="text-2xl font-semibold text-forest">Aucun établissement</h1>
        <p className="mt-2 text-sm text-ink/50">
          Crée d’abord ton établissement pour gérer ses promotions.
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
              <Sparkles size={15} />
              Promotions
            </div>
            <h1 className="text-3xl font-semibold tracking-tight md:text-4xl">
              Crée une promotion avec l’IA
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-white/65">
              L’IA génère automatiquement le visuel de la promotion. Le prompt
              utilisé est défini uniquement par l’administrateur.
            </p>
          </div>

          <select
            value={establishmentId}
            onChange={(event) => setEstablishmentId(event.target.value)}
            className="rounded-xl border border-white/15 bg-white/10 px-4 py-3 text-sm text-white outline-none"
          >
            {establishments.map((establishment) => (
              <option key={establishment.id} value={establishment.id} className="text-ink">
                {establishment.name}
              </option>
            ))}
          </select>
        </div>
      </section>

      {errorMessage && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-700">
          {errorMessage}
        </div>
      )}

      <section className="rounded-3xl border border-ink/10 bg-white p-6 shadow-sm md:p-8">
        <div className="flex items-start gap-4">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gold/10 text-gold">
            <ImageIcon size={19} />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-forest">Nouvelle promotion</h2>
            <p className="mt-1 text-sm text-ink/45">
              Renseigne le contenu commercial. Le visuel est toujours généré par l’IA.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink/60">Nom</span>
            <input
              value={form.name}
              onChange={(event) => updateForm('name', event.target.value)}
              placeholder="Ex. Menu déjeuner -20%"
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink/60">Description</span>
            <input
              value={form.description}
              onChange={(event) => updateForm('description', event.target.value)}
              placeholder="Ex. Du lundi au vendredi, midi uniquement"
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink/60">Prix normal (MAD)</span>
            <input
              value={form.normal_price}
              onChange={(event) => updateForm('normal_price', event.target.value)}
              type="number"
              min="0"
              placeholder="250"
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
            />
          </label>

          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold text-ink/60">Prix promo (MAD)</span>
            <input
              value={form.promo_price}
              onChange={(event) => updateForm('promo_price', event.target.value)}
              type="number"
              min="0"
              placeholder="199"
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
            />
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={() => void generateAndPublish()}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
            {saving ? 'Génération du visuel…' : 'Générer et publier avec l’IA'}
          </button>
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">Publication</p>
            <h2 className="mt-1 text-2xl font-semibold text-forest">Tes promotions</h2>
          </div>
          <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-ink/45 ring-1 ring-ink/5">
            {promotions.length} promotion{promotions.length > 1 ? 's' : ''}
          </span>
        </div>

        {promotions.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-ink/15 bg-white p-10 text-center">
            <Plus className="mx-auto mb-3 text-gold" size={28} />
            <p className="text-sm font-semibold text-forest">Aucune promotion publiée</p>
            <p className="mt-1 text-xs text-ink/45">
              La première promotion générée apparaîtra automatiquement sur la page publique.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {promotions.map((promotion) => (
              <article
                key={promotion.id}
                className="overflow-hidden rounded-3xl border border-ink/10 bg-white shadow-sm"
              >
                {promotion.image_url ? (
                  <img
                    src={promotion.image_url}
                    alt=""
                    className="aspect-[16/9] w-full object-cover"
                  />
                ) : (
                  <div className="grid aspect-[16/9] place-items-center bg-[#f7f7f3] text-ink/20">
                    <ImageIcon size={32} />
                  </div>
                )}

                <div className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold text-forest">{promotion.name}</h3>
                      <p className="mt-1 text-xs leading-5 text-ink/45">
                        {promotion.description || 'Sans description'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${promotion.active ? 'bg-green-100 text-green-700' : 'bg-ink/5 text-ink/40'}`}
                    >
                      {promotion.active ? 'Publiée' : 'Masquée'}
                    </span>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-sm font-bold text-gold">
                        {promotion.promo_price ?? '—'} MAD
                      </span>
                      {promotion.normal_price != null && (
                        <span className="ml-2 text-xs text-ink/30 line-through">
                          {promotion.normal_price} MAD
                        </span>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => void regeneratePromotion(promotion)}
                        disabled={regeneratingId === promotion.id}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-gold/30 bg-gold/5 px-3 py-2 text-xs font-semibold text-gold disabled:opacity-50"
                      >
                        {regeneratingId === promotion.id ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                        {regeneratingId === promotion.id ? 'Génération…' : 'Nouveau visuel'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void togglePromotion(promotion)}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-ink/10 px-3 py-2 text-xs font-semibold text-ink/60"
                      >
                        {promotion.active ? <EyeOff size={14} /> : <Eye size={14} />}
                        {promotion.active ? 'Masquer' : 'Publier'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deletePromotion(promotion)}
                        className="grid h-9 w-9 place-items-center rounded-xl border border-red-200 text-red-600"
                        aria-label="Supprimer"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
