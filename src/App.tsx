import { useEffect, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
import Login from '@/pages/Login';
import { ForgotPassword, Register } from '@/pages/AuthPages';

import Dashboard from '@/pages/Dashboard';
import Establishments from '@/pages/Establishments';
import Reviews from '@/pages/Reviews';
import Analytics from '@/pages/Analytics';
import Loyalty from '@/pages/Loyalty';
import LoyaltySettings from '@/pages/LoyaltySettings';
import Menu from '@/pages/Menu';
import MenuDesign from '@/pages/MenuDesign';
import Promotions from '@/pages/Promotions';
import Admin from '@/pages/Admin';
import Employee from '@/pages/Employee';
import LoyaltyScanner from '@/pages/LoyaltyScanner';

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

  useEffect(() => {
    let active = true;

    const loadSelectedEstablishment = async () => {
      if (!user?.id) {
        if (active) {
          setEstablishmentId(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);

      const { data, error } = await supabase.rpc('get_my_establishments');

      if (error) {
        console.error(
          'Erreur chargement établissement pour le contrôle abonnement:',
          error
        );

        if (active) {
          setEstablishmentId(null);
          setLoading(false);
        }

        return;
      }

      const establishments = (data ?? []) as EstablishmentRow[];
      const storageKey = `tapmarrakech:selected-establishment:${user.id}`;
      const storedId = window.localStorage.getItem(storageKey);

      const selectedId = establishments.some(
        (establishment) => establishment.id === storedId
      )
        ? storedId
        : establishments[0]?.id ?? null;

      if (selectedId && selectedId !== storedId) {
        window.localStorage.setItem(storageKey, selectedId);
      }

      if (active) {
        setEstablishmentId(selectedId);
        setLoading(false);
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
  }, [user?.id]);

  if (loading) {
    return (
      <div className="grid min-h-[400px] place-items-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!establishmentId) {
    return (
      <div className="rounded-2xl border border-dashed border-ink/15 bg-white px-6 py-16 text-center">
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

function App() {
  return (
    <LanguageProvider>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
          <Route path="/r/:slug" element={<PublicReview />} />
          <Route path="/loyalty" element={<LoyaltyLaunch />} />
          <Route path="/loyalty/:token" element={<LoyaltyCard />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['responsible']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route
                path="/dashboard/establishments"
                element={<Establishments />}
              />
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
                element={
                  <SubscriptionFeatureRoute feature="menu">
                    <MenuDesign />
                  </SubscriptionFeatureRoute>
                }
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
                path="/dashboard/loyalty/settings"
                element={
                  <SubscriptionFeatureRoute feature="loyalty">
                    <LoyaltySettings />
                  </SubscriptionFeatureRoute>
                }
              />
            </Route>
          </Route>

          {/* L'employé possède sa propre session par code. */}
          <Route
            path="/employee"
            element={
              new URLSearchParams(window.location.search).has('scanner') ? (
                <LoyaltyScanner />
              ) : (
                <Employee />
              )
            }
          />

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
      <div className="min-h-screen grid place-items-center bg-[#f7f7f3]">
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
    const scannerToken = window.localStorage.getItem('tapmarrakech:scanner-token');
    if (scannerToken) return <Navigate to={`/employee?scanner=${scannerToken}`} replace />;

    return <Navigate to="/login" replace />;
  }

  if (role === 'admin') return <Navigate to="/admin" replace />;
  if (role === 'responsible') return <Navigate to="/dashboard" replace />;
  if (role === 'employee') return <Navigate to="/employee" replace />;

  return <Navigate to="/login" replace />;
}

export default App;
