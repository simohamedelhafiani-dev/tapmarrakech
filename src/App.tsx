import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/DashboardLayout';
import SubscriptionGuard from '@/components/SubscriptionGuard';
import type { SubscriptionFeature } from '@/lib/subscriptionAccess';
import { supabase } from '@/lib/supabase';
import { LanguageProvider } from '@/contexts/LanguageContext';

import PublicReview from '@/pages/PublicReview';
import LoyaltyCard from '@/pages/LoyaltyCard';
import LoyaltyJoin from '@/pages/LoyaltyJoin';
import LoyaltyRecover from '@/pages/LoyaltyRecover';
import Login from '@/pages/Login';
import { EmailConfirmation, ForgotPassword, Register, ResetPassword } from '@/pages/AuthPages';

import Dashboard from '@/pages/Dashboard';
import Reviews from '@/pages/Reviews';
import Analytics from '@/pages/Analytics';
import Loyalty from '@/pages/Loyalty';
import LoyaltyRaffles from '@/pages/LoyaltyRaffles';
import Menu from '@/pages/Menu';
import Promotions from '@/pages/Promotions';
import Admin from '@/pages/Admin';
import AdminOverview from '@/pages/AdminOverview';
import AdminOverviewV2 from '@/pages/AdminOverviewV2';
import AdminStatCardTest from '@/pages/AdminStatCardTest';
import LoyaltyScanner from '@/pages/LoyaltyScanner';
import AssistantIA from '@/pages/AssistantIA';
import Onboarding from '@/pages/Onboarding';

type EstablishmentRow = {
  id: string;
};

function SubscriptionFeatureRoute({
  feature,
  children,
}: {
  feature: SubscriptionFeature;
  children: ReactNode;
}) {
  const { user } = useAuth();
  const [establishmentId, setEstablishmentId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let active = true;

    const loadSelectedEstablishment = async () => {
      if (!user?.id) {
        if (active) {
          setEstablishmentId(null);
          setLoadError(false);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setLoadError(false);

      try {
        const { data, error } = await supabase.rpc('get_my_establishments');
        if (error) throw error;

        const establishments = (data ?? []) as EstablishmentRow[];
        const storageKey = `tapmarrakech:selected-establishment:${user.id}`;
        let storedId: string | null = null;

        // Storage can be disabled by browser privacy settings. Fall back to the
        // first accessible establishment rather than blocking the route.
        try {
          storedId = window.localStorage.getItem(storageKey);
        } catch {
          storedId = null;
        }

        const selectedId = establishments.some(
          (establishment) => establishment.id === storedId
        )
          ? storedId
          : establishments[0]?.id ?? null;

        if (selectedId && selectedId !== storedId) {
          try {
            window.localStorage.setItem(storageKey, selectedId);
          } catch {
            // Selection still works for this page view when storage is blocked.
          }
        }

        if (active) setEstablishmentId(selectedId);
      } catch (error) {
        console.error(
          'Erreur chargement établissement pour le contrôle abonnement:',
          error
        );
        if (active) {
          setEstablishmentId(null);
          setLoadError(true);
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    loadSelectedEstablishment();

    const handleEstablishmentChanged = (event: Event) => {
      const customEvent = event as CustomEvent<{ establishmentId?: string }>;
      const nextId = customEvent.detail?.establishmentId;

      if (nextId) {
        setEstablishmentId(nextId);
      }
    };

    window.addEventListener(
      'tapmarrakech:establishment-changed',
      handleEstablishmentChanged
    );

    return () => {
      active = false;
      window.removeEventListener(
        'tapmarrakech:establishment-changed',
        handleEstablishmentChanged
      );
    };
  }, [user?.id, retryToken]);

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div
        className="rounded-2xl border border-red-200 bg-[var(--kelyani-panel)] px-6 py-12 text-center"
        role="alert"
      >
        <h2 className="font-display text-xl text-forest">
          Impossible de charger les établissements
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink/50">
          Vérifie ta connexion puis réessaie. Aucune modification n’a été effectuée.
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

  if (!establishmentId) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-[var(--kelyani-panel)] px-6 py-16 text-center">
        <h2 className="font-display text-2xl text-forest">
          Aucun établissement sélectionné
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-ink/50">
          Sélectionnez ou créez un établissement avant d’utiliser cette
          fonctionnalité.
        </p>
      </div>
    );
  }

  return (
    <SubscriptionGuard
      establishmentId={establishmentId}
      feature={feature}
    >
      {children}
    </SubscriptionGuard>
  );
}

function OnboardingGate() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = useState<'loading' | 'complete' | 'incomplete' | 'error'>('loading');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    if (authLoading) return () => { active = false; };
    if (!user?.id) {
      setStatus('error');
      return () => { active = false; };
    }
    setStatus('loading');
    void supabase.from('profiles').select('onboarding_completed_at').eq('id', user.id).maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        if (error) {
          console.error('Impossible de vérifier la fin de l’onboarding:', error);
          setStatus('error');
        } else {
          setStatus(data?.onboarding_completed_at ? 'complete' : 'incomplete');
        }
      });
    return () => { active = false; };
  }, [user?.id, authLoading, retry]);

  if (authLoading || status === 'loading') {
    return <div className="grid min-h-screen place-items-center bg-[var(--kelyani-bg)]"><div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--kelyani-gold)] border-t-transparent" /></div>;
  }
  if (status === 'incomplete') return <Navigate to="/dashboard/onboarding" replace />;
  if (status === 'error') {
    return <div className="grid min-h-[60vh] place-items-center bg-[var(--kelyani-bg)] px-6 text-center text-[var(--kelyani-text)]">
      <div className="max-w-md rounded-2xl border border-[var(--kelyani-border)] bg-[var(--kelyani-panel)] p-6">
        <h1 className="font-display text-xl text-[var(--kelyani-gold)]">Vérification du profil impossible</h1>
        <p className="mt-3 text-sm text-white/60">Nous ne pouvons pas vérifier si votre profil est terminé. Réessayez avant de continuer.</p>
        <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-5 rounded-xl bg-[var(--kelyani-gold)] px-4 py-2.5 text-sm font-semibold text-[var(--kelyani-bg)]">Réessayer</button>
      </div>
    </div>;
  }
  return <Outlet />;
}

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          <Route path="/r/:slug" element={<PublicReview />} />
          <Route path="/p/:slug/:section" element={<PublicReview />} />
          <Route path="/p/:slug" element={<PublicReview />} />
          <Route path="/loyalty" element={<LoyaltyLaunch />} />
          <Route path="/loyalty/join" element={<LoyaltyJoin />} />
          <Route path="/loyalty/recover" element={<LoyaltyRecover />} />
          <Route path="/loyalty/:token" element={<LoyaltyCard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/auth/callback" element={<EmailConfirmation />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin/*" element={<Admin />} />
            <Route path="/admin/overview-test" element={<AdminOverview />} />
            <Route path="/admin/overview-v2" element={<AdminOverviewV2 />} />
            <Route path="/admin/statcard-test" element={<AdminStatCardTest />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['responsible']} />}>
            <Route path="/dashboard/onboarding" element={<Onboarding />} />
            <Route element={<OnboardingGate />}>
              <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/assistant-ia" element={<AssistantIA />} />
              <Route
                path="/dashboard/reviews"
                element={
                  <SubscriptionFeatureRoute feature="reviews">
                    <Reviews />
                  </SubscriptionFeatureRoute>
                }
              />
              <Route
                path="/dashboard/analytics"
                element={
                  <SubscriptionFeatureRoute feature="analytics">
                    <Analytics />
                  </SubscriptionFeatureRoute>
                }
              />
              <Route
                path="/dashboard/menu/design"
                element={<Navigate to="/dashboard/menu" replace />}
              />
              <Route
                path="/dashboard/menu"
                element={
                  <SubscriptionFeatureRoute feature="menu">
                    <Menu />
                  </SubscriptionFeatureRoute>
                }
              />
              <Route
                path="/dashboard/promotions"
                element={
                  <SubscriptionFeatureRoute feature="promotions">
                    <Promotions />
                  </SubscriptionFeatureRoute>
                }
              />
              <Route
                path="/dashboard/loyalty"
                element={
                  <SubscriptionFeatureRoute feature="loyalty">
                    <Loyalty />
                  </SubscriptionFeatureRoute>
                }
              />
              <Route
                path="/dashboard/loyalty/raffles"
                element={
                  <SubscriptionFeatureRoute feature="loyalty">
                    <LoyaltyRaffles />
                  </SubscriptionFeatureRoute>
                }
              />
              <Route
                path="/dashboard/loyalty/settings"
                element={<Navigate to="/dashboard/loyalty" replace />}
              />
              </Route>
            </Route>
          </Route>

          {/* Parcours scanner fidélité conservé ; l'espace employé séparé n'est plus utilisé. */}
          <Route path="/employee" element={<LoyaltyScanner />} />

          <Route path="*" element={<RoleRedirect />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </LanguageProvider>
  );
}

function LoyaltyLaunch() {
  const customerToken = window.localStorage.getItem('tapmarrakech:customer-card-token');

  if (customerToken) {
    return <Navigate to={`/loyalty/${customerToken}`} replace />;
  }

  return <Navigate to="/login" replace />;
}

function RoleRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[var(--kelyani-panel)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  const launchSource = new URLSearchParams(window.location.search).get('source');
  const customerToken = window.localStorage.getItem('tapmarrakech:customer-card-token');
  const isStandalone =
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  // A customer-installed PWA must always reopen the saved customer card,
  // even if the installation was created from an older manifest whose
  // start_url was "/".
  if ((launchSource === 'pwa' || isStandalone) && customerToken) {
    return <Navigate to={`/loyalty/${customerToken}`} replace />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'responsible') return <Navigate to="/dashboard" replace />;

  return <Navigate to="/login" replace />;
}

export default App;
