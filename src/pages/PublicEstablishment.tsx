import { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays,
  ChevronRight,
  Gift,
  Instagram,
  MapPin,
  MessageCircle,
  Phone,
  Star,
  UtensilsCrossed,
  Wifi,
  X,
} from 'lucide-react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

type EstablishmentPublic = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  google_review_url: string;
  business_type: string | null;
  city: string | null;
  description: string | null;
  phone: string | null;
  email: string | null;
  website_url: string | null;
  instagram_url: string | null;
  whatsapp_number: string | null;
  theme_config: Record<string, unknown> | null;
};

type WifiData = {
  network_name: string | null;
  wifi_password: string | null;
  security_type: string;
};

const themeString = (config: Record<string, unknown> | null, key: string) => {
  const value = config?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
};

const normalizeWhatsApp = (value: string) => value.replace(/\D/g, '');

export default function PublicEstablishment() {
  const { slug } = useParams<{ slug: string }>();
  const [establishment, setEstablishment] = useState<EstablishmentPublic | null>(null);
  const [wifi, setWifi] = useState<WifiData | null>(null);
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(false);
  const [wifiOpen, setWifiOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const load = async () => {
      if (!slug) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('establishments')
        .select(
          'id,name,slug,logo_url,google_review_url,business_type,city,description,phone,email,website_url,instagram_url,whatsapp_number,theme_config'
        )
        .eq('slug', slug)
        .maybeSingle();

      if (error || !data) {
        if (active) {
          setEstablishment(null);
          setLoading(false);
        }
        return;
      }

      const [wifiResult, loyaltyResult] = await Promise.all([
        supabase
          .from('establishment_wifi')
          .select('network_name,wifi_password,security_type')
          .eq('establishment_id', data.id)
          .eq('active', true)
          .maybeSingle(),
        supabase
          .from('loyalty_settings')
          .select('enabled')
          .eq('establishment_id', data.id)
          .maybeSingle(),
      ]);

      if (!active) return;

      setEstablishment(data as EstablishmentPublic);
      setWifi(wifiResult.data ?? null);
      setLoyaltyEnabled(loyaltyResult.data?.enabled ?? false);
      setLoading(false);

      void supabase.from('analytics_events').insert({
        establishment_id: data.id,
        event_type: 'page_view',
      });
    };

    void load();
    return () => {
      active = false;
    };
  }, [slug]);

  const theme = establishment?.theme_config ?? null;
  const coverUrl = useMemo(() => themeString(theme, 'cover_url'), [theme]);
  const slogan = useMemo(
    () => themeString(theme, 'slogan') ?? 'Votre expérience commence ici.',
    [theme]
  );
  const bookingUrl = useMemo(
    () => themeString(theme, 'booking_url') ?? establishment?.website_url ?? null,
    [theme, establishment?.website_url]
  );
  const mapsUrl = useMemo(() => themeString(theme, 'maps_url'), [theme]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f7f7f3] px-4 py-8">
        <div className="mx-auto max-w-[520px] animate-pulse">
          <div className="h-[360px] rounded-[32px] bg-[#e9e9e3]" />
          <div className="mt-5 grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-32 rounded-2xl bg-white" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!establishment) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#f7f7f3] px-6 text-center">
        <div>
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-[#173d32] text-[#d3a84c]">
            <MapPin size={28} />
          </div>
          <h1 className="mt-5 font-display text-3xl text-[#173d32]">
            Établissement introuvable
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Ce lien public n'est pas disponible ou l'établissement n'existe plus.
          </p>
        </div>
      </div>
    );
  }

  const menuUrl = '/r/' + establishment.slug + '?section=menu';
  const loyaltyUrl = '/r/' + establishment.slug + '?section=loyalty';
  const contactHref = establishment.whatsapp_number
    ? 'https://wa.me/' + normalizeWhatsApp(establishment.whatsapp_number)
    : establishment.phone
      ? 'tel:' + establishment.phone
      : establishment.email
        ? 'mailto:' + establishment.email
        : null;

  const actions = [
    {
      title: 'Découvrir notre menu',
      description: 'Plats, boissons et spécialités',
      icon: UtensilsCrossed,
      href: menuUrl,
      primary: true,
      external: false,
    },
    ...(establishment.google_review_url
      ? [
          {
            title: 'Laisser un avis Google',
            description: 'Votre avis compte !',
            icon: Star,
            href: establishment.google_review_url,
            primary: false,
            external: true,
          },
        ]
      : []),
    ...(loyaltyEnabled
      ? [
          {
            title: 'Programme fidélité',
            description: 'Cumulez des points et recevez des récompenses',
            icon: Gift,
            href: loyaltyUrl,
            primary: false,
            external: false,
          },
        ]
      : []),
    ...(wifi
      ? [
          {
            title: 'Wi-Fi gratuit',
            description: 'Connectez-vous en un clic',
            icon: Wifi,
            href: '#wifi',
            primary: false,
            external: false,
          },
        ]
      : []),
    ...(contactHref
      ? [
          {
            title: 'Nous contacter',
            description: 'Question, réservation ou demande spéciale',
            icon: MessageCircle,
            href: contactHref,
            primary: false,
            external: true,
          },
        ]
      : []),
    ...(bookingUrl
      ? [
          {
            title: 'Réserver une table',
            description: 'Réservez votre prochaine expérience',
            icon: CalendarDays,
            href: bookingUrl,
            primary: false,
            external: true,
          },
        ]
      : []),
    ...(establishment.instagram_url
      ? [
          {
            title: 'Nous suivre',
            description: 'Actualités, événements et coulisses',
            icon: Instagram,
            href: establishment.instagram_url,
            primary: false,
            external: true,
          },
        ]
      : []),
    ...(mapsUrl
      ? [
          {
            title: 'Nous trouver',
            description: 'Itinéraire sur Google Maps',
            icon: MapPin,
            href: mapsUrl,
            primary: false,
            external: true,
          },
        ]
      : []),
  ];

  return (
    <main className="min-h-screen bg-[#f7f7f3] text-[#173d32]">
      <div className="mx-auto min-h-screen w-full max-w-[520px] overflow-hidden bg-[#f7f7f3] shadow-[0_0_60px_rgba(23,61,50,0.08)]">
        <section
          className="relative min-h-[390px] overflow-hidden bg-[#173d32]"
          style={
            coverUrl
              ? {
                  backgroundImage:
                    'linear-gradient(180deg, rgba(10,37,30,0.16), rgba(10,37,30,0.88)), url("' +
                    coverUrl +
                    '")',
                  backgroundPosition: 'center',
                  backgroundSize: 'cover',
                }
              : undefined
          }
        >
          {!coverUrl && (
            <>
              <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full border border-white/10" />
              <div className="absolute -bottom-32 -left-28 h-80 w-80 rounded-full border border-[#d3a84c]/15" />
            </>
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-5">
            <div className="text-xs font-medium uppercase tracking-[0.24em] text-white/65">
              Tap Marrakech
            </div>
            <button
              type="button"
              className="rounded-full border border-white/15 bg-[#173d32]/70 px-3 py-2 text-xs font-semibold text-white backdrop-blur"
            >
              FR <span className="ml-1 text-white/50">⌄</span>
            </button>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-6 pb-9 pt-24 text-center text-white">
            {establishment.logo_url ? (
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center overflow-hidden rounded-full border border-white/30 bg-white/10 p-1 backdrop-blur">
                <img
                  src={establishment.logo_url}
                  alt={establishment.name}
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
            ) : (
              <div className="mx-auto mb-5 grid h-20 w-20 place-items-center rounded-full border border-[#d3a84c]/60 bg-[#173d32]/70 font-display text-2xl text-[#d3a84c]">
                {establishment.name.charAt(0).toUpperCase()}
              </div>
            )}

            <h1 className="font-display text-[38px] leading-none tracking-[-0.03em] sm:text-5xl">
              {establishment.name}
            </h1>

            <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/70">
              {establishment.business_type ?? 'Établissement'}
              {establishment.city ? ' • ' + establishment.city : ''}
            </p>

            <p className="mx-auto mt-6 max-w-sm font-display text-xl italic text-white/90">
              {slogan}
            </p>

            {establishment.description && (
              <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-white/65">
                {establishment.description}
              </p>
            )}
          </div>
        </section>

        <section className="relative -mt-4 rounded-t-[30px] bg-[#f7f7f3] px-4 pb-2 pt-6">
          <div className="grid grid-cols-2 gap-3">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <a
                  key={action.title}
                  href={action.href}
                  target={action.external ? '_blank' : undefined}
                  rel={action.external ? 'noreferrer' : undefined}
                  onClick={(event) => {
                    if (action.title === 'Wi-Fi gratuit') {
                      event.preventDefault();
                      setWifiOpen(true);
                    }
                  }}
                  className={[
                    'group flex min-h-[142px] flex-col justify-between rounded-[20px] border p-4 no-underline transition duration-200 active:scale-[0.98]',
                    action.primary
                      ? 'border-[#173d32] bg-[#173d32] text-white shadow-[0_10px_30px_rgba(23,61,50,0.14)]'
                      : 'border-black/[0.06] bg-white text-[#173d32] shadow-[0_6px_24px_rgba(23,61,50,0.05)]',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div
                      className={[
                        'grid h-11 w-11 place-items-center rounded-[14px]',
                        action.primary
                          ? 'bg-[#d3a84c] text-[#173d32]'
                          : 'bg-[#f4ead3] text-[#173d32]',
                      ].join(' ')}
                    >
                      <Icon size={22} strokeWidth={1.8} />
                    </div>
                    <ChevronRight size={19} className="mt-1 opacity-60" />
                  </div>
                  <div>
                    <h2 className="font-display text-[17px] leading-tight">
                      {action.title}
                    </h2>
                    <p
                      className={[
                        'mt-1.5 text-[11px] leading-[1.45]',
                        action.primary ? 'text-white/65' : 'text-slate-500',
                      ].join(' ')}
                    >
                      {action.description}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>

          {loyaltyEnabled && (
            <a
              href={loyaltyUrl}
              className="mt-3 flex items-center gap-3 rounded-[20px] bg-[#173d32] p-4 text-white no-underline shadow-[0_10px_30px_rgba(23,61,50,0.12)]"
            >
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[#d3a84c]/15 text-[#d3a84c]">
                <Gift size={25} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="font-display text-[17px]">
                  Rejoignez notre programme fidélité
                </h2>
                <p className="mt-1 text-[11px] text-white/65">
                  Des avantages exclusifs vous attendent.
                </p>
              </div>
              <span className="flex shrink-0 items-center gap-1 rounded-xl bg-[#d3a84c] px-3 py-2 text-[11px] font-bold text-[#173d32]">
                Je m'inscris <ChevronRight size={15} />
              </span>
            </a>
          )}
        </section>

        <footer className="mt-8 rounded-t-[50%_50%_0_0] bg-[#ece9df] px-6 pb-8 pt-12 text-center">
          <p className="font-display text-[28px] italic text-[#173d32]">
            Des moments qui restent.
          </p>
          <div className="mx-auto mt-3 h-0.5 w-10 bg-[#d3a84c]" />
          <p className="mt-5 text-sm text-slate-500">Merci de votre visite.</p>

          <div className="mt-8">
            <p className="font-display text-lg text-[#173d32]">
              {establishment.name}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {establishment.business_type ?? 'Établissement'}
              {establishment.city ? ' • ' + establishment.city : ''}
            </p>
          </div>

          <div className="mt-8 flex items-center justify-center gap-3">
            {establishment.instagram_url && (
              <a
                href={establishment.instagram_url}
                target="_blank"
                rel="noreferrer"
                aria-label="Instagram"
                className="grid h-10 w-10 place-items-center rounded-full bg-[#173d32] text-white"
              >
                <Instagram size={18} />
              </a>
            )}
            {establishment.whatsapp_number && contactHref && (
              <a
                href={contactHref}
                target="_blank"
                rel="noreferrer"
                aria-label="WhatsApp"
                className="grid h-10 w-10 place-items-center rounded-full bg-[#173d32] text-white"
              >
                <MessageCircle size={18} />
              </a>
            )}
            {establishment.phone && (
              <a
                href={'tel:' + establishment.phone}
                aria-label="Téléphone"
                className="grid h-10 w-10 place-items-center rounded-full bg-[#173d32] text-white"
              >
                <Phone size={18} />
              </a>
            )}
          </div>

          <p className="mt-8 text-[10px] uppercase tracking-[0.18em] text-slate-400">
            Propulsé par <span className="font-semibold text-[#173d32]">Tap Marrakech</span>
          </p>
        </footer>
      </div>

      {wifiOpen && wifi && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#071f18]/55 p-5 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-[26px] bg-[#f7f7f3] p-5 shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#d3a84c]">
                  Connexion
                </p>
                <h2 className="mt-1 font-display text-2xl text-[#173d32]">
                  Wi-Fi gratuit
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setWifiOpen(false)}
                className="grid h-9 w-9 place-items-center rounded-full bg-white text-[#173d32]"
                aria-label="Fermer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-5 rounded-2xl bg-[#173d32] p-5 text-white">
              <Wifi className="text-[#d3a84c]" size={25} />
              <p className="mt-5 text-[10px] uppercase tracking-[0.18em] text-white/50">
                Réseau
              </p>
              <p className="mt-1 break-all font-semibold">
                {wifi.network_name || 'Wi-Fi de l’établissement'}
              </p>

              {wifi.wifi_password && (
                <>
                  <p className="mt-4 text-[10px] uppercase tracking-[0.18em] text-white/50">
                    Mot de passe
                  </p>
                  <p className="mt-1 break-all font-mono text-lg text-[#d3a84c]">
                    {wifi.wifi_password}
                  </p>
                </>
              )}

              <p className="mt-4 text-xs text-white/50">
                Sécurité : {wifi.security_type}
              </p>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
