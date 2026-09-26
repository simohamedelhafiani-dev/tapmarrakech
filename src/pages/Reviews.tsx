import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Lightbulb,
  Search,
  SlidersHorizontal,
  Sparkles,
  Target,
} from 'lucide-react';

import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Review } from '@/lib/types';
import { Stars } from '@/components/Stars';
import { DataLoadError } from '@/components/DataLoadError';

type AIRecurringIssue = {
  topic: string;
  frequency: string;
  priority: string;
  explanation: string;
};

type AIRecommendation = {
  priority: string;
  action: string;
  reason: string;
};

type AIPriorityAction = {
  priority: string;
  action: string;
  reason: string;
  impact: string;
};

type AIAnalysis = {
  summary: string;
  sentiment: string;
  satisfaction_score: number;
  strengths: string[];
  weaknesses: string[];
  recurring_issues: AIRecurringIssue[];
  recommendations: AIRecommendation[];
  actions_prioritaires: AIPriorityAction[];
};

type AIResponse = {
  success: boolean;
  statistics?: {
    total_reviews: number;
    average_rating: number;
    positive_reviews: number;
    negative_reviews: number;
    rating_distribution: {
      1: number;
      2: number;
      3: number;
      4: number;
      5: number;
    };
  };
  analysis?: AIAnalysis;
  error?: string;
};

export default function Reviews() {
  const { user } = useAuth();

  const [reviews, setReviews] = useState<Review[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('Tous');
  const [rating, setRating] = useState('Tous');

  const [loading, setLoading] = useState(true);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiAnalysis, setAiAnalysis] =
    useState<AIAnalysis | null>(null);
  const [aiStatistics, setAiStatistics] =
    useState<AIResponse['statistics'] | null>(null);

  useEffect(() => {
    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        /*
         * Récupère les établissements accessibles
         * à l'utilisateur connecté.
         *
         * Admin       → tous les établissements
         * Responsable → établissements liés
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
        searchText.includes(
          search.toLowerCase()
        );

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

  const analyzeReviews = async () => {
    if (!reviews.length) {
      setAiError(
        'Il faut au moins un avis pour lancer une analyse.'
      );
      return;
    }

    setAiLoading(true);
    setAiError('');
    setAiAnalysis(null);
    setAiStatistics(null);

    try {
      /*
       * Aucun avis ni donnée personnelle n'est envoyé
       * directement depuis le navigateur.
       *
       * L'Edge Function récupère elle-même les avis
       * selon les droits de l'utilisateur connecté.
       */
      const { data, error } =
        await supabase.functions.invoke(
          'analyze-reviews',
          {
            body: {},
          }
        );

      if (error) {
        console.error(
          'Erreur appel analyse IA:',
          error
        );

        setAiError(
          `Impossible de lancer l'analyse IA : ${error.message}`
        );

        return;
      }

      const result =
        data as AIResponse;

      if (!result?.success || !result.analysis) {
        setAiError(
          result?.error ||
            'La réponse de l’IA est invalide.'
        );

        return;
      }

      const rawAnalysis = result.analysis;

      const normalizedAnalysis: AIAnalysis = {
        summary:
          typeof rawAnalysis.summary === 'string'
            ? rawAnalysis.summary
            : '',
        sentiment:
          typeof rawAnalysis.sentiment === 'string'
            ? rawAnalysis.sentiment
            : 'Non déterminé',
        satisfaction_score:
          typeof rawAnalysis.satisfaction_score === 'number'
            ? rawAnalysis.satisfaction_score
            : 0,
        strengths: Array.isArray(rawAnalysis.strengths)
          ? rawAnalysis.strengths.filter(
              (item): item is string =>
                typeof item === 'string'
            )
          : [],
        weaknesses: Array.isArray(rawAnalysis.weaknesses)
          ? rawAnalysis.weaknesses.filter(
              (item): item is string =>
                typeof item === 'string'
            )
          : [],
        recurring_issues: Array.isArray(
          rawAnalysis.recurring_issues
        )
          ? rawAnalysis.recurring_issues.filter(
              (item): item is AIRecurringIssue =>
                Boolean(item) &&
                typeof item === 'object' &&
                typeof item.topic === 'string' &&
                typeof item.frequency === 'string' &&
                typeof item.priority === 'string' &&
                typeof item.explanation === 'string'
            )
          : [],
        recommendations: Array.isArray(
          rawAnalysis.recommendations
        )
          ? rawAnalysis.recommendations.filter(
              (item): item is AIRecommendation =>
                Boolean(item) &&
                typeof item === 'object' &&
                typeof item.priority === 'string' &&
                typeof item.action === 'string' &&
                typeof item.reason === 'string'
            )
          : [],
        actions_prioritaires: Array.isArray(
          rawAnalysis.actions_prioritaires
        )
          ? rawAnalysis.actions_prioritaires.filter(
              (item): item is AIPriorityAction =>
                Boolean(item) &&
                typeof item === 'object' &&
                typeof item.priority === 'string' &&
                typeof item.action === 'string' &&
                typeof item.reason === 'string' &&
                typeof item.impact === 'string'
            )
          : [],
      };

      setAiAnalysis(normalizedAnalysis);
      setAiStatistics(
        result.statistics ?? null
      );
    } catch (error) {
      console.error(
        'Erreur analyse IA:',
        error
      );

      setAiError(
        'Une erreur est survenue pendant l’analyse IA.'
      );
    } finally {
      setAiLoading(false);
    }
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
      {/* HEADER */}
      <div className="mb-8">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
              Relation client
            </p>

            <h1 className="mt-2 font-display text-4xl text-forest">
              Avis reçus
            </h1>

            <p className="mt-2 text-sm text-ink/50">
              Lisez, traitez et analysez les retours de
              vos clients.
            </p>
          </div>

          <button
            onClick={analyzeReviews}
            disabled={
              aiLoading || reviews.length === 0
            }
            className="flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiLoading ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Analyse en cours...
              </>
            ) : (
              <>
                <Brain size={17} />
                Analyser mes avis avec l’IA
              </>
            )}
          </button>
        </div>
      </div>

      {/* ERREUR IA */}
      {aiError && (
        <div className="mb-5 flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <AlertTriangle
            size={18}
            className="mt-0.5 shrink-0"
          />

          <div>
            <p className="font-semibold">
              Analyse IA impossible
            </p>

            <p className="mt-1">
              {aiError}
            </p>
          </div>
        </div>
      )}

      {/* ANALYSE IA */}
      {aiAnalysis && (
        <div className="mb-7 overflow-hidden rounded-3xl border border-ink/5 bg-white shadow-soft">
          {/* ENTÊTE IA */}
          <div className="bg-forest p-6 text-white md:p-8">
            <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
              <div>
                <div className="flex items-center gap-2 text-gold">
                  <Sparkles size={18} />

                  <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                    Analyse intelligente
                  </span>
                </div>

                <h2 className="mt-2 font-display text-3xl">
                  Votre réputation en résumé
                </h2>

                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/60">
                  Analyse automatique des avis clients
                  accessibles à votre établissement.
                </p>
              </div>

              <div className="rounded-2xl bg-white/10 px-6 py-4 text-center">
                <p className="text-xs uppercase tracking-wider text-white/50">
                  Satisfaction
                </p>

                <p className="mt-1 text-3xl font-semibold text-gold">
                  {Math.round(
                    aiAnalysis.satisfaction_score
                  )}
                  %
                </p>
              </div>
            </div>
          </div>

          {/* STATISTIQUES */}
          {aiStatistics && (
            <div className="grid border-b border-ink/5 md:grid-cols-4">
              <div className="p-5 md:border-r border-ink/5">
                <p className="text-xs text-ink/40">
                  Avis analysés
                </p>

                <p className="mt-1 text-2xl font-semibold text-forest">
                  {aiStatistics.total_reviews}
                </p>
              </div>

              <div className="p-5 md:border-r border-ink/5">
                <p className="text-xs text-ink/40">
                  Note moyenne
                </p>

                <p className="mt-1 text-2xl font-semibold text-forest">
                  ⭐ {aiStatistics.average_rating}/5
                </p>
              </div>

              <div className="p-5 md:border-r border-ink/5">
                <p className="text-xs text-ink/40">
                  Avis positifs
                </p>

                <p className="mt-1 text-2xl font-semibold text-forest">
                  {aiStatistics.positive_reviews}
                </p>
              </div>

              <div className="p-5">
                <p className="text-xs text-ink/40">
                  Avis à surveiller
                </p>

                <p className="mt-1 text-2xl font-semibold text-forest">
                  {aiStatistics.negative_reviews}
                </p>
              </div>
            </div>
          )}

          {/* RÉSUMÉ */}
          <div className="p-6 md:p-8">
            <div className="rounded-2xl bg-[#f7f7f3] p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                Synthèse
              </p>

              <p className="mt-3 text-sm leading-7 text-ink/70">
                {aiAnalysis.summary}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-forest shadow-sm">
                  Sentiment :{' '}
                  {aiAnalysis.sentiment}
                </span>
              </div>
            </div>

            {/* POINTS FORTS / FAIBLES */}
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div className="rounded-2xl border border-ink/5 p-5">
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    size={18}
                    className="text-forest"
                  />

                  <h3 className="font-semibold text-forest">
                    Ce que vos clients apprécient
                  </h3>
                </div>

                {aiAnalysis.strengths.length ? (
                  <ul className="mt-4 space-y-3">
                    {aiAnalysis.strengths.map(
                      (item, index) => (
                        <li
                          key={index}
                          className="flex gap-2 text-sm leading-6 text-ink/65"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-gold" />

                          <span>{item}</span>
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-ink/40">
                    Pas assez de données.
                  </p>
                )}
              </div>

              <div className="rounded-2xl border border-ink/5 p-5">
                <div className="flex items-center gap-2">
                  <AlertTriangle
                    size={18}
                    className="text-[#a15c50]"
                  />

                  <h3 className="font-semibold text-forest">
                    Ce qui peut être amélioré
                  </h3>
                </div>

                {aiAnalysis.weaknesses.length ? (
                  <ul className="mt-4 space-y-3">
                    {aiAnalysis.weaknesses.map(
                      (item, index) => (
                        <li
                          key={index}
                          className="flex gap-2 text-sm leading-6 text-ink/65"
                        >
                          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#a15c50]" />

                          <span>{item}</span>
                        </li>
                      )
                    )}
                  </ul>
                ) : (
                  <p className="mt-4 text-sm text-ink/40">
                    Aucun problème majeur détecté.
                  </p>
                )}
              </div>
            </div>

            {/* PROBLÈMES RÉCURRENTS */}
            <div className="mt-5 rounded-2xl border border-ink/5 p-5">
              <div className="flex items-center gap-2">
                <Target
                  size={18}
                  className="text-gold"
                />

                <h3 className="font-semibold text-forest">
                  Problèmes récurrents
                </h3>
              </div>

              {aiAnalysis.recurring_issues.length ? (
                <div className="mt-4 space-y-3">
                  {aiAnalysis.recurring_issues.map(
                    (issue, index) => (
                      <div
                        key={index}
                        className="rounded-xl bg-[#f7f7f3] p-4"
                      >
                        <div className="flex flex-col justify-between gap-2 md:flex-row">
                          <p className="font-semibold text-forest">
                            {issue.topic}
                          </p>

                          <div className="flex flex-wrap gap-2">
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] text-ink/55">
                              {issue.frequency}
                            </span>

                            <span className="rounded-full bg-[#f4e4e1] px-2.5 py-1 text-[11px] font-semibold text-[#a15c50]">
                              Priorité {issue.priority}
                            </span>
                          </div>
                        </div>

                        <p className="mt-2 text-sm leading-6 text-ink/60">
                          {issue.explanation}
                        </p>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink/40">
                  Aucun problème récurrent clairement
                  identifié.
                </p>
              )}
            </div>

            {/* RECOMMANDATIONS */}
            <div className="mt-5 rounded-2xl bg-[#f7f7f3] p-5">
              <div className="flex items-center gap-2">
                <Lightbulb
                  size={18}
                  className="text-gold"
                />

                <h3 className="font-semibold text-forest">
                  Recommandations IA
                </h3>
              </div>

              {aiAnalysis.recommendations.length ? (
                <div className="mt-4 space-y-3">
                  {aiAnalysis.recommendations.map(
                    (recommendation, index) => (
                      <div
                        key={index}
                        className="rounded-xl bg-white p-4 shadow-sm"
                      >
                        <div className="flex gap-3">
                          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-forest text-xs font-semibold text-white">
                            {index + 1}
                          </div>

                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="font-semibold text-forest">
                                {recommendation.action}
                              </p>

                              <span className="rounded-full bg-[#f4ead3] px-2.5 py-1 text-[11px] font-semibold text-[#8b6b2c]">
                                {recommendation.priority}
                              </span>
                            </div>

                            <p className="mt-1 text-sm leading-6 text-ink/55">
                              {recommendation.reason}
                            </p>
                          </div>
                        </div>
                      </div>
                    )
                  )}
                </div>
              ) : (
                <p className="mt-4 text-sm text-ink/40">
                  Aucune recommandation disponible.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* FILTRES */}
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

      {/* LISTE DES AVIS */}
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
