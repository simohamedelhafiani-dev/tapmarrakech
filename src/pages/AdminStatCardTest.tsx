import { MessageSquare, Star, UsersRound } from 'lucide-react';
import StatCard from '@/components/admin/StatCard';
import { useAdminOverviewStats } from '@/hooks/useAdminOverviewStats';

export default function AdminStatCardTest() {
  const { status, data, error } = useAdminOverviewStats(30);

  return (
    <main className="min-h-screen bg-[#050505] px-6 py-10 text-[#FFFFFF]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#00DFA5]">
            Admin Overview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#FFFFFF]">
            StatCard — données réelles
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#B0B0B0]">
            Test visuel branché directement sur le hook Admin Overview.
            Période : 30 jours.
          </p>
        </div>

        {status === 'error' ? (
          <div className="mb-6 rounded-2xl border border-[#00DFA5]/30 bg-[#686D76] p-5 text-sm text-[#00DFA5]">
            {error}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Avis reçus"
            value={data?.reviewsCount ?? '—'}
            icon={MessageSquare}
            iconTone="indigo"
            trend={data?.reviewGrowth}
          />

          <StatCard
            label="Note moyenne"
            value={data ? data.averageRating.toFixed(2) : '—'}
            icon={Star}
            iconTone="emerald"
            hint="Sur 5.00"
          />

          <StatCard
            label="Clients fidélisés"
            value={data?.loyaltyCustomersCount ?? '—'}
            icon={UsersRound}
            iconTone="emerald"
            trend={data?.registrationGrowth}
          />
        </div>

        {status === 'loading' ? (
          <p className="mt-6 text-xs font-medium text-[#6B7280]">
            Chargement des données réelles…
          </p>
        ) : null}
      </div>
    </main>
  );
}
