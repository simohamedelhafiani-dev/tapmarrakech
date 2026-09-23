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
  MessageCircle,
  Phone,
  Send,
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
  const { slug, section: routeSection } = useParams<{ slug: string; section?: string }>();

  const [place, setPlace] = useState<Establishment | null>(null);
  const [section, setSection] = useState<Section>(() => {
    const requested = routeSection || new URLSearchParams(window.location.search).get('section');
    return requested === 'menu' || requested === 'reviews' || requested === 'loyalty'
      ? requested
      : 'home';
  });

  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(true);
  const [menuTemplateConfig, setMenuTemplateConfig] = useState<Record<string, any> | null>(null);

  const [rating, setRating] = useState(0);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(true);

  const [showLoyaltyForm, setShowLoyaltyForm] = useState(false);
  const [loyaltyCreated, setLoyaltyCreated] = useState<any>(null);
  const [loyaltyCardUrl, setLoyaltyCardUrl] = useState('');
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
          'id,name,slug,logo_url,google_review_url,redirect_threshold,phone,email,address,city,description,website_url,instagram_url,facebook_url,tiktok_url,whatsapp_number,page_template_id,menu_template_id,menu_display_mode,menu_pdf_url,menu_ai_design,menu_ai_photo_mode'
        )
        .eq('slug', slug)
        .maybeSingle();

      if (!establishment) {
        setPlace(null);
        setLoading(false);
        return;
      }

      setPlace(establishment as unknown as Establishment);

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
        { data: selectedMenuTemplate },
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

        establishment.menu_template_id
          ? supabase
              .from('templates')
              .select('id,kind,config,active')
              .eq('kind', 'menu')
              .eq('active', true)
              .or(`id.eq.${establishment.menu_template_id},config->>key.eq.${establishment.menu_template_id}`)
              .maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      setCategories(menuCategories ?? []);
      setItems(menuItems ?? []);
      setPromotions(promotionRows ?? []);
      setRewards(rewardRows ?? []);
      setLoyaltyEnabled(loyaltySettings?.enabled ?? true);
      setMenuTemplateConfig(selectedMenuTemplate?.config ?? null);

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

    const { data: linkData, error: linkError } = await supabase.rpc(
      'get_public_loyalty_link',
      {
        p_establishment_id: place.id,
        p_loyalty_number: customer.loyalty_number,
        p_phone: loyaltyForm.phone.trim(),
      }
    );

    const loyaltyLink = Array.isArray(linkData) ? linkData[0]?.access_token : linkData?.access_token;

    if (linkError || !loyaltyLink) {
      setLoyaltyCreated(customer);
      setLoyaltyCardUrl('');
    } else {
      const url = new URL('/loyalty/' + loyaltyLink, window.location.origin).toString();
      setLoyaltyCreated(customer);
      setLoyaltyCardUrl(url);
      try {
        window.localStorage.setItem('tapmarrakech:customer-card-token', String(loyaltyLink));
      } catch {
        // Ignore storage restrictions; the permanent link remains available.
      }
    }

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
  const menuTemplate =
    menuTemplateConfig?.layout ||
    (p.menu_template_id === 'dark' || p.menu_template_id === 'cards' || p.menu_template_id === 'luxury'
      ? p.menu_template_id
      : 'editorial');
  const menuDisplayMode = p.menu_display_mode || 'digital';
  const menuPdfUrl = p.menu_pdf_url || '';
  const menuAiDesign = p.menu_ai_design || null;

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
            {/* PREMIUM ESTABLISHMENT HEADER */}
            <section className="relative overflow-hidden bg-forest px-5 pb-8 pt-5 text-white">
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-gold/10 blur-3xl" />
              <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-black/20 blur-3xl" />

              <div className="relative">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-semibold uppercase tracking-[0.28em] text-white/45">
                    Bienvenue
                  </span>
                  <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.16em] text-white/55">
                    Expérience client
                  </span>
                </div>

                <div className="mt-8 text-center">
                  {p.logo_url ? (
                    <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[26px] bg-white p-2 shadow-2xl">
                      <img
                        src={p.logo_url}
                        alt={p.name}
                        className="h-full w-full rounded-[18px] object-contain"
                      />
                    </div>
                  ) : (
                    <div className="mx-auto grid h-24 w-24 place-items-center rounded-[26px] bg-white/10 font-display text-4xl text-gold ring-1 ring-white/10">
                      {p.name?.[0] || 'E'}
                    </div>
                  )}

                  <h1 className="mt-5 font-display text-[34px] leading-tight">
                    {p.name}
                  </h1>

                  {description && (
                    <p className="mx-auto mt-2 max-w-[360px] text-sm leading-5 text-white/50">
                      {description}
                    </p>
                  )}

                  {(googleRating || googleReviewCount) && (
                    <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/8 px-4 py-2">
                      <Star size={14} fill="currentColor" className="text-gold" />
                      <span className="text-sm font-semibold">
                        {googleRating ? Number(googleRating).toFixed(1) : 'Google'}
                      </span>
                      {googleReviewCount && (
                        <span className="text-xs text-white/40">
                          · {googleReviewCount} avis
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="mt-7 flex flex-wrap justify-center gap-2">
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
                      href={`https://wa.me/${whatsapp.replace(/\D/g, '')}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2.5 text-xs font-semibold text-white ring-1 ring-white/10"
                    >
                      <MessageCircle size={14} />
                      WhatsApp
                    </a>
                  )}
                </div>
              </div>
            </section>

            {/* PUBLIC ACTIONS */}
            <main className="space-y-3 px-5 pt-5">
              {loyaltyEnabled && (
                <ActionRow
                  icon={<Heart size={22} />}
                  title="Rejoindre notre programme fidélité"
                  subtitle="Cumulez des points et profitez d’avantages exclusifs"
                  onClick={() => navigate('loyalty')}
                  accent="rose"
                />
              )}

              {place.google_review_url && (
                <ActionRow
                  icon={<Star size={22} />}
                  title="Laisser un avis Google"
                  subtitle="Votre avis compte beaucoup pour nous"
                  onClick={() => navigate('reviews')}
                  accent="blue"
                />
              )}

              {(menuPdfUrl || categories.length > 0 || items.length > 0) && (
                <ActionRow
                  icon={<UtensilsCrossed size={22} />}
                  title="Voir le menu"
                  subtitle="Découvrez nos plats et boissons"
                  onClick={() => navigate('menu')}
                  accent="orange"
                />
              )}

              <WifiActionRow establishmentId={p.id} />

              {directionsUrl && (
                <ActionRow
                  icon={<MapPin size={22} />}
                  title="Nous trouver"
                  subtitle={[address, city].filter(Boolean).join(', ')}
                  href={directionsUrl}
                  accent="gold"
                />
              )}

              {promotions.length > 0 && (
                <section className="pt-2">
                  <div className="mb-4 flex items-end justify-between">
                    <div>
                      <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-gold">Offres du moment</p>
                      <h2 className="mt-1 font-display text-2xl text-forest">Nos promotions</h2>
                    </div>
                    <Sparkles size={19} className="text-gold" />
                  </div>
                  <div className="-mx-5 flex gap-3 overflow-x-auto px-5 pb-2 scrollbar-hide">
                    {promotions.map((promotion) => (
                      <article key={promotion.id} className="min-w-[290px] overflow-hidden rounded-[26px] bg-forest shadow-lg">
                        {promotion.image_url ? (
                          <img src={promotion.image_url} alt={promotion.name} className="h-44 w-full object-cover" />
                        ) : (
                          <div className="grid h-32 place-items-center bg-forest text-white/30"><Gift size={30} /></div>
                        )}
                        <div className="p-4 text-white">
                          <h3 className="font-display text-xl">{promotion.name}</h3>
                          {promotion.description && <p className="mt-1 text-xs leading-5 text-white/50">{promotion.description}</p>}
                          <div className="mt-3 flex items-end justify-between gap-3">
                            <span className="inline-flex rounded-full bg-gold px-3 py-1 text-[9px] font-bold uppercase tracking-wider text-forest">Offre exclusive</span>
                            {promotion.promo_price !== null && (
                              <div className="text-right">
                                {promotion.normal_price !== null && <p className="text-[10px] text-white/35 line-through">{Number(promotion.normal_price).toLocaleString('fr-FR')} MAD</p>}
                                <p className="text-lg font-bold text-gold">{Number(promotion.promo_price).toLocaleString('fr-FR')} MAD</p>
                              </div>
                            )}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {(website || instagram || p.facebook_url || p.tiktok_url) && (
                <section className="pt-7 text-center">
                  <div className="flex items-center gap-3">
                    <div className="h-px flex-1 bg-ink/10" />
                    <span className="text-xs font-semibold text-ink/45">Suivez-nous</span>
                    <div className="h-px flex-1 bg-ink/10" />
                  </div>

                  <div className="mt-4 flex justify-center gap-3">
                    {instagram && (
                      <a
                        href={instagram}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Instagram"
                        className="grid h-11 w-11 place-items-center rounded-full bg-forest text-white"
                      >
                        <Instagram size={19} />
                      </a>
                    )}
                    {p.facebook_url && (
                      <a
                        href={p.facebook_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Facebook"
                        className="grid h-11 w-11 place-items-center rounded-full bg-forest text-sm font-bold text-white"
                      >
                        f
                      </a>
                    )}
                    {p.tiktok_url && (
                      <a
                        href={p.tiktok_url}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="TikTok"
                        className="grid h-11 w-11 place-items-center rounded-full bg-forest text-sm font-bold text-white"
                      >
                        ♪
                      </a>
                    )}
                    {website && (
                      <a
                        href={website.startsWith('http') ? website : `https://${website}`}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Site internet"
                        className="grid h-11 w-11 place-items-center rounded-full bg-forest text-white"
                      >
                        <ExternalLink size={18} />
                      </a>
                    )}
                  </div>
                </section>
              )}

              <footer className="pb-4 pt-6 text-center">
                <div className="flex items-center justify-center gap-2 text-[9px] font-semibold uppercase tracking-[0.18em] text-ink/25">
                  <div className="h-px w-12 bg-ink/10" />
                  <span>Propulsé par <strong className="text-ink/45">TapMarrakech</strong></span>
                  <div className="h-px w-12 bg-ink/10" />
                </div>
              </footer>
            </main>
          </>
        )}

        {/* =====================================================
            MENU
        ===================================================== */}
        {section === 'menu' && (
          <main
            className="relative -mx-5 min-h-screen overflow-hidden px-5 pb-16 pt-4 text-white"
            style={{
              backgroundImage:
                menuAiDesign?.background_image_url
                  ? `url("${menuAiDesign.background_image_url}")`
                  : Array.isArray(menuAiDesign?.wallpaper_library) && menuAiDesign.wallpaper_library[0]
                    ? `url("${menuAiDesign.wallpaper_library[0]}")`
                    : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center top',
              backgroundRepeat: 'no-repeat',
            }}
          >
            <div className="pointer-events-none absolute inset-0 bg-black/18" />

            <div className="relative z-10">
              <div className="flex items-center justify-between">
                {p.logo_url ? (
                  <div className="flex h-20 w-[150px] items-center justify-start">
                    <img
                      src={p.logo_url}
                      alt={p.name}
                      className="h-full w-full object-contain object-left drop-shadow-[0_6px_18px_rgba(0,0,0,0.35)]"
                    />
                  </div>
                ) : (
                  <div className="flex h-20 items-center font-display text-3xl text-gold">
                    {p.name?.[0] || 'E'}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => navigate('home')}
                  className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-3.5 py-2 text-xs font-semibold text-white/85"
                >
                  <ArrowLeft size={15} />
                  Accueil
                </button>
              </div>

              {menuDisplayMode === 'pdf' && menuPdfUrl ? (
                <section className="mt-6">
                  <div className="mb-4">
                    <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-gold">Menu</p>
                    <h1 className="mt-1 font-display text-4xl text-white">Notre menu</h1>
                    <p className="mt-2 text-sm text-white/65">Le menu original de l’établissement.</p>
                  </div>
                  <div className="overflow-hidden rounded-[24px] bg-black/30 shadow-xl ring-1 ring-white/15 backdrop-blur-md">
                    <iframe
                      src={menuPdfUrl}
                      title={`Menu PDF de ${p.name}`}
                      className="h-[75vh] min-h-[620px] w-full"
                    />
                  </div>
                  <a href={menuPdfUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-full bg-gold px-5 py-3.5 text-sm font-semibold text-forest">
                    Ouvrir le menu en plein écran
                    <ExternalLink size={15} />
                  </a>
                </section>
              ) : menuAiDesign?.sections?.length ? (
                <AIPremiumMenu
                  design={menuAiDesign}
                  place={p}
                  categories={categories}
                  items={items}
                  itemsByCategory={itemsByCategory}
                  photoMode={(p as any).menu_ai_photo_mode === 'without_photos' ? 'without_photos' : 'with_photos'}
                />
              ) : (
                <MenuTemplate
                  template={menuTemplate}
                  place={p}
                  categories={categories}
                  itemsByCategory={itemsByCategory}
                />
              )}
            </div>
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
                      <CheckCircle2 size={34} className="text-gold" />

                      <p className="mt-6 text-[9px] font-bold uppercase tracking-[0.25em] text-gold">
                        Bienvenue dans le programme
                      </p>

                      <h2 className="mt-2 font-display text-3xl">
                        {loyaltyCreated.first_name}
                      </h2>

                      <div className="mt-7 rounded-[22px] border border-white/10 bg-white/5 p-5">
                        <div className="flex items-center justify-between gap-4">
                          <div>
                            <p className="text-[9px] uppercase tracking-[0.18em] text-white/35">
                              Carte fidélité
                            </p>
                            <p className="mt-2 text-sm font-semibold text-white">
                              Votre carte est prête
                            </p>
                            <p className="mt-1 text-[10px] leading-4 text-white/40">
                              Gardez-la sur votre téléphone pour la présenter à chaque visite.
                            </p>
                          </div>
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gold/15 text-gold">
                            <Gift size={21} />
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl bg-black/10 px-3 py-2.5">
                          <p className="text-[8px] uppercase tracking-[0.16em] text-white/30">
                            N° carte
                          </p>
                          <p className="mt-1 text-xs font-semibold tracking-[0.08em] text-white/75">
                            {loyaltyCreated.loyalty_number}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3">
                        <div className="rounded-2xl bg-white/5 p-4">
                          <p className="text-[9px] uppercase text-white/35">Points</p>
                          <p className="mt-1 text-xl font-bold">{loyaltyCreated.points_balance ?? 0}</p>
                        </div>
                        <div className="rounded-2xl bg-white/5 p-4">
                          <p className="text-[9px] uppercase text-white/35">Visites</p>
                          <p className="mt-1 text-xl font-bold">{loyaltyCreated.visit_count ?? 0}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {loyaltyCardUrl && (
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      <a
                        href={loyaltyCardUrl}
                        className="flex items-center justify-center rounded-full bg-forest px-4 py-3 text-sm font-semibold text-white"
                      >
                        Ouvrir ma carte
                      </a>
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(loyaltyCardUrl)}
                        className="rounded-full border border-ink/10 bg-white px-4 py-3 text-sm font-semibold text-forest"
                      >
                        Copier le lien
                      </button>
                    </div>
                  )}

                  {loyaltyCardUrl && (
                    <button
                      type="button"
                      onClick={async () => {
                        if (navigator.share) {
                          await navigator.share({
                            title: 'Ma carte fidélité',
                            text: 'Voici ma carte fidélité.',
                            url: loyaltyCardUrl,
                          });
                          return;
                        }
                        await navigator.clipboard.writeText(loyaltyCardUrl);
                      }}
                      className="mt-3 w-full rounded-full bg-gold px-5 py-3.5 text-sm font-bold text-forest"
                    >
                      Partager / enregistrer ma carte
                    </button>
                  )}

                  <button
                    onClick={() => setLoyaltyCreated(null)}
                    className="mt-3 w-full rounded-full border border-ink/10 bg-white py-3 text-sm font-semibold text-forest"
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
      </div>

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

function ActionRow({
  icon,
  title,
  subtitle,
  onClick,
  href,
  accent = 'green',
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  onClick?: () => void;
  href?: string;
  accent?: 'green' | 'rose' | 'blue' | 'orange' | 'gold';
}) {
  const accentClasses = {
    green: 'bg-emerald-50 text-emerald-600',
    rose: 'bg-rose-50 text-rose-500',
    blue: 'bg-blue-50 text-blue-500',
    orange: 'bg-orange-50 text-orange-500',
    gold: 'bg-amber-50 text-amber-600',
  } as const;

  const className = "group flex w-full items-center gap-4 rounded-[24px] bg-white p-4 text-left shadow-sm ring-1 ring-ink/5 transition active:scale-[0.99]";

  const contentNode = (
    <>
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-[17px] ${accentClasses[accent]}`}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-bold text-forest">{title}</p>
        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-ink/45">{subtitle}</p>
      </div>

      <ArrowRight size={19} className="shrink-0 text-ink/35 transition-transform group-hover:translate-x-0.5" />
    </>
  );

  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className={className}>
        {contentNode}
      </a>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {contentNode}
    </button>
  );
}

function AIPremiumMenu({
  design,
  place,
  categories,
  items,
  itemsByCategory,
  photoMode,
}: {
  design: any;
  place: any;
  categories: MenuCategory[];
  items: MenuItem[];
  itemsByCategory: Record<string, MenuItem[]>;
  photoMode: 'with_photos' | 'without_photos';
}) {
  const style = design?.style ?? 'editorial';
  const sections = Array.isArray(design?.sections) ? design.sections : [];
  const itemMap = new Map(items.map((item) => [item.id, item]));
  const categoryMap = new Map(categories.map((category) => [category.id, category]));

  const visibleSections = sections.filter((section: any) => {
    if (section?.type === 'featured') {
      return Array.isArray(section.item_ids) && section.item_ids.some((id: string) => itemMap.has(id));
    }
    return Boolean(
      section?.category_id &&
      categoryMap.has(section.category_id) &&
      (itemsByCategory[section.category_id] ?? []).length
    );
  });

  const navSections = visibleSections.filter((section: any) => section?.title).slice(0, 12);

  const wallpaper =
    design?.background_image_url ||
    (Array.isArray(design?.wallpaper_library) ? design.wallpaper_library[0] : null) ||
    null;

  const palette = wallpaper
    ? {
        page: 'bg-transparent text-white',
        body: 'bg-transparent',
        muted: 'text-white/65',
        accent: 'text-gold',
        line: 'border-white/15',
        card: 'bg-black/35 border-white/15',
        product: 'text-white',
      }
    : style === 'dark'
      ? {
          page: 'bg-[#102b24] text-white',
          body: 'bg-[#102b24]',
          muted: 'text-white/55',
          accent: 'text-gold',
          line: 'border-white/10',
          card: 'bg-white/[0.055] border-white/10',
          product: 'text-white',
        }
      : style === 'luxury'
        ? {
            page: 'bg-[#f3eee2] text-forest',
            body: 'bg-[#f3eee2]',
            muted: 'text-ink/55',
            accent: 'text-gold',
            line: 'border-gold/20',
            card: 'bg-[#fffdf7] border-gold/15',
            product: 'text-forest',
          }
        : style === 'immersive'
          ? {
              page: 'bg-[#ebe5d8] text-forest',
              body: 'bg-[#ebe5d8]',
              muted: 'text-ink/55',
              accent: 'text-gold',
              line: 'border-forest/10',
              card: 'bg-[#fffaf0] border-forest/10',
              product: 'text-forest',
            }
          : {
              page: 'bg-[#f0ece2] text-forest',
              body: 'bg-[#f0ece2]',
              muted: 'text-ink/55',
              accent: 'text-gold',
              line: 'border-forest/10',
              card: 'bg-[#fffdf8] border-ink/10',
              product: 'text-forest',
            };

  const scrollToSection = (index: number) => {
    document.getElementById(`ai-menu-section-${index}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  return (
    <div className={`relative mt-2 overflow-hidden ${wallpaper ? 'bg-transparent' : palette.page}`}>
      <section
        className={`relative overflow-hidden px-5 pb-10 pt-7 ${
          wallpaper ? 'bg-black/20' : style === 'dark' ? 'bg-[#0d241e]' : 'bg-[#173d32]'
        }`}
      >
        <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-gold/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full bg-black/20 blur-3xl" />

        <div className="relative">
          <p className="text-[9px] font-bold uppercase tracking-[0.34em] text-gold">
            {design.hero?.eyebrow || place.name || 'La carte'}
          </p>
          <h1 className="mt-2 max-w-[430px] font-display text-[42px] leading-[0.94] text-white">
            {design.hero?.title || place.name || 'Notre menu'}
          </h1>
          {design.hero?.subtitle && (
            <p className="mt-4 max-w-[390px] text-sm leading-6 text-white/60">
              {design.hero.subtitle}
            </p>
          )}
        </div>
      </section>

      {navSections.length > 1 && (
        <div className={`sticky top-0 z-20 overflow-x-auto border-b px-5 py-3 scrollbar-hide ${
          wallpaper ? 'border-white/10 bg-black/45' : 'border-ink/10 bg-[#f0ece2]/95'
        }`}>
          <div className="flex min-w-max gap-2">
            {navSections.map((section: any, index: number) => (
              <button
                key={`nav-${index}`}
                type="button"
                onClick={() => scrollToSection(visibleSections.indexOf(section))}
                className={
                  'rounded-full border px-4 py-2 text-[10px] font-semibold shadow-sm ' +
                  (index === 0
                    ? 'border-gold/60 bg-gold text-forest'
                    : wallpaper
                      ? 'border-white/20 bg-black/25 text-white'
                      : 'border-forest/10 bg-white/75 text-forest')
                }
              >
                {section.title}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className={`relative px-5 pb-14 pt-8 ${wallpaper ? 'bg-transparent' : palette.body}`}>
        {(design.intro?.title || design.intro?.text) && (
          <section className={`mb-10 rounded-[28px] border p-5 shadow-xl ${palette.card}`}>
            {design.intro.title && (
              <h2 className={`font-display text-2xl ${palette.product}`}>
                {design.intro.title}
              </h2>
            )}
            {design.intro.text && (
              <p className={`mt-2 text-sm leading-6 ${palette.muted}`}>
                {design.intro.text}
              </p>
            )}
          </section>
        )}

        <div className="space-y-12">
          {visibleSections.map((section: any, index: number) => {
            const sectionItems =
              section.type === 'featured'
                ? (section.item_ids ?? [])
                    .map((id: string) => itemMap.get(id))
                    .filter(Boolean) as MenuItem[]
                : (itemsByCategory[section.category_id] ?? []);

            if (!sectionItems.length) return null;

            const layout = wallpaper
              ? 'list'
              : section.type === 'featured'
                ? 'feature'
                : section.layout === 'list'
                  ? 'list'
                  : section.layout === 'feature'
                    ? 'feature'
                    : 'grid';

            return (
              <section
                id={`ai-menu-section-${index}`}
                key={`${section.type}-${section.category_id ?? index}-${index}`}
                className="scroll-mt-20"
              >
                <div className="mb-5">
                  <div className="flex items-center gap-3">
                    <span className={`h-px w-8 ${style === 'dark' ? 'bg-gold/50' : 'bg-gold'}`} />
                    <p className={`text-[8px] font-bold uppercase tracking-[0.3em] ${palette.accent}`}>
                      {section.type === 'featured' ? 'Les signatures' : 'La sélection'}
                    </p>
                  </div>
                  <h2 className={`mt-2 font-display text-[30px] leading-tight ${palette.product}`}>
                    {section.title}
                  </h2>
                  {section.subtitle && (
                    <p className={`mt-1.5 max-w-[390px] text-xs leading-5 ${palette.muted}`}>
                      {section.subtitle}
                    </p>
                  )}
                </div>

                {layout === 'feature' ? (
                  <div className="space-y-4">
                    {sectionItems.slice(0, 4).map((item) => (
                      <article
                        key={item.id}
                        className={`overflow-hidden rounded-[26px] border shadow-sm ${palette.card}`}
                      >
                        {photoMode === 'with_photos' && item.image_url && (
                          <img src={item.image_url} alt="" className="h-48 w-full object-cover" />
                        )}
                        <div className="p-5">
                          <div className="flex items-start justify-between gap-4">
                            <h3 className={`text-[16px] font-bold leading-5 ${palette.product}`}>
                              {item.name}
                            </h3>
                            <span className={`shrink-0 text-sm font-bold ${palette.accent}`}>
                              {Number(item.price).toLocaleString('fr-FR')} MAD
                            </span>
                          </div>
                          {item.description && (
                            <p className={`mt-2 text-xs leading-5 ${palette.muted}`}>
                              {item.description}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : layout === 'grid' ? (
                  <div className="grid grid-cols-2 gap-3">
                    {sectionItems.map((item) => (
                      <article
                        key={item.id}
                        className={`overflow-hidden rounded-[22px] border shadow-sm ${palette.card}`}
                      >
                        {photoMode === 'with_photos' && item.image_url ? (
                          <img src={item.image_url} alt="" className="aspect-[1.15] w-full object-cover" />
                        ) : null}
                        <div className="p-3.5">
                          <h3 className={`line-clamp-2 text-sm font-bold leading-5 ${palette.product}`}>
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className={`mt-1.5 line-clamp-3 text-[10px] leading-4 ${palette.muted}`}>
                              {item.description}
                            </p>
                          )}
                          <p className={`mt-3 text-sm font-bold ${palette.accent}`}>
                            {Number(item.price).toLocaleString('fr-FR')} MAD
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : wallpaper ? (
                  <div className="space-y-3">
                    {sectionItems.map((item) => (
                      <article
                        key={item.id}
                        className="flex items-center gap-3 overflow-hidden rounded-[22px] border border-white/15 bg-black/38 p-2.5 shadow-lg"
                      >
                        {photoMode === 'with_photos' && item.image_url ? (
                          <img
                            src={item.image_url}
                            alt=""
                            className="h-[74px] w-[74px] shrink-0 rounded-[16px] object-cover"
                          />
                        ) : (
                          <div className="h-[74px] w-[74px] shrink-0 rounded-[16px] bg-white/10" />
                        )}
                        <div className="min-w-0 flex-1 py-1">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="text-[14px] font-bold leading-5 text-white">
                              {item.name}
                            </h3>
                            <span className="shrink-0 text-[13px] font-bold text-gold">
                              {Number(item.price).toLocaleString('fr-FR')} MAD
                            </span>
                          </div>
                          {item.description && (
                            <p className="mt-1 text-[10px] leading-4 text-white/60">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={`overflow-hidden rounded-[24px] border shadow-sm ${palette.card}`}>
                    {sectionItems.map((item) => (
                      <article
                        key={item.id}
                        className="flex items-start justify-between gap-4 border-b border-current/10 p-4 last:border-b-0"
                      >
                        <div className="min-w-0">
                          <h3 className={`text-[15px] font-semibold leading-5 ${palette.product}`}>
                            {item.name}
                          </h3>
                          {item.description && (
                            <p className={`mt-1 text-[11px] leading-5 ${palette.muted}`}>
                              {item.description}
                            </p>
                          )}
                        </div>
                        <span className={`shrink-0 text-sm font-bold ${palette.accent}`}>
                          {Number(item.price).toLocaleString('fr-FR')} MAD
                        </span>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MenuTemplate({
  template,
  place,
  categories,
  itemsByCategory,
}: {
  template: string;
  place: any;
  categories: MenuCategory[];
  itemsByCategory: Record<string, MenuItem[]>;
}) {
  const visible = categories.filter((category) => (itemsByCategory[category.id] ?? []).length > 0);

  if (!visible.length) {
    return (
      <div className="mt-7">
        <p className="text-[9px] font-bold uppercase tracking-[0.28em] text-gold">Découvrez</p>
        <h1 className="mt-1 font-display text-4xl text-forest">Notre menu</h1>
        <Empty icon={<UtensilsCrossed size={22} />} title="Menu bientôt disponible" text="Le contenu apparaîtra ici dès qu’il sera ajouté." />
      </div>
    );
  }

  if (template === 'dark') {
    return (
      <div className="mt-6 -mx-5 overflow-hidden bg-[#102b24] px-5 pb-10 pt-7 text-white">
        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold">Menu</p>
        <h1 className="mt-2 font-display text-5xl leading-none">{place.name || 'Notre carte'}</h1>
        <p className="mt-3 text-sm text-white/45">Une carte pensée pour être consultée simplement.</p>
        <div className="mt-8 space-y-8">
          {visible.map((category) => (
            <section key={category.id}>
              <div className="mb-4 flex items-end justify-between gap-4">
                <h2 className="font-display text-2xl text-gold">{category.name}</h2>
                {category.description && <p className="max-w-[180px] text-right text-[10px] leading-4 text-white/35">{category.description}</p>}
              </div>
              <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/[0.03]">
                {(itemsByCategory[category.id] ?? []).map((item) => (
                  <article key={item.id} className="flex items-start justify-between gap-4 p-4">
                    <div className="min-w-0">
                      <h3 className="font-semibold">{item.name}</h3>
                      {item.description && <p className="mt-1 text-xs leading-5 text-white/40">{item.description}</p>}
                    </div>
                    <span className="shrink-0 font-semibold text-gold">{Number(item.price).toLocaleString('fr-FR')} MAD</span>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  if (template === 'cards') {
    return (
      <div className="mt-7">
        <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold">Découvrez</p>
        <h1 className="mt-1 font-display text-4xl text-forest">Notre carte</h1>
        <p className="mt-2 text-sm text-ink/45">Choisissez votre envie.</p>
        <div className="mt-7 space-y-8">
          {visible.map((category) => (
            <section key={category.id}>
              <div className="mb-4 flex items-end justify-between">
                <h2 className="font-display text-2xl text-forest">{category.name}</h2>
                <span className="text-[9px] uppercase tracking-widest text-ink/30">{(itemsByCategory[category.id] ?? []).length} choix</span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(itemsByCategory[category.id] ?? []).map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-[24px] bg-white shadow-sm ring-1 ring-ink/5">
                    <div className="aspect-[1.15] overflow-hidden bg-[#eee9df]">
                      {item.image_url ? <img src={item.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-ink/15"><UtensilsCrossed size={25} /></div>}
                    </div>
                    <div className="p-3.5">
                      <h3 className="line-clamp-2 text-sm font-bold text-forest">{item.name}</h3>
                      {item.description && <p className="mt-1.5 line-clamp-2 text-[10px] leading-4 text-ink/40">{item.description}</p>}
                      <p className="mt-3 text-sm font-bold text-gold">{Number(item.price).toLocaleString('fr-FR')} MAD</p>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  if (template === 'luxury') {
    return (
      <div className="mt-7">
        <div className="border-y border-gold/30 py-7 text-center">
          <p className="text-[9px] font-bold uppercase tracking-[0.35em] text-gold">La carte</p>
          <h1 className="mt-2 font-display text-5xl text-forest">{place.name || 'Menu'}</h1>
          <p className="mx-auto mt-3 max-w-xs text-xs leading-5 text-ink/45">Une sélection préparée avec soin.</p>
        </div>
        <div className="mt-8 space-y-10">
          {visible.map((category) => (
            <section key={category.id}>
              <div className="mb-5 text-center">
                <span className="text-[8px] font-bold uppercase tracking-[0.35em] text-gold">Sélection</span>
                <h2 className="mt-1 font-display text-3xl text-forest">{category.name}</h2>
                {category.description && <p className="mt-1 text-xs text-ink/40">{category.description}</p>}
              </div>
              <div className="space-y-5">
                {(itemsByCategory[category.id] ?? []).map((item) => (
                  <article key={item.id} className="group">
                    <div className="flex items-baseline gap-3">
                      <h3 className="text-[15px] font-semibold text-forest">{item.name}</h3>
                      <div className="h-px flex-1 border-t border-dotted border-ink/15" />
                      <span className="text-sm font-bold text-gold">{Number(item.price).toLocaleString('fr-FR')} MAD</span>
                    </div>
                    {item.description && <p className="mt-1.5 max-w-[85%] text-[11px] leading-5 text-ink/40">{item.description}</p>}
                  </article>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-7">
      <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-gold">Découvrez</p>
      <h1 className="mt-1 font-display text-4xl text-forest">Notre menu</h1>
      <p className="mt-2 text-sm text-ink/45">Une sélection préparée pour vous.</p>
      <div className="mt-8 space-y-8">
        {visible.map((category) => (
          <section key={category.id}>
            <h2 className="mb-4 font-display text-2xl text-forest">{category.name}</h2>
            <div className="space-y-3">
              {(itemsByCategory[category.id] ?? []).map((item) => (
                <article key={item.id} className="flex overflow-hidden rounded-[22px] bg-white p-3 shadow-sm ring-1 ring-ink/5">
                  {item.image_url && <img src={item.image_url} alt="" className="h-24 w-24 shrink-0 rounded-[16px] object-cover" />}
                  <div className="min-w-0 flex-1 p-2">
                    <div className="flex items-start justify-between gap-3"><h3 className="font-semibold text-forest">{item.name}</h3><span className="shrink-0 text-sm font-bold text-gold">{Number(item.price).toLocaleString('fr-FR')} MAD</span></div>
                    {item.description && <p className="mt-2 text-xs leading-5 text-ink/45">{item.description}</p>}
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
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

function WifiActionRow({
  establishmentId,
}: {
  establishmentId: string;
}) {
  const [wifi, setWifi] = useState<{
    network_name: string;
    wifi_password: string;
  } | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<'network' | 'password' | ''>('');

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

    void loadWifi();

    return () => {
      cancelled = true;
    };
  }, [establishmentId]);

  const copy = async (value: string, type: 'network' | 'password') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(type);
      window.setTimeout(() => setCopied(''), 1600);
    } catch {
      // Clipboard may be unavailable in some browsers.
    }
  };

  if (!wifi) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group flex w-full items-center gap-4 rounded-[24px] bg-white p-4 text-left shadow-sm ring-1 ring-ink/5 transition active:scale-[0.99]"
      >
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-[17px] bg-emerald-50 text-emerald-600">
          <Wifi size={22} />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-bold text-forest">Se connecter au Wi-Fi</p>
          <p className="mt-1 text-[11px] leading-5 text-ink/45">
            Appuyez ici pour afficher les informations de connexion.
          </p>
        </div>

        <ArrowRight size={19} className="shrink-0 text-ink/35" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/50 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-[380px] rounded-[30px] bg-[#fffdf9] p-6 shadow-2xl">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="ml-auto grid h-9 w-9 place-items-center rounded-full bg-ink/5 text-ink/45"
              aria-label="Fermer"
            >
              <X size={17} />
            </button>

            <div className="mx-auto mt-1 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
              <Wifi size={23} />
            </div>

            <h2 className="mt-4 text-center font-display text-2xl text-forest">
              Connexion Wi-Fi
            </h2>

            <p className="mt-1 text-center text-sm leading-5 text-ink/45">
              Connectez votre téléphone au réseau ci-dessous.
            </p>

            <div className="mt-5 rounded-2xl border border-ink/5 bg-[#f7f7f3] p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink/40">Réseau Wi-Fi</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 break-all text-sm font-bold text-forest">{wifi.network_name}</p>
                <button
                  type="button"
                  onClick={() => copy(wifi.network_name, 'network')}
                  className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-semibold text-forest ring-1 ring-ink/5"
                >
                  {copied === 'network' ? 'Copié' : 'Copier'}
                </button>
              </div>
            </div>

            <div className="mt-3 rounded-2xl border border-ink/5 bg-[#f7f7f3] p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-ink/40">Mot de passe</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="min-w-0 flex-1 break-all text-sm font-bold text-forest">
                  {wifi.wifi_password || 'Aucun mot de passe'}
                </p>
                {wifi.wifi_password && (
                  <button
                    type="button"
                    onClick={() => copy(wifi.wifi_password, 'password')}
                    className="shrink-0 rounded-full bg-white px-3 py-2 text-[10px] font-semibold text-forest ring-1 ring-ink/5"
                  >
                    {copied === 'password' ? 'Copié' : 'Copier'}
                  </button>
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="mt-5 w-full rounded-full bg-forest px-5 py-3.5 text-sm font-semibold text-white"
            >
              Fermer
            </button>
          </div>
        </div>
      )}
    </>
  );
}