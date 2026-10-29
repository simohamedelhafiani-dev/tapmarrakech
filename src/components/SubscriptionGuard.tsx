import { ReactNode, useEffect, useState } from 'react';
import {
  getMySubscriptionAccess,
  planHasFeature,
  SubscriptionFeature,
  SubscriptionAccess,
} from '@/lib/subscriptionAccess';

type SubscriptionGuardProps = {
  establishmentId: string;
  feature: SubscriptionFeature;
  children: ReactNode;
  fallback?: ReactNode;
};

export default function SubscriptionGuard({
  establishmentId,
  feature,
  children,
  fallback,
}: SubscriptionGuardProps) {
  const [access, setAccess] = useState<SubscriptionAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(false);

      try {
        const results = await getMySubscriptionAccess(establishmentId);
        if (!cancelled) {
          setAccess(results[0] ?? null);
        }
      } catch (error) {
        console.error('Vérification de l’abonnement impossible :', error);
        if (!cancelled) {
          setAccess(null);
          setLoadError(true);
        }
      } finally {
        // Always release the guard after the request settles, including network
        // failures. A failed check must not leave the customer on a blank screen.
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [establishmentId, retryToken]);

  if (loading) {
    return (
      <div
        className="grid min-h-[180px] place-items-center gap-3 text-center text-sm text-ink/60"
        role="status"
        aria-live="polite"
      >
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-[#D4AF37] border-t-transparent" />
        <span>Vérification de l’abonnement…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-white p-6 text-center"
        role="alert"
      >
        <h3 className="text-sm font-semibold text-ink">
          Impossible de vérifier l’abonnement
        </h3>
        <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-ink/60">
          Vérifiez votre connexion puis réessayez. Aucune modification de votre abonnement n’a été effectuée.
        </p>
        <button
          type="button"
          onClick={() => setRetryToken((value) => value + 1)}
          className="mt-4 rounded-xl bg-[#0D0D0D] px-4 py-2.5 text-xs font-semibold text-white"
        >
          Réessayer
        </button>
      </div>
    );
  }

  if (!planHasFeature(access, feature)) {
    return (
      fallback ?? (
        <div className="rounded-2xl border border-ink/10 bg-white p-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#f5f0df] text-forest">
            🔒
          </div>

          <h3 className="mt-4 text-sm font-semibold text-ink">
            Fonctionnalité non incluse
          </h3>

          <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-ink/50">
            Cette fonctionnalité n’est pas incluse dans l’abonnement actuel
            de cet établissement.
          </p>
        </div>
      )
    );
  }

  return <>{children}</>;
}
