import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  Building2,
  Gift,
  LayoutDashboard,
  LogOut,
  Menu as MenuIcon,
  MessageSquare,
  Settings2,
  UtensilsCrossed,
  X,
  QrCode,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLanguage, type Language } from '@/contexts/LanguageContext';

const links = [
  {
    to: '/dashboard',
    label: 'Vue d’ensemble',
    icon: LayoutDashboard,
    end: true,
    feature: null,
  },
  {
    to: '/dashboard/establishments',
    label: 'Établissements',
    icon: Building2,
    feature: null,
  },
  {
    to: '/dashboard/reviews',
    label: 'Avis reçus',
    icon: MessageSquare,
    feature: 'reviews' as const,
  },
  {
    to: '/dashboard/analytics',
    label: 'Analytics',
    icon: BarChart3,
    feature: 'analytics' as const,
  },
  {
    to: '/dashboard/menu',
    label: 'Menu',
    icon: UtensilsCrossed,
    feature: 'menu' as const,
  },
  {
    to: '/dashboard/promotions',
    label: 'Promotions',
    icon: Gift,
    feature: 'promotions' as const,
  },
  {
    to: '/dashboard/loyalty',
    label: 'Fidélité',
    icon: Gift,
    feature: 'loyalty' as const,
  },
  {
    to: '/dashboard/loyalty/settings',
    label: 'Programme fidélité',
    icon: Settings2,
    feature: 'loyalty' as const,
  },
];

type Establishment = {
  id: string;
  name: string;
  logo_url: string | null;
};

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [establishmentName, setEstablishmentName] = useState<string | null>(
    null
  );
  const [establishmentLogoUrl, setEstablishmentLogoUrl] = useState<
    string | null
  >(null);
  const [scannerUrl, setScannerUrl] = useState<string | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);

  const { signOut, user, role } = useAuth();
  const { language, setLanguage } = useLanguage();
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
        setEstablishmentLogoUrl(null);
        setScannerUrl(null);
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
          setEstablishmentLogoUrl(null);
          setScannerUrl(null);
        }

        return;
      }

      const establishments = (data ?? []) as Establishment[];
      const establishment = establishments[0];

      if (active) {
        setEstablishmentName(establishment?.name ?? null);
        setEstablishmentLogoUrl(establishment?.logo_url ?? null);
      }

      if (!establishment?.id) {
        if (active) setScannerUrl(null);
        return;
      }

      setScannerLoading(true);
      const { data: scannerRow, error: scannerError } = await supabase
        .from('establishment_scanner_links')
        .select('access_token')
        .eq('establishment_id', establishment.id)
        .maybeSingle();

      if (!active) return;

      if (scannerError || !scannerRow?.access_token) {
        console.error(
          'Erreur lecture du lien scanner fidélité:',
          scannerError ?? new Error('Aucun lien scanner pour cet établissement')
        );
        setScannerUrl(null);
      } else {
        setScannerUrl(
          window.location.origin +
            '/employee?scanner=' +
            encodeURIComponent(scannerRow.access_token)
        );
      }

      setScannerLoading(false);
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
      ? (language === 'en' ? 'Administrator' : language === 'ar' ? 'المشرف' : 'Administrateur')
      : role === 'responsible'
        ? (language === 'en' ? 'Manager' : language === 'ar' ? 'المسؤول' : 'Responsable')
        : 'Compte';

  const navLabels: Record<string, string> = language === 'en'
    ? {
        'Vue d’ensemble': 'Overview',
        'Établissements': 'Establishments',
        'Avis reçus': 'Reviews',
        Analytics: 'Analytics',
        Menu: 'Menu',
        Promotions: 'Promotions',
        Fidélité: 'Loyalty',
        'Programme fidélité': 'Loyalty program',
      }
    : language === 'ar'
      ? {
          'Vue d’ensemble': 'نظرة عامة',
          'Établissements': 'المؤسسات',
          'Avis reçus': 'التقييمات',
          Analytics: 'التحليلات',
          Menu: 'القائمة',
          Promotions: 'العروض',
          Fidélité: 'الولاء',
          'Programme fidélité': 'برنامج الولاء',
        }
      : {};

  const localizedLabel = (label: string) => navLabels[label] ?? label;

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
        className={`fixed inset-y-0 z-40 flex w-[248px] flex-col bg-forest px-4 py-5 text-white shadow-xl transition-transform lg:translate-x-0 ${language === 'ar' ? 'right-0 left-auto' : 'left-0'} ${
          open ? 'translate-x-0' : language === 'ar' ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-9 flex items-center justify-between px-2">
          <div className="flex min-h-[64px] flex-1 items-center justify-center">
            <img
              src="/tapmarrakech-logo.png"
              alt="TapMarrakech"
              className="h-[72px] w-[72px] object-contain"
            />
          </div>

          <button
            className="lg:hidden"
            onClick={() => setOpen(false)}
            aria-label="Fermer le menu"
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
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
                `flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] transition ${
                  isActive
                    ? 'bg-white text-forest shadow-lg'
                    : 'text-white/65 hover:bg-white/10 hover:text-white'
                }`
              }
            >
              <Icon size={18} strokeWidth={1.8} />
              {localizedLabel(label)}
            </NavLink>
          ))}
        </nav>

        {role === 'responsible' && (
          <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <QrCode size={16} />
              Scanner fidélité
            </div>
            <p className="mt-1 text-[10px] leading-4 text-white/45">
              Lien permanent de votre scanner pour valider les récompenses.
            </p>

            {scannerLoading ? (
              <div className="mt-3 text-[10px] text-white/45">Génération du lien…</div>
            ) : scannerUrl ? (
              <>
                <div className="mt-3 rounded-lg bg-black/20 px-2.5 py-2 text-[9px] leading-3 text-white/55 break-all">
                  {scannerUrl}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => window.open(scannerUrl, '_blank', 'noopener,noreferrer')}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-gold px-2 py-2 text-[10px] font-semibold text-forest hover:bg-gold/90"
                  >
                    <ExternalLink size={12} />
                    Ouvrir
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(scannerUrl);
                        alert('Lien scanner copié.');
                      } catch {
                        alert('Impossible de copier le lien.');
                      }
                    }}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2 py-2 text-[10px] font-semibold text-white hover:bg-white/10"
                  >
                    <Copy size={12} />
                    Copier
                  </button>
                </div>
              </>
            ) : (
              <p className="mt-3 text-[10px] leading-4 text-red-200">
                Impossible de charger le lien scanner.
              </p>
            )}
          </div>
        )}

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

      <div className={language === 'ar' ? 'lg:pr-[270px]' : 'lg:pl-[270px]'}>
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center gap-4 border-b border-ink/5 bg-[#f7f7f3]/90 px-4 py-3 backdrop-blur-xl sm:px-6 md:px-8">
          <button
            onClick={() => setOpen(true)}
            className="text-ink lg:hidden"
            aria-label="Ouvrir le menu"
          >
            <MenuIcon />
          </button>

          <div className="hidden min-w-0 flex-1 max-w-[560px] lg:block">
            <div className="flex h-11 items-center gap-3 rounded-xl border border-ink/5 bg-white px-4 shadow-sm">
              <span className="text-ink/35">⌕</span>
              <span className="text-xs text-ink/35">Rechercher un client, un avis, un établissement...</span>
              <span className="ml-auto rounded-md border border-ink/10 bg-[#f7f7f3] px-2 py-1 text-[9px] text-ink/35">⌘ K</span>
            </div>
          </div>



          <div className="ml-auto flex items-center gap-2">
            <button type="button" className="relative grid h-10 w-10 place-items-center rounded-xl border border-ink/10 bg-white text-ink/60 shadow-sm" aria-label="Notifications">
              <Bell size={17} />
              <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-red-500" />
            </button>
            <div className="hidden h-10 items-center gap-2 rounded-xl border border-ink/10 bg-white px-2.5 shadow-sm sm:flex">
              <div className="grid h-7 w-7 place-items-center rounded-full bg-forest text-xs font-semibold text-white">{avatarLetter}</div>
              <div className="max-w-[130px] leading-tight">
                <p className="truncate text-xs font-semibold text-ink">{displayName}</p>
                <p className="text-[9px] text-ink/40">{roleLabel}</p>
              </div>
            </div>
            <label className="hidden items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink/60 shadow-sm md:flex">
              <select
                value={language}
                onChange={(event) => setLanguage(event.target.value as Language)}
                aria-label="Language"
                className="cursor-pointer bg-transparent outline-none"
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
                <option value="ar">العربية</option>
              </select>
            </label>
            <button
            onClick={() =>
              navigate('/dashboard/establishments')
            }
            className="flex items-center gap-2 rounded-full bg-forest px-3 py-2 text-xs font-semibold text-white transition hover:bg-forest-light sm:px-4"
          >
            <Building2 size={15} />
            <span className="hidden sm:inline">Gérer mes établissements</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-5 md:p-8 lg:p-10">
          <Outlet />
        </main>

        <footer className="px-5 pb-6 text-center text-xs font-medium text-ink/35 md:px-10">
          {role === 'admin' ? 'TapMarrakech' : 'by Tap Marrakech'}
        </footer>
      </div>
    </div>
  );
}
