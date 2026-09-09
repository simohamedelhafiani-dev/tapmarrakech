import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen grid place-items-center bg-cream"><div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" /></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}
