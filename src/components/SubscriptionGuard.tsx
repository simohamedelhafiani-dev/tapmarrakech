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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);

      const results = await getMySubscriptionAccess(establishmentId);

      if (!cancelled) {
        setAccess(results[0] ?? null);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [establishmentId]);

  if (loading) {
    return null;
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
