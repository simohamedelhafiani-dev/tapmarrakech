import { Building2, CreditCard, MapPin, Sparkles } from 'lucide-react';
import type { EstablishmentListItem } from '@/hooks/useEstablishments';

type EstablishmentCardProps = {
  establishment: EstablishmentListItem;
  onOpen: (establishment: EstablishmentListItem) => void;
};

function formatPrice(price: number | null, interval: string | null) {
  if (price == null) return null;
  const suffix = interval === 'year' ? '/an' : '/mois';
  return `${price.toLocaleString('fr-FR')} MAD${suffix}`;
}

export default function EstablishmentCard({
  establishment,
  onOpen,
}: EstablishmentCardProps) {
  const subscription = establishment.subscription;
  const isActive = subscription?.status === 'active';
  const isTrial = subscription?.status === 'trial';
  const price = formatPrice(subscription?.price_mad ?? null, subscription?.interval ?? null);

  return (
    <article className="group relative overflow-hidden rounded-[26px] border border-ink/6 bg-white p-5 text-left shadow-[0_8px_30px_rgba(15,23,42,0.045)] transition duration-300 hover:-translate-y-1 hover:border-forest/15 hover:shadow-[0_18px_45px_rgba(23,61,50,0.12)] sm:p-6">
      <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-forest via-forest/70 to-gold opacity-70" />

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {establishment.logo_url ? (
            <img
              src={establishment.logo_url}
              alt={establishment.name}
              className="h-14 w-14 shrink-0 rounded-2xl border border-ink/5 bg-[#f7f7f3] object-cover"
            />
          ) : (
            <div className="relative grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-forest text-white shadow-lg shadow-forest/10">
              <Building2 size={21} strokeWidth={1.8} />
              <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full border-2 border-white bg-gold">
                <Sparkles size={9} className="text-forest" />
              </span>
            </div>
          )}

          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-ink">
              {establishment.name}
            </h3>
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink/40">
              {establishment.business_type && <span>{establishment.business_type}</span>}
              {establishment.city && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} />
                  {establishment.city}
                </span>
              )}
              {!establishment.business_type && !establishment.city && <span>Établissement</span>}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpen(establishment)}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-ink/8 bg-[#fafaf7] text-ink/35 transition hover:border-forest/10 hover:bg-forest hover:text-white"
          aria-label={`Ouvrir ${establishment.name}`}
        >
          →
        </button>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        {subscription ? (
          <span
            className={[
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold',
              isActive
                ? 'bg-forest/7 text-forest'
                : isTrial
                  ? 'bg-gold/15 text-[#8b6a20]'
                  : 'bg-ink/5 text-ink/55',
            ].join(' ')}
          >
            <CreditCard size={11} />
            {subscription.plan_name ?? 'Abonnement'} · {isTrial ? 'Essai' : isActive ? 'Actif' : subscription.status}
            {price ? ` · ${price}` : ''}
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-medium text-ink/40">
            Aucun abonnement
          </span>
        )}

        <span className="rounded-full bg-[#f7f7f3] px-2.5 py-1 text-[10px] text-ink/35">
          /{establishment.slug}
        </span>
      </div>

      <div className="mt-5 border-t border-ink/5 pt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-ink/30">
              Espace de gestion
            </p>
            <p className="mt-1 text-xs font-medium text-ink/60">
              Profil · Menu · Fidélité · Avis · Analytics
            </p>
          </div>
          <button
            type="button"
            onClick={() => onOpen(establishment)}
            className="shrink-0 text-[11px] font-semibold text-forest opacity-70 transition group-hover:opacity-100"
          >
            Ouvrir →
          </button>
        </div>
      </div>
    </article>
  );
}
