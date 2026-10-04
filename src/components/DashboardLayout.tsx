import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Bell,
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
  MessageCircle,
  AlertTriangle,
  Check,
  Search,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import { getMySubscriptionAccess, getSubscriptionTheme, type SubscriptionTheme } from '@/lib/subscriptionAccess';

const links = [
  {
    to: '/dashboard',
    label: 'Vue d’ensemble',
    icon: LayoutDashboard,
    end: true,
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
  slug: string;
  logo_url: string | null;
};

type AppNotification = {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  tone: 'review' | 'alert' | 'info';
};

type SearchResult = {
  id: string;
  type: 'establishment' | 'customer' | 'review';
  title: string;
  subtitle: string;
  establishmentId?: string;
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
  const [activeEstablishment, setActiveEstablishment] = useState<Establishment | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  const { signOut, user, role } = useAuth();
  const { language, setLanguage } = useLanguage();
  const navigate = useNavigate();

  const notificationStorageKey = user?.id ? `tapmarrakech:notifications:last-seen:${user.id}` : null;

  useEffect(() => {
    let active = true;

    const loadSubscriptionTheme = async () => {
      if (role !== 'responsible') {
        if (active) setSubscriptionTheme(getSubscriptionTheme(null));
        return;
      }

      const establishmentId = (() => {
        try {
          return user?.id ? window.localStorage.getItem(`tapmarrakech:selected-establishment:${user.id}`) : null;
        } catch {
          return null;
        }
      })();
      const accesses = await getMySubscriptionAccess(establishmentId ?? undefined);
      const access = accesses[0];

      if (active) setSubscriptionTheme(getSubscriptionTheme(access));
    };

    void loadSubscriptionTheme();

    const handleEstablishmentChanged = () => void loadSubscriptionTheme();
    window.addEventListener('tapmarrakech:establishment-changed', handleEstablishmentChanged);

    return () => {
      active = false;
      window.removeEventListener('tapmarrakech:establishment-changed', handleEstablishmentChanged);
    };
  }, [role, user?.id]);

  useEffect(() => {
    if (!notificationStorageKey) {
      setLastSeenNotificationsAt(null);
      return;
    }
    setLastSeenNotificationsAt(localStorage.getItem(notificationStorageKey));
  }, [notificationStorageKey]);

  useEffect(() => {
    if (!user?.id || !role) return;
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
            .select('id,rating,comment,created_at,establishment_id')
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
          description: `Note ${review.rating}/5${review.comment ? ` — ${String(review.comment).slice(0, 90)}` : ''}`,
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
  }, [user?.id, role]);

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
        setScannerUrl(null);
        setActiveEstablishment(null);
        return;
      }

      const { data, error } = await supabase.rpc('get_my_establishments');

      if (error) {
        console.error('Erreur chargement des établissements du responsable:', error);
        if (active) {
          setScannerUrl(null);
          setActiveEstablishment(null);
        }
        return;
      }

      const establishments = (data ?? []) as Establishment[];
      const storageKey = `tapmarrakech:selected-establishment:${user.id}`;
      const storedId = window.localStorage.getItem(storageKey);
      const establishment = establishments.find((item) => item.id === storedId) ?? establishments[0] ?? null;

      if (!establishment?.id) {
        if (active) {
          setScannerUrl(null);
          setActiveEstablishment(null);
        }
        return;
      }

      if (storedId !== establishment.id) {
        window.localStorage.setItem(storageKey, establishment.id);
      }

      if (active) setActiveEstablishment(establishment);

      setScannerLoading(true);
      const { data: scannerRow, error: scannerError } = await supabase
        .from('establishment_scanner_links')
        .select('access_token')
        .eq('establishment_id', establishment.id)
        .maybeSingle();

      if (!active) return;

      if (scannerError || !scannerRow?.access_token) {
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

    void loadEstablishment();

    const handleEstablishmentChanged = () => void loadEstablishment();
    window.addEventListener('tapmarrakech:establishment-changed', handleEstablishmentChanged);

    return () => {
      active = false;
      window.removeEventListener('tapmarrakech:establishment-changed', handleEstablishmentChanged);
    };
  }, [role, user?.id]);

  useEffect(() => {
    let active = true;
    const query = searchQuery.trim();

    if (!query || query.length < 2 || role !== 'responsible') {
      setSearchResults([]);
      return;
    }

    const timer = window.setTimeout(async () => {
      const safeQuery = query.replace(/[(),]/g, ' ').replace(/\\s+/g, ' ').trim();
      const { data: accessible, error: establishmentError } = await supabase.rpc('get_my_establishments');
      if (!active || establishmentError) return;

      const establishments = (accessible ?? []) as Establishment[];
      const establishmentIds = establishments.map((item) => item.id);
      const pattern = `%${safeQuery}%`;

      const [customerResponse, reviewResponse] = await Promise.all([
        establishmentIds.length
          ? supabase
              .from('loyalty_customers')
              .select('id,first_name,last_name,phone,loyalty_number,establishment_id')
              .in('establishment_id', establishmentIds)
              .or(`first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},loyalty_number.ilike.${pattern}`)
              .order('created_at', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),
        establishmentIds.length
          ? supabase
              .from('reviews')
              .select('id,name,comment,rating,establishment_id')
              .in('establishment_id', establishmentIds)
              .or(`name.ilike.${pattern},comment.ilike.${pattern}`)
              .order('created_at', { ascending: false })
              .limit(5)
          : Promise.resolve({ data: [], error: null }),
      ]);

      if (!active) return;

      const establishmentResults: SearchResult[] = establishments
        .filter((item) => [item.name, item.slug].some((value) => value.toLowerCase().includes(query.toLowerCase())))
        .slice(0, 3)
        .map((item) => ({
          id: item.id,
          type: 'establishment',
          title: item.name,
          subtitle: 'Établissement',
          establishmentId: item.id,
        }));

      const customerResults: SearchResult[] = (customerResponse.data ?? []).map((item) => ({
        id: item.id,
        type: 'customer',
        title: [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Client',
        subtitle: item.phone || item.loyalty_number || 'Client fidélité',
        establishmentId: item.establishment_id,
      }));

      const reviewResults: SearchResult[] = (reviewResponse.data ?? []).map((item) => ({
        id: item.id,
        type: 'review',
        title: item.name || 'Avis client',
        subtitle: `Note ${item.rating}/5 · ${String(item.comment || '').slice(0, 55)}`,
        establishmentId: item.establishment_id,
      }));

      setSearchResults([...establishmentResults, ...customerResults, ...reviewResults].slice(0, 8));
    }, 220);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [searchQuery, role]);

  const selectSearchResult = (result: SearchResult) => {
    if (result.establishmentId && user?.id) {
      window.localStorage.setItem(`tapmarrakech:selected-establishment:${user.id}`, result.establishmentId);
      window.dispatchEvent(new CustomEvent('tapmarrakech:establishment-changed', { detail: { establishmentId: result.establishmentId } }));
    }

    setSearchOpen(false);
    setSearchQuery('');

    if (result.type === 'customer') navigate('/dashboard/loyalty');
    else if (result.type === 'review') navigate('/dashboard/reviews');
    else navigate('/dashboard');
  };

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
    <div
      className="dashboard-depth-shell min-h-screen bg-[#050505] text-[#FFFFFF]"
      style={{ ['--app-primary' as string]: subscriptionTheme.primary, ['--app-primary-hover' as string]: subscriptionTheme.primaryHover, ['--app-accent' as string]: subscriptionTheme.accent }}
    >
      {open && (
        <button
          aria-label="Fermer le menu"
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-[#050505]/70 backdrop-blur-sm lg:hidden"
        />
      )}

      <div className="min-h-screen">
        <header className="dashboard-depth-topbar sticky top-0 z-50 border-b border-[#242424] bg-[#050505]/95 px-3 py-3 backdrop-blur-2xl sm:px-5">
          <div className="mx-auto flex max-w-[1700px] items-center gap-3">
            <button type="button" onClick={() => navigate('/dashboard')} className="flex min-w-0 shrink-0 items-center gap-3 text-left" aria-label="Établissement actif">
              {activeEstablishment?.logo_url ? (
                <img src={activeEstablishment.logo_url} alt={activeEstablishment.name} className="h-11 w-11 rounded-xl border border-[#242424] bg-white object-contain p-1" />
              ) : (
                <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#242424] bg-[#111111] text-[#C9A45C]"><Building2 size={18} /></div>
              )}
              <div className="hidden min-w-0 sm:block">
                <p className="max-w-[180px] truncate text-sm font-semibold text-white">{activeEstablishment?.name || 'Votre établissement'}</p>
                <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.18em] text-[#C9A45C]/60">Espace établissement · KELYANI</p>
              </div>
            </button>

            <div className="relative mx-auto hidden min-w-0 max-w-2xl flex-1 md:block">
              <label className="relative block">
                <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#C9A45C]" />
                <input
                  type="search"
                  value={searchQuery}
                  onFocus={() => setSearchOpen(true)}
                  onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
                  placeholder="Rechercher un client, un avis, un établissement..."
                  aria-label="Rechercher"
                  className="h-11 w-full rounded-2xl border border-[#242424] bg-[#111111] pl-11 pr-16 text-sm text-[#FFFFFF] outline-none placeholder:text-[#F5F5DC]/30 focus:border-[#C9A45C]/60 focus:ring-1 focus:ring-[#C9A45C]/20"
                />
              </label>
              {searchOpen && searchQuery.trim().length >= 2 && (
                <div className="absolute left-0 right-0 top-13 z-[70] overflow-hidden rounded-2xl border border-[#242424] bg-[#111111] shadow-[0_24px_70px_rgba(0,0,0,.55)]">
                  {searchResults.length ? searchResults.map((result) => (
                    <button key={`${result.type}-${result.id}`} type="button" onClick={() => selectSearchResult(result)} className="flex w-full items-start gap-3 border-b border-[#242424] px-4 py-3 text-left last:border-0 hover:bg-[#181818]">
                      <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#C9A45C]/10 text-[#C9A45C]">{result.type === 'customer' ? '◉' : result.type === 'review' ? '★' : <Building2 size={15} />}</span>
                      <span className="min-w-0"><span className="block truncate text-xs font-semibold text-white">{result.title}</span><span className="mt-0.5 block truncate text-[10px] text-white/40">{result.subtitle}</span></span>
                    </button>
                  )) : <p className="px-4 py-5 text-center text-xs text-white/35">Aucun résultat.</p>}
                </div>
              )}
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              {role === 'responsible' && scannerUrl && (
                <button
                  type="button"
                  onClick={() => window.open(scannerUrl, '_blank', 'noopener,noreferrer')}
                  className="hidden h-10 items-center gap-2 rounded-full border border-[#242424] bg-[#111111] px-3 text-[10px] font-semibold text-[#F5F5DC]/70 transition hover:border-[#C9A45C]/60 hover:text-[#E1C27A] lg:flex"
                >
                  <QrCode size={14} /> Scanner
                </button>
              )}

              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    setNotificationsOpen((value) => !value);
                    if (!notificationsOpen) markNotificationsRead();
                  }}
                  className="relative grid h-10 w-10 place-items-center rounded-full border border-[#242424] bg-[#111111] text-[#F5F5DC]/65 transition hover:border-[#C9A45C]/60 hover:text-[#E1C27A]"
                  aria-label="Notifications"
                  aria-expanded={notificationsOpen}
                >
                  <Bell size={17} />
                  {unreadNotifications.length > 0 && (
                    <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-[#C9A45C] px-1 text-[8px] font-bold text-[#050505]">
                      {unreadNotifications.length > 9 ? '9+' : unreadNotifications.length}
                    </span>
                  )}
                </button>

                {notificationsOpen && (
                  <>
                    <button className="fixed inset-0 z-40 cursor-default" aria-label="Fermer les notifications" onClick={() => setNotificationsOpen(false)} />
                    <div className="absolute right-0 top-12 z-50 w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-3xl border border-[#242424] bg-[#111111] shadow-[0_24px_80px_rgba(0,0,0,.55)]">
                      <div className="flex items-center justify-between border-b border-[#242424] px-4 py-3">
                        <div>
                          <p className="text-sm font-semibold text-[#FFFFFF]">Notifications</p>
                          <p className="text-[10px] text-[#F5F5DC]/40">{notifications.length} activité{notifications.length > 1 ? 's' : ''} récente{notifications.length > 1 ? 's' : ''}</p>
                        </div>
                        {notifications.length > 0 && (
                          <button type="button" onClick={markNotificationsRead} className="text-[10px] font-semibold text-[#C9A45C]">
                            Tout marquer comme lu
                          </button>
                        )}
                      </div>
                      <div className="max-h-[520px] overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="px-5 py-10 text-center">
                            <Check size={22} className="mx-auto text-[#C9A45C]/50" />
                            <p className="mt-2 text-sm font-medium text-[#FFFFFF]">Aucune notification</p>
                            <p className="mt-1 text-[11px] text-[#F5F5DC]/35">Tout est à jour.</p>
                          </div>
                        ) : notifications.map((notification) => (
                          <div key={notification.id} className="flex gap-3 border-b border-[#242424] px-4 py-3.5 last:border-0">
                            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#C9A45C]">
                              {notification.tone === 'alert' ? <AlertTriangle size={16} /> : notification.tone === 'review' ? <MessageCircle size={16} /> : <Building2 size={16} />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-[#FFFFFF]">{notification.title}</p>
                              <p className="mt-1 text-[11px] leading-4 text-[#F5F5DC]/50">{notification.description}</p>
                              <p className="mt-1 text-[9px] text-[#F5F5DC]/30">{new Intl.DateTimeFormat(language === 'ar' ? 'ar-MA' : language === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(notification.createdAt))}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>

              <div className="hidden h-10 items-center gap-2 rounded-full border border-[#242424] bg-[#111111] px-3 sm:flex">
                <div className="grid h-7 w-7 place-items-center rounded-full bg-[#C9A45C] text-xs font-semibold text-[#050505]">{avatarLetter}</div>
                <div className="max-w-[130px] leading-tight">
                  <p className="truncate text-xs font-semibold text-[#FFFFFF]">{displayName}</p>
                  <p className="text-[9px] text-[#F5F5DC]/40">{roleLabel}</p>
                </div>
              </div>

              <label className="hidden items-center rounded-full border border-[#242424] bg-[#111111] px-3 py-2 text-xs font-medium text-[#F5F5DC]/60 md:flex">
                <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label="Language" className="cursor-pointer bg-transparent text-[#F5F5DC] outline-none">
                  <option className="bg-[#111111]" value="fr">FR</option>
                  <option className="bg-[#111111]" value="en">EN</option>
                  <option className="bg-[#111111]" value="ar">AR</option>
                </select>
              </label>

              <button
                type="button"
                onClick={logout}
                className="grid h-10 w-10 place-items-center rounded-full border border-[#242424] bg-[#111111] text-[#F5F5DC]/60 transition hover:border-[#C9A45C]/60 hover:text-[#E1C27A]"
                aria-label="Déconnexion"
              >
                <LogOut size={15} />
              </button>
            </div>
          </div>

          <div className="relative mx-auto mt-3 md:hidden">
            <label className="relative block">
              <Search size={14} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#C9A45C]" />
              <input
                type="search"
                value={searchQuery}
                onFocus={() => setSearchOpen(true)}
                onChange={(event) => { setSearchQuery(event.target.value); setSearchOpen(true); }}
                placeholder="Rechercher..."
                aria-label="Rechercher"
                className="h-10 w-full rounded-2xl border border-[#242424] bg-[#111111] pl-10 pr-4 text-xs text-[#FFFFFF] outline-none placeholder:text-[#F5F5DC]/30 focus:border-[#C9A45C]/60"
              />
            </label>
            {searchOpen && searchQuery.trim().length >= 2 && (
              <div className="absolute left-0 right-0 top-12 z-[70] overflow-hidden rounded-2xl border border-[#242424] bg-[#111111] shadow-[0_24px_70px_rgba(0,0,0,.55)]">
                {searchResults.length ? searchResults.map((result) => (
                  <button key={`${result.type}-mobile-${result.id}`} type="button" onClick={() => selectSearchResult(result)} className="flex w-full items-start gap-3 border-b border-[#242424] px-4 py-3 text-left last:border-0 hover:bg-[#181818]">
                    <span className="min-w-0"><span className="block truncate text-xs font-semibold text-white">{result.title}</span><span className="mt-0.5 block truncate text-[10px] text-white/40">{result.subtitle}</span></span>
                  </button>
                )) : <p className="px-4 py-5 text-center text-xs text-white/35">Aucun résultat.</p>}
              </div>
            )}
          </div>
        </header>

        <main className="dashboard-depth-main mx-auto w-full max-w-[1700px] px-3 pb-28 pt-6 sm:px-5 md:px-8 lg:px-10 lg:pt-8">
          <Outlet />
        </main>

        <nav className="dashboard-depth-nav fixed inset-x-0 bottom-0 z-[60] border-t border-[#242424] bg-[#050505]/96 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl">
          <div className="mx-auto flex max-w-[1100px] items-center justify-start gap-1 overflow-x-auto scrollbar-none">
            {links.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => `group flex min-w-[76px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all ${
                  isActive
                    ? 'bg-[#111111] text-[#E1C27A] shadow-[0_0_24px_rgba(201,164,92,0.10)]'
                    : 'text-[#F5F5DC]/40 hover:bg-[#111111] hover:text-[#F5F5DC]'
                }`}
              >
                <Icon size={18} strokeWidth={1.8} />
                <span className="max-w-[90px] truncate text-[8px] font-semibold">{localizedLabel(label)}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
