import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
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
  Sparkles,
  Star,
  UtensilsCrossed,
  Wifi,
  X,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import type { Establishment } from '@/lib/types';
import { Stars } from '@/components/Stars';

type Section = 'home' | 'menu' | 'reviews' | 'loyalty';

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
  const [section, setSection] = useState<Section>('home');

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);

  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showLoyaltyForm, setShowLoyaltyForm] = useState(false);
  const [loyaltyCreated, setLoyaltyCreated] = useState<any>(null);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [loyaltyError, setLoyaltyError] = useState('');

  const [loyaltyForm, setLoyaltyForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    birth_date: '',
  });

  const [reviewError, setReviewError] = useState('');

  const [reviewForm, setReviewForm] = useState({
    comment: '',
    name: '',
    phone: '',
    email: '',
    website: '',
  });

  useEffect(() => {
    const load = async () => {
      if (!slug) return;

      setLoading(true);

      const { data: establishment } = await supabase
        .from('establishments')
        .select(
          'id,name,slug,logo_url,google_review_url,redirect_threshold,phone,email,address,city,description,website_url,instagram_url,facebook_url,tiktok_url,whatsapp_number,page_template_id,menu_template_id'
        )
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
        { data: promotionRows },
        { data: rewardRows },
        { data: loyaltySettings },
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
          .from('loyalty_rewards')
          .select('id,name,description,points_required,active')
          .eq('establishment_id', establishment.id)
          .eq('active', true)
          .order('points_required'),

        supabase
          .from('loyalty_settings')
          .select('enabled')
          .eq('establishment_id', establishment.id)
          .maybeSingle(),
      ]);

      setCategories(menuCategories ?? []);
      setItems(menuItems ?? []);
      setPromotions(promotionRows ?? []);
      setRewards(rewardRows ?? []);
      setLoyaltyEnabled(loyaltySettings?.enabled ?? true);

      setLoading(false);
    };

    load();
  }, [slug]);

  const itemsByCategory = useMemo(() => {
    const grouped: Record<string, MenuItem[]> = {};

    items.forEach((item) => {
      if (!grouped[item.category_id]) {
        grouped[item.category_id] = [];
      }

      grouped[item.category_id].push(item);
    });

    return grouped;
  }, [items]);

  const navigate = (next: Section) => {
    setSection(next);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getPublicReviewSessionId = () => {
    const key = `tapmarrakech_public_review_session:${slug || 'unknown'}`;

    try {
      const existing = window.sessionStorage.getItem(key);

      if (existing) {
        return existing;
      }

      const sessionId = crypto.randomUUID();
      window.sessionStorage.setItem(key, sessionId);
      return sessionId;
    } catch {
      return crypto.randomUUID();
    }
  };

  const submitPublicReview = async (payload: {
    rating: number;
    type: 'positive' | 'negative';
    comment?: string;
    name?: string | null;
    phone?: string | null;
    email?: string | null;
    honeypot?: string;
  }) => {
    const { data, error } = await supabase.functions.invoke(
      'submit-public-review',
      {
        body: {
          establishment_id: place?.id,
          session_id: getPublicReviewSessionId(),
          ...payload,
        },
      }
    );

    if (error) {
      return {
        data: null,
        error: error.message || 'Impossible d’envoyer votre avis.',
      };
    }

    if (!data?.success) {
      return {
        data: null,
        error: data?.error || 'Impossible d’envoyer votre avis.',
      };
    }

    return { data, error: null };
  };

  const chooseRating = async (value: number) => {
    if (!place || rating) return;

    setReviewError('');
    setRating(value);

    await supabase.from('analytics_events').insert({
      establishment_id: place.id,
      event_type: 'rating_selected',
      rating: value,
    });

    if (value >= 4) {
      const { error } = await submitPublicReview({
        rating: value,
        type: 'positive',
      });

      if (error) {
        setRating(0);
        setReviewError(error);
        return;
      }

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

  const submitPrivateReview = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!place || !rating || !reviewForm.comment.trim()) return;

    setReviewError('');

    const { error } = await submitPublicReview({
      rating,
      type: 'negative',
      comment: reviewForm.comment.trim(),
      name: reviewForm.name.trim() || null,
      phone: reviewForm.phone.trim() || null,
      email: reviewForm.email.trim() || null,
      honeypot: reviewForm.website,
    });

    if (error) {
      setReviewError(
        error === 'Trop de tentatives. Veuillez réessayer plus tard.'
          ? error
          : 'Impossible d’envoyer votre message. Veuillez réessayer.'
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

  const registerLoyalty = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    if (!place) return;

    setLoyaltyError('');

    if (!loyaltyForm.first_name.trim()) {
      setLoyaltyError('Veuillez saisir votre prénom.');
      return;
    }

    if (!loyaltyForm.last_name.trim()) {
      setLoyaltyError('Veuillez saisir votre nom.');
      return;
    }

    if (!loyaltyForm.phone.trim()) {
      setLoyaltyError('Veuillez saisir votre numéro de téléphone.');
      return;
    }

    setLoyaltyLoading(true);

    const { data, error } = await supabase.rpc(
      'register_public_loyalty_customer',
      {
        p_establishment_id: place.id,
        p_first_name: loyaltyForm.first_name.trim(),
        p_last_name: loyaltyForm.last_name.trim(),
        p_phone: loyaltyForm.phone.trim(),
        p_birth_date: loyaltyForm.birth_date || null,
      }
    );

    setLoyaltyLoading(false);

    if (error) {
      if (
        error.message
          ?.toLowerCase()
          .includes('already_registered')
      ) {
        setLoyaltyError(
          'Ce numéro est déjà inscrit au programme fidélité.'
        );
      } else {
        setLoyaltyError(
          error.message ||
            'Impossible de créer votre carte fidélité.'
        );
      }

      return;
    }

    const customer = Array.isArray(data) ? data[0] : data;

    if (!customer) {
      setLoyaltyError(
        'Impossible de créer votre carte fidélité.'
      );
      return;
    }

    setLoyaltyCreated(customer);
    setShowLoyaltyForm(false);

    await supabase.from('analytics_events').insert({
      establishment_id: place.id,
      event_type: 'loyalty_registration',
    });
  };

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f5f0e7]">
        <div className="h-9 w-9 animate-spin rounded-full border-2 border-forest border-t-transparent" />
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
          <p className="mt-2 text-sm text-ink/50">
            Ce lien n’est plus disponible.
          </p>
        </div>
      </div>
    );
  }

  const p = place as any;

  const phone = p.phone || '';
  const whatsapp = p.whatsapp_number || '';
  const address = p.address || '';
  const city = p.city || '';
  const description = p.description || '';
  const website = p.website_url || '';
  const instagram = p.instagram_url || '';
  const googleRating =
    p.google_rating ?? p.rating ?? null;
  const googleReviewCount =
    p.google_review_count ?? p.review_count ?? null;

  const directionsUrl =
    address || city
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          [address, city].filter(Boolean).join(', ')
        )}`
      : '';

  return (
    <div className="min-h-screen bg-[#f5f0e7] text-ink">
      <div className="mx-auto min-h-screen w-full max-w-[520px] overflow-hidden bg-[#f5f0e7] pb-24 shadow-2xl">

        {/* =====================================================
            HOME
        ===================================================== */}
        {section === 'home' && (
          <>
            {/* PREMIUM HERO */}
            <section className="relative min-h-[520px] overflow-hidden bg-forest">
              <div className="absolute inset-0">
                <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
                <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-black/20 blur-3xl" />
              </div>

              <div className="relative px-6 pb-8 pt-7">
                <div className="flex items-center justify-between">
                  <img
                    src="/tapmarrakech-logo.png"
                    alt="TapMarrakech"
                    className="h-8 w-auto object-contain brightness-0 invert opacity-80"
                  />

                  <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/60">
                    Votre expérience
                  </div>
                </div>

                <div className="mt-14 text-center">
                  {p.logo_url ? (
                    <div className="mx-auto mb-6 flex h-28 w-28 items-center justify-center rounded-[30px] bg-white p-2 shadow-2xl">
                      <img
                        src={p.logo_url}
                        alt={p.name}
                        className="h-full w-full rounded-[22px] object-cover"
                      />
                    </div>
                  ) : (
                    <div className="mx-auto mb-6 grid h-28 w-28 place-items-center rounded-[30px] bg-white/10 font-display text-5xl text-gold ring-1 ring-white/10">
                      {p.name?.[0] || 'E'}
                    </div>
                  )}

                  <p className="text-[10px] font-semibold uppercase tracking-[0.35em] text-gold">
                    Bienvenue
                  </p>

                  <h1 className="mt-3 font-display text-4xl leading-tight text-white">
                    {p.name}
                  </h1>

                  {(googleRating || p.google_review_url) && (
                    <div className="mt-5 flex items-center justify-center gap-2">
                      <Star
                        size={16}
                        fill="currentColor"
                        className="text-gold"
                      />

                      <span className="text-sm font-semibold text-white">
                        {googleRating
                          ? Number(googleRating).toFixed(1)
                          : 'Google'}
                      </span>

                      {googleReviewCount && (
                        <span className="text-xs text-white/40">
                          · {googleReviewCount} avis
                        </span>
                      )}
                    </div>
                  )}

                  {description && (
                    <p className="mx-auto mt-5 max-w-[390px] text-sm leading-6 text-white/55">
                      {description}
                    </p>
                  )}
                </div>

                {/* ACTION PILLS */}
                <div className="mt-8 flex flex-wrap justify-center gap-2">
                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-forest"
                    >
                      <Phone size={14} />
                      Appeler
                    </a>
                  )}

                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp.replace(
                        /\D/g,
                        ''
                      )}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-xs font-semibold text-white ring-1 ring-white/10"
                    >
                      <MessageCircle size={14} />
                      WhatsApp
                    </a>
                  )}

                  {directionsUrl && (
                    <a
                      href={directionsUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-xs font-semibold text-white ring-1 ring-white/10"
                    >
                      <MapPin size={14} />
                      Itinéraire
                    </a>
                  )}
                </div>
              </div>
            </section>

            {/* MAIN CONTENT */}
            <main className="space-y-6 px-5 pt-6">

              {/* PROMOTIONS */}
              {promotions.length > 0 && (
                <section>
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-gold">
                        En ce moment
                      </p>
                      <h2 className="mt-1 font-display text-3xl text-forest">
                        À découvrir
                      </h2>
                    </div>

                    <Sparkles
                      size={20}
                      className="mb-1 text-gold"
                    />
                  </div>

                  <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 scrollbar-hide">
                    {promotions.map((promotion) => (
                      <article
                        key={promotion.id}
                        className="relative min-w-[310px] overflow-hidden rounded-[28px] bg-forest shadow-xl"
                      >
                        {promotion.image_url ? (
                          <img
                            src={promotion.image_url}
                            alt=""
                            className="h-52 w-full object-cover"
                          />
                        ) : (
                          <div className="h-36 bg-gradient-to-br from-forest via-[#214d40] to-[#0e2923]" />
                        )}

                        <div className="p-5 text-white">
                          <span className="inline-flex items-center rounded-full bg-gold px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-forest">
                            Offre exclusive
                          </span>

                          <div className="mt-3 flex items-end justify-between gap-4">
                            <div>
                              <h3 className="font-display text-2xl">
                                {promotion.name}
                              </h3>

                              {promotion.description && (
                                <p className="mt-1.5 text-xs leading-5 text-white/50">
                                  {promotion.description}
                                </p>
                              )}
                            </div>

                            {promotion.promo_price !== null && (
                              <div className="shrink-0 text-right">
                                {promotion.normal_price !== null && (
                                  <p className="text-[10px] text-white/35 line-through">
                                    {Number(
                                      promotion.normal_price
                                    ).toLocaleString('fr-FR')}{' '}
                                    MAD
                                  </p>
                                )}

                                <p className="text-xl font-bold text-gold">
                                  {Number(
                                    promotion.promo_price
                                  ).toLocaleString('fr-FR')}{' '}
                                  MAD
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {/* 3 PRIMARY EXPERIENCES */}
              <section className="grid grid-cols-3 gap-3">
                <FeatureCard
                  icon={<UtensilsCrossed size={21} />}
                  title="Menu"
                  subtitle="Découvrir"
                  onClick={() => navigate('menu')}
                />

                <FeatureCard
                  icon={<Heart size={21} />}
                  title="Avis"
                  subtitle="Votre expérience"
                  onClick={() => navigate('reviews')}
                />

                {loyaltyEnabled ? (
                  <FeatureCard
                    icon={<Gift size={21} />}
                    title="Fidélité"
                    subtitle="Vos avantages"
                    onClick={() => navigate('loyalty')}
                    featured
                  />
                ) : (
                  <FeatureCard
                    icon={<Sparkles size={21} />}
                    title="Découvrir"
                    subtitle="Nos services"
                    onClick={() => {}}
                  />
                )}
              </section>

              {/* LOYALTY TEASER */}
              {loyaltyEnabled && (
                <section className="relative overflow-hidden rounded-[30px] bg-[#e9dfca] p-6">
                  <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gold/20 blur-2xl" />

                  <div className="relative">
                    <div className="flex items-center gap-2 text-gold">
                      <Gift size={17} />
                      <span className="text-[9px] font-bold uppercase tracking-[0.25em]">
                        Programme fidélité
                      </span>
                    </div>

                    <h2 className="mt-3 max-w-[300px] font-display text-2xl leading-tight text-forest">
                      Plus vous revenez,
                      plus vous êtes récompensé.
                    </h2>

                    <button
                      onClick={() => navigate('loyalty')}
                      className="mt-5 inline-flex items-center gap-2 rounded-full bg-forest px-5 py-3 text-xs font-semibold text-white"
                    >
                      Rejoindre le programme
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </section>
              )}

              {/* WIFI */}
              <WifiCard establishmentId={p.id} />

              {/* CONTACT */}
              {(address ||
                city ||
                website ||
                instagram) && (
                <section className="border-t border-ink/5 pt-6">
                  <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold">
                    Informations
                  </p>

                  <div className="mt-4 space-y-3">
                    {(address || city) && (
                      <div className="flex gap-3">
                        <MapPin
                          size={16}
                          className="mt-0.5 shrink-0 text-forest"
                        />
                        <span className="text-sm text-ink/55">
                          {[address, city]
                            .filter(Boolean)
                            .join(', ')}
                        </span>
                      </div>
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
                        className="flex items-center gap-3 text-sm text-ink/55"
                      >
                        <ExternalLink
                          size={16}
                          className="text-forest"
                        />
                        Site internet
                      </a>
                    )}

                    {instagram && (
                      <a
                        href={instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 text-sm text-ink/55"
                      >
                        <Instagram
                          size={16}
                          className="text-forest"
                        />
                        Instagram
                      </a>
                    )}
                  </div>
                </section>
              )}
            </main>
          </>
        )}

        {/* =====================================================
            MENU
        ===================================================== */}
        {section === 'menu' && (
          <main className="px-5 pt-6">
            <BackButton onClick={() => navigate('home')} />

            <div className="mt-7">
              <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-gold">
                Découvrez
              </p>

              <h1 className="mt-1 font-display text-4xl text-forest">
                Notre menu
              </h1>

              <p className="mt-2 text-sm text-ink/45">
                Une sélection préparée pour vous.
              </p>
            </div>

            {categories.length === 0 ? (
              <Empty
                icon={<UtensilsCrossed size={22} />}
                title="Menu bientôt disponible"
                text="Le contenu apparaîtra ici dès qu’il sera ajouté."
              />
            ) : (
              <div className="mt-8 space-y-8">
                {categories.map((category) => {
                  const categoryItems =
                    itemsByCategory[category.id] ?? [];

                  if (!categoryItems.length) return null;

                  return (
                    <section key={category.id}>
                      <div className="mb-4">
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
                          <article
                            key={item.id}
                            className="flex overflow-hidden rounded-[22px] bg-white p-3 shadow-sm ring-1 ring-ink/5"
                          >
                            {item.image_url && (
                              <img
                                src={item.image_url}
                                alt=""
                                className="h-24 w-24 shrink-0 rounded-[16px] object-cover"
                              />
                            )}

                            <div className="min-w-0 flex-1 p-2">
                              <div className="flex items-start justify-between gap-3">
                                <h3 className="font-semibold text-forest">
                                  {item.name}
                                </h3>

                                <span className="shrink-0 text-sm font-bold text-gold">
                                  {Number(
                                    item.price
                                  ).toLocaleString('fr-FR')}{' '}
                                  MAD
                                </span>
                              </div>

                              {item.description && (
                                <p className="mt-2 text-xs leading-5 text-ink/45">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          </article>
                        ))}
                      </div>
                    </section>
                  );
                })}
              </div>
            )}
          </main>
        )}

        {/* =====================================================
            REVIEWS
        ===================================================== */}
        {section === 'reviews' && (
          <main className="px-5 pt-6">
            <BackButton onClick={() => navigate('home')} />

            <div className="mt-7">
              <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-gold">
                Votre expérience
              </p>

              <h1 className="mt-1 font-display text-4xl text-forest">
                Votre avis compte.
              </h1>
            </div>

            {!rating && !sent && (
              <section className="mt-8 rounded-[30px] bg-forest p-7 text-center text-white shadow-xl">
                <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-white/10 text-gold">
                  <Heart size={25} fill="currentColor" />
                </div>

                <h2 className="mt-5 font-display text-2xl">
                  Comment était votre expérience ?
                </h2>

                <p className="mt-2 text-sm leading-6 text-white/50">
                  Votre retour nous aide à vous offrir une
                  meilleure expérience.
                </p>

                <div className="mt-8 flex justify-center">
                  <Stars
                    rating={rating}
                    size={40}
                    interactive
                    onSelect={chooseRating}
                  />
                </div>

                <p className="mt-5 text-[10px] uppercase tracking-wider text-white/30">
                  Touchez une étoile
                </p>
              </section>
            )}

            {rating >= place.redirect_threshold &&
              !sent && (
                <section className="mt-8 rounded-[30px] bg-white p-7 text-center shadow-sm ring-1 ring-ink/5">
                  <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-gold/10 text-gold">
                    <Check size={26} />
                  </div>

                  <h2 className="mt-5 font-display text-2xl text-forest">
                    Merci beaucoup.
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-ink/50">
                    Votre satisfaction nous fait vraiment plaisir.
                  </p>

                  {place.google_review_url && (
                    <a
                      href={place.google_review_url}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-6 flex items-center justify-center gap-2 rounded-full bg-forest px-5 py-3.5 text-sm font-semibold text-white"
                    >
                      Partager sur Google
                      <ExternalLink size={15} />
                    </a>
                  )}
                </section>
              )}

            {rating > 0 &&
              rating < place.redirect_threshold &&
              !sent && (
                <section className="mt-8 rounded-[30px] bg-white p-7 shadow-sm ring-1 ring-ink/5">
                  <h2 className="font-display text-2xl text-forest">
                    Parlons-en.
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-ink/50">
                    Votre message reste privé et sera transmis
                    directement à notre équipe.
                  </p>

                  <form
                    onSubmit={submitPrivateReview}
                    className="mt-6 space-y-3"
                  >
                    <textarea
                      required
                      rows={4}
                      value={reviewForm.comment}
                      onChange={(e) =>
                        setReviewForm({
                          ...reviewForm,
                          comment: e.target.value,
                        })
                      }
                      placeholder="Que pouvons-nous améliorer ?"
                      className="w-full resize-none rounded-2xl border border-ink/10 bg-[#faf9f6] p-4 text-sm outline-none focus:border-forest"
                    />

                    <div
                      aria-hidden="true"
                      className="absolute -left-[10000px] h-px w-px overflow-hidden"
                    >
                      <label htmlFor="review-website">
                        Site web
                      </label>
                      <input
                        id="review-website"
                        tabIndex={-1}
                        autoComplete="off"
                        value={reviewForm.website}
                        onChange={(e) =>
                          setReviewForm({
                            ...reviewForm,
                            website: e.target.value,
                          })
                        }
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <input
                        value={reviewForm.name}
                        onChange={(e) =>
                          setReviewForm({
                            ...reviewForm,
                            name: e.target.value,
                          })
                        }
                        placeholder="Nom"
                        className="rounded-2xl border border-ink/10 bg-[#faf9f6] p-3.5 text-sm outline-none focus:border-forest"
                      />

                      <input
                        value={reviewForm.phone}
                        onChange={(e) =>
                          setReviewForm({
                            ...reviewForm,
                            phone: e.target.value,
                          })
                        }
                        placeholder="Téléphone"
                        className="rounded-2xl border border-ink/10 bg-[#faf9f6] p-3.5 text-sm outline-none focus:border-forest"
                      />
                    </div>

                    {reviewError && (
                      <p className="text-xs text-red-600">
                        {reviewError}
                      </p>
                    )}

                    <button className="flex w-full items-center justify-center gap-2 rounded-full bg-forest px-5 py-3.5 text-sm font-semibold text-white">
                      <Send size={15} />
                      Envoyer
                    </button>
                  </form>
                </section>
              )}

            {sent && (
              <section className="mt-8 rounded-[30px] bg-white p-8 text-center shadow-sm ring-1 ring-ink/5">
                <CheckCircle2
                  size={42}
                  className="mx-auto text-forest"
                />

                <h2 className="mt-5 font-display text-2xl text-forest">
                  Merci pour votre retour.
                </h2>

                <p className="mt-2 text-sm text-ink/50">
                  Notre équipe va prendre connaissance de votre
                  message.
                </p>
              </section>
            )}
          </main>
        )}

        {/* =====================================================
            LOYALTY
        ===================================================== */}        {section === 'loyalty' && (
          <main className="px-5 pt-6">
            <BackButton onClick={() => navigate('home')} />

            <div className="mt-7">
              <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-gold">
                Programme exclusif
              </p>

              <h1 className="mt-1 font-display text-4xl text-forest">
                Fidélité
              </h1>
            </div>

            {loyaltyCreated ? (
              <section className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-[#f5f0e7]/95 px-4 py-6 backdrop-blur-sm">
                <div className="w-full max-w-[420px]">
                  <div className="relative overflow-hidden rounded-[32px] bg-forest p-7 text-white shadow-2xl">
                  <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gold/10 blur-2xl" />

                  <div className="relative">
                    <CheckCircle2
                      size={34}
                      className="text-gold"
                    />

                    <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.25em] text-gold">
                      Bienvenue dans le programme
                    </p>

                    <h2 className="mt-2 font-display text-3xl">
                      {loyaltyCreated.first_name}
                    </h2>

                    <div className="mt-7 rounded-[22px] border border-white/10 bg-white/5 p-5">
                      <p className="text-[9px] uppercase tracking-wider text-white/35">
                        Votre numéro fidélité
                      </p>

                      <p className="mt-2 text-2xl font-bold tracking-[0.12em] text-gold">
                        {loyaltyCreated.loyalty_number}
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-[9px] uppercase text-white/35">
                          Points
                        </p>
                        <p className="mt-1 text-xl font-bold">
                          {loyaltyCreated.points_balance ?? 0}
                        </p>
                      </div>

                      <div className="rounded-2xl bg-white/5 p-4">
                        <p className="text-[9px] uppercase text-white/35">
                          Visites
                        </p>
                        <p className="mt-1 text-xl font-bold">
                          {loyaltyCreated.visit_count ?? 0}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                  <button
                    onClick={() => setLoyaltyCreated(null)}
                    className="mt-5 w-full rounded-full border border-ink/10 bg-white py-3 text-sm font-semibold text-forest"
                  >
                    Retour au programme
                  </button>
                </div>
              </section>
            ) : (
              <>
                <section className="relative mt-8 overflow-hidden rounded-[32px] bg-forest p-7 text-white shadow-2xl">
                  <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gold/10 blur-3xl" />

                  <div className="relative">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gold/15 text-gold">
                      <Gift size={26} />
                    </div>

                    <h2 className="mt-6 max-w-[330px] font-display text-3xl leading-tight">
                      Des avantages réservés à nos clients fidèles.
                    </h2>

                    <p className="mt-3 text-sm leading-6 text-white/50">
                      Cumulez des points à chaque visite et
                      profitez de récompenses exclusives.
                    </p>

                    <button
                      onClick={() => setShowLoyaltyForm(true)}
                      className="mt-7 flex w-full items-center justify-center gap-2 rounded-full bg-gold px-5 py-3.5 text-sm font-bold text-forest"
                    >
                      Rejoindre gratuitement
                      <ArrowRight size={16} />
                    </button>
                  </div>
                </section>

                {rewards.length > 0 && (
                  <section className="mt-8">
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold">
                      Vos futures récompenses
                    </p>

                    <div className="mt-4 space-y-3">
                      {rewards.map((reward) => (
                        <div
                          key={reward.id}
                          className="flex items-center justify-between gap-4 rounded-[22px] bg-white p-4 shadow-sm ring-1 ring-ink/5"
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

                          <span className="shrink-0 rounded-full bg-gold/10 px-3 py-1.5 text-[10px] font-bold text-gold">
                            {reward.points_required} pts
                          </span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                <section className="mt-8 rounded-[28px] bg-white p-6 ring-1 ring-ink/5">
                  <h3 className="font-display text-xl text-forest">
                    Comment ça marche ?
                  </h3>

                  <div className="mt-5 space-y-5">
                    <Step
                      number="01"
                      title="Inscrivez-vous"
                      text="Créez gratuitement votre carte fidélité."
                    />

                    <Step
                      number="02"
                      title="Cumulez"
                      text="À chaque achat ou visite, vous accumulez des points."
                    />

                    <Step
                      number="03"
                      title="Soyez récompensé"
                      text="Utilisez vos points pour profiter de vos avantages."
                    />
                  </div>
                </section>
              </>
            )}
          </main>
        )}

        <footer className="px-5 pb-5 pt-12 text-center">
          <div className="flex items-center justify-center gap-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/25">
            <ShieldCheck size={12} />
            Une expérience propulsée par TapMarrakech
          </div>
        </footer>
      </div>

      {/* =====================================================
          BOTTOM NAV
      ===================================================== */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto w-full max-w-[520px] border-t border-ink/5 bg-[#fffdf9]/95 px-3 pb-[max(9px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl">
        <div className="grid grid-cols-4 gap-1">
          <NavButton
            active={section === 'home'}
            icon={<Sparkles size={18} />}
            label="Accueil"
            onClick={() => navigate('home')}
          />

          <NavButton
            active={section === 'menu'}
            icon={<MenuIcon size={18} />}
            label="Menu"
            onClick={() => navigate('menu')}
          />

          <NavButton
            active={section === 'reviews'}
            icon={<Heart size={18} />}
            label="Avis"
            onClick={() => navigate('reviews')}
          />

          <NavButton
            active={section === 'loyalty'}
            icon={<Gift size={18} />}
            label="Fidélité"
            onClick={() => navigate('loyalty')}
          />
        </div>
      </nav>

      {/* =====================================================
          LOYALTY MODAL
      ===================================================== */}
      {showLoyaltyForm && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm">
          <div className="w-full max-w-[520px] rounded-t-[34px] bg-[#fffdf9] p-6 pb-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-gold">
                  Inscription gratuite
                </p>

                <h2 className="mt-1 font-display text-2xl text-forest">
                  Rejoindre la fidélité
                </h2>
              </div>

              <button
                onClick={() => setShowLoyaltyForm(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink/50"
              >
                <X size={17} />
              </button>
            </div>

            <form
              onSubmit={registerLoyalty}
              className="mt-6 space-y-3"
            >
              <div className="grid grid-cols-2 gap-3">
                <input
                  required
                  value={loyaltyForm.first_name}
                  onChange={(e) =>
                    setLoyaltyForm({
                      ...loyaltyForm,
                      first_name: e.target.value,
                    })
                  }
                  placeholder="Prénom"
                  className="rounded-2xl border border-ink/10 bg-white px-4 py-3.5 text-sm outline-none focus:border-forest"
                />

                <input
                  required
                  value={loyaltyForm.last_name}
                  onChange={(e) =>
                    setLoyaltyForm({
                      ...loyaltyForm,
                      last_name: e.target.value,
                    })
                  }
                  placeholder="Nom"
                  className="rounded-2xl border border-ink/10 bg-white px-4 py-3.5 text-sm outline-none focus:border-forest"
                />
              </div>

              <input
                required
                type="tel"
                value={loyaltyForm.phone}
                onChange={(e) =>
                  setLoyaltyForm({
                    ...loyaltyForm,
                    phone: e.target.value,
                  })
                }
                placeholder="Numéro de téléphone"
                className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3.5 text-sm outline-none focus:border-forest"
              />

              <div>
                <label className="mb-1.5 block text-[10px] font-medium text-ink/45">
                  Date de naissance
                  <span className="ml-1">(facultatif)</span>
                </label>

                <input
                  type="date"
                  value={loyaltyForm.birth_date}
                  onChange={(e) =>
                    setLoyaltyForm({
                      ...loyaltyForm,
                      birth_date: e.target.value,
                    })
                  }
                  className="w-full rounded-2xl border border-ink/10 bg-white px-4 py-3.5 text-sm outline-none focus:border-forest"
                />
              </div>

              {loyaltyError && (
                <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs text-red-600">
                  {loyaltyError}
                </div>
              )}

              <button
                disabled={loyaltyLoading}
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-full bg-forest px-5 py-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {loyaltyLoading
                  ? 'Création de votre carte...'
                  : 'Créer ma carte fidélité'}
                {!loyaltyLoading && <ArrowRight size={16} />}
              </button>

              <p className="text-center text-[9px] leading-4 text-ink/30">
                Vos informations sont utilisées uniquement pour
                gérer votre programme fidélité.
              </p>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   COMPONENTS
========================================================= */

function FeatureCard({
  icon,
  title,
  subtitle,
  onClick,
  featured = false,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick: () => void;
  featured?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-[22px] p-4 text-left transition active:scale-[0.98] ${
        featured
          ? 'bg-forest text-white shadow-lg'
          : 'bg-white text-forest shadow-sm ring-1 ring-ink/5'
      }`}
    >
      <div
        className={`grid h-10 w-10 place-items-center rounded-xl ${
          featured
            ? 'bg-white/10 text-gold'
            : 'bg-forest/5 text-forest'
        }`}
      >
        {icon}
      </div>

      <p className="mt-4 text-sm font-bold">{title}</p>

      <p
        className={`mt-1 text-[9px] ${
          featured ? 'text-white/45' : 'text-ink/35'
        }`}
      >
        {subtitle}
      </p>
    </button>
  );
}

function BackButton({
  onClick,
}: {
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 text-xs font-semibold text-forest"
    >
      <ArrowLeft size={15} />
      Accueil
    </button>
  );
}

function Empty({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="mt-8 rounded-[28px] bg-white p-8 text-center ring-1 ring-ink/5">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-forest/5 text-forest">
        {icon}
      </div>

      <h2 className="mt-4 font-display text-xl text-forest">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-ink/45">
        {text}
      </p>
    </div>
  );
}

function Step({
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
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gold/10 text-[9px] font-bold text-gold">
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

function NavButton({
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
      className={`flex min-h-[58px] flex-col items-center justify-center gap-1 rounded-[18px] px-2 py-2 transition-all duration-200 active:scale-95 ${
        active
          ? 'bg-forest text-white shadow-lg shadow-forest/20'
          : 'text-ink/40 hover:bg-forest/5 hover:text-forest'
      }`}
    >
      {icon}

      <span className="text-[9px] font-semibold">
        {label}
      </span>
    </button>
  );
}

function WifiCard({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [wifi, setWifi] = useState<{
    network_name: string;
    wifi_password: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadWifi = async () => {
      try {
        const { data, error } = await supabase.rpc('get_public_wifi', {
          p_establishment_id: establishmentId,
        });

        if (error) {
          console.error('Erreur lors du chargement du Wi-Fi:', error);
          return;
        }

        const wifiData = Array.isArray(data) ? data[0] : data;

        if (!cancelled && wifiData?.network_name) {
          setWifi({
            network_name: wifiData.network_name,
            wifi_password: wifiData.wifi_password || '',
          });
        }
      } catch (error) {
        console.error('Erreur inattendue lors du chargement du Wi-Fi:', error);
      }
    };

    loadWifi();

    return () => {
      cancelled = true;
    };
  }, [establishmentId]);

  if (!wifi) return null;

  return (
    <section className="rounded-[28px] bg-white p-5 shadow-sm ring-1 ring-ink/5">
      <div className="flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-forest/5 text-forest">
          <Wifi size={20} />
        </div>

        <div>
          <p className="font-display text-xl text-forest">
            Wi-Fi gratuit
          </p>

          <p className="mt-1 text-xs text-ink/40">
            Connectez-vous pendant votre visite.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-[#f7f5ef] px-3 py-1.5 text-xs font-semibold text-forest">
              {wifi.network_name}
            </span>

            {wifi.wifi_password && (
              <span className="rounded-full bg-gold/10 px-3 py-1.5 text-xs font-semibold text-gold">
                {wifi.wifi_password}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}