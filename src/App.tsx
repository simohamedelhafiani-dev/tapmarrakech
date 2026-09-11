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

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>

          {/* Pages publiques */}
          <Route path="/r/:slug" element={<PublicReview />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          {/* =========================================
              ESPACE ADMIN TAPMARRAKECH
          ========================================= */}
          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<AdminPlaceholder />} />
          </Route>

          {/* =========================================
              ESPACE RESPONSABLE
          ========================================= */}
          <Route element={<ProtectedRoute allowedRoles={['responsible']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
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

          {/* =========================================
              ESPACE EMPLOYÉ
          ========================================= */}
          <Route element={<ProtectedRoute allowedRoles={['employee']} />}>
            <Route path="/employee" element={<EmployeePlaceholder />} />
          </Route>

          {/* Redirection automatique selon le rôle */}
          <Route path="*" element={<RoleRedirect />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}


/* =========================================
   PAGE ADMIN TEMPORAIRE
========================================= */

function AdminPlaceholder() {
  return (
    <div className="min-h-screen bg-[#f7f7f3] grid place-items-center p-6">
      <div className="text-center">
        <div className="mb-4 text-5xl">👑</div>

        <h1 className="font-display text-3xl text-forest">
          Administration TapMarrakech
        </h1>

        <p className="mt-2 text-sm text-ink/50">
          Espace administrateur
        </p>
      </div>
    </div>
  );
}


/* =========================================
   PAGE EMPLOYÉ TEMPORAIRE
========================================= */

function EmployeePlaceholder() {
  return (
    <div className="min-h-screen bg-[#f7f7f3] grid place-items-center p-6">
      <div className="text-center">
        <div className="mb-4 text-5xl">👨‍💼</div>

        <h1 className="font-display text-3xl text-forest">
          Espace Employé
        </h1>

        <p className="mt-2 text-sm text-ink/50">
          Espace employé TapMarrakech
        </p>
      </div>
    </div>
  );
}


/* =========================================
   REDIRECTION SELON LE RÔLE
========================================= */

function RoleRedirect() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f7f3]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (role === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (role === 'employee') {
    return <Navigate to="/employee" replace />;
  }

  if (role === 'responsible') {
    return <Navigate to="/dashboard" replace />;
  }

  return <Navigate to="/login" replace />;
}


export default App;
