import { useEffect } from 'react';
import { MessageSquare, Star, UsersRound } from 'lucide-react';
import StatCard from '@/components/admin/StatCard';
import { useAdminOverviewStats } from '@/hooks/useAdminOverviewStats';

export default function AdminStatCardTest() {
  const { status, data, error } = useAdminOverviewStats(30);

  useEffect(() => {
    console.log('[StatCard TEST] MOUNT');

    return () => {
      console.log('[StatCard TEST] UNMOUNT');
    };
  }, []);

  useEffect(() => {
    const root = document.querySelector('main');

    if (!root) {
      console.log('[DOM WATCH] main introuvable');
      return;
    }

    console.log('[DOM WATCH] OBSERVER ACTIF');

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        console.log('[DOM WATCH] MUTATION', {
          type: mutation.type,
          target: mutation.target,
          oldValue: mutation.oldValue,
          addedNodes: mutation.addedNodes.length,
          removedNodes: mutation.removedNodes.length,
          currentText: root.innerText,
        });
      });
    });

    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      characterDataOldValue: true,
    });

    return () => {
      observer.disconnect();
      console.log('[DOM WATCH] OBSERVER STOP');
    };
  }, []);

  console.log('[StatCard TEST] RENDER:', {
    data,
    reviewsCount: data?.reviewsCount,
    averageRating: data?.averageRating,
    loyaltyCustomersCount: data?.loyaltyCustomersCount,
  });

  console.log('[StatCard TEST] VALUES:', {
    reviewsCount: data?.reviewsCount,
    averageRating: data?.averageRating,
    loyaltyCustomersCount: data?.loyaltyCustomersCount,
    reviewGrowth: data?.reviewGrowth,
    registrationGrowth: data?.registrationGrowth,
  });

  return (
    <main className="min-h-screen bg-[#F6F7F5] px-6 py-10 text-[#111827]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#173D32]/70">
            Admin Overview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#111827]">
            StatCard — données réelles
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">
            Test visuel branché directement sur le hook Admin Overview.
            Période : 30 jours.
          </p>
        </div>

        {status === 'error' ? (
          <div className="mb-6 rounded-2xl border border-[#FECACA] bg-[#FEF2F2] p-5 text-sm text-[#B91C1C]">
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
            iconTone="amber"
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
