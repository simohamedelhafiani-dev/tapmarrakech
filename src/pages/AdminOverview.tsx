import { useAdminOverviewStats } from '../hooks/useAdminOverviewStats';

export default function AdminOverview() {
  const { stats, loading, error } = useAdminOverviewStats();

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Admin Overview</h1>
        <p className="mt-1 text-sm text-ink/55">
          Vue de validation des statistiques administrateur.
        </p>
      </div>

      {error !== null && (
        <p className="text-sm text-red-600">
          Erreur de chargement des statistiques : {error}
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="Avis" value={loading ? '—' : stats.reviewsCount.toLocaleString('fr-FR')} />
        <Metric
          label="Note moyenne"
          value={loading ? '—' : stats.averageRating.toFixed(1)}
        />
        <Metric
          label="Clients fidélisés"
          value={
            loading
              ? '—'
              : stats.loyaltyCustomersCount.toLocaleString('fr-FR')
          }
        />
        <Metric
          label="Événements analytics"
          value={
            loading
              ? '—'
              : stats.analyticsEventsCount.toLocaleString('fr-FR')
          }
        />
        <Metric
          label="Revenu période"
          value={
            loading
              ? '—'
              : `${stats.currentRevenue.toLocaleString('fr-FR')} DH`
          }
        />
      </div>

      <div className="rounded-2xl border border-ink/10 bg-white p-5">
        <p className="text-sm font-medium text-ink">Contrôle du hook</p>
        <div className="mt-3 space-y-1 text-sm text-ink/65">
          <p>Période : {stats.periodDays} jours</p>
          <p>
            ROI réel :{' '}
            {stats.realRoi === null
              ? 'Non disponible'
              : `${stats.realRoi.toFixed(2)} %`}
          </p>
        </div>
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <p className="text-xs font-medium text-ink/45">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </p>
    </div>
  );
}
