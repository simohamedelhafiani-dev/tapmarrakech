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

function App() { return <BrowserRouter><AuthProvider><Routes><Route path="/r/:slug" element={<PublicReview />} /><Route path="/login" element={<Login />} /><Route path="/register" element={<Register />} /><Route path="/forgot-password" element={<ForgotPassword />} /><Route element={<ProtectedRoute />}><Route element={<DashboardLayout />}><Route path="/dashboard" element={<Dashboard />} /><Route path="/dashboard/establishments" element={<Establishments />} /><Route path="/dashboard/reviews" element={<Reviews />} /><Route path="/dashboard/analytics" element={<Analytics />} /></Route></Route><Route path="*" element={<Navigate to="/dashboard" replace />} /></Routes></AuthProvider></BrowserRouter>; }
export default App;
