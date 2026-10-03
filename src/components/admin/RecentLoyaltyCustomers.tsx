import { RefreshCw, UserPlus } from 'lucide-react';
import type { RecentLoyaltyCustomer } from '@/hooks/useRecentLoyaltyCustomers';

type RecentLoyaltyCustomersProps = {
  customers: RecentLoyaltyCustomer[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void | Promise<void>;
};

function formatDate(createdAt: string): string {
  const timestamp = Date.parse(createdAt);

  if (Number.isNaN(timestamp)) {
    return 'Date inconnue';
  }

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp));
}

function getCustomerName(customer: RecentLoyaltyCustomer): string {
  return [customer.first_name, customer.last_name]
    .filter(Boolean)
    .join(' ')
    .trim() || 'Client';
}

export default function RecentLoyaltyCustomers({
  customers,
  loading,
  error,
  onRetry,
}: RecentLoyaltyCustomersProps) {
  return (
    <section
      className="rounded-3xl border border-[#242424] bg-[#111111] p-6 shadow-soft"
      aria-labelledby="recent-loyalty-customers-title"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A45C]/45">
            Fidélité
          </p>
          <h3
            id="recent-loyalty-customers-title"
            className="mt-1 text-lg font-semibold text-[#FFFFFF]"
          >
            Clients récents
          </h3>
        </div>

        {!loading && !error && customers.length > 0 && (
          <span className="rounded-full bg-[#C9A45C]/5 px-3 py-1.5 text-[10px] font-semibold text-[#C9A45C]">
            {customers.length} client{customers.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-2" aria-label="Chargement des clients fidélité récents">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-[#242424] p-3"
              >
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-ink/5" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-36 animate-pulse rounded bg-ink/5" />
                  <div className="h-2.5 w-48 max-w-full animate-pulse rounded bg-ink/5" />
                </div>
                <div className="h-6 w-20 animate-pulse rounded-full bg-ink/5" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#242424] bg-[#111111] p-6 text-center">
            <p className="text-sm font-semibold text-[#FFFFFF]">
              Impossible de charger les clients fidélité récents.
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
        ) : customers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/10 bg-[#111111] p-8 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#C9A45C]/5 text-[#C9A45C]">
              <UserPlus size={18} />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#FFFFFF]">
              Aucun client fidélité récent
            </p>
            <p className="mt-1 text-xs text-[#FFFFFF]/40">
              Les nouveaux membres du programme apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {customers.map((customer) => {
              const visitLabel =
                customer.visit_count === 1
                  ? '1 visite'
                  : `${customer.visit_count} visites`;

              return (
                <div
                  key={customer.id}
                  className="flex items-center gap-3 rounded-2xl border border-[#242424] p-3 transition hover:border-[#242424] hover:bg-[#111111]"
                >
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#C9A45C]">
                    <UserPlus size={17} strokeWidth={1.9} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#FFFFFF]">
                      {getCustomerName(customer)}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[#FFFFFF]/40">
                      {customer.establishment_name} · membre depuis{' '}
                      {formatDate(customer.created_at)}
                    </p>
                  </div>

                  <span
                    className={
                      customer.visit_count > 0
                        ? 'shrink-0 rounded-full bg-[#C9A45C]/10 px-2.5 py-1.5 text-[10px] font-semibold text-[#C9A45C]'
                        : 'shrink-0 rounded-full bg-ink/5 px-2.5 py-1.5 text-[10px] font-medium text-[#FFFFFF]/40'
                    }
                  >
                    {visitLabel}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
