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
    <main className="min-h-screen bg-[#080A0B] px-6 py-8 text-[#F2F5F6] sm:px-8 lg:px-10">
      <div className="mx-auto max-w-[1500px] space-y-8">
        <section className="relative overflow-hidden rounded-[32px] border border-[#B5BEC3]/15 bg-[#343A40]/90 p-8 shadow-[0_20px_60px_rgba(23,61,50,0.08)] backdrop-blur-xl sm:p-10">
          <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#00DFA5]/10 blur-3xl" />

          <div className="relative">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#F2F5F6]/10 bg-[#F2F5F6]/5 px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-[#F2F5F6]" />
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2F5F6]/70">
                Administration
              </span>
            </div>

            <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
              <div>
                <h1 className="text-4xl font-semibold tracking-[-0.04em] text-[#F2F5F6] sm:text-5xl">
                  Vue d’ensemble
                </h1>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-[#F2F5F6]/55">
                  Une lecture claire de l’activité, de la réputation et de la
                  fidélité de votre plateforme.
                </p>
              </div>

              <div className="rounded-2xl border border-[#F2F5F6]/10 bg-[#454D54]/90 px-5 py-3 shadow-sm">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#F2F5F6]/40">
                  Période
                </p>

                <p className="mt-1 text-sm font-semibold text-[#F2F5F6]">
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
            iconClass="bg-[#F2F5F6]/8 text-[#F2F5F6]"
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
            iconClass="bg-[#00DFA5]/12 text-[#00DFA5]"
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
            iconClass="bg-[#454D54] text-[#00DFA5]"
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
            iconClass="bg-[#454D54] text-[#00DFA5]"
          />
        </section>

        <section className="rounded-[28px] border border-[#B5BEC3]/15 bg-[#343A40]/85 p-6 shadow-[0_16px_50px_rgba(23,61,50,0.06)] backdrop-blur-xl">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#F2F5F6]/40">
                État des données
              </p>

              <h2 className="mt-1 text-lg font-semibold text-[#F2F5F6]">
                Source statistique
              </h2>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-[#00DFA5]/25 bg-[#454D54] px-4 py-2 text-sm font-medium text-[#00DFA5]">
              <span className="h-2 w-2 rounded-full bg-[#00DFA5]" />
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
    <article className="group rounded-[28px] border border-[#B5BEC3]/15 bg-[#454D54]/90 p-6 shadow-[0_16px_50px_rgba(23,61,50,0.06)] backdrop-blur-xl transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_20px_60px_rgba(23,61,50,0.09)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-[#F2F5F6]/50">
            {label}
          </p>

          <p className="mt-7 text-4xl font-semibold tracking-[-0.04em] text-[#F2F5F6]">
            {value}
          </p>

          <p className="mt-2 text-xs text-[#F2F5F6]/45">
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
