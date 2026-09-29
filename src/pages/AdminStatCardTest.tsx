import {
  MessageSquare,
  Star,
  UsersRound,
} from 'lucide-react';
import StatCard from '@/components/admin/StatCard';

export default function AdminStatCardTest() {
  return (
    <main className="min-h-screen bg-[#F6F7F5] px-6 py-10 text-[#111827]">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#173D32]/70">
            Admin Overview
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em] text-[#111827]">
            StatCard — test visuel
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6B7280]">
            Aperçu isolé du composant avant son utilisation dans le nouvel
            Overview Admin.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            label="Avis reçus"
            value={11}
            icon={MessageSquare}
            iconTone="forest"
            hint="Total actuel"
          />

          <StatCard
            label="Note moyenne"
            value="4.09"
            icon={Star}
            iconTone="gold"
            hint="Sur 5.00"
          />

          <StatCard
            label="Clients fidélisés"
            value={13}
            icon={UsersRound}
            iconTone="emerald"
            hint="Clients enregistrés"
          />
        </div>
      </div>
    </main>
  );
}
