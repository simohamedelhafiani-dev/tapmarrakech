import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { DashboardLayout } from '@/components/DashboardLayout';

import PublicReview from '@/pages/PublicReview';
import { ForgotPassword, Login, Register } from '@/pages/AuthPages';

import Dashboard from '@/pages/Dashboard';
import Establishments from '@/pages/Establishments';
import Reviews from '@/pages/Reviews';
import Analytics from '@/pages/Analytics';
import Loyalty from '@/pages/Loyalty';
import LoyaltySettings from '@/pages/LoyaltySettings';
import Admin from '@/pages/Admin';
import Employee from '@/pages/Employee';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* =====================================================
              PAGES PUBLIQUES
          ===================================================== */}

          <Route
            path="/r/:slug"
            element={<PublicReview />}
          />

          <Route
            path="/login"
            element={<Login />}
          />

          <Route
            path="/register"
            element={<Register />}
          />

          <Route
            path="/forgot-password"
            element={<ForgotPassword />}
          />

          {/* =====================================================
              ESPACE ADMIN TAPMARRAKECH
          ===================================================== */}

          <Route
            element={
              <ProtectedRoute allowedRoles={['admin']} />
            }
          >
            <Route
              path="/admin"
              element={<Admin />}
            />
          </Route>

          {/* =====================================================
              ESPACE RESPONSABLE
          ===================================================== */}

          <Route
            element={
              <ProtectedRoute allowedRoles={['responsible']} />
            }
          >
            <Route element={<DashboardLayout />}>

              <Route
                path="/dashboard"
                element={<Dashboard />}
              />

              <Route
                path="/dashboard/establishments"
                element={<Establishments />}
              />

              <Route
                path="/dashboard/reviews"
                element={<Reviews />}
              />

              <Route
                path="/dashboard/analytics"
                element={<Analytics />}
              />

              <Route
                path="/dashboard/loyalty"
                element={<Loyalty />}
              />

              <Route
                path="/dashboard/loyalty/settings"
                element={<LoyaltySettings />}
              />

            </Route>
          </Route>

          {/* =====================================================
              ESPACE EMPLOYÉ
              
              IMPORTANT :
              Cette route est volontairement PUBLIQUE au niveau
              de React Router.

              L'employé se sécurise ensuite avec son code dans
              Employee.tsx + employee-login.
          ===================================================== */}

          <Route
            path="/employee"
            element={<Employee />}
          />

          {/* =====================================================
              REDIRECTION PAR RÔLE
          ===================================================== */}

          <Route
            path="*"
            element={<RoleRedirect />}
          />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

/*
 * =============================================================
 * REDIRECTION
 * =============================================================
 */

function RoleRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f7f3]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  /*
   * Pas connecté :
   * on garde le login classique pour Admin / Responsable.
   */
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  /*
   * Admin
   */
  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  /*
   * Responsable
   */
  if (role === 'responsible') {
    return <Navigate to="/dashboard" replace />;
  }

  /*
   * Employé connecté via l'ancien système Auth :
   * on le renvoie vers son espace.
   */
  if (role === 'employee') {
    return <Navigate to="/employee" replace />;
  }

  /*
   * Sécurité :
   * si aucun rôle reconnu.
   */
  return <Navigate to="/login" replace />;
}

export default App;
