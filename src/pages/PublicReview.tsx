import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Gift,
  Heart,
  Instagram,
  MapPin,
  Menu as MenuIcon,
  MessageCircle,
  Phone,
  Send,
  ShieldCheck,
  Star,
  Utensils,
  Wifi,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Establishment } from '@/lib/types';
import { Stars } from '@/components/Stars';

type PublicTab = 'home' | 'menu' | 'reviews' | 'loyalty';

type MenuCategory = {
  id: string;
  name: string;
  description: string | null;
  display_order: number;
  active: boolean;
};

type MenuItem = {
  id: string;
  category_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  display_order: number;
  active: boolean;
};

type Promotion = {
  id: string;
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

type WifiInfo = {
  network_name: string | null;
  wifi_password: string | null;
  active: boolean;
};

type LoyaltyReward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
};

export default function PublicReview() {
  const { slug } = useParams<{ slug: string }>();

  const [place, setPlace] = useState<Establishment | null>(null);
  const [tab, setTab] = useState<PublicTab>('home');

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [wifi, setWifi] = useState<WifiInfo | null>(null);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);

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
      if (!slug) return;

      setLoading(true);

      const { data: establishment } = await supabase
        .from('establishments')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (!establishment) {
        setPlace(null);
        setLoading(false);
        return;
      }

      setPlace(establishment);

      await supabase.from('analytics_events').insert({
        establishment_id: establishment.id,
        event_type: 'page_view',
      });

      const [
        { data: menuCategories },
        { data: menuItems },
        { data: promotionData },
        { data: wifiData },
        { data: rewardData },
      ] = await Promise.all([
        supabase
          .from('menu_categories')
          .select('*')
          .eq('establishment_id', establishment.id)
          .eq('active', true)
          .order('display_order'),

        supabase
          .from('menu_items')
          .select('*')
          .eq('establishment_id', establishment.id)
          .eq('active', true)
          .order('display_order'),

        supabase
          .from('promotions')
          .select('*')
          .eq('establishment_id', establishment.id)
          .eq('active', true)
          .order('display_order'),

        supabase
          .from('establishment_wifi')
          .select('network_name, wifi_password, active')
          .eq('establishment_id', establishment.id)
          .eq('active', true)
          .maybeSingle(),

        supabase
          .from('loyalty_rewards')
          .select('id, name, description, points_required, active')
          .eq('establishment_id', establishment.id)
          .eq('active', true)
          .order('points_required'),
      ]);

      setCategories(menuCategories ?? []);
      setItems(menuItems ?? []);
      setPromotions(promotionData ?? []);
      setWifi(wifiData ?? null);
      setRewards(rewardData ?? []);

      setLoading(false);
    };

    load();
  }, [slug]);

  const itemsByCategory = useMemo(() => {
    const result: Record<string, MenuItem[]> = {};

    for (const item of items) {
      if (!result[item.category_id]) {
        result[item.category_id] = [];
      }

      result[item.category_id].push(item);
    }

    return result;
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

      await supabase.from('analytics_events').insert({
        establishment_id: place.id,
        event_type: 'google_redirect',
        rating: value,
      });

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

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!place || !form.comment.trim()) return;

    setError('');

    const { error: insertError } = await supabase.from('reviews').insert({
      establishment_id: place.id,
      rating,
      type: 'negative',
      comment: form.comment.trim(),
      name: form.name.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
    });

    if (insertError) {
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

  const openTab = (nextTab: PublicTab) => {
    setTab(nextTab);
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    });
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f3ea]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!place) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f3ea] px-6 text-center">
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

  const establishment = place as any;

  const phone =
    establishment.phone ||
    '';

  const whatsapp =
    establishment.whatsapp_number ||
    '';

  const city =
    establishment.city ||
    '';

  const address =
    establishment.address ||
    '';

  const description =
    establishment.description ||
    '';

  const instagram =
    establishment.instagram_url ||
    '';

  const website =
    establishment.website_url ||
    '';

  const googleRating =
    establishment.google_rating ??
    establishment.rating ??
    null;

  const googleReviewCount =
    establishment.google_review_count ??
    establishment.review_count ??
    null;

  const directionsUrl =
    address || city
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [address, city].filter(Boolean).join(', ')
        )}`
      : '';

  return (
    <div className="min-h-screen bg-[#f7f3ea] text-ink">
      <div className="mx-auto min-h-screen w-full max-w-[520px] pb-28">

        {/* HEADER */}
        <header className="relative overflow-hidden bg-forest px-5 pb-8 pt-7 text-white">
          <div className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-gold/10 blur-2xl" />
          <div className="absolute -bottom-20 -left-20 h-48 w-48 rounded-full bg-white/5 blur-2xl" />

          <div className="relative">
            <div className="flex items-center justify-between">
              <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-gold">
                Bienvenue
              </div>

              <div className="flex items-center gap-1.5 text-[10px] text-white/50">
                <ShieldCheck size={13} />
                Expérience digitale
              </div>
            </div>

            <div className="mt-7 flex items-center gap-4">
              {establishment.logo_url ? (
                <img
                  src={establishment.logo_url}
                  alt=""
                  className="h-20 w-20 rounded-2xl bg-white object-cover p-1 shadow-lg"
                />
              ) : (
                <div className="grid h-20 w-20 place-items-center rounded-2xl bg-white/10 font-display text-3xl text-gold">
                  {place.name?.[0] ?? 'E'}
                </div>
              )}

              <div className="min-w-0">
                <h1 className="font-display text-3xl leading-tight">
                  {place.name}
                </h1>

                {(googleRating || place.google_review_url) && (
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex items-center gap-1 text-gold">
                      <Star size={15} fill="currentColor" />
                      <span className="text-sm font-semibold">
                        {googleRating
                          ? Number(googleRating).toFixed(1)
                          : 'Google'}
                      </span>
                    </div>

                    {googleReviewCount && (
                      <span className="text-xs text-white/50">
                        · {googleReviewCount} avis
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {description && (
              <p className="mt-5 max-w-[440px] text-sm leading-6 text-white/65">
                {description}
              </p>
            )}

            {/* QUICK ACTIONS */}
            <div className="mt-6 grid grid-cols-4 gap-2">
              {phone && (
                <a
                  href={`tel:${phone}`}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/10 px-2 py-3 text-[10px] font-semibold text-white transition hover:bg-white/15"
                >
                  <Phone size={18} />
                  Appeler
                </a>
              )}

              {whatsapp && (
                <a
                  href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/10 px-2 py-3 text-[10px] font-semibold text-white transition hover:bg-white/15"
                >
                  <MessageCircle size={18} />
                  WhatsApp
                </a>
              )}

              {directionsUrl && (
                <a
                  href={directionsUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/10 px-2 py-3 text-[10px] font-semibold text-white transition hover:bg-white/15"
                >
                  <MapPin size={18} />
                  Itinéraire
                </a>
              )}

              {place.google_review_url && (
                <button
                  onClick={() => openTab('reviews')}
                  className="flex flex-col items-center gap-1.5 rounded-2xl bg-white/10 px-2 py-3 text-[10px] font-semibold text-white transition hover:bg-white/15"
                >
                  <Star size={18} />
                  Avis
                </button>
              )}
            </div>
          </div>
        </header>

        {/* HOME */}
        {tab === 'home' && (
          <main className="space-y-5 px-5 pt-5">

            {/* PROMOTIONS */}
            {promotions.length > 0 && (
              <section>
                <div className="mb-3 flex items-end justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                      À ne pas manquer
                    </p>
                    <h2 className="mt-1 font-display text-2xl text-forest">
                      Nos offres
                    </h2>
                  </div>

                  <span className="rounded-full bg-gold/10 px-3 py-1 text-[10px] font-semibold text-gold">
                    {promotions.length} offre
                    {promotions.length > 1 ? 's' : ''}
                  </span>
                </div>

                <div className="space-y-3">
                  {promotions.map((promotion) => (
                    <div
                      key={promotion.id}
                      className="overflow-hidden rounded-3xl border border-ink/5 bg-white shadow-sm"
                    >
                      {promotion.image_url && (
                        <img
                          src={promotion.image_url}
                          alt=""
                          className="h-44 w-full object-cover"
                        />
                      )}

                      <div className="p-5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-red-600">
                              <Gift size={12} />
                              Offre
                            </div>

                            <h3 className="font-display text-xl text-forest">
                              {promotion.name}
                            </h3>

                            {promotion.description && (
                              <p className="mt-2 text-sm leading-5 text-ink/55">
                                {promotion.description}
                              </p>
                            )}
                          </div>

                          {(promotion.promo_price !== null ||
                            promotion.normal_price !== null) && (
                            <div className="shrink-0 text-right">
                              {promotion.normal_price !== null &&
                                promotion.promo_price !== null &&
                                promotion.normal_price >
                                  promotion.promo_price && (
                                  <div className="text-xs text-ink/35 line-through">
                                    {Number(
                                      promotion.normal_price
                                    ).toLocaleString('fr-FR')}{' '}
                                    MAD
                                  </div>
                                )}

                              {promotion.promo_price !== null && (
                                <div className="text-xl font-bold text-forest">
                                  {Number(
                                    promotion.promo_price
                                  ).toLocaleString('fr-FR')}{' '}
                                  MAD
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* MENU */}
            <button
              onClick={() => openTab('menu')}
              className="group flex w-full items-center justify-between rounded-3xl bg-white p-5 text-left shadow-sm ring-1 ring-ink/5 transition hover:-translate-y-0.5"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-forest/10 text-forest">
                  <Utensils size={22} />
                </div>

                <div>
                  <p className="font-display text-xl text-forest">
                    Découvrir notre menu
                  </p>
                  <p className="mt-1 text-xs text-ink/45">
                    {items.length > 0
                      ? `${items.length} produit${
                          items.length > 1 ? 's' : ''
                        } disponible${items.length > 1 ? 's' : ''}`
                      : 'Voir nos produits et services'}
                  </p>
                </div>
              </div>

              <ArrowRight
                size={20}
                className="text-gold transition group-hover:translate-x-1"
              />
            </button>

            {/* WIFI */}
            {wifi?.active && wifi.network_name && (
              <section className="rounded-3xl bg-forest p-5 text-white shadow-sm">
                <div className="flex items-start gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10 text-gold">
                    <Wifi size={22} />
                  </div>

                  <div className="min-w-0">
                    <p className="font-display text-xl">
                      Wi-Fi gratuit
                    </p>

                    <p className="mt-1 text-xs text-white/55">
                      Connectez-vous pendant votre visite.
                    </p>

                    <div className="mt-4 space-y-2">
                      <div className="rounded-xl bg-white/10 px-3 py-2.5">
                        <p className="text-[9px] uppercase tracking-wider text-white/40">
                          Réseau
                        </p>
                        <p className="mt-0.5 text-sm font-semibold">
                          {wifi.network_name}
                        </p>
                      </div>

                      {wifi.wifi_password && (
                        <div className="rounded-xl bg-white/10 px-3 py-2.5">
                          <p className="text-[9px] uppercase tracking-wider text-white/40">
                            Mot de passe
                          </p>
                          <p className="mt-0.5 text-sm font-semibold">
                            {wifi.wifi_password}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* LOYALTY */}
            <button
              onClick={() => openTab('loyalty')}
              className="group flex w-full items-center justify-between rounded-3xl border border-gold/20 bg-[#fffaf0] p-5 text-left shadow-sm"
            >
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold">
                  <Gift size={22} />
                </div>

                <div>
                  <p className="font-display text-xl text-forest">
                    Programme fidélité
                  </p>
                  <p className="mt-1 text-xs text-ink/45">
                    Profitez de vos avantages et récompenses.
                  </p>
                </div>
              </div>

              <ArrowRight
                size={20}
                className="text-gold transition group-hover:translate-x-1"
              />
            </button>

            {/* REVIEW CTA */}
            <section className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-ink/5">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-gold/10 text-gold">
                <Heart size={22} fill="currentColor" />
              </div>

              <h2 className="mt-4 font-display text-2xl text-forest">
                Votre expérience compte
              </h2>

              <p className="mx-auto mt-2 max-w-[360px] text-sm leading-6 text-ink/50">
                Partagez votre expérience avec notre équipe.
              </p>

              <button
                onClick={() => openTab('reviews')}
                className="mt-5 inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white"
              >
                Donner mon avis
                <ArrowRight size={16} />
              </button>
            </section>

            {/* CONTACT */}
            {(address || city || phone || website || instagram) && (
              <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-ink/5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                  Informations
                </p>

                <div className="mt-4 space-y-3">
                  {(address || city) && (
                    <div className="flex items-start gap-3">
                      <MapPin
                        size={17}
                        className="mt-0.5 shrink-0 text-forest"
                      />
                      <span className="text-sm leading-5 text-ink/60">
                        {[address, city].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}

                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="flex items-center gap-3 text-sm text-ink/60"
                    >
                      <Phone size={17} className="text-forest" />
                      {phone}
                    </a>
                  )}

                  {website && (
                    <a
                      href={
                        website.startsWith('http')
                          ? website
                          : `https://${website}`
                      }
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 text-sm text-ink/60"
                    >
                      <ExternalLink
                        size={17}
                        className="text-forest"
                      />
                      Site web
                    </a>
                  )}

                  {instagram && (
                    <a
                      href={instagram}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 text-sm text-ink/60"
                    >
                      <Instagram
                        size={17}
                        className="text-forest"
                      />
                      Instagram
                    </a>
                  )}
                </div>
              </section>
            )}
          </main>
        )}

        {/* MENU */}
        {tab === 'menu' && (
          <main className="px-5 pt-5">
            <PageTitle
              eyebrow="Notre carte"
              title="Menu"
              onBack={() => openTab('home')}
            />

            {categories.length === 0 ? (
              <EmptyState
                icon={<Utensils size={22} />}
                title="Menu bientôt disponible"
                text="Les produits et services de cet établissement apparaîtront ici."
              />
            ) : (
              <div className="mt-6 space-y-7">
                {categories.map((category) => {
                  const categoryItems =
                    itemsByCategory[category.id] ?? [];

                  if (categoryItems.length === 0) return null;

                  return (
                    <section key={category.id}>
                      <div className="mb-3">
                        <h2 className="font-display text-2xl text-forest">
                          {category.name}
                        </h2>

                        {category.description && (
                          <p className="mt-1 text-xs leading-5 text-ink/45">
                            {category.description}
                          </p>
                        )}
                      </div>

                      <div className="space-y-3">
                        {categoryItems.map((item) => (
                          <div
                            key={item.id}
                            className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-ink/5"
                          >
                            <div className="flex gap-3 p-3">
                              {item.image_url && (
                                <img
                                  src={item.image_url}
                                  alt=""
                                  className="h-24 w-24 shrink-0 rounded-xl object-cover"
                                />
                              )}

                              <div className="min-w-0 flex-1 py-1">
                                <div className="flex items-start justify-between gap-3">
                                  <h3 className="font-semibold text-forest">
                                    {item.name}
                                  </h3>

                                  <span className="shrink-0 font-semibold text-gold">
                                    {Number(
                                      item.price
                                    ).toLocaleString('fr-FR')}{' '}
                                    MAD
                                  </span>
                                </div>

                                {item.description && (
                                  <p className="mt-2 text-xs leading-5 text-ink/50">
                                    {item.description}
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </main>
        )}

        {/* REVIEWS */}
        {tab === 'reviews' && (
          <main className="px-5 pt-5">
            <PageTitle
              eyebrow="Votre expérience"
              title="Votre avis compte"
              onBack={() => openTab('home')}
            />

            {!rating && !sent && (
              <section className="mt-8 rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-ink/5">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold/10 text-gold">
                  <Heart size={25} fill="currentColor" />
                </div>

                <h2 className="mt-5 font-display text-2xl text-forest">
                  Comment s’est passée votre expérience ?
                </h2>

                <p className="mt-2 text-sm leading-6 text-ink/50">
                  Votre retour nous aide à améliorer continuellement
                  votre expérience.
                </p>

                <div className="mt-8 flex justify-center">
                  <Stars
                    rating={rating}
                    size={42}
                    interactive
                    onSelect={choose}
                  />
                </div>

                <p className="mt-5 text-xs text-ink/35">
                  Appuyez sur une étoile pour répondre
                </p>
              </section>
            )}

            {rating >= place.redirect_threshold && !sent && (
              <section className="mt-8 rounded-3xl bg-white p-7 text-center shadow-sm ring-1 ring-ink/5">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold/10 text-gold">
                  <Heart size={27} fill="currentColor" />
                </div>

                <h2 className="mt-4 font-display text-2xl text-forest">
                  Merci pour votre retour ❤️
                </h2>

                <p className="mt-2 text-sm leading-6 text-ink/55">
                  Votre satisfaction nous fait très plaisir.
                  Aidez-nous à la partager.
                </p>

                {place.google_review_url && (
                  <a
                    href={place.google_review_url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-6 flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white"
                  >
                    Laisser un avis sur Google
                    <ExternalLink size={16} />
                  </a>
                )}
              </section>
            )}

            {rating > 0 &&
              rating < place.redirect_threshold &&
              !sent && (
                <section className="mt-8 rounded-3xl bg-white p-7 shadow-sm ring-1 ring-ink/5">
                  <h2 className="font-display text-2xl text-forest">
                    Nous sommes désolés.
                  </h2>

                  <p className="mt-3 text-sm leading-6 text-ink/55">
                    Pouvez-vous nous expliquer ce qui s’est passé ?
                    Votre message restera privé et sera transmis à
                    notre équipe.
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
                      className="w-full resize-none rounded-xl border border-ink/10 bg-[#fbfaf7] p-3 text-sm outline-none focus:ring-2 focus:ring-gold"
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
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white"
                    >
                      <Send size={16} />
                      Envoyer mon retour
                    </button>
                  </form>
                </section>
              )}

            {sent && (
              <section className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-ink/5">
                <CheckCircle2
                  className="mx-auto text-forest"
                  size={40}
                />

                <h2 className="mt-4 font-display text-2xl text-forest">
                  Merci pour votre retour.
                </h2>

                <p className="mt-2 text-sm leading-6 text-ink/55">
                  Notre équipe va prendre connaissance de votre
                  message.
                </p>

                <button
                  onClick={() => {
                    setRating(0);
                    setSent(false);
                    setForm({
                      comment: '',
                      name: '',
                      phone: '',
                      email: '',
                    });
                  }}
                  className="mt-5 text-xs font-semibold text-forest"
                >
                  Retour à l’accueil
                </button>
              </section>
            )}
          </main>
        )}

        {/* LOYALTY */}
        {tab === 'loyalty' && (
          <main className="px-5 pt-5">
            <PageTitle
              eyebrow="Vos avantages"
              title="Fidélité"
              onBack={() => openTab('home')}
            />

            <section className="mt-6 overflow-hidden rounded-3xl bg-forest p-6 text-white">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gold/15 text-gold">
                <Gift size={23} />
              </div>

              <h2 className="mt-5 font-display text-2xl">
                Récompensé à chaque visite
              </h2>

              <p className="mt-2 text-sm leading-6 text-white/55">
                Profitez du programme fidélité de {place.name}.
                Cumulez des points et bénéficiez de récompenses.
              </p>
            </section>

            {rewards.length > 0 && (
              <section className="mt-6">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
                  Récompenses disponibles
                </p>

                <div className="mt-3 space-y-3">
                  {rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className="flex items-center justify-between gap-4 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/5"
                    >
                      <div>
                        <h3 className="font-semibold text-forest">
                          {reward.name}
                        </h3>

                        {reward.description && (
                          <p className="mt-1 text-xs leading-5 text-ink/45">
                            {reward.description}
                          </p>
                        )}
                      </div>

                      <div className="shrink-0 rounded-full bg-gold/10 px-3 py-1.5 text-xs font-bold text-gold">
                        {Number(
                          reward.points_required
                        ).toLocaleString('fr-FR')}{' '}
                        pts
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-ink/5">
              <h3 className="font-display text-xl text-forest">
                Comment ça marche ?
              </h3>

              <div className="mt-5 space-y-4">
                <LoyaltyStep
                  number="01"
                  title="Inscrivez-vous"
                  text="Demandez votre inscription au programme fidélité."
                />

                <LoyaltyStep
                  number="02"
                  title="Cumulez des points"
                  text="À chaque achat ou visite, vos points sont enregistrés."
                />

                <LoyaltyStep
                  number="03"
                  title="Profitez de vos récompenses"
                  text="Échangez vos points contre les avantages proposés."
                />
              </div>
            </section>
          </main>
        )}

        {/* FOOTER */}
        <footer className="px-5 pb-8 pt-10 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[10px] font-semibold tracking-wider text-ink/30">
            <ShieldCheck size={13} />
            PROPULSÉ PAR TAPMARRAKECH
          </div>
        </footer>
      </div>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-[520px] border-t border-ink/5 bg-white/95 px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(0,0,0,0.06)] backdrop-blur">
        <div className="grid grid-cols-4 gap-1">
          <BottomNavButton
            active={tab === 'home'}
            icon={<Star size={18} />}
            label="Accueil"
            onClick={() => openTab('home')}
          />

          <BottomNavButton
            active={tab === 'menu'}
            icon={<MenuIcon size={18} />}
            label="Menu"
            onClick={() => openTab('menu')}
          />

          <BottomNavButton
            active={tab === 'reviews'}
            icon={<Heart size={18} />}
            label="Avis"
            onClick={() => openTab('reviews')}
          />

          <BottomNavButton
            active={tab === 'loyalty'}
            icon={<Gift size={18} />}
            label="Fidélité"
            onClick={() => openTab('loyalty')}
          />
        </div>
      </nav>
    </div>
  );
}

function PageTitle({
  eyebrow,
  title,
  onBack,
}: {
  eyebrow: string;
  title: string;
  onBack: () => void;
}) {
  return (
    <div>
      <button
        onClick={onBack}
        className="mb-5 text-xs font-semibold text-forest"
      >
        ← Retour
      </button>

      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-gold">
        {eyebrow}
      </p>

      <h1 className="mt-1 font-display text-3xl text-forest">
        {title}
      </h1>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-8 rounded-3xl bg-white p-8 text-center shadow-sm ring-1 ring-ink/5">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-forest/10 text-forest">
        {icon}
      </div>

      <h2 className="mt-4 font-display text-xl text-forest">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-ink/50">
        {text}
      </p>
    </div>
  );
}

function LoyaltyStep({
  number,
  title,
  text,
}: {
  number: string;
  title: string;
  text: string;
}) {
  return (
    <div className="flex gap-4">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/10 text-[10px] font-bold text-gold">
        {number}
      </div>

      <div>
        <h4 className="text-sm font-semibold text-forest">
          {title}
        </h4>

        <p className="mt-1 text-xs leading-5 text-ink/45">
          {text}
        </p>
      </div>
    </div>
  );
}

function BottomNavButton({
  active,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-2xl py-2 transition ${
        active
          ? 'bg-forest text-white'
          : 'text-ink/40 hover:bg-[#f7f7f3]'
      }`}
    >
      {icon}
      <span className="text-[9px] font-semibold">
        {label}
      </span>
    </button>
  );
}
