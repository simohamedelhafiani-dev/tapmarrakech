import { useEffect, useMemo, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Review } from '@/lib/types';
import { Stars } from '@/components/Stars';

export default function Reviews() {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Tous');
  const [rating, setRating] = useState('Tous');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        /*
         * On récupère les établissements auxquels
         * l'utilisateur connecté a réellement accès.
         *
         * Admin       → tous les établissements
         * Responsable → ses établissements liés
         */
        const { data: places, error: placesError } =
          await supabase.rpc('get_my_establishments');

        if (placesError) {
          console.error(
            'Erreur récupération établissements:',
            placesError
          );
          setReviews([]);
          return;
        }

        const ids = (places ?? []).map(
          (place: { id: string }) => place.id
        );

        if (!ids.length) {
          setReviews([]);
          return;
        }

        const { data, error } = await supabase
          .from('reviews')
          .select(
            '*, establishment:establishments(name)'
          )
          .in('establishment_id', ids)
          .order('created_at', {
            ascending: false,
          });

        if (error) {
          console.error(
            'Erreur récupération avis:',
            error
          );
          setReviews([]);
          return;
        }

        setReviews((data as Review[]) ?? []);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user]);

  const filtered = useMemo(() => {
    return reviews.filter((review) => {
      const matchesStatus =
        status === 'Tous' ||
        review.status === status;

      const matchesRating =
        rating === 'Tous' ||
        String(review.rating) === rating;

      const searchText =
        `${review.comment ?? ''} ${
          review.name ?? ''
        } ${review.email ?? ''} ${
          review.phone ?? ''
        }`.toLowerCase();

      const matchesSearch =
        searchText.includes(search.toLowerCase());

      return (
        matchesStatus &&
        matchesRating &&
        matchesSearch
      );
    });
  }, [reviews, status, rating, search]);

  const update = async (
    id: string,
    next: Review['status']
  ) => {
    const { error } = await supabase
      .from('reviews')
      .update({ status: next })
      .eq('id', id);

    if (error) {
      console.error(
        'Erreur mise à jour statut:',
        error
      );
      return;
    }

    setReviews((current) =>
      current.map((review) =>
        review.id === id
          ? { ...review, status: next }
          : review
      )
    );
  };

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Relation client
        </p>

        <h1 className="mt-2 font-display text-4xl text-forest">
          Avis reçus
        </h1>

        <p className="mt-2 text-sm text-ink/50">
          Lisez et traitez chaque retour de vos clients.
        </p>
      </div>

      <div className="rounded-2xl border border-ink/5 bg-white p-4 shadow-soft">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30"
              size={17}
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder="Rechercher dans les avis…"
              className="w-full rounded-xl border border-ink/10 bg-[#fbfaf7] py-3 pl-10 pr-3 text-sm outline-none focus:ring-2 focus:ring-gold"
            />
          </div>

          <div className="flex gap-2 overflow-auto">
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value)
              }
              className="rounded-xl border border-ink/10 bg-[#fbfaf7] px-3 py-3 text-xs outline-none"
            >
              <option>Tous</option>
              <option>Nouveau</option>
              <option>En cours</option>
              <option>Traité</option>
            </select>

            <select
              value={rating}
              onChange={(e) =>
                setRating(e.target.value)
              }
              className="rounded-xl border border-ink/10 bg-[#fbfaf7] px-3 py-3 text-xs outline-none"
            >
              <option value="Tous">
                Toutes les notes
              </option>

              {[5, 4, 3, 2, 1].map((n) => (
                <option
                  key={n}
                  value={n}
                >
                  ⭐ {n}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-2 text-xs text-ink/40">
          <SlidersHorizontal size={14} />

          {filtered.length} avis affiché
          {filtered.length > 1 ? 's' : ''}
        </div>
      </div>

      <div className="mt-5 space-y-3">
        {filtered.map((review) => (
          <div
            key={review.id}
            className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft"
          >
            <div className="flex flex-col justify-between gap-3 sm:flex-row">
              <div className="flex items-center gap-3">
                <Stars rating={review.rating} />

                <span className="text-xs font-semibold text-forest">
                  {review.establishment?.name}
                </span>
              </div>

              <span className="text-xs text-ink/35">
                {new Date(
                  review.created_at
                ).toLocaleString('fr-FR', {
                  dateStyle: 'medium',
                })}
              </span>
            </div>

            <p className="mt-4 text-sm leading-6 text-ink/70">
              {review.comment ||
                'Avis positif sans commentaire.'}
            </p>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-ink/5 pt-3">
              <div className="text-xs text-ink/45">
                {review.name || 'Client anonyme'}

                {review.email &&
                  ` · ${review.email}`}

                {review.phone &&
                  ` · ${review.phone}`}
              </div>

              <select
                value={review.status}
                onChange={(e) =>
                  update(
                    review.id,
                    e.target.value as Review['status']
                  )
                }
                className={`rounded-lg border-0 px-3 py-2 text-xs font-semibold outline-none ${
                  review.status === 'Nouveau'
                    ? 'bg-[#f4e4e1] text-[#a15c50]'
                    : review.status === 'En cours'
                      ? 'bg-[#f4ead3] text-[#8b6b2c]'
                      : 'bg-[#e5eee9] text-forest'
                }`}
              >
                <option>Nouveau</option>
                <option>En cours</option>
                <option>Traité</option>
              </select>
            </div>
          </div>
        ))}

        {!filtered.length && (
          <div className="rounded-2xl border border-dashed border-ink/15 py-20 text-center text-sm text-ink/40">
            Aucun avis ne correspond à vos filtres.
          </div>
        )}
      </div>
    </div>
  );
}
