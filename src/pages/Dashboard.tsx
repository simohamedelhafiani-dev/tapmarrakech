import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  MessageCircle,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Establishment, Review } from '@/lib/types';
import { Stars } from '@/components/Stars';

const ranges = [
  {
    key: '8w',
    label: '8 dernières semaines',
    days: 56,
  },
  {
    key: '30d',
    label: '30 derniers jours',
    days: 30,
  },
  {
    key: '3m',
    label: '3 mois',
    days: 90,
  },
  {
    key: '6m',
    label: '6 mois',
    days: 180,
  },
  {
    key: '12m',
    label: '12 mois',
    days: 365,
  },
];

function Stat({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Star;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink/50">
            {label}
          </p>

          <p className="mt-3 font-display text-3xl text-forest">
            {value}
          </p>
        </div>

        <div
          className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}
        >
          <Icon size={18} />
        </div>
      </div>

      <p className="mt-4 text-[11px] text-ink/45">
        {detail}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { user, role } = useAuth();

  const [places, setPlaces] = useState<Establishment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [profileName, setProfileName] = useState<string>('');
  const [period, setPeriod] = useState('8w');
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlaces([]);
      setReviews([]);
      setProfileName('');
      setSelectedEstablishmentId(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);

      try {
        /*
         * Charger le profil
         */
        const { data: profile, error: profileError } =
          await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) {
          console.error(
            'Erreur chargement profil:',
            profileError
          );
        }

        setProfileName(
          profile?.name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Utilisateur'
        );

        /*
         * Charger les établissements accessibles
         *
         * ADMIN :
         * → tous les établissements
         *
         * RESPONSABLE :
         * → uniquement ses établissements rattachés
         */
        const {
          data: establishments,
          error: establishmentsError,
        } = await supabase.rpc('get_my_establishments');

        if (establishmentsError) {
          console.error(
            'Erreur chargement établissements:',
            establishmentsError
          );

          setPlaces([]);
          setReviews([]);
          setSelectedEstablishmentId(null);
          setLoading(false);
          return;
        }

        const accessiblePlaces =
          (establishments ?? []) as Establishment[];

        setPlaces(accessiblePlaces);

        /*
         * Restaurer l'établissement sélectionné.
         *
         * Si aucun choix n'a encore été enregistré, on utilise
         * le premier établissement accessible.
         *
         * Si l'ancien choix n'existe plus ou n'est plus accessible,
         * on revient automatiquement au premier établissement.
         */
        const storageKey = `tapmarrakech:selected-establishment:${user.id}`;
        const storedId = window.localStorage.getItem(storageKey);

        const validStoredPlace = accessiblePlaces.find(
          (place) => place.id === storedId
        );

        const nextId =
          validStoredPlace?.id ??
          accessiblePlaces[0]?.id ??
          null;

        setSelectedEstablishmentId(nextId);

        if (nextId) {
          window.localStorage.setItem(storageKey, nextId);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.error(
          'Erreur inattendue dashboard:',
          error
        );

        setPlaces([]);
        setReviews([]);
        setSelectedEstablishmentId(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, role]);

  /*
   * Charger uniquement les avis de l'établissement sélectionné.
   *
   * Cette séparation est importante pour que les statistiques,
   * le graphique et les derniers retours correspondent toujours
   * à l'établissement actuellement choisi.
   */
  useEffect(() => {
    let active = true;

    const loadReviews = async () => {
      if (!selectedEstablishmentId) {
        setReviews([]);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from('reviews')
        .select(
          '*, establishment:establishments(name)'
        )
        .eq('establishment_id', selectedEstablishmentId)
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Erreur chargement avis:',
          error
        );

        if (active) {
          setReviews([]);
        }

        return;
      }

      if (active) {
        setReviews((data as Review[]) ?? []);
      }
    };

    loadReviews();

    return () => {
      active = false;
    };
  }, [selectedEstablishmentId]);

  const positive = reviews.filter(
    (review) => review.rating >= 4
  ).length;

  const negative = reviews.filter(
    (review) => review.rating <= 3
  ).length;

  const pending = reviews.filter(
    (review) =>
      review.status === 'Nouveau' &&
      review.rating <= 3
  ).length;

  const average = reviews.length
    ? (
        reviews.reduce(
          (total, review) => total + review.rating,
          0
        ) / reviews.length
      ).toFixed(1)
    : '—';

  const selected =
    ranges.find((range) => range.key === period) ??
    ranges[0];

  const chart = useMemo(() => {
    const now = new Date();

    return Array.from(
      {
        length: period === '8w' ? 8 : 7,
      },
      (_, index) => {
        const end = new Date(now);

        end.setDate(
          now.getDate() -
            (period === '8w'
              ? (7 - index) * 7
              : (6 - index) *
                Math.ceil(selected.days / 7))
        );

        const start = new Date(end);

        start.setDate(
          end.getDate() -
            (period === '8w'
              ? 7
              : Math.ceil(selected.days / 7))
        );

        const rows = reviews.filter((review) => {
          const date = new Date(review.created_at);

          return date >= start && date <= end;
        });

        return {
          name:
            period === '8w'
              ? `S${index + 1}`
              : `${index + 1}`,
          total: rows.length,
          positive: rows.filter(
            (review) => review.rating >= 4
          ).length,
          negative: rows.filter(
            (review) => review.rating <= 3
          ).length,
        };
      }
    );
  }, [reviews, period, selected.days]);

  const latest = reviews.slice(0, 4);

  const isResponsible = role === 'responsible';

  const selectedEstablishment =
    places.find(
      (place) => place.id === selectedEstablishmentId
    ) ?? null;

  const establishmentName = selectedEstablishment?.name ?? null;

  const changeEstablishment = (establishmentId: string) => {
    setSelectedEstablishmentId(establishmentId);

    if (user?.id) {
      const storageKey = `tapmarrakech:selected-establishment:${user.id}`;
      window.localStorage.setItem(
        storageKey,
        establishmentId
      );
    }

    window.dispatchEvent(
      new CustomEvent('tapmarrakech:establishment-changed', {
        detail: {
          establishmentId,
        },
      })
    );
  };

  const roleLabel =
    role === 'admin'
      ? 'Administrateur'
      : role === 'responsible'
        ? 'Responsable'
        : role === 'employee'
          ? 'Employé'
          : 'Compte';

  if (loading) {
    return (
      <div className="h-72 animate-pulse rounded-2xl bg-ink/5" />
    );
  }

  return (
    <div>
      {/* HEADER */}

      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            {roleLabel}
          </p>

          {places.length > 0 && (
            <div className="mt-3">
              <label
                htmlFor="dashboard-establishment"
                className="sr-only"
              >
                Établissement actif
              </label>

              <select
                id="dashboard-establishment"
                value={selectedEstablishmentId ?? ''}
                onChange={(event) =>
                  changeEstablishment(event.target.value)
                }
                className="max-w-full rounded-xl border border-ink/10 bg-white px-3 py-2 text-sm font-semibold text-forest shadow-sm outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/30"
              >
                {places.map((place) => (
                  <option
                    key={place.id}
                    value={place.id}
                  >
                    {place.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isResponsible && establishmentName && (
            <p className="mt-2 text-lg font-semibold text-forest">
              {establishmentName}
            </p>
          )}

          <h1 className="mt-2 font-display text-4xl text-forest">
            Bonjour {profileName} 👋
          </h1>

          <p className="mt-2 text-sm text-ink/50">
            {establishmentName
              ? `Voici ce qui se passe dans votre établissement ${establishmentName}.`
              : 'Voici ce qui se passe dans vos établissements.'}
          </p>
        </div>

        {!isResponsible && (
          <Link
            to="/dashboard/establishments"
            className="flex w-fit items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-xs font-semibold text-forest transition hover:border-gold"
          >
            Gérer mes établissements
            <ArrowUpRight size={15} />
          </Link>
        )}
      </div>

      {/* STATISTIQUES */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat
          label="Avis reçus"
          value={reviews.length}
          detail="Depuis le début"
          icon={MessageCircle}
          accent="bg-[#f4ead3] text-gold"
        />

        <Stat
          label="Note moyenne"
          value={average}
          detail="Sur 5 étoiles"
          icon={Star}
          accent="bg-[#e5eee9] text-forest"
        />

        <Stat
          label="Avis positifs"
          value={positive}
          detail={
            reviews.length
              ? `${Math.round(
                  (positive / reviews.length) * 100
                )}% du total`
              : 'Pas encore de données'
          }
          icon={TrendingUp}
          accent="bg-[#e5eee9] text-forest"
        />

        <Stat
          label="Retours négatifs"
          value={negative}
          detail="Notes de 1 à 3 étoiles"
          icon={TrendingDown}
          accent="bg-[#f4ead3] text-gold"
        />

        <Stat
          label="À traiter"
          value={pending}
          detail="Retours en attente"
          icon={CheckCircle2}
          accent="bg-[#f4e4e1] text-[#a15c50]"
        />
      </div>

      {/* GRAPHIQUE + DERNIERS AVIS */}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div>
              <h2 className="font-display text-xl text-forest">
                Avis reçus par semaine
              </h2>

              <p className="mt-1 text-xs text-ink/45">
                Volume et sentiment de vos retours
              </p>
            </div>

            <select
              value={period}
              onChange={(event) =>
                setPeriod(event.target.value)
              }
              className="rounded-lg border border-ink/10 bg-[#fafaf7] px-3 py-2 text-xs text-ink/65 outline-none"
            >
              {ranges.map((range) => (
                <option
                  key={range.key}
                  value={range.key}
                >
                  {range.label}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-8 h-64">
            <ResponsiveContainer
              width="100%"
              height="100%"
            >
              <BarChart
                data={chart}
                barGap={5}
              >
                <CartesianGrid
                  vertical={false}
                  stroke="#edf0eb"
                />

                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#9ca89f',
                    fontSize: 11,
                  }}
                />

                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{
                    fill: '#9ca89f',
                    fontSize: 11,
                  }}
                />

                <Tooltip
                  cursor={{
                    fill: '#f7f7f3',
                  }}
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #edf0eb',
                    fontSize: 12,
                  }}
                />

                <Bar
                  dataKey="positive"
                  name="Positifs"
                  fill="#c8a96b"
                  radius={[4, 4, 0, 0]}
                />

                <Bar
                  dataKey="negative"
                  name="Négatifs"
                  fill="#17352a"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="mt-4 flex gap-5 text-xs text-ink/50">
            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-gold" />
              Positifs
            </span>

            <span className="flex items-center gap-2">
              <i className="h-2 w-2 rounded-full bg-forest" />
              Négatifs
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl text-forest">
                Derniers retours
              </h2>

              <p className="mt-1 text-xs text-ink/45">
                Les avis les plus récents
              </p>
            </div>

            <Link
              to="/dashboard/reviews"
              className="text-xs font-semibold text-gold"
            >
              Tout voir
            </Link>
          </div>

          <div className="mt-6 space-y-5">
            {latest.length ? (
              latest.map((review) => (
                <div
                  key={review.id}
                  className="border-b border-ink/5 pb-4 last:border-0"
                >
                  <div className="flex justify-between">
                    <Stars rating={review.rating} />

                    <span className="text-[10px] text-ink/35">
                      {new Date(
                        review.created_at
                      ).toLocaleDateString('fr-FR')}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink/65">
                    {review.comment ||
                      'Avis positif sans commentaire'}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-ink/40">
                Vos premiers avis apparaîtront ici.
              </div>
            )}
          </div>
        </section>
      </div>

      {/* BAS DE PAGE */}

      <div className="mt-6 rounded-2xl bg-forest p-6 text-white md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              {isResponsible
                ? 'Votre établissement'
                : 'Votre réseau'}
            </p>

            <h2 className="mt-2 font-display text-2xl">
              {establishmentName ||
                `${places.length} établissement${
                  places.length > 1 ? 's' : ''
                } connecté${
                  places.length > 1 ? 's' : ''
                }`}
            </h2>

            <p className="mt-1 text-sm text-white/50">
              Mesurez chaque expérience, au même endroit.
            </p>
          </div>

          <Link
            to="/dashboard/analytics"
            className="flex w-fit items-center gap-2 rounded-xl bg-gold px-4 py-3 text-xs font-semibold text-forest transition hover:bg-[#d5b878]"
          >
            Explorer les analytics
            <BarChart3 size={15} />
          </Link>
        </div>
      </div>

      <footer className="mt-10 pb-4 text-center text-xs font-medium text-ink/35">by Tap Marrakech</footer>
    </div>
  );
}
