import { useAdminOverviewStatsV2 } from '@/hooks/useAdminOverviewV2Stats';

export default function AdminOverviewV2() {
  const state = useAdminOverviewStatsV2();

  console.log('[AdminOverviewV2] COMPONENT RENDER', {
    status: state.status,
    data: state.data,
  });

  const isLoading = state.status === 'loading';
  const hasError = state.status === 'error';
  const stats = state.data;

  return (
    <main className="min-h-screen bg-[#f7f7f3] px-6 py-8 text-[#173d32] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px] space-y-8">
        <section className="relative overflow-hidden rounded-[32px] border border-white/80 bg-white/75 p-8 shadow-[0_20px_60px_rgba(23,61,50,0.08)] backdrop-blur-xl sm:p-10">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#d3a84c]/10 blur-3xl" />

          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#173d32]/10 bg-[#173d32]/5 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#173d32]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#173d32]/70">
                Administration
              </span>
            </div>

            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[#173d32] sm:text-5xl">
                  Vue d’ensemble
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#173d32]/55">
                  Une lecture claire de l’activité, de la réputation et de la
                  fidélité de votre plateforme.
                </p>
              </div>

              <div className="rounded-2xl border border-[#173d32]/10 bg-white/80 px-5 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#173d32]/40">
                  Période
                </p>

                <p className="mt-1 text-sm font-semibold text-[#173d32]">
                  30 derniers jours
                </p>
              </div>
            </div>
          </div>
        </section>

        {hasError && (
          <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
            {state.error}
          </section>
        )}

        <section className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Avis reçus"
            value={
              isLoading
                ? '—'
                : stats
                  ? stats.reviews.toLocaleString('fr-FR')
                  : '—'
            }
            detail="Avis sur la période"
            icon="★"
            iconClass="bg-[#173d32]/8 text-[#173d32]"
          />

          <StatCard
            label="Note moyenne"
            value={
              isLoading
                ? '—'
                : stats
                  ? stats.averageRating.toLocaleString('fr-FR', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })
                  : '—'
            }
            detail="Note moyenne des avis"
            icon="★"
            iconClass="bg-[#d3a84c]/12 text-[#b18425]"
          />

          <StatCard
            label="Clients fidélisés"
            value={
              isLoading
                ? '—'
                : stats
                  ? stats.loyaltyCustomers.toLocaleString('fr-FR')
                  : '—'
            }
            detail="Clients du programme"
            icon="●"
            iconClass="bg-emerald-50 text-emerald-600"
          />

          <StatCard
            label="Événements analytics"
            value={
              isLoading
                ? '—'
                : stats
                  ? stats.analyticsEvents.toLocaleString('fr-FR')
                  : '—'
            }
            detail="Interactions enregistrées"
            icon="↗"
            iconClass="bg-indigo-50 text-indigo-600"
          />
        </section>

        <section className="rounded-[28px] border border-white/80 bg-white/70 p-6 shadow-[0_16px_50px_rgba(23,61,50,0.06)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#173d32]/40">
                État des données
              </p>

              <h2 className="mt-1 text-lg font-semibold text-[#173d32]">
                Source statistique
              </h2>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {isLoading ? 'Chargement' : hasError ? 'Erreur' : 'Données disponibles'}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

type StatCardProps = {
  label: string;
  value: string;
  detail: string;
  icon: string;
  iconClass: string;
};

function StatCard({
  label,
  value,
  detail,
  icon,
  iconClass,
}: StatCardProps) {
  return (
    <article className="group rounded-[28px] border border-white/80 bg-white/80 p-6 shadow-[0_16px_50px_rgba(23,61,50,0.06)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(23,61,50,0.09)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#173d32]/50">
            {label}
          </p>

          <p className="mt-7 text-4xl font-semibold tracking-[-0.04em] text-[#173d32]">
            {value}
          </p>

          <p className="mt-2 text-xs text-[#173d32]/45">
            {detail}
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-semibold ${iconClass}`}
        >
          {icon}
        </div>
      </div>
    </article>
  );
}
