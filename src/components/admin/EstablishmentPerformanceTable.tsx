import { Building2, RefreshCw } from 'lucide-react';
import type { EstablishmentPerformance } from '@/hooks/useEstablishmentPerformance';

type EstablishmentPerformanceTableProps = {
  performanceData: EstablishmentPerformance[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void | Promise<void>;
};

function formatRating(rating: number, reviews: number): string {
  return reviews > 0 ? `${rating.toFixed(1)} / 5` : '—';
}

function formatVisits(visits: number): string {
  return visits === 1 ? '1' : visits.toLocaleString('fr-FR');
}

export default function EstablishmentPerformanceTable({
  performanceData,
  loading,
  error,
  onRetry,
}: EstablishmentPerformanceTableProps) {
  return (
    <section
      className="rounded-3xl border border-[#242424] bg-[#111111] p-6 shadow-soft"
      aria-labelledby="establishment-performance-title"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A45C]/45">
            Pilotage
          </p>
          <h3
            id="establishment-performance-title"
            className="mt-1 text-lg font-semibold text-[#FFFFFF]"
          >
            Performance par établissement
          </h3>
          <p className="mt-1 text-xs text-[#FFFFFF]/40">
            Totaux historiques depuis la création de chaque établissement.
          </p>
        </div>

        {!loading && !error && performanceData.length > 0 && (
          <span className="shrink-0 rounded-full bg-[#C9A45C]/5 px-3 py-1.5 text-[10px] font-semibold text-[#C9A45C]">
            {performanceData.length} établissement
            {performanceData.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="mt-5">
        {loading ? (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-[#242424] md:block">
              <div className="grid grid-cols-[minmax(180px,1.4fr)_repeat(5,minmax(80px,1fr))] gap-4 bg-[#111111] px-4 py-3">
                {[1, 2, 3, 4, 5, 6].map((item) => (
                  <div
                    key={item}
                    className="h-2.5 animate-pulse rounded bg-ink/5"
                  />
                ))}
              </div>
              <div className="divide-y divide-ink/5">
                {[1, 2].map((row) => (
                  <div
                    key={row}
                    className="grid grid-cols-[minmax(180px,1.4fr)_repeat(5,minmax(80px,1fr))] items-center gap-4 px-4 py-4"
                  >
                    {[1, 2, 3, 4, 5, 6].map((cell) => (
                      <div
                        key={cell}
                        className="h-3 animate-pulse rounded bg-ink/5"
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:hidden">
              {[1, 2].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-[#242424] p-4"
                >
                  <div className="h-4 w-32 animate-pulse rounded bg-ink/5" />
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    {[1, 2, 3, 4, 5].map((cell) => (
                      <div
                        key={cell}
                        className="h-3 animate-pulse rounded bg-ink/5"
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : error ? (
          <div className="rounded-2xl border border-[#242424] bg-[#111111] p-6 text-center">
            <p className="text-sm font-semibold text-[#FFFFFF]">
              Impossible de charger les performances des établissements.
            </p>
            <button
              type="button"
              onClick={() => void onRetry()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2.5 text-xs font-semibold text-[#050505] transition hover:bg-[#C9A45C]-light"
            >
              <RefreshCw size={14} />
              Réessayer
            </button>
          </div>
        ) : performanceData.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/10 bg-[#111111] p-8 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#C9A45C]/5 text-[#C9A45C]">
              <Building2 size={18} />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#FFFFFF]">
              Aucun établissement à afficher
            </p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-hidden rounded-2xl border border-[#242424] md:block">
              <div className="grid grid-cols-[minmax(180px,1.4fr)_repeat(5,minmax(80px,1fr))] gap-4 bg-[#111111] px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#FFFFFF]/40">
                <span>Établissement</span>
                <span className="text-right">Avis</span>
                <span className="text-right">Note</span>
                <span className="text-right">Scans</span>
                <span className="text-right">Clients</span>
                <span className="text-right">Visites</span>
              </div>

              <div className="divide-y divide-ink/5">
                {performanceData.map((performance) => (
                  <div
                    key={performance.establishment_id}
                    className="grid grid-cols-[minmax(180px,1.4fr)_repeat(5,minmax(80px,1fr))] items-center gap-4 px-4 py-4 transition hover:bg-[#111111]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#C9A45C]">
                        <Building2 size={16} strokeWidth={1.9} />
                      </div>
                      <span className="truncate text-xs font-semibold text-[#FFFFFF]">
                        {performance.establishment_name}
                      </span>
                    </div>
                    <span className="text-right text-xs font-semibold text-[#FFFFFF]">
                      {performance.reviews.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-right text-xs text-[#FFFFFF]">
                      {formatRating(performance.average_rating, performance.reviews)}
                    </span>
                    <span className="text-right text-xs font-semibold text-[#FFFFFF]">
                      {performance.scans.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-right text-xs font-semibold text-[#FFFFFF]">
                      {performance.loyalty_customers.toLocaleString('fr-FR')}
                    </span>
                    <span className="text-right text-xs font-semibold text-[#FFFFFF]">
                      {formatVisits(performance.visits)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-2 md:hidden">
              {performanceData.map((performance) => (
                <div
                  key={performance.establishment_id}
                  className="rounded-2xl border border-[#242424] p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#C9A45C]">
                      <Building2 size={16} strokeWidth={1.9} />
                    </div>
                    <span className="truncate text-sm font-semibold text-[#FFFFFF]">
                      {performance.establishment_name}
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <Metric label="Avis" value={performance.reviews} />
                    <Metric
                      label="Note"
                      value={formatRating(
                        performance.average_rating,
                        performance.reviews,
                      )}
                    />
                    <Metric label="Scans" value={performance.scans} />
                    <Metric
                      label="Clients"
                      value={performance.loyalty_customers}
                    />
                    <Metric label="Visites" value={performance.visits} />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-xl bg-[#111111] p-3">
      <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#FFFFFF]/35">
        {label}
      </p>
      <p className="mt-1 text-sm font-semibold text-[#FFFFFF]">
        {typeof value === 'number' ? value.toLocaleString('fr-FR') : value}
      </p>
    </div>
  );
}
