import { useAdminOverviewV2Stats } from '@/hooks/useAdminOverviewV2Stats';

export default function AdminOverviewV2() {
  const { stats, loading, error } = useAdminOverviewV2Stats();

  return (
    <main className="min-h-screen bg-[#f7f7f3] p-8 text-[#17352a]">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#17352a]/50">
            Administration — test V2
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Statistiques</h1>
          <p className="mt-2 text-sm text-[#17352a]/55">
            Nouvelle chaîne d’affichage, indépendante de l’ancien Overview.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Avis reçus" value={loading ? '…' : String(stats?.reviews ?? '—')} />
          <Stat
            label="Note moyenne"
            value={loading ? '…' : stats ? stats.rating.toFixed(2) : '—'}
          />
          <Stat
            label="Clients fidélisés"
            value={loading ? '…' : String(stats?.loyaltyCustomers ?? '—')}
          />
          <Stat
            label="Événements analytics"
            value={loading ? '…' : String(stats?.analyticsEvents ?? '—')}
          />
        </section>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-3xl border border-black/5 bg-white p-6 shadow-sm">
      <p className="text-sm text-[#17352a]/55">{label}</p>
      <p className="mt-5 text-4xl font-semibold tracking-tight">{value}</p>
    </article>
  );
}
