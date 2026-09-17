import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Gift,
  Heart,
  Menu as MenuIcon,
  MessageSquare,
  Send,
  ShieldCheck,
  Star,
  UtensilsCrossed,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Establishment } from '@/lib/types';
import { Stars } from '@/components/Stars';

type PublicTab = 'menu' | 'reviews' | 'loyalty';

type MenuCategory = {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
};

type MenuItem = {
  id: string;
  establishment_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number | string;
  image_url: string | null;
  display_order: number;
  active: boolean;
};

export default function PublicReview() {
  const { slug } = useParams<{ slug: string }>();

  const [place, setPlace] = useState<Establishment | null>(null);
  const [activeTab, setActiveTab] = useState<PublicTab>('menu');

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [menuLoading, setMenuLoading] = useState(false);

  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [form, setForm] = useState({
    comment: '',
    name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    const load = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      const { data, error: establishmentError } = await supabase
        .from('establishments')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (establishmentError) {
        console.error('Erreur établissement public:', establishmentError);
      }

      setPlace(data);
      setLoading(false);

      if (data) {
        await supabase.from('analytics_events').insert({
          establishment_id: data.id,
          event_type: 'page_view',
        });

        await loadMenu(data.id);
      }
    };

    load();
  }, [slug]);

  async function loadMenu(establishmentId: string) {
    setMenuLoading(true);

    const [categoriesResult, itemsResult] = await Promise.all([
      supabase
        .from('menu_categories')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),

      supabase
        .from('menu_items')
        .select('*')
        .eq('establishment_id', establishmentId)
        .eq('active', true)
        .order('display_order', { ascending: true })
        .order('created_at', { ascending: true }),
    ]);

    if (categoriesResult.error) {
      console.error(
        'Erreur catégories menu public:',
        categoriesResult.error
      );
    }

    if (itemsResult.error) {
      console.error(
        'Erreur produits menu public:',
        itemsResult.error
      );
    }

    setCategories((categoriesResult.data as MenuCategory[]) ?? []);

    setItems(
      ((itemsResult.data as MenuItem[]) ?? []).map((item) => ({
        ...item,
        price: Number(item.price),
      }))
    );

    setMenuLoading(false);
  }

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};

    for (const item of items) {
      if (!grouped[item.category_id]) {
        grouped[item.category_id] = [];
      }

      grouped[item.category_id].push(item);
    }

    return grouped;
  }, [items]);

  const choose = async (value: number) => {
    if (!place || rating) return;

    setRating(value);

    await supabase.from('analytics_events').insert({
      establishment_id: place.id,
      event_type: 'rating_selected',
      rating: value,
    });

    if (value >= place.redirect_threshold) {
      await supabase.from('reviews').insert({
        establishment_id: place.id,
        rating: value,
        type: 'positive',
      });

      await supabase.from('analytics_events').insert([
        {
          establishment_id: place.id,
          event_type: 'google_redirect',
          rating: value,
        },
      ]);

      if (place.google_review_url) {
        window.open(
          place.google_review_url,
          '_blank',
          'noopener,noreferrer'
        );
      }
    } else {
      await supabase.from('analytics_events').insert({
        establishment_id: place.id,
        event_type: 'negative_feedback',
        rating: value,
      });
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    if (!place || !form.comment.trim()) return;

    setError('');

    const { error: insertError } = await supabase
      .from('reviews')
      .insert({
        establishment_id: place.id,
        rating,
        type: 'negative',
        comment: form.comment.trim(),
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
      });

    if (insertError) {
      console.error(insertError);
      setError(
        'Impossible d’envoyer votre message. Veuillez réessayer.'
      );
      return;
    }

    await supabase.from('analytics_events').insert({
      establishment_id: place.id,
      event_type: 'review_submitted',
      rating,
    });

    setSent(true);
  };

  function switchTab(tab: PublicTab) {
    setActiveTab(tab);

    if (place) {
      supabase.from('analytics_events').insert({
        establishment_id: place.id,
        event_type:
          tab === 'menu'
            ? 'public_menu_view'
            : tab === 'reviews'
              ? 'public_reviews_view'
              : 'public_loyalty_view',
      });
    }

    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f0e7]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!place) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f0e7] px-6 text-center">
        <div>
          <p className="font-display text-3xl text-forest">
            Établissement introuvable
          </p>

          <p className="mt-2 text-sm text-ink/60">
            Ce lien n’est plus disponible.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f0e7] text-ink">
      <div className="mx-auto w-full max-w-[520px] px-5 pb-12 pt-8">

        {/* HEADER */}
        <header className="text-center">
          {place.logo_url ? (
            <img
              src={place.logo_url}
              alt={place.name}
              className="mx-auto mb-4 h-20 w-20 rounded-2xl object-cover shadow-soft"
            />
          ) : (
            <div className="mx-auto mb-4 grid h-20 w-20 place-items-center rounded-2xl bg-forest font-display text-3xl text-gold shadow-soft">
              {place.name[0]}
            </div>
          )}

          <h1 className="font-display text-4xl text-forest">
            {place.name}
          </h1>

          <p className="mt-2 text-xs font-semibold tracking-[0.18em] text-forest/45">
            BIENVENUE
          </p>
        </header>

        {/* NAVIGATION PUBLIQUE */}
        <nav className="sticky top-3 z-20 mt-8 rounded-2xl border border-ink/5 bg-white/95 p-1.5 shadow-soft backdrop-blur">
          <div className="grid grid-cols-3 gap-1">

            <button
              type="button"
              onClick={() => switchTab('menu')}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition ${
                activeTab === 'menu'
                  ? 'bg-forest text-white'
                  : 'text-ink/55 hover:bg-[#f7f7f3]'
              }`}
            >
              <UtensilsCrossed size={18} />
              <span>MENU</span>
            </button>

            <button
              type="button"
              onClick={() => switchTab('reviews')}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition ${
                activeTab === 'reviews'
                  ? 'bg-forest text-white'
                  : 'text-ink/55 hover:bg-[#f7f7f3]'
              }`}
            >
              <MessageSquare size={18} />
              <span>AVIS</span>
            </button>

            <button
              type="button"
              onClick={() => switchTab('loyalty')}
              className={`flex flex-col items-center justify-center gap-1.5 rounded-xl px-2 py-3 text-xs font-semibold transition ${
                activeTab === 'loyalty'
                  ? 'bg-forest text-white'
                  : 'text-ink/55 hover:bg-[#f7f7f3]'
              }`}
            >
              <Gift size={18} />
              <span>FIDÉLITÉ</span>
            </button>

          </div>
        </nav>

        {/* ========================= */}
        {/* MENU */}
        {/* ========================= */}

        {activeTab === 'menu' && (
          <section className="mt-8">

            <div className="mb-7 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-forest text-gold">
                <MenuIcon size={23} />
              </div>

              <h2 className="font-display text-3xl text-forest">
                Notre menu
              </h2>

              <p className="mt-2 text-sm text-ink/55">
                Découvrez notre sélection
              </p>
            </div>

            {menuLoading ? (
              <div className="grid place-items-center py-16">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-forest border-t-transparent" />
              </div>
            ) : categories.length === 0 ? (
              <div className="rounded-3xl bg-white px-6 py-12 text-center shadow-soft">
                <UtensilsCrossed
                  className="mx-auto text-forest/35"
                  size={34}
                />

                <h3 className="mt-4 font-display text-2xl text-forest">
                  Menu bientôt disponible
                </h3>

                <p className="mt-2 text-sm leading-6 text-ink/50">
                  Le menu de cet établissement sera bientôt disponible ici.
                </p>
              </div>
            ) : (
              <div className="space-y-8">

                {categories.map((category) => {
                  const categoryItems =
                    itemsByCategory[category.id] ?? [];

                  if (categoryItems.length === 0) {
                    return null;
                  }

                  return (
                    <div key={category.id}>

                      <div className="mb-4">
                        <h3 className="font-display text-2xl text-forest">
                          {category.name}
                        </h3>

                        {category.description && (
                          <p className="mt-1 text-sm leading-5 text-ink/50">
                            {category.description}
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">

                        {categoryItems.map((item) => (
                          <article
                            key={item.id}
                            className="overflow-hidden rounded-2xl bg-white shadow-soft"
                          >
                            <div className="flex gap-4 p-4">

                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt={item.name}
                                  className="h-24 w-24 shrink-0 rounded-xl object-cover"
                                />
                              )}

                              <div className="min-w-0 flex-1">

                                <div className="flex items-start justify-between gap-3">
                                  <h4 className="font-semibold text-ink">
                                    {item.name}
                                  </h4>

                                  <span className="shrink-0 font-semibold text-forest">
                                    {Number(item.price).toFixed(2)} MAD
                                  </span>
                                </div>

                                {item.description && (
                                  <p className="mt-1.5 text-xs leading-5 text-ink/55">
                                    {item.description}
                                  </p>
                                )}

                              </div>
                            </div>
                          </article>
                        ))}

                      </div>
                    </div>
                  );
                })}

              </div>
            )}

          </section>
        )}

        {/* ========================= */}
        {/* AVIS */}
        {/* ========================= */}

        {activeTab === 'reviews' && (
          <section className="mt-8">

            {!rating && (
              <>
                <div className="mb-7 text-center">
                  <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-forest text-gold">
                    <Star size={23} fill="currentColor" />
                  </div>

                  <h2 className="font-display text-3xl text-forest">
                    Votre avis compte
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-ink/55">
                    Comment s’est passée votre expérience avec nous ?
                  </p>
                </div>

                <div className="rounded-3xl bg-white p-7 text-center shadow-soft">
                  <div className="flex justify-center gap-3">
                    <Stars
                      rating={rating}
                      size={42}
                      interactive
                      onSelect={choose}
                    />
                  </div>

                  <p className="mt-5 text-xs text-ink/40">
                    Appuyez sur une étoile pour répondre
                  </p>
                </div>
              </>
            )}

            {rating >= place.redirect_threshold && !sent && (
              <div className="mt-8 animate-in rounded-3xl bg-white p-7 text-center shadow-soft">
                <Heart
                  className="mx-auto text-gold"
                  fill="currentColor"
                  size={32}
                />

                <h2 className="mt-4 font-display text-2xl text-forest">
                  Merci pour votre retour
                </h2>

                <p className="mt-2 text-sm leading-6 text-ink/60">
                  Votre satisfaction nous fait très plaisir.
                  Aidez-nous à la partager.
                </p>

                {place.google_review_url && (
                  <a
                    href={place.google_review_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-light"
                  >
                    Laisser un avis sur Google
                    <ExternalLink size={16} />
                  </a>
                )}

                <button
                  type="button"
                  onClick={() => switchTab('menu')}
                  className="mt-3 w-full rounded-xl border border-forest/10 px-5 py-3 text-sm font-semibold text-forest"
                >
                  Retour au menu
                </button>
              </div>
            )}

            {rating > 0 &&
              rating < place.redirect_threshold &&
              !sent && (
                <div className="mt-8 rounded-3xl bg-white p-7 shadow-soft">

                  <h2 className="font-display text-2xl text-forest">
                    Nous sommes désolés que votre expérience n’ait pas été
                    à la hauteur.
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-ink/60">
                    Pouvez-vous nous expliquer ce qui s’est passé ?
                    Votre message restera privé et sera transmis à notre
                    équipe.
                  </p>

                  <form
                    onSubmit={submit}
                    className="mt-6 space-y-3"
                  >
                    <textarea
                      required
                      value={form.comment}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          comment: e.target.value,
                        })
                      }
                      placeholder="Votre message *"
                      rows={4}
                      className="w-full resize-none rounded-xl border border-ink/10 bg-[#fbfaf7] p-3 text-sm outline-none transition focus:ring-2 focus:ring-gold"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={form.name}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            name: e.target.value,
                          })
                        }
                        placeholder="Votre nom"
                        className="rounded-xl border border-ink/10 bg-[#fbfaf7] p-3 text-sm outline-none focus:ring-2 focus:ring-gold"
                      />

                      <input
                        value={form.phone}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            phone: e.target.value,
                          })
                        }
                        placeholder="Téléphone"
                        className="rounded-xl border border-ink/10 bg-[#fbfaf7] p-3 text-sm outline-none focus:ring-2 focus:ring-gold"
                      />
                    </div>

                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          email: e.target.value,
                        })
                      }
                      placeholder="Votre email (facultatif)"
                      className="w-full rounded-xl border border-ink/10 bg-[#fbfaf7] p-3 text-sm outline-none focus:ring-2 focus:ring-gold"
                    />

                    {error && (
                      <p className="text-xs text-red-600">
                        {error}
                      </p>
                    )}

                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-light"
                    >
                      <Send size={16} />
                      Envoyer mon retour
                    </button>
                  </form>
                </div>
              )}

            {sent && (
              <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-soft">

                <CheckCircle2
                  className="mx-auto text-forest"
                  size={40}
                />

                <h2 className="mt-4 font-display text-2xl text-forest">
                  Merci pour votre retour.
                </h2>

                <p className="mt-2 text-sm leading-6 text-ink/60">
                  Notre équipe va prendre connaissance de votre message.
                </p>

                <button
                  type="button"
                  onClick={() => switchTab('menu')}
                  className="mt-6 w-full rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white"
                >
                  Retour au menu
                </button>

              </div>
            )}

          </section>
        )}

        {/* ========================= */}
        {/* FIDÉLITÉ */}
        {/* ========================= */}

        {activeTab === 'loyalty' && (
          <section className="mt-8">

            <div className="mb-7 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-forest text-gold">
                <Gift size={23} />
              </div>

              <h2 className="font-display text-3xl text-forest">
                Votre fidélité
              </h2>

              <p className="mt-2 text-sm leading-6 text-ink/55">
                Profitez des avantages réservés à nos clients fidèles.
              </p>
            </div>

            <div className="overflow-hidden rounded-3xl bg-forest p-7 text-white shadow-soft">

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold tracking-[0.2em] text-gold">
                    PROGRAMME
                  </p>

                  <h3 className="mt-2 font-display text-3xl">
                    Fidélité
                  </h3>
                </div>

                <div className="grid h-14 w-14 place-items-center rounded-2xl bg-white/10">
                  <Gift className="text-gold" size={27} />
                </div>
              </div>

              <p className="mt-6 text-sm leading-6 text-white/70">
                Cumulez des points lors de vos visites et profitez
                progressivement de récompenses proposées par
                l’établissement.
              </p>

              <div className="mt-6 grid grid-cols-3 gap-2">

                <div className="rounded-2xl bg-white/10 p-3 text-center">
                  <Star
                    className="mx-auto text-gold"
                    size={20}
                    fill="currentColor"
                  />
                  <p className="mt-2 text-[11px] font-semibold">
                    Points
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-3 text-center">
                  <Gift
                    className="mx-auto text-gold"
                    size={20}
                  />
                  <p className="mt-2 text-[11px] font-semibold">
                    Récompenses
                  </p>
                </div>

                <div className="rounded-2xl bg-white/10 p-3 text-center">
                  <Heart
                    className="mx-auto text-gold"
                    size={20}
                    fill="currentColor"
                  />
                  <p className="mt-2 text-[11px] font-semibold">
                    Avantages
                  </p>
                </div>

              </div>
            </div>

            <div className="mt-5 rounded-3xl bg-white p-7 shadow-soft">

              <div className="flex items-start gap-4">
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#f5f0e7] text-forest">
                  <ShieldCheck size={22} />
                </div>

                <div>
                  <h3 className="font-display text-xl text-forest">
                    Comment ça fonctionne ?
                  </h3>

                  <p className="mt-2 text-sm leading-6 text-ink/55">
                    Présentez votre numéro de fidélité lors de vos
                    prochaines visites. L’équipe pourra enregistrer
                    votre visite et vos points.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-3">

                <div className="flex items-center gap-3 rounded-2xl bg-[#f7f7f3] p-4">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm font-semibold text-white">
                    1
                  </span>

                  <p className="text-sm text-ink/70">
                    Présentez votre carte ou numéro fidélité.
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-[#f7f7f3] p-4">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm font-semibold text-white">
                    2
                  </span>

                  <p className="text-sm text-ink/70">
                    Cumulez vos points au fil de vos visites.
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-2xl bg-[#f7f7f3] p-4">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-forest text-sm font-semibold text-white">
                    3
                  </span>

                  <p className="text-sm text-ink/70">
                    Utilisez vos points pour profiter de récompenses.
                  </p>
                </div>

              </div>

            </div>

            <div className="mt-5 rounded-3xl border border-gold/30 bg-[#fbf7ed] p-6 text-center">

              <Gift
                className="mx-auto text-gold"
                size={28}
              />

              <h3 className="mt-3 font-display text-xl text-forest">
                Pas encore membre ?
              </h3>

              <p className="mt-2 text-sm leading-6 text-ink/55">
                Demandez votre inscription au programme fidélité
                directement auprès de notre équipe.
              </p>

            </div>

          </section>
        )}

        {/* FOOTER */}
        <footer className="mt-12 flex items-center justify-center gap-1.5 text-[10px] font-semibold tracking-wider text-ink/30">
          <ShieldCheck size={13} />
          PROPULSÉ PAR TAPMARRAKECH
        </footer>

      </div>
    </div>
  );
}
