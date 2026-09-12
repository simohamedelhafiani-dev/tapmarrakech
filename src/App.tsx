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
          <Route path="/r/:slug" element={<PublicReview />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />

          <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
            <Route path="/admin" element={<Admin />} />
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['responsible']} />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/establishments" element={<Establishments />} />
              <Route path="/dashboard/reviews" element={<Reviews />} />
              <Route path="/dashboard/analytics" element={<Analytics />} />
              <Route path="/dashboard/loyalty" element={<Loyalty />} />
              <Route path="/dashboard/loyalty/settings" element={<LoyaltySettings />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute allowedRoles={['employee']} />}>
            <Route path="/employee" element={<Employee />} />
          </Route>

          <Route path="*" element={<RoleRedirect />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
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
