import { useEffect } from 'react';
import { useAdminOverviewStats } from '../hooks/useAdminOverviewStats';

const formatNumber = (value: number) =>
  value.toLocaleString('fr-FR', { maximumFractionDigits: 0 });

const formatDh = (value: number) =>
  `${value.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} DH`;

const formatPercent = (value: number) =>
  `${value.toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} %`;

export default function AdminOverview() {
  const { stats, loading, error } = useAdminOverviewStats();

  console.log('[AdminOverview COMPONENT]', {
    loading,
    reviews: stats.reviewsCount,
    rating: stats.averageRating,
  });

  const rating = stats.averageRating.toLocaleString('fr-FR', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });

  const reviewPositiveRate = stats.reviewsCount
    ? (stats.positiveReviewsCount / stats.reviewsCount) * 100
    : 0;

  useEffect(() => {
    const card = document.querySelector(
      '[data-testid="admin-overview-reviews"]',
    );

    console.log('[AdminOverview DOM TARGET]', {
      loading,
      cardFound: Boolean(card),
      cardText: card?.textContent ?? null,
      cardHtml: card?.outerHTML.slice(0, 1000) ?? null,
    });
  }, [loading, stats.reviewsCount, stats.averageRating]);

  return (
    <section className="min-h-full bg-[#F6F7F5] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/80 p-6 shadow-[0_20px_60px_rgba(23,61,50,0.08)] backdrop-blur-xl sm:p-8">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D3A84C]/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-20 h-64 w-64 rounded-full bg-[#173D32]/10 blur-3xl" />

          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#173D32]/10 bg-[#173D32]/[0.05] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#173D32]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#10B981]" />
                Administration
              </div>

              <h1 className="text-3xl font-semibold tracking-[-0.03em] text-[#111827] sm:text-4xl">
                Vue d’ensemble
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-[#111827]/55">
                Une lecture claire de l’activité, de la réputation et de la
                fidélité de votre plateforme.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-2xl border border-[#173D32]/10 bg-white/75 px-4 py-3 text-right shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#111827]/40">
                  Période
                </p>
                <p className="mt-1 text-sm font-semibold text-[#173D32]">
                  {stats.periodDays} derniers jours
                </p>
              </div>
            </div>
          </div>
        </header>

        {error !== null && (
          <div className="rounded-2xl border border-[#EF4444]/20 bg-[#EF4444]/[0.06] px-4 py-3 text-sm text-[#B91C1C]">
            Erreur de chargement des statistiques : {error}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            testId="admin-overview-reviews"
            label="Avis reçus"
            value={loading ? '—' : formatNumber(stats.reviewsCount)}
            detail={
              loading
                ? 'Chargement…'
                : `${formatNumber(stats.currentReviewsCount)} sur la période`
            }
            accent="forest"
            icon="★"
          />

          <MetricCard
            label="Note moyenne"
            value={loading ? '—' : rating}
            detail={
              loading
                ? 'Chargement…'
                : `${formatPercent(reviewPositiveRate)} d’avis positifs`
            }
            accent="gold"
            icon="★"
          />

          <MetricCard
            label="Clients fidélisés"
            value={
              loading ? '—' : formatNumber(stats.loyaltyCustomersCount)
            }
            detail={
              loading
                ? 'Chargement…'
                : `${formatNumber(stats.returningCustomersCount)} clients récurrents`
            }
            accent="violet"
            icon="●"
          />

          <MetricCard
            label="Événements analytics"
            value={
              loading ? '—' : formatNumber(stats.analyticsEventsCount)
            }
            detail={
              loading
                ? 'Chargement…'
                : `${formatNumber(stats.currentAnalyticsEventsCount)} sur la période`
            }
            accent="indigo"
            icon="↗"
          />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <section className="rounded-[26px] border border-white/80 bg-white/85 p-6 shadow-[0_18px_50px_rgba(17,24,39,0.06)] backdrop-blur-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#111827]/40">
                  Fidélité
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight text-[#111827]">
                  Activité du programme
                </h2>
              </div>
              <div className="rounded-xl bg-[#173D32]/[0.06] px-3 py-2 text-xs font-semibold text-[#173D32]">
                {loading ? '—' : `${formatNumber(stats.visitsTotal)} visites`}
              </div>
            </div>

            <div className="mt-7 grid gap-4 sm:grid-cols-3">
              <Insight
                label="Clients actifs"
                value={
                  loading ? '—' : formatNumber(stats.activeCustomersCount)
                }
                sub={loading ? '' : formatPercent(stats.activeRate)}
              />
              <Insight
                label="Points gagnés"
                value={
                  loading ? '—' : formatNumber(stats.pointsEarnedTotal)
                }
                sub="cumul"
              />
              <Insight
                label="Points utilisés"
                value={
                  loading ? '—' : formatNumber(stats.pointsRedeemedTotal)
                }
                sub={
                  loading
                    ? ''
                    : formatPercent(stats.redemptionRate)
                }
              />
            </div>

            <div className="mt-7 rounded-2xl border border-[#173D32]/10 bg-[#F6F7F5] p-4">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold text-[#111827]">
                    Solde de points
                  </p>
                  <p className="mt-1 text-xs text-[#111827]/45">
                    Points actuellement détenus par les clients
                  </p>
                </div>
                <p className="text-xl font-semibold tracking-tight text-[#173D32]">
                  {loading
                    ? '—'
                    : formatNumber(stats.pointsBalanceTotal)}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[26px] border border-white/80 bg-[#173D32] p-6 text-white shadow-[0_18px_50px_rgba(23,61,50,0.18)] sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/45">
                  Performance commerciale
                </p>
                <h2 className="mt-1 text-lg font-semibold tracking-tight">
                  Revenus & transactions
                </h2>
              </div>
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[#D3A84C]">
                DH
              </div>
            </div>

            <div className="mt-8">
              <p className="text-xs text-white/50">Revenu sur la période</p>
              <p className="mt-2 text-4xl font-semibold tracking-[-0.03em]">
                {loading ? '—' : formatDh(stats.currentRevenue)}
              </p>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3">
              <DarkInsight
                label="Transactions"
                value={
                  loading
                    ? '—'
                    : formatNumber(stats.currentTransactionsCount)
                }
              />
              <DarkInsight
                label="Panier moyen"
                value={
                  loading ? '—' : formatDh(stats.averageBasket)
                }
              />
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <DarkInsight
                label="Revenu total"
                value={loading ? '—' : formatDh(stats.totalRevenue)}
              />
              <DarkInsight
                label="Contribution nette"
                value={
                  loading ? '—' : formatDh(stats.netContribution)
                }
              />
            </div>
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <MiniPanel
            eyebrow="Réputation"
            title="Répartition des avis"
            value={
              loading
                ? '—'
                : `${formatNumber(stats.positiveReviewsCount)} positifs`
            }
            secondary={
              loading
                ? 'Chargement…'
                : `${formatNumber(stats.negativeReviewsCount)} négatifs · ${formatNumber(stats.pendingReviewsCount)} en attente`
            }
          />

          <MiniPanel
            eyebrow="Engagement"
            title="Clients récurrents"
            value={
              loading
                ? '—'
                : formatNumber(stats.returningCustomersCount)
            }
            secondary={
              loading
                ? 'Chargement…'
                : `${formatPercent(stats.returningRate)} de taux de retour`
            }
          />

          <MiniPanel
            eyebrow="ROI fidélité"
            title="Performance du programme"
            value={
              loading
                ? '—'
                : stats.realRoi === null
                  ? 'N/D'
                  : formatPercent(stats.realRoi)
            }
            secondary={
              loading
                ? 'Chargement…'
                : `${formatDh(stats.rewardValueOnPeriod)} de valeur récompenses`
            }
          />
        </div>
      </div>
    </section>
  );
}

function MetricCard({
  label,
  value,
  detail,
  accent,
  icon,
  testId,
}: {
  label: string;
  value: string;
  detail: string;
  accent: 'forest' | 'gold' | 'violet' | 'indigo';
  icon: string;
  testId?: string;
}) {
  const accentClasses = {
    forest: 'bg-[#173D32]/[0.07] text-[#173D32]',
    gold: 'bg-[#D3A84C]/[0.14] text-[#A2761D]',
    violet: 'bg-[#8B5CF6]/[0.10] text-[#7C3AED]',
    indigo: 'bg-[#6366F1]/[0.10] text-[#4F46E5]',
  };

  return (
    <article data-testid={testId} className="group rounded-[24px] border border-white/80 bg-white/85 p-5 shadow-[0_14px_40px_rgba(17,24,39,0.05)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_45px_rgba(17,24,39,0.08)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-semibold text-[#111827]/45">{label}</p>
        <span
          className={`grid h-9 w-9 place-items-center rounded-xl text-sm font-semibold ${accentClasses[accent]}`}
        >
          {icon}
        </span>
      </div>

      <p className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-[#111827]">
        {value}
      </p>
      <p className="mt-2 text-xs text-[#111827]/45">{detail}</p>
    </article>
  );
}

function Insight({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border border-[#111827]/[0.06] bg-white p-4">
      <p className="text-xs text-[#111827]/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-[#111827]">
        {value}
      </p>
      <p className="mt-1 text-[11px] font-medium text-[#173D32]">{sub}</p>
    </div>
  );
}

function DarkInsight({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.07] p-4">
      <p className="text-[11px] text-white/45">{label}</p>
      <p className="mt-2 text-lg font-semibold tracking-tight text-white">
        {value}
      </p>
    </div>
  );
}

function MiniPanel({
  eyebrow,
  title,
  value,
  secondary,
}: {
  eyebrow: string;
  title: string;
  value: string;
  secondary: string;
}) {
  return (
    <article className="rounded-[24px] border border-white/80 bg-white/85 p-6 shadow-[0_14px_40px_rgba(17,24,39,0.05)] backdrop-blur-xl">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#111827]/35">
        {eyebrow}
      </p>
      <h3 className="mt-2 text-base font-semibold text-[#111827]">{title}</h3>
      <p className="mt-5 text-2xl font-semibold tracking-tight text-[#173D32]">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5 text-[#111827]/45">{secondary}</p>
    </article>
  );
}
