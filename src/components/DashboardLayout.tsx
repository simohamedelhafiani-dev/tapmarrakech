import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const links = [
  {
    to: '/dashboard',
    label: 'Vue d’ensemble',
    icon: LayoutDashboard,
    end: true,
  },
  {
    to: '/dashboard/establishments',
    label: 'Établissements',
    icon: Building2,
  },
  {
    to: '/dashboard/reviews',
    label: 'Avis reçus',
    icon: MessageSquare,
  },
  {
    to: '/dashboard/analytics',
    label: 'Analytics',
    icon: BarChart3,
  },
  {
    to: '/dashboard/loyalty',
    label: 'Fidélité',
    icon: Gift,
  },
];

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const { signOut, user } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-[#f7f7f3] text-ink">
      {open && (
        <button
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col bg-forest px-5 py-6 text-white transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-12 flex items-center justify-between px-3">
          <div className="font-display text-2xl tracking-tight">
            Tap<span className="text-gold">Marrakech</span>
          </div>

          <button
            className="lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/40">
          Espace de gestion
        </p>

        <nav className="space-y-1">
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              end={end}
              onClick={() => setOpen(false)}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-xl px-3 py-3 text-sm transition ${
                  isActive
                    ? 'bg-white text-forest shadow-lg'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto border-t border-white/10 pt-5">
          <div className="mb-4 flex items-center gap-3 px-2">
            <div className="grid h-9 w-9 place-items-center rounded-full bg-gold font-semibold text-forest">
              {user?.email?.[0]?.toUpperCase()}
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {user?.email}
              </p>

              <p className="text-[10px] text-white/45">
                Compte administrateur
              </p>
            </div>
          </div>

          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm text-white/60 transition hover:bg-white/10 hover:text-white"
          >
            <LogOut size={17} />
            Se déconnecter
          </button>
        </div>
      </aside>

      <div className="lg:pl-[270px]">
        <header className="sticky top-0 z-20 flex h-[76px] items-center justify-between border-b border-ink/5 bg-[#f7f7f3]/90 px-5 backdrop-blur md:px-10">
          <button
            onClick={() => setOpen(true)}
            className="text-ink lg:hidden"
          >
            <Menu />
          </button>

          <div className="hidden text-sm text-ink/50 lg:block">
            Mercredi 9 septembre 2026
          </div>

          <button
            onClick={() => navigate('/dashboard/establishments')}
            className="ml-auto flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-semibold text-white transition hover:bg-forest-light"
          >
            <Building2 size={15} />
            Gérer mes établissements
          </button>
        </header>

        <main className="mx-auto max-w-[1440px] p-5 md:p-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
