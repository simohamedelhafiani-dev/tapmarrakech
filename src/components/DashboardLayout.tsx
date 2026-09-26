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
  UtensilsCrossed,
  X,
  QrCode,
  Copy,
  ExternalLink,
  MessageCircle,
  AlertTriangle,
  Check,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { getMySubscriptionAccess, getSubscriptionTheme, type SubscriptionTheme } from '@/lib/subscriptionAccess';
import { DataLoadError } from '@/components/DataLoadError';

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
];

type Establishment = {
  id: string;
  name: string;
  logo_url: string | null;
};

type AppNotification = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  tone: 'review' | 'alert' | 'info';
};

export function DashboardLayout() {
  const [open, setOpen] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [scannerUrl, setScannerUrl] = useState<string | null>(null);
  const [scannerLoading, setScannerLoading] = useState(false);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [lastSeenNotificationsAt, setLastSeenNotificationsAt] = useState<string | null>(null);
  const [subscriptionTheme, setSubscriptionTheme] = useState<SubscriptionTheme>(() => getSubscriptionTheme(null));

  const { signOut, user, role, loading: authLoading } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const notificationStorageKey = user?.id ? `tapmarrakech:notifications:last-seen:${user.id}` : null;

  useEffect(() => {
    let active = true;

    const loadSubscriptionTheme = async () => {
      if (authLoading) return;
      if (role !== 'responsible') {
        if (active) setSubscriptionTheme(getSubscriptionTheme(null));
        return;
      }

      const accesses = await getMySubscriptionAccess();
      const establishmentId = (() => {
        try {
          return user?.id ? window.localStorage.getItem(`tapmarrakech:selected-establishment:${user.id}`) : null;
        } catch {
          return null;
        }
      })();
      const access = establishmentId
        ? accesses.find((item) => item.establishment_id === establishmentId)
        : accesses[0];

      if (active) setSubscriptionTheme(getSubscriptionTheme(access));
    };

    void loadSubscriptionTheme();

    const handleEstablishmentChanged = () => void loadSubscriptionTheme();
    window.addEventListener('tapmarrakech:establishment-changed', handleEstablishmentChanged);

    return () => {
      active = false;
      window.removeEventListener('tapmarrakech:establishment-changed', handleEstablishmentChanged);
    };
  }, [authLoading, role, user?.id]);

  useEffect(() => {
    if (!notificationStorageKey) {
      setLastSeenNotificationsAt(null);
      return;
    }
    setLastSeenNotificationsAt(localStorage.getItem(notificationStorageKey));
  }, [notificationStorageKey]);

  useEffect(() => {
    if (authLoading || !user?.id || !role) return;
    let active = true;

    const loadNotifications = async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      try {
        let establishmentIds: string[] = [];

        if (role === 'responsible') {
          const { data } = await supabase.rpc('get_my_establishments');
          establishmentIds = (data ?? [])
            .map((item: { id?: string }) => item.id)
            .filter(Boolean) as string[];
        }

        const scope = <T extends { in: (column: string, values: string[]) => T }>(
          query: T
        ) => establishmentIds.length ? query.in('establishment_id', establishmentIds) : query;

        const reviewQuery = scope(
          supabase.from('reviews')
            .select('id,rating,content,created_at,establishment_id')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(100)
        );

        const loyaltyCustomerQuery = scope(
          supabase.from('loyalty_customers')
            .select('id,first_name,last_name,created_at,establishment_id')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(100)
        );

        const loyaltyTransactionQuery = scope(
          supabase.from('loyalty_transactions')
            .select('id,type,points,amount,description,created_at,establishment_id')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(100)
        );

        const loyaltyRedemptionQuery = scope(
          supabase.from('loyalty_redemptions')
            .select('id,points_used,discount_amount,amount_paid,created_at,establishment_id')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(100)
        );

        const [
          { data: reviewRows, error: reviewError },
          { data: customerRows, error: customerError },
          { data: transactionRows, error: transactionError },
          { data: redemptionRows, error: redemptionError },
        ] = await Promise.all([
          role === 'admin' || establishmentIds.length ? reviewQuery : Promise.resolve({ data: [], error: null }),
          role === 'admin' || establishmentIds.length ? loyaltyCustomerQuery : Promise.resolve({ data: [], error: null }),
          role === 'admin' || establishmentIds.length ? loyaltyTransactionQuery : Promise.resolve({ data: [], error: null }),
          role === 'admin' || establishmentIds.length ? loyaltyRedemptionQuery : Promise.resolve({ data: [], error: null }),
        ]);

        if (!active) return;

        if (reviewError) console.error('Erreur notifications avis:', reviewError);
        if (customerError) console.error('Erreur notifications fidélité:', customerError);
        if (transactionError) console.error('Erreur notifications transactions fidélité:', transactionError);
        if (redemptionError) console.error('Erreur notifications récompenses:', redemptionError);

        const reviewNotifications: AppNotification[] = (reviewRows ?? []).map((review) => ({
          id: `review-${review.id}`,
          title: 'Nouvel avis client',
          description: `Note ${review.rating}/5${review.content ? ` — ${String(review.content).slice(0, 90)}` : ''}`,
          createdAt: review.created_at,
          tone: Number(review.rating) <= 3 ? 'alert' : 'review',
        }));

        const customerNotifications: AppNotification[] = (customerRows ?? []).map((customer) => ({
          id: `loyalty-customer-${customer.id}`,
          title: 'Nouveau client fidélité',
          description: `${[customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Un client'} a rejoint le programme de fidélité.`,
          createdAt: customer.created_at,
          tone: 'info',
        }));

        const transactionNotifications: AppNotification[] = (transactionRows ?? []).map((transaction) => ({
          id: `loyalty-transaction-${transaction.id}`,
          title: transaction.type === 'EARN' ? 'Points fidélité ajoutés' : 'Mouvement fidélité',
          description: `${transaction.points ?? 0} point${Math.abs(Number(transaction.points ?? 0)) > 1 ? 's' : ''} · ${transaction.description || 'Nouvelle transaction fidélité'}`,
          createdAt: transaction.created_at,
          tone: 'info',
        }));

        const redemptionNotifications: AppNotification[] = (redemptionRows ?? []).map((redemption) => ({
          id: `loyalty-redemption-${redemption.id}`,
          title: 'Récompense utilisée',
          description: `${redemption.points_used ?? 0} points utilisés${redemption.discount_amount ? ` · remise ${redemption.discount_amount} DH` : ''}.`,
          createdAt: redemption.created_at,
          tone: 'review',
        }));

        let extraNotifications: AppNotification[] = [];

        if (role === 'admin') {
          const { data: establishmentsRows, error: establishmentsError } = await supabase
            .from('establishments')
            .select('id,name,created_at')
            .gte('created_at', since)
            .order('created_at', { ascending: false })
            .limit(100);

          if (establishmentsError) console.error('Erreur notifications établissements:', establishmentsError);

          extraNotifications = (establishmentsRows ?? []).map((item) => ({
            id: `establishment-${item.id}`,
            title: 'Nouvel établissement',
            description: `${item.name} a été ajouté à la plateforme.`,
            createdAt: item.created_at,
            tone: 'info' as const,
          }));
        }

        setNotifications([
          ...reviewNotifications,
          ...customerNotifications,
          ...transactionNotifications,
          ...redemptionNotifications,
          ...extraNotifications,
        ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 100));
      } catch (error) {
        console.error('Erreur chargement notifications:', error);
        if (active) setNotifications([]);
      }
    };

    void loadNotifications();
    return () => { active = false; };
  }, [authLoading, user?.id, role]);

  const unreadNotifications = notifications.filter((item) =>
    !lastSeenNotificationsAt || new Date(item.createdAt).getTime() > new Date(lastSeenNotificationsAt).getTime()
  );

  const markNotificationsRead = () => {
    const now = new Date().toISOString();
    if (notificationStorageKey) localStorage.setItem(notificationStorageKey, now);
    setLastSeenNotificationsAt(now);
  };

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      if (authLoading) return;
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
      if (authLoading || role !== 'responsible' || !user?.id) {
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
          setScannerUrl(null);
        }

        return;
      }

      const establishments = (data ?? []) as Establishment[];
      const establishment = establishments[0];

      if (active) {
        setScannerUrl(null);
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

  return (
    <div className="tm-theme min-h-screen bg-[var(--ink)] text-[var(--paper)]" style={{ ["--app-primary" as string]: subscriptionTheme.primary, ["--app-primary-hover" as string]: subscriptionTheme.primaryHover, ["--app-accent" as string]: subscriptionTheme.accent }}>
      {open && (
        <button
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-30 bg-ink/30 lg:hidden"
        />
      )}

      <aside
        style={{ backgroundColor: subscriptionTheme.sidebar }}
        className={`fixed inset-y-0 z-40 flex w-[248px] flex-col px-4 py-5 text-white shadow-xl transition-transform lg:translate-x-0 ${language === 'ar' ? 'right-0 left-auto' : 'left-0'} ${
          open ? 'translate-x-0' : language === 'ar' ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-9 flex items-center justify-between px-2">
          <div className="flex min-h-[64px] flex-1 items-center justify-center">
            <img
              src="/tapmarrakech-logo.svg"
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
            <div style={{ backgroundColor: subscriptionTheme.accent, color: subscriptionTheme.primary }}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full font-semibold">
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
            style={{ color: subscriptionTheme.accent }}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm transition hover:bg-white/10 hover:text-white"
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
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((value) => !value);
                  if (!notificationsOpen) markNotificationsRead();
                }}
                className="relative grid h-10 w-10 place-items-center rounded-xl border border-ink/10 bg-white text-ink/60 shadow-sm"
                aria-label="Notifications"
                aria-expanded={notificationsOpen}
              >
                <Bell size={17} />
                {unreadNotifications.length > 0 && (
                  <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-red-500 px-1 text-[8px] font-bold text-white">
                    {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" aria-label="Fermer les notifications" onClick={() => setNotificationsOpen(false)} />
                  <div className="absolute right-0 top-12 z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-ink/10 bg-white shadow-2xl">
                    <div className="flex items-center justify-between border-b border-ink/5 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-ink">Notifications</p>
                        <p className="text-[10px] text-ink/40">{notifications.length} activité{notifications.length > 1 ? 's' : ''} récente{notifications.length > 1 ? 's' : ''}</p>
                      </div>
                      {notifications.length > 0 && (
                        <button type="button" onClick={markNotificationsRead} className="text-[10px] font-semibold text-forest">
                          Tout marquer comme lu
                        </button>
                      )}
                    </div>
                    <div className="max-h-[520px] overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="px-5 py-10 text-center">
                          <Check size={22} className="mx-auto text-forest/40" />
                          <p className="mt-2 text-sm font-medium text-ink">Aucune notification</p>
                          <p className="mt-1 text-[11px] text-ink/35">Tout est à jour.</p>
                        </div>
                      ) : notifications.map((notification) => (
                        <div key={notification.id} className="flex gap-3 border-b border-ink/5 px-4 py-3.5 last:border-0">
                          <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${notification.tone === 'alert' ? 'bg-red-50 text-red-500' : notification.tone === 'review' ? 'bg-gold/10 text-gold' : 'bg-forest/10 text-forest'}`}>
                            {notification.tone === 'alert' ? <AlertTriangle size={16} /> : notification.tone === 'review' ? <MessageCircle size={16} /> : <Building2 size={16} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-ink">{notification.title}</p>
                            <p className="mt-1 text-[11px] leading-4 text-ink/50">{notification.description}</p>
                            <p className="mt-1 text-[9px] text-ink/30">{new Intl.DateTimeFormat(language === 'ar' ? 'ar-MA' : language === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(notification.createdAt))}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
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
            style={{ backgroundColor: subscriptionTheme.primary }}
            className="flex items-center gap-2 rounded-full px-3 py-2 text-xs font-semibold text-white transition sm:px-4"
          >
            <Building2 size={15} />
            <span className="hidden sm:inline">Gérer mes établissements</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-5 md:p-8 lg:p-10">
          <Outlet />
        </main>

        <footer className="px-5 pb-6 text-center md:px-10">
          <img
            src="/tapmarrakech-logo.svg"
            alt="TapMarrakech"
            className="mx-auto h-7 w-auto object-contain opacity-75"
          />
        </footer>
      </div>
    </div>
  );
}
