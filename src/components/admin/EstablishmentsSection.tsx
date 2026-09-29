import { useMemo, useState } from 'react';
import { Activity, Building2, CreditCard, Plus, Search } from 'lucide-react';
import EstablishmentCard from '@/components/admin/EstablishmentCard';
import type { EstablishmentListItem } from '@/hooks/useEstablishments';

type SubscriptionFilter = 'all' | 'active' | 'trial' | 'none';

type EstablishmentsSectionProps = {
  establishments: EstablishmentListItem[];
  loading: boolean;
  error: Error | null;
  onAdd: () => void;
  onOpen: (establishment: EstablishmentListItem) => void;
};

export default function EstablishmentsSection({
  establishments,
  loading,
  error,
  onAdd,
  onOpen,
}: EstablishmentsSectionProps) {
  const [search, setSearch] = useState('');
  const [subscriptionFilter, setSubscriptionFilter] =
    useState<SubscriptionFilter>('all');

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return establishments.filter((establishment) => {
      const matchesSearch =
        !query ||
        [
          establishment.name,
          establishment.slug,
          establishment.city ?? '',
          establishment.business_type ?? '',
          establishment.subscription?.plan_name ?? '',
        ].some((value) => value.toLowerCase().includes(query));

      const status = establishment.subscription?.status ?? 'none';
      const matchesFilter =
        subscriptionFilter === 'all' ||
        (subscriptionFilter === 'none' && status === 'none') ||
        status === subscriptionFilter;

      return matchesSearch && matchesFilter;
    });
  }, [establishments, search, subscriptionFilter]);

  const activeCount = establishments.filter(
    (item) => item.subscription?.status === 'active'
  ).length;

  const trialCount = establishments.filter(
    (item) => item.subscription?.status === 'trial'
  ).length;

  return (
    <div className="space-y-7">
      <div className="relative overflow-hidden rounded-[28px] border border-ink/5 bg-forest p-6 text-white shadow-[0_18px_60px_rgba(23,61,50,0.14)] sm:p-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-gold/10 blur-2xl" />
        <div className="absolute -bottom-24 left-1/3 h-48 w-48 rounded-full bg-white/5 blur-3xl" />

        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
              <Building2 size={12} />
              Portefeuille
            </div>
            <h2 className="font-display text-3xl tracking-tight sm:text-4xl">
              Établissements
            </h2>
            <p className="mt-2 max-w-xl text-sm leading-6 text-white/55">
              Gérez chaque établissement depuis un espace centralisé, avec ses
              abonnements, sa fidélité, ses avis et son expérience client.
            </p>
          </div>

          <button
            type="button"
            onClick={onAdd}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-forest transition hover:bg-[#f7f7f3]"
          >
            <Plus size={16} />
            Ajouter un établissement
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink/5 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/35">
              Total
            </span>
            <Building2 size={16} className="text-forest/50" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">{establishments.length}</p>
          <p className="mt-1 text-[10px] text-ink/35">établissements gérés</p>
        </div>

        <div className="rounded-2xl border border-forest/10 bg-forest/[0.035] p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-forest/50">
              Abonnements
            </span>
            <CreditCard size={16} className="text-forest" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-forest">{activeCount}</p>
          <p className="mt-1 text-[10px] text-ink/35">
            actifs · {trialCount} en essai
          </p>
        </div>

        <div className="rounded-2xl border border-gold/20 bg-[#fdf9ef] p-4 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink/40">
              Vue
            </span>
            <Activity size={16} className="text-gold" />
          </div>
          <p className="mt-2 text-2xl font-semibold text-ink">{filtered.length}</p>
          <p className="mt-1 text-[10px] text-ink/35">
            résultat{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-md">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink/30"
          />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Rechercher un établissement..."
            className="h-12 w-full rounded-2xl border border-ink/8 bg-white pl-11 pr-4 text-sm outline-none shadow-sm transition focus:border-forest/25 focus:ring-4 focus:ring-forest/5"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {([
            ['all', 'Tous'],
            ['active', 'Actifs'],
            ['trial', 'Essais'],
            ['none', 'Sans abonnement'],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setSubscriptionFilter(value)}
              className={[
                'rounded-xl border px-3 py-2 text-[11px] font-semibold transition',
                subscriptionFilter === value
                  ? 'border-forest bg-forest text-white'
                  : 'border-ink/10 bg-white text-ink/55 hover:border-forest/20 hover:text-forest',
              ].join(' ')}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="rounded-3xl border border-red-100 bg-red-50 p-8 text-center">
          <p className="text-sm font-semibold text-red-700">
            Impossible de charger les établissements.
          </p>
          <p className="mt-1 text-xs text-red-600/70">{error.message}</p>
        </div>
      ) : loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-52 animate-pulse rounded-[26px] border border-ink/5 bg-white"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-ink/10 bg-white p-14 text-center shadow-soft">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-forest/5 text-forest">
            <Building2 size={24} />
          </div>
          <p className="mt-4 text-sm font-semibold text-ink">
            Aucun établissement trouvé
          </p>
          <p className="mt-1 text-xs text-ink/40">
            {search || subscriptionFilter !== 'all'
              ? 'Essayez une autre recherche ou un autre filtre.'
              : 'Créez votre premier établissement pour commencer.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((establishment) => (
            <EstablishmentCard
              key={establishment.id}
              establishment={establishment}
              onOpen={onOpen}
            />
          ))}
        </div>
      )}
    </div>
  );
}
