import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
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
              <Route path="/dashboard/establishments" element={<Establishments />} />
              <Route path="/dashboard/reviews" element={<Reviews />} />
              <Route path="/dashboard/analytics" element={<Analytics />} />
              <Route path="/dashboard/loyalty" element={<Loyalty />} />
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

          {/* Redirection générale */}
          <Route path="*" element={<RoleRedirect />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}


/*
  Écran temporaire Admin.
  On va le remplacer par le vrai dashboard Admin
  dans l'étape suivante.
*/
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


/*
  Écran temporaire Employé.
  On va créer le véritable espace employé
  après l'espace Admin.
*/
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


/*
  Redirection automatique selon le rôle.
*/
function RoleRedirect() {
  const storedRole = localStorage.getItem('tapmarrakech_role');

  if (storedRole === 'admin') {
    return <Navigate to="/admin" replace />;
  }

  if (storedRole === 'employee') {
    return <Navigate to="/employee" replace />;
  }

  return <Navigate to="/dashboard" replace />;
}


export default App;
