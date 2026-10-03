import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { AdminOverviewEvolutionPoint } from '@/hooks/useAdminOverviewStats';

type EvolutionChartsProps = {
  reviewsData: AdminOverviewEvolutionPoint[];
  scansData: AdminOverviewEvolutionPoint[];
  loading?: boolean;
};

function formatDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);

  if (Number.isNaN(parsed.getTime())) {
    return date;
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
  }).format(parsed);
}

function EvolutionCard({
  title,
  description,
  data,
  dataKey,
  stroke,
}: {
  title: string;
  description: string;
  data: AdminOverviewEvolutionPoint[];
  dataKey: string;
  stroke: string;
}) {
  return (
    <div className="rounded-3xl border border-[#242424] bg-[#111111] p-5 shadow-soft">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A45C]/70">
            Évolution · 30 jours
          </p>
          <h3 className="mt-1 text-base font-semibold text-[#FFFFFF]">{title}</h3>
          <p className="mt-1 text-xs text-[#FFFFFF]/50">{description}</p>
        </div>
      </div>

      <div className="mt-5 h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <defs>
              <linearGradient id={`${dataKey}-gradient`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={stroke} stopOpacity={0.22} />
                <stop offset="100%" stopColor={stroke} stopOpacity={0.02} />
              </linearGradient>
            </defs>

            <CartesianGrid strokeDasharray="3 3" stroke="#242424" vertical={false} />

            <XAxis
              dataKey="date"
              tickFormatter={formatDate}
              tick={{ fontSize: 10, fill: '#F5F5DC' }}
              axisLine={false}
              tickLine={false}
              minTickGap={24}
            />

            <YAxis
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#F5F5DC' }}
              axisLine={false}
              tickLine={false}
              width={32}
            />

            <Tooltip
              labelFormatter={(label) => formatDate(String(label))}
              formatter={(value) => [Number(value), 'Nombre']}
              contentStyle={{
                borderRadius: 12,
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
              }}
            />

            <Area
              type="linear"
              dataKey="count"
              stroke={stroke}
              strokeWidth={2.5}
              fill={`url(#${dataKey}-gradient)`}
              dot={{ r: 2.5 }}
              activeDot={{ r: 5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function EvolutionSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {[0, 1].map((item) => (
        <div
          key={item}
          className="rounded-3xl border border-[#242424] bg-[#111111] p-5 shadow-soft"
        >
          <div className="h-3 w-28 animate-pulse rounded bg-[#242424]" />
          <div className="mt-2 h-5 w-36 animate-pulse rounded bg-[#242424]" />
          <div className="mt-1 h-3 w-48 animate-pulse rounded bg-[#242424]" />
          <div className="mt-5 h-[250px] animate-pulse rounded-2xl bg-[#111111]" />
        </div>
      ))}
    </div>
  );
}

export default function EvolutionCharts({
  reviewsData,
  scansData,
  loading = false,
}: EvolutionChartsProps) {
  if (loading) {
    return <EvolutionSkeleton />;
  }

  return (
    <section aria-label="Évolution de la plateforme">
      <div className="mb-4">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A45C]/70">
          Tendances
        </p>
        <h2 className="mt-1 text-lg font-semibold text-[#FFFFFF]">
          Évolution de la plateforme
        </h2>
        <p className="mt-1 text-sm text-[#FFFFFF]/50">
          Suivi quotidien des avis reçus et des scans sur les 30 derniers jours.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <EvolutionCard
          title="Avis reçus"
          description="Nombre d’avis créés chaque jour."
          data={reviewsData}
          dataKey="reviews"
          stroke="#C9A45C"
        />

        <EvolutionCard
          title="Scans"
          description="Nombre de pages établissement consultées chaque jour."
          data={scansData}
          dataKey="scans"
          stroke="#E1C27A"
        />
      </div>
    </section>
  );
}
