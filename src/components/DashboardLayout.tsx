import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Settings2,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

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
  {
    to: '/dashboard/loyalty/settings',
    label: 'Programme fidélité',
    icon: Settings2,
  },
];

type Establishment = {
  id: string;
  name: string;
};

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [establishmentName, setEstablishmentName] = useState<string | null>(null);

  const { signOut, user, role } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (!user?.id) {
        setProfileName(null);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('name')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        console.error('Erreur chargement du profil:', error);

        if (active) {
          setProfileName(null);
        }

        return;
      }

      if (active) {
        setProfileName(data?.name ?? null);
      }
    };

    loadProfile();

    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    const loadEstablishment = async () => {
      if (role !== 'responsible' || !user?.id) {
        setEstablishmentName(null);
        return;
      }

      const { data, error } = await supabase.rpc('get_my_establishments');

      if (error) {
        console.error(
          'Erreur chargement de l’établissement du responsable:',
          error
        );

        if (active) {
          setEstablishmentName(null);
        }

        return;
      }

      const establishments = (data ?? []) as Establishment[];

      if (active) {
        setEstablishmentName(establishments[0]?.name ?? null);
      }
    };

    loadEstablishment();

    return () => {
      active = false;
    };
  }, [role, user?.id]);

  const logout = async () => {
    await signOut();
    navigate('/login');
  };

  const roleLabel =
    role === 'admin'
      ? 'Administrateur'
      : role === 'responsible'
        ? 'Responsable'
        : role === 'employee'
          ? 'Employé'
          : 'Compte';

  const displayName =
    profileName ||
    user?.user_metadata?.name ||
    user?.email ||
    'Utilisateur';

  const avatarLetter =
    displayName?.trim()?.[0]?.toUpperCase() || 'U';

  const formattedDate = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const capitalizedDate =
    formattedDate.charAt(0).toUpperCase() +
    formattedDate.slice(1);

  const sidebarTitle =
    role === 'admin'
      ? 'TapMarrakech'
      : role === 'responsible'
        ? establishmentName || 'Mon établissement'
        : 'Mon espace';

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
        <div className="mb-10 flex items-center justify-between px-3">
          {role === 'admin' ? (
            <div className="flex min-h-[64px] flex-1 items-center justify-center">
              <img
                src="/tapmarrakech-logo.png"
                alt="TapMarrakech"
                className="h-16 w-16 object-contain"
              />
            </div>
          ) : (
            <div
              className="max-w-[205px] truncate font-display text-xl tracking-tight"
              title={sidebarTitle}
            >
              {sidebarTitle}
            </div>
          )}

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
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold font-semibold text-forest">
              {avatarLetter}
            </div>

            <div className="min-w-0">
              <p className="truncate text-xs font-medium">
                {displayName}
              </p>

              <p className="text-[10px] text-white/45">
                {roleLabel}
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
        <header className="sticky top-0 z-20 flex h-[104px] items-center justify-between border-b border-ink/5 bg-[#f7f7f3]/95 px-5 md:px-10">
          <button
            onClick={() => setOpen(true)}
            className="text-ink lg:hidden"
          >
            <Menu />
          </button>

          <div className="hidden text-sm text-ink/50 lg:block">
            {capitalizedDate}
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center gap-3">
            {establishmentLogoUrl ? (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-ink/10 bg-white p-1.5 shadow-sm">
                <img
                  src={establishmentLogoUrl}
                  alt={`Logo ${establishmentName || 'établissement'}`}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-ink/10 bg-white text-forest shadow-sm">
                <Building2 size={22} />
              </div>
            )}
            <div className="max-w-[260px] text-center">
              <p className="truncate text-sm font-semibold text-forest md:text-base">
                {establishmentName || 'Mon établissement'}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-gold">
                Établissement
              </p>
            </div>
          </div>

          <button
            onClick={() =>
              navigate('/dashboard/establishments')
            }
            className="ml-auto flex items-center gap-2 rounded-full bg-forest px-4 py-2 text-xs font-semibold text-white transition hover:bg-forest-light"
          >
            <Building2 size={15} />
            Gérer mes établissements
          </button>
        </header>

        <main className="mx-auto max-w-[1440px] p-5 md:p-10">
          <Outlet />
        </main>

        <footer className="px-5 pb-6 text-center text-xs font-medium text-ink/35 md:px-10">
          {role === 'admin' ? 'TapMarrakech' : 'by Tap Marrakech'}
        </footer>
      </div>
    </div>
  );
}
