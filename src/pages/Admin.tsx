import { useEffect, useMemo, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import {
  BarChart3,
  Bell,
  Building2,
  Gift,
  Ticket,
  LogOut,
  Menu,
  Users,
  UserRound,
  X,
  CheckCircle2,
  UserPlus,
  Power,
  LockKeyhole,
  RefreshCw,
  MessageSquare,
  Brain,
  Plus,
  Save,
  Pencil,
  TrendingUp,
  DollarSign,
  UsersRound,
  Printer,
  CreditCard,
  AlertTriangle,
  Activity,
  Search,
  Filter,
  CalendarDays,
  ShieldCheck,
  Star,
  WalletCards,
  Trash2,
  Upload,
  Sparkles,
  FileText,
  Gem,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import KelyaniMark from '@/components/brand/KelyaniMark';
import LoyaltyStudio from '@/components/loyalty/LoyaltyStudio';
import LoyaltyProgramCustomization from '@/components/LoyaltyProgramCustomization';
import RecentActivity from '@/components/admin/RecentActivity';
import EvolutionCharts from '@/components/admin/EvolutionCharts';
import RecentLoyaltyCustomers from '@/components/admin/RecentLoyaltyCustomers';
import EstablishmentPerformanceTable from '@/components/admin/EstablishmentPerformanceTable';
import EstablishmentsSection from '@/components/admin/EstablishmentsSection';
import ProfileForm from '@/components/admin/ProfileForm';
import WifiForm from '@/components/admin/WifiForm';
import GoogleBusinessAdminSection from '@/components/admin/GoogleBusinessAdminSection';
import MenuStudio from '@/components/admin/menu/MenuStudio';
import LoyaltyNotificationsPanel from '@/components/admin/LoyaltyNotificationsPanel';
import LoyaltyRaffleStudio from '@/components/loyalty/LoyaltyRaffleStudio';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import { useRecentLoyaltyCustomers } from '@/hooks/useRecentLoyaltyCustomers';
import { useAdminOverviewStats } from '@/hooks/useAdminOverviewStats';
import { useEstablishmentPerformance } from '@/hooks/useEstablishmentPerformance';
import { useEstablishments } from '@/hooks/useEstablishments';
import { useEstablishmentProfile } from '@/hooks/useEstablishmentProfile';

type Establishment = {
  id: string;
  name: string;
  slug: string;
  ai_business_type_id: string | null;
  created_at: string;
  city?: string | null;
  business_type?: string | null;
};

type AIBusinessType = {
  id: string;
  name: string;
  description: string | null;
  ai_prompt: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

type StaffMember = {
  id: string;
  establishment_id: string;
  user_id: string;
  role: 'OWNER' | 'MANAGER' | 'STAFF';
  active: boolean;
  created_at: string;
  email: string;
  name: string;
  profileRole: 'admin' | 'responsible' | 'employee' | null;
};

type GlobalStats = {
  reviews: number;
  averageRating: number;
  positiveReviews: number;
  negativeReviews: number;
  loyaltyCustomers: number;
  analyticsEvents: number;
};

type BillingPlan = {
  id: string;
  name: string;
  price_mad: number;
  interval: string;
  active: boolean;
  features?: string[] | null;
};

type BillingSubscription = {
  id: string;
  establishment_id: string;
  plan_id: string;
  status: string;
  started_at: string | null;
  current_period_end: string | null;
  trial_days: number | null;
  plan?: BillingPlan | null;
};

type BillingSnapshot = {
  available: boolean;
  plans: BillingPlan[];
  subscriptions: BillingSubscription[];
  paymentsThisMonth: number;
  failedPayments: number;
  overdueInvoices: number;
  upcomingRenewals: number;
  mrr: number;
};

type AdminSection =
  | 'overview'
  | 'establishments'
  | 'responsibles'
  | 'employees'
  | 'reviews'
  | 'analysis'
  | 'ai'
  | 'analytics'
  | 'reports'
  | 'billing'
  | 'loyalty'
  | 'system';

export default function Admin() {
  const { language, setLanguage } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const sectionFromPath = (pathname: string): AdminSection => {
    const slug = pathname.replace(/^\/admin\/?/, '').split('/')[0];
    if (slug === 'reviews') return 'ai';
    const validSections: AdminSection[] = [
      'overview', 'establishments', 'responsibles', 'employees', 'reviews',
      'analysis', 'ai', 'analytics', 'reports', 'billing', 'loyalty', 'system',
    ];
    return validSections.includes(slug as AdminSection) ? slug as AdminSection : 'overview';
  };

  const pathForSection = (nextSection: AdminSection) =>
    nextSection === 'overview' ? '/admin' : `/admin/${nextSection}`;

  const [section, setSection] = useState<AdminSection>(() => sectionFromPath(window.location.pathname));
  const [aiWorkspaceTab, setAIWorkspaceTab] = useState<'home' | 'engine' | 'prompts' | 'google' | 'menus'>('home');
  const [selectedMenuEstablishmentId, setSelectedMenuEstablishmentId] = useState('');

  useEffect(() => {
    const nextSection = sectionFromPath(location.pathname);
    setSection(nextSection);

    // Preserve the old /admin/reviews deep link while Google reviews live in the AI workspace.
    const slug = location.pathname.replace(/^\/admin\/?/, '').split('/')[0];
    if (slug === 'reviews') setAIWorkspaceTab('google');
  }, [location.pathname]);
  const [open, setOpen] = useState(false);

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [aiBusinessTypes, setAIBusinessTypes] = useState<AIBusinessType[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({
    reviews: 0,
    averageRating: 0,
    positiveReviews: 0,
    negativeReviews: 0,
    loyaltyCustomers: 0,
    analyticsEvents: 0,
  });

  const [billing, setBilling] = useState<BillingSnapshot>({
    available: false,
    plans: [],
    subscriptions: [],
    paymentsThisMonth: 0,
    failedPayments: 0,
    overdueInvoices: 0,
    upcomingRenewals: 0,
    mrr: 0,
  });


  const [loading, setLoading] = useState(true);

  const {
    establishments: establishmentList,
    loading: establishmentListLoading,
    error: establishmentListError,
    reload: reloadEstablishmentList,
  } = useEstablishments();

  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | null>(null);
  const [loyaltyTab, setLoyaltyTab] = useState<'program' | 'notifications' | 'raffles'>('program');

  useEffect(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    const establishmentIndex = parts.indexOf('establishments');
    const routeEstablishmentId = establishmentIndex >= 0 ? parts[establishmentIndex + 1] : null;

    if (routeEstablishmentId && establishmentList.some((item) => item.id === routeEstablishmentId)) {
      setSelectedEstablishmentId(routeEstablishmentId);
      if (user?.id) {
        window.localStorage.setItem(
          `tapmarrakech:selected-establishment:${user.id}`,
          routeEstablishmentId
        );
      }
      return;
    }

    if (location.pathname === '/admin/establishments') {
      setSelectedEstablishmentId(null);
      return;
    }

    if (!establishmentList.length || !user?.id) return;

    const storageKey = `tapmarrakech:selected-establishment:${user.id}`;
    const storedId = window.localStorage.getItem(storageKey);
    const selectedId = establishmentList.some((item) => item.id === storedId)
      ? storedId
      : establishmentList[0].id;

    setSelectedEstablishmentId(selectedId);
    if (selectedId) {
  window.localStorage.setItem(storageKey, selectedId);
}
  }, [location.pathname, establishmentList, user?.id]);
  const [showCreateEstablishmentForm, setShowCreateEstablishmentForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ id: string; type: 'establishment' | 'customer' | 'review'; title: string; subtitle: string; establishmentId?: string }>>([]);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    console.log('[Establishments] HOOK DATA:', {
      status: establishmentListLoading ? 'loading' : 'success',
      count: establishmentList.length,
      establishments: establishmentList,
      error: establishmentListError?.message ?? null,
    });
  }, [establishmentListLoading, establishmentList, establishmentListError]);


  useEffect(() => {
    let active = true;
    const query = searchQuery.trim();
    if (query.length < 2) { setSearchResults([]); return; }
    const timer = window.setTimeout(async () => {
      const safeQuery = query.replace(/[(),]/g, ' ').replace(/\\s+/g, ' ').trim();
      const pattern = `%${safeQuery}%`;
      const [establishmentResponse, customerResponse, reviewResponse] = await Promise.all([
        supabase.from('establishments').select('id,name,slug,city').or(`name.ilike.${pattern},slug.ilike.${pattern},city.ilike.${pattern}`).order('created_at', { ascending: false }).limit(5),
        supabase.from('loyalty_customers').select('id,first_name,last_name,phone,loyalty_number,establishment_id').or(`first_name.ilike.${pattern},last_name.ilike.${pattern},phone.ilike.${pattern},loyalty_number.ilike.${pattern}`).order('created_at', { ascending: false }).limit(5),
        supabase.from('reviews').select('id,name,comment,rating,establishment_id').or(`name.ilike.${pattern},comment.ilike.${pattern}`).order('created_at', { ascending: false }).limit(5),
      ]);
      if (!active) return;
      const establishmentResults = (establishmentResponse.data ?? []).map(item => ({ id: item.id, type: 'establishment' as const, title: item.name, subtitle: 'Établissement', establishmentId: item.id }));
      const customerResults = (customerResponse.data ?? []).map(item => ({ id: item.id, type: 'customer' as const, title: [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Client', subtitle: item.phone || item.loyalty_number || 'Client fidélité', establishmentId: item.establishment_id }));
      const reviewResults = (reviewResponse.data ?? []).map(item => ({ id: item.id, type: 'review' as const, title: item.name || 'Avis client', subtitle: `Note ${item.rating}/5 · ${String(item.comment || '').slice(0, 55)}`, establishmentId: item.establishment_id }));
      setSearchResults([...establishmentResults, ...customerResults, ...reviewResults].slice(0, 10));
    }, 220);
    return () => { active = false; window.clearTimeout(timer); };
  }, [searchQuery]);

  const selectSearchResult = (result: { type: 'establishment' | 'customer' | 'review'; establishmentId?: string }) => {
    if (result.establishmentId) setSelectedEstablishmentId(result.establishmentId);
    if (result.type === 'establishment') navigate('/admin/establishments');
    else if (result.type === 'customer') navigate('/admin/loyalty');
    else { setAIWorkspaceTab('google'); navigate('/admin/ai'); }
    setSearchQuery('');
    setSearchOpen(false);
  };

  const [staffLoading, setStaffLoading] = useState(true);

  const loadEstablishments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('establishments')
      .select('id, name, slug, created_at')
      .order('created_at', { ascending: false });

    console.log(
      '[KPI PROOF] loadEstablishments:',
      'rowCount=',
      data?.length ?? 0,
      'error=',
      error?.message ?? null
    );

    if (error) {
      console.error('Erreur établissements:', error);
      setEstablishments([]);
    } else {
      setEstablishments((data ?? []).map((row) => ({ ...row, ai_business_type_id: null })));
    }

    setLoading(false);
  };

  const loadStaff = async () => {
    setStaffLoading(true);

    const { data: staffRows, error: staffError } = await supabase
      .from('establishment_staff')
      .select('id, establishment_id, user_id, role, active, created_at')
      .order('created_at', { ascending: false });

    if (staffError) {
      console.error('Erreur équipe:', staffError);
      setStaff([]);
      setStaffLoading(false);
      return;
    }

    const rows = staffRows ?? [];
    const userIds = rows.map((row) => row.user_id);

    if (userIds.length === 0) {
      setStaff([]);
      setStaffLoading(false);
      return;
    }

    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .in('id', userIds);

    if (profilesError) {
      console.error('Erreur profils:', profilesError);
      setStaff([]);
      setStaffLoading(false);
      return;
    }

    const profileMap = new Map(
      (profiles ?? []).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const result: StaffMember[] = rows.map((row) => {
      const profile = profileMap.get(row.user_id);

      return {
        id: row.id,
        establishment_id: row.establishment_id,
        user_id: row.user_id,
        role: row.role,
        active: row.active,
        created_at: row.created_at,
        email: profile?.email ?? '—',
        name: profile?.name ?? 'Utilisateur',
        profileRole: profile?.role ?? null,
      };
    });

    setStaff(result);
    setStaffLoading(false);
  };

  const loadAIBusinessTypes = async () => {
    const { data, error } = await supabase
      .from('ai_business_types')
      .select('id, name, description, ai_prompt, active, created_at, updated_at')
      .order('name', { ascending: true });

    if (error) {
      console.error('Erreur types IA:', error);
      setAIBusinessTypes([]);
      return;
    }

    setAIBusinessTypes(data ?? []);
  };

  const loadGlobalStats = async () => {
    try {
      const [
        { data: reviewRows, error: reviewsError },
        { count: loyaltyCustomers, error: loyaltyError },
        { count: analyticsEvents, error: analyticsError },
      ] = await Promise.all([
        supabase.from('reviews').select('rating'),
        supabase.from('loyalty_customers').select('id', { count: 'exact', head: true }),
        supabase.from('analytics_events').select('id', { count: 'exact', head: true }),
      ]);

      console.log(
        '[KPI PROOF] loadGlobalStats:',
        'reviewsRows=',
        reviewRows?.length ?? 0,
        'reviewsError=',
        reviewsError?.message ?? null,
        'loyaltyCustomers=',
        loyaltyCustomers ?? 0,
        'loyaltyError=',
        loyaltyError?.message ?? null,
        'analyticsEvents=',
        analyticsEvents ?? 0,
        'analyticsError=',
        analyticsError?.message ?? null
      );

      if (reviewsError || loyaltyError || analyticsError) {
        throw reviewsError ?? loyaltyError ?? analyticsError;
      }

      const ratings = (reviewRows ?? [])
        .map((row) => Number(row.rating))
        .filter((rating) => Number.isFinite(rating));

      const averageRating = ratings.length
        ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
        : 0;

      setGlobalStats({
        reviews: ratings.length,
        averageRating,
        positiveReviews: ratings.filter((rating) => rating >= 4).length,
        negativeReviews: ratings.filter((rating) => rating <= 3).length,
        loyaltyCustomers: loyaltyCustomers ?? 0,
        analyticsEvents: analyticsEvents ?? 0,
      });
    } catch (error) {
      console.error('Erreur statistiques globales:', error);
      setGlobalStats({
        reviews: 0,
        averageRating: 0,
        positiveReviews: 0,
        negativeReviews: 0,
        loyaltyCustomers: 0,
        analyticsEvents: 0,
      });
    }
  };

  const loadBilling = async () => {
    const empty: BillingSnapshot = { available: false, plans: [], subscriptions: [], paymentsThisMonth: 0, failedPayments: 0, overdueInvoices: 0, upcomingRenewals: 0, mrr: 0 };
    try {
      const [
        { data: plans, error: plansError },
        { data: subscriptions, error: subscriptionsError },
        { count: paymentsThisMonth },
        { count: failedPayments },
        { count: overdueInvoices },
      ] = await Promise.all([
        supabase.from('subscription_plans').select('id,name,price_mad,interval,active,features').order('price_mad'),
        supabase.from('subscriptions').select('id,establishment_id,plan_id,status,started_at,current_period_end,trial_days,subscription_plans(id,name,price_mad,interval,active)'),
        supabase.from('payments').select('id', { count: 'exact', head: true }).gte('paid_at', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()).eq('status', 'paid'),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'failed'),
        supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('status', 'overdue'),
      ]);
      if (plansError || subscriptionsError) {
        if (plansError) console.error('Erreur plans:', plansError);
        if (subscriptionsError) console.error('Erreur abonnements:', subscriptionsError);
        setBilling(empty);
        return;
      }
      const normalizedSubscriptions: BillingSubscription[] = (subscriptions ?? []).map((subscription) => {
        const relation = subscription.subscription_plans;
        const plan = Array.isArray(relation) ? relation[0] ?? null : relation ?? null;
        return { ...subscription, plan: plan as BillingPlan | null };
      });
      const mrr = normalizedSubscriptions
        .filter((subscription) => subscription.status === 'active')
        .reduce((sum, subscription) => {
          const price = Number(subscription.plan?.price_mad ?? 0);
          const interval = subscription.plan?.interval === 'year' ? 'year' : 'month';
          return sum + (interval === 'year' ? price / 12 : price);
        }, 0);
      const now = Date.now();
      const in30Days = now + 30 * 24 * 60 * 60 * 1000;
      const upcomingRenewals = normalizedSubscriptions.filter((subscription) => {
        if (!subscription.current_period_end || subscription.status !== 'active') return false;
        const time = new Date(subscription.current_period_end).getTime();
        return time >= now && time <= in30Days;
      }).length;
      setBilling({ available: true, plans: (plans ?? []) as BillingPlan[], subscriptions: normalizedSubscriptions, paymentsThisMonth: paymentsThisMonth ?? 0, failedPayments: failedPayments ?? 0, overdueInvoices: overdueInvoices ?? 0, upcomingRenewals, mrr });
    } catch (error) {
      console.error('Erreur facturation:', error);
      setBilling(empty);
    }
  };

  useEffect(() => {
    loadEstablishments();
    loadStaff();
    loadAIBusinessTypes();
    loadGlobalStats();
    loadBilling();
  }, []);

  const reloadAll = async () => {
    await Promise.all([
      loadEstablishments(),
      reloadEstablishmentList(),
      loadStaff(),
      loadAIBusinessTypes(),
      loadGlobalStats(),
      loadBilling(),
    ]);
  };

  const logout = async () => {
    await signOut();
    navigate('/login');
  };

  const responsibleMembers = useMemo(
    () => staff.filter((member) => member.role === 'MANAGER'),
    [staff]
  );

  const menuItems: {
    id: AdminSection;
    label: string;
    icon: typeof Building2;
  }[] = [
    {
      id: 'overview',
      label: 'Vue d’ensemble',
      icon: BarChart3,
    },
    {
      id: 'establishments',
      label: 'Établissements',
      icon: Building2,
    },
    {
      id: 'responsibles',
      label: 'Responsables',
      icon: UserRound,
    },
    {
      id: 'analysis',
      label: 'Analyse des avis',
      icon: Brain,
    },
    {
      id: 'analytics',
      label: 'Pilotage Analytics',
      icon: TrendingUp,
    },
    {
      id: 'ai',
      label: 'Paramètres automatisation',
      icon: Brain,
    },
    {
      id: 'reports',
      label: 'Rapports PDF',
      icon: Printer,
    },
    {
      id: 'billing',
      label: 'Abonnements & facturation',
      icon: CreditCard,
    },
    {
      id: 'loyalty',
      label: '💎 Fidélité',
      icon: Gem,
    },
    {
      id: 'system',
      label: 'Supervision technique',
      icon: Activity,
    },
  ];

  const currentLabel =
    menuItems.find((item) => item.id === section)?.label ??
    'Vue d’ensemble';

  return (
    <div className="admin-depth-shell min-h-screen bg-[#050505] text-[#FFFFFF] selection:bg-[#686D76]/30">
      <header className="admin-depth-topbar sticky top-0 z-50 border-b border-[#242424] bg-[#050505]/95 px-3 py-3 backdrop-blur-2xl sm:px-5">
        <div className="mx-auto flex max-w-[1700px] items-center gap-3">
          <button type="button" onClick={() => navigate('/admin')} className="flex shrink-0 items-center gap-3 text-left" aria-label="KELYANI">
            <KelyaniMark size={72} />
            <div className="hidden sm:block leading-none">
              <p className="font-display text-xl font-semibold tracking-[.08em] text-[#00DFA5]">KELYANI</p>
              <p className="mt-1 text-[7px] font-semibold uppercase tracking-[.22em] text-[#00DFA5]/70">CUSTOMER INTELLIGENCE</p>
            </div>
          </button>

          <div className="relative mx-auto hidden min-w-0 flex-1 max-w-2xl md:block">
            <label className="relative block">
              <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#00DFA5]" />
              <input type="search" value={searchQuery} onFocus={() => setSearchOpen(true)} onChange={event => { setSearchQuery(event.target.value); setSearchOpen(true); }} placeholder="Rechercher un établissement, client, avis..." aria-label="Rechercher dans KELYANI" className="h-11 w-full rounded-3xl border border-[#242424] bg-[#111111] pl-11 pr-4 text-sm text-[#FFFFFF] outline-none placeholder:text-[#B0B0B0]/35 focus:border-[#00DFA5]/60 focus:ring-1 focus:ring-[#00DFA5]/20" />
            </label>
            {searchOpen && searchQuery.trim().length >= 2 && <div className="absolute left-0 right-0 top-13 z-[70] overflow-hidden rounded-2xl border border-[#242424] bg-[#111111] shadow-[0_24px_70px_rgba(0,0,0,.55)]">{searchResults.length ? searchResults.map(result => <button key={`${result.type}-${result.id}`} type="button" onClick={() => selectSearchResult(result)} className="flex w-full items-start gap-3 border-b border-[#242424] px-4 py-3 text-left last:border-0 hover:bg-[#181818]"><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#686D76]/10 text-[#00DFA5]">{result.type === 'customer' ? '◉' : result.type === 'review' ? '★' : <Building2 size={15} />}</span><span className="min-w-0"><span className="block truncate text-xs font-semibold text-white">{result.title}</span><span className="mt-0.5 block truncate text-[10px] text-white/40">{result.subtitle}</span></span></button>) : <p className="px-4 py-5 text-center text-xs text-white/35">Aucun résultat.</p>}</div>}
          </div>

          <div className="ml-auto flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-[#242424] bg-[#111111] px-3 py-2 text-[10px] font-semibold text-[#B0B0B0]/65 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-[#686D76]" />
              Connecté
            </div>
            <label className="hidden items-center rounded-full border border-[#242424] bg-[#111111] px-3 py-2 text-[10px] font-semibold text-[#B0B0B0]/65 lg:flex">
              <select value={language} onChange={(event) => setLanguage(event.target.value as Language)} aria-label="Language" className="bg-transparent text-[#B0B0B0] outline-none">
                <option className="bg-[#111111]" value="fr">FR</option>
                <option className="bg-[#111111]" value="en">EN</option>
                <option className="bg-[#111111]" value="ar">AR</option>
              </select>
            </label>
            <button type="button" className="relative grid h-10 w-10 place-items-center rounded-full border border-[#242424] bg-[#111111] text-[#B0B0B0]/65 transition hover:border-[#00DFA5]/50 hover:text-[#00DFA5]" aria-label="Notifications">
              <Bell size={16} />
              <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-[#686D76]" />
            </button>
            <button type="button" onClick={reloadAll} className="hidden h-10 items-center gap-2 rounded-full border border-[#242424] bg-[#111111] px-3 text-[10px] font-semibold text-[#B0B0B0]/65 transition hover:border-[#00DFA5]/50 hover:text-[#00DFA5] lg:flex">
              <RefreshCw size={13} />
              Actualiser
            </button>
            <button type="button" onClick={logout} className="grid h-10 w-10 place-items-center rounded-full border border-[#242424] bg-[#111111] text-[#B0B0B0]/65 transition hover:border-[#00DFA5]/50 hover:text-[#00DFA5]" aria-label="Déconnexion">
              <LogOut size={15} />
            </button>
          </div>
        </div>

        <div className="mx-auto mt-3 md:hidden">
          <label className="relative block">
            <Search size={15} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#00DFA5]" />
            <input type="search" value={searchQuery} onFocus={() => setSearchOpen(true)} onChange={event => { setSearchQuery(event.target.value); setSearchOpen(true); }} placeholder="Rechercher..." aria-label="Rechercher" className="h-10 w-full rounded-3xl border border-[#242424] bg-[#111111] pl-11 pr-4 text-xs text-[#FFFFFF] outline-none placeholder:text-[#B0B0B0]/35 focus:border-[#00DFA5]/60" />
          </label>
        </div>
      </header>

        <main className="admin-depth-main kelyani-workspace mx-auto w-full max-w-[1700px] px-3 pb-28 pt-6 sm:px-5 md:px-8 lg:px-10 lg:pt-8">

          {section === 'overview' && (
            <Overview
              establishments={establishments}
              staff={staff}
              loading={loading}
              onNavigate={setSection}
              billing={billing}
              globalStats={globalStats}
            />
          )}

          {section === 'establishments' && (() => {
            const workspaceEstablishment = selectedEstablishmentId
              ? establishments.find((item) => item.id === selectedEstablishmentId) ?? null
              : null;

            if (workspaceEstablishment) {
              return (
                <EstablishmentWorkspace
                  establishment={workspaceEstablishment}
                  businessTypes={aiBusinessTypes}
                  onBack={() => { setSelectedEstablishmentId(null); navigate('/admin/establishments'); }}
                  onReload={loadEstablishments}
                />
              );
            }

            return (
              <>
                <EstablishmentsSection
                  establishments={establishmentList}
                  loading={establishmentListLoading}
                  error={establishmentListError}
                  onAdd={() => setShowCreateEstablishmentForm(true)}
                  onOpen={(establishment) => { setSelectedEstablishmentId(establishment.id); navigate(`/admin/establishments/${establishment.id}/profile`); }}
                />
                {showCreateEstablishmentForm && (
                  <CreateEstablishmentForm
                    close={() => setShowCreateEstablishmentForm(false)}
                    reload={async () => {
                      await Promise.all([reloadEstablishmentList(), loadEstablishments()]);
                    }}
                    businessTypes={aiBusinessTypes}
                  />
                )}
              </>
            );
          })()}

          {section === 'responsibles' && (
            <ResponsiblesSection
              establishments={establishments}
              staff={responsibleMembers}
              loading={staffLoading}
              reload={loadStaff}
            />
          )}

          {section === 'reviews' && (
            <ReviewsSection establishments={establishments} />
          )}

          {section === 'analysis' && (
            <ReviewAnalysisSection establishments={establishments} />
          )}

          {section === 'analytics' && (
            <AdminAnalyticsSection establishments={establishments} />
          )}

          {section === 'ai' && (
            <section className="space-y-6">
              <header className="rounded-3xl border border-[#00DFA5]/20 bg-gradient-to-br from-[#111111] via-[#050505] to-[#111111] p-5 sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#00DFA5]/70">Administration centrale</p>
                    <h2 className="font-display text-3xl text-[#00DFA5] md:text-4xl">Paramètres automatisation</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-white/50">Centralisez les avis, les réglages IA et toutes les automatisations dans un tableau de bord unique.</p>
                  </div>
                  <span className="inline-flex w-fit items-center gap-2 rounded-full border border-[#00DFA5]/25 bg-[#686D76]/5 px-3 py-2 text-[10px] font-semibold uppercase tracking-wider text-[#00DFA5]"><Sparkles size={13} /> Centre IA</span>
                </div>
              </header>

              {aiWorkspaceTab === 'home' ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  <button type="button" onClick={() => setAIWorkspaceTab('engine')} className="group min-h-[190px] rounded-3xl border border-[#00DFA5]/35 bg-gradient-to-br from-[#111111] via-[#0d0d0d] to-[#050505] p-6 text-left shadow-[0_12px_35px_rgba(0,0,0,.28)] transition duration-200 hover:-translate-y-1 hover:border-[#00DFA5]/75 hover:shadow-[0_20px_45px_rgba(0,223,165,.12)] [transform:perspective(1000px)_rotateX(2deg)]">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#00DFA5]/30 bg-[#686D76]/10 text-[#00DFA5]"><Brain size={22} /></span>
                    <span className="mt-5 block text-lg font-semibold text-[#00DFA5]">Moteur IA global</span>
                    <span className="mt-2 block text-sm leading-6 text-white/50">Fournisseur, modèle, clé API, température et limites de génération.</span>
                    <span className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00DFA5]">Ouvrir les paramètres →</span>
                  </button>
                  <button type="button" onClick={() => setAIWorkspaceTab('prompts')} className="group min-h-[190px] rounded-3xl border border-[#242424] bg-gradient-to-br from-[#171717] via-[#0d0d0d] to-[#050505] p-6 text-left shadow-[0_12px_35px_rgba(0,0,0,.28)] transition duration-200 hover:-translate-y-1 hover:border-[#00DFA5]/60 hover:shadow-[0_20px_45px_rgba(0,223,165,.1)] [transform:perspective(1000px)_rotateX(2deg)]">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/5 text-[#00DFA5]"><FileText size={22} /></span>
                    <span className="mt-5 block text-lg font-semibold text-white">Prompts & fonctionnalités</span>
                    <span className="mt-2 block text-sm leading-6 text-white/50">Instructions métier et comportements des fonctionnalités IA.</span>
                    <span className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00DFA5]">Ouvrir les paramètres →</span>
                  </button>
                  <button type="button" onClick={() => setAIWorkspaceTab('google')} className="group min-h-[190px] rounded-3xl border border-[#00DFA5]/35 bg-gradient-to-br from-[#111111] via-[#0d0d0d] to-[#050505] p-6 text-left shadow-[0_12px_35px_rgba(0,0,0,.28)] transition duration-200 hover:-translate-y-1 hover:border-[#00DFA5]/75 hover:shadow-[0_20px_45px_rgba(0,223,165,.12)] [transform:perspective(1000px)_rotateX(2deg)]">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl border border-[#00DFA5]/30 bg-[#686D76]/10 text-[#00DFA5]"><MessageSquare size={22} /></span>
                    <span className="mt-5 block text-lg font-semibold text-[#00DFA5]">Avis Google & automatisations</span>
                    <span className="mt-2 block text-sm leading-6 text-white/50">Un seul espace pour connecter Google, gérer les avis, configurer les réponses IA, les langues, les liens et la fréquence de synchronisation.</span>
                    <span className="mt-5 block text-[10px] font-semibold uppercase tracking-[0.16em] text-[#00DFA5]">Ouvrir l’espace centralisé →</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-5">
                  <button type="button" onClick={() => setAIWorkspaceTab('home')} className="inline-flex items-center gap-2 rounded-xl border border-[#242424] bg-[#101010] px-4 py-2.5 text-xs font-semibold text-[#00DFA5] transition hover:border-[#00DFA5]/60"><span aria-hidden="true">←</span> Toutes les options</button>
                  {aiWorkspaceTab === 'engine' && <AIConfigurationSection view="engine" businessTypes={aiBusinessTypes} reload={loadAIBusinessTypes} />}
                  {aiWorkspaceTab === 'prompts' && <AIConfigurationSection view="prompts" businessTypes={aiBusinessTypes} reload={loadAIBusinessTypes} />}
                  {aiWorkspaceTab === 'menus' && (
                    <section className="space-y-5 rounded-3xl border border-[#242424] bg-[#111111] p-5 sm:p-7">
                      <div><h3 className="font-display text-2xl text-[#00DFA5]">IA pour les menus</h3><p className="mt-2 text-sm text-white/50">Sélectionnez un établissement pour ouvrir son studio de menus existant.</p></div>
                      {establishments.length ? (
                        <div className="space-y-4">
                          <label className="block max-w-xl text-xs font-semibold text-[#00DFA5]">Établissement
                            <select value={selectedMenuEstablishmentId} onChange={event => setSelectedMenuEstablishmentId(event.target.value)} className="mt-2 w-full rounded-xl border border-[#242424] bg-[#050505] px-3 py-3 text-sm text-white">
                              <option value="">Choisir un établissement</option>
                              {establishments.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                          </label>
                          {selectedMenuEstablishmentId && <MenuStudio key={selectedMenuEstablishmentId} establishmentId={selectedMenuEstablishmentId} />}
                        </div>
                      ) : <p className="text-sm text-white/50">Créez d’abord un établissement pour configurer son menu.</p>}
                    </section>
                  )}
                  {aiWorkspaceTab === 'google' && (
                    <div>
                      <div className="mb-5">
                        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00DFA5]/60">Avis et automatisation</p>
                        <h3 className="font-display text-2xl text-[#00DFA5] md:text-3xl">Avis & Google Business</h3>
                        <p className="mt-2 max-w-3xl text-sm leading-6 text-white/50">Choisissez une tuile pour afficher uniquement les réglages de cette fonctionnalité.</p>
                      </div>
                      <GoogleBusinessAdminSection establishments={establishments} businessTypes={aiBusinessTypes} onEstablishmentCreated={async () => { await Promise.all([loadEstablishments(), reloadEstablishmentList()]); }} legacyReviews={<ReviewsSection establishments={establishments} />} />
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {section === 'reports' && (
            <PDFReportsSection establishments={establishments} />
          )}

          {section === 'billing' && (
            <BillingSection establishments={establishments} billing={billing} reload={loadBilling} />
          )}

          {section === 'loyalty' && (
            <section className="space-y-5">
              <GoogleWalletStagingPanel />
              {establishments.length > 0 ? (
                <>
                  <div className="rounded-3xl border border-[#242424] bg-[#111111] p-4 shadow-sm">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                      <label className="block max-w-md text-xs font-semibold text-[#00DFA5]">
                        Établissement
                        <select
                          value={selectedEstablishmentId ?? ''}
                          onChange={(event) => setSelectedEstablishmentId(event.target.value || null)}
                          className="mt-2 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-3 text-sm font-normal text-[#FFFFFF] outline-none focus:border-[#242424]"
                        >
                          {establishments.map((establishment) => (
                            <option key={establishment.id} value={establishment.id}>
                              {establishment.name}
                            </option>
                          ))}
                        </select>
                      </label>

                      <div className="flex flex-wrap gap-2 rounded-2xl border border-[#242424]/10 bg-[#050505] p-1">
                        <button
                          type="button"
                          onClick={() => setLoyaltyTab('program')}
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${loyaltyTab === 'program' ? 'bg-[#686D76] text-[#050505]' : 'text-[#FFFFFF]/45 hover:text-[#00DFA5]'}`}
                        >
                          <Gem size={14} /> Programme
                        </button>
                        <button
                          type="button"
                          onClick={() => setLoyaltyTab('notifications')}
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${loyaltyTab === 'notifications' ? 'bg-[#686D76] text-[#050505]' : 'text-[#FFFFFF]/45 hover:text-[#00DFA5]'}`}
                        >
                          <Bell size={14} /> Notifications
                        </button>
                        <button
                          type="button"
                          onClick={() => setLoyaltyTab('raffles')}
                          className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition ${loyaltyTab === 'raffles' ? 'bg-[#686D76] text-[#050505]' : 'text-[#FFFFFF]/45 hover:text-[#00DFA5]'}`}
                        >
                          <Ticket size={14} /> Tombola
                        </button>
                      </div>
                    </div>
                  </div>

                  {selectedEstablishmentId && loyaltyTab === 'program' && (
                    <LoyaltyStudio establishmentId={selectedEstablishmentId} />
                  )}

                  {selectedEstablishmentId && loyaltyTab === 'notifications' && (
                    <LoyaltyNotificationsPanel establishmentId={selectedEstablishmentId} />
                  )}

                  {selectedEstablishmentId && loyaltyTab === 'raffles' && (
                    <LoyaltyRaffleStudio establishmentId={selectedEstablishmentId} />
                  )}
                </>
              ) : (
                <div className="rounded-3xl border border-[#242424] bg-[#111111] p-10 text-center shadow-sm">
                  <Gem className="mx-auto text-[#00DFA5]" size={28} />
                  <h2 className="mt-3 font-display text-2xl text-[#00DFA5]">Fidélité</h2>
                  <p className="mt-2 text-sm text-[#FFFFFF]/45">Créez d’abord un établissement pour configurer son programme de fidélité.</p>
                </div>
              )}
            </section>
          )}

          {section === 'system' && (
            <SystemSection billing={billing} globalStats={globalStats} establishments={establishments} />
          )}
        </main>
      
      <nav aria-label="Navigation administration" className="admin-depth-nav fixed inset-x-0 bottom-0 z-[60] border-t border-[#242424] bg-[#050505]/95 px-2 pb-[max(8px,env(safe-area-inset-bottom))] pt-2 backdrop-blur-2xl">
        <div className="mx-auto flex max-w-[900px] items-center justify-start gap-1 overflow-x-auto scrollbar-none">
          {menuItems.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  navigate(pathForSection(id));
                  if (id === 'loyalty' && !selectedEstablishmentId && establishments[0]) setSelectedEstablishmentId(establishments[0].id);
                }}
                aria-label={label}
                data-active={active} className={`kelyani-nav-link group flex min-w-[68px] flex-1 flex-col items-center justify-center gap-1 rounded-2xl px-2 py-2 transition-all ${
                  active
                    ? 'bg-[#111111] text-[#00DFA5] shadow-[0_0_24px_rgba(0,223,165,0.10)]'
                    : 'text-[#B0B0B0]/40 hover:bg-[#111111] hover:text-[#B0B0B0]'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.7} />
                <span className="max-w-[76px] truncate text-[8px] font-semibold tracking-[.02em]">{label.replace('💎 ', '')}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/* =========================================================
   OVERVIEW
========================================================= */

function Overview({
  establishments,
  staff,
  loading,
  onNavigate,
  billing,
  globalStats,
}: {
  establishments: Establishment[];
  staff: StaffMember[];
  loading: boolean;
  onNavigate: (section: AdminSection) => void;
  billing: BillingSnapshot;
  globalStats: GlobalStats;
}) {
  const [selectedEstablishment, setSelectedEstablishment] = useState('all');
  const [detail, setDetail] = useState({
    reviews: 0,
    averageRating: 0,
    loyaltyCustomers: 0,
    analyticsEvents: 0,
    loyaltyRevenue: 0,
  });
  const [detailLoading, setDetailLoading] = useState(false);
  const requestCounter = useRef(0);
  const {
    activities,
    loading: activityLoading,
    error: activityError,
    reload: reloadRecentActivity,
  } = useRecentActivity();

  const {
    customers: recentLoyaltyCustomers,
    loading: loyaltyCustomersLoading,
    error: loyaltyCustomersError,
    reload: reloadRecentLoyaltyCustomers,
  } = useRecentLoyaltyCustomers(10);

  useEffect(() => {
    console.log('[RecentLoyaltyCustomers] Admin bridge:', {
      customers: recentLoyaltyCustomers,
      loading: loyaltyCustomersLoading,
      error: loyaltyCustomersError,
      count: recentLoyaltyCustomers.length,
    });
  }, [
    recentLoyaltyCustomers,
    loyaltyCustomersLoading,
    loyaltyCustomersError,
  ]);

  const {
    data: overviewStats,
    status: overviewStatsStatus,
  } = useAdminOverviewStats(30);

  useEffect(() => {
    console.log('[OverviewEvolution] HOOK DATA:', {
      status: overviewStatsStatus,
      reviewsPoints: overviewStats?.reviewsEvolution?.length,
      scansPoints: overviewStats?.scansEvolution?.length,
      scansTotal: overviewStats?.scansEvolution?.reduce(
        (sum, point) => sum + point.count,
        0,
      ),
    });
  }, [overviewStatsStatus, overviewStats]);

  const {
    performances: establishmentPerformances,
    loading: establishmentPerformanceLoading,
    error: establishmentPerformanceError,
    reload: reloadEstablishmentPerformance,
  } = useEstablishmentPerformance();

  useEffect(() => {    console.log(
      '[EstablishmentPerformance] Admin bridge:',
      {
        status: establishmentPerformanceLoading          ? 'loading'
          : establishmentPerformanceError
            ? 'error'
            : 'success',
        performances: establishmentPerformances,
        count: establishmentPerformances.length,
      },
    );
  }, [
    establishmentPerformances,
    establishmentPerformanceLoading,
    establishmentPerformanceError,
  ]);

  console.log(
    '[KPI PROOF] Overview render:',
    'establishments=',
    establishments.length,
    'reviews=',
    globalStats.reviews,
    'loyaltyCustomers=',
    globalStats.loyaltyCustomers,
    'averageRating=',
    globalStats.averageRating,
    'detailReviews=',
    detail.reviews,
    'detailLoyaltyCustomers=',
    detail.loyaltyCustomers,
    'detailLoading=',
    detailLoading
  );
  console.log('[RecentActivity] Overview received:', { activities, activityLoading, activityError });

  useEffect(() => {
    const reqId = ++requestCounter.current;
    console.log('[EFFECT START]', reqId, selectedEstablishment);

    let mounted = true;

    const load = async () => {
      setDetailLoading(true);

      if (selectedEstablishment === 'all') {
        try {
          const { data: transactionRows, error: transactionError } = await supabase
            .from('loyalty_transactions')
            .select('amount')
            .eq('type', 'EARN');
          if (transactionError) throw transactionError;
          const loyaltyRevenue = (transactionRows ?? []).reduce(
            (sum, row) => sum + Number(row.amount ?? 0),
            0,
          );
          if (mounted) {
            setDetail({
              reviews: globalStats.reviews,
              averageRating: globalStats.averageRating,
              loyaltyCustomers: globalStats.loyaltyCustomers,
              analyticsEvents: globalStats.analyticsEvents,
              loyaltyRevenue,
            });
          }
        } catch (error) {
          console.error('Erreur CA fidélité global:', error);
          if (mounted) setDetail(current => ({ ...current, loyaltyRevenue: 0 }));
        } finally {
          if (mounted) setDetailLoading(false);
        }
        return;
      }

      try {
        const [
          { data: reviewRows, error: reviewsError },
          { count: loyaltyCustomers, error: loyaltyError },
          { count: analyticsEvents, error: analyticsError },
          { data: transactionRows, error: transactionError },
        ] = await Promise.all([
          supabase.from('reviews').select('rating').eq('establishment_id', selectedEstablishment),
          supabase.from('loyalty_customers').select('id', { count: 'exact', head: true }).eq('establishment_id', selectedEstablishment),
          supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('establishment_id', selectedEstablishment),
          supabase.from('loyalty_transactions').select('amount').eq('establishment_id', selectedEstablishment).eq('type', 'EARN'),
        ]);

        if (reviewsError || loyaltyError || analyticsError || transactionError) {
          throw reviewsError ?? loyaltyError ?? analyticsError ?? transactionError;
        }

        if (!mounted) return;

        const ratings = (reviewRows ?? [])
          .map((row) => Number(row.rating))
          .filter((rating) => Number.isFinite(rating));

        console.log('[SET DETAIL]', reqId, {
          reviews: ratings.length,
          loyaltyCustomers: loyaltyCustomers ?? 0,
          analyticsEvents: analyticsEvents ?? 0,
        });
        setDetail({
          reviews: ratings.length,
          averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0,
          loyaltyCustomers: loyaltyCustomers ?? 0,
          analyticsEvents: analyticsEvents ?? 0,
          loyaltyRevenue: (transactionRows ?? []).reduce(
            (sum, row) => sum + Number(row.amount ?? 0),
            0,
          ),
        });
      } catch (error) {
        console.error('Erreur statistiques établissement Admin:', error);
        if (mounted) {
          setDetail({
            reviews: 0,
            averageRating: 0,
            loyaltyCustomers: 0,
            analyticsEvents: 0,
            loyaltyRevenue: 0,
          });
        }
      } finally {
        if (mounted) setDetailLoading(false);
      }
    };

    void load();
    return () => {
      mounted = false;
      console.log('[CLEANUP]', reqId);
    };
  }, [selectedEstablishment, globalStats]);

  const responsibles = staff.filter((member) => member.role === 'MANAGER');
  const activeSubscriptions = billing.subscriptions.filter((item) => item.status === 'active').length;

  const selectedName = selectedEstablishment === 'all'
    ? 'Tous les établissements'
    : establishments.find((item) => item.id === selectedEstablishment)?.name ?? 'Établissement';

  return (
    <div className="space-y-6 pb-8 text-white">
      <section className="relative isolate overflow-hidden rounded-[28px] border border-[#00DFA5]/20 bg-[radial-gradient(ellipse_at_top_right,rgba(0,223,165,0.15),transparent_42%),linear-gradient(135deg,#171717_0%,#090909_66%,#111111_100%)] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.25)] sm:rounded-[32px] sm:p-7 lg:p-8"><div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border border-[#00DFA5]/15" /><div className="relative flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#00DFA5]/45">Vue globale</p>
          <h2 className="text-3xl font-semibold tracking-tight text-[#FFFFFF] md:text-[38px]">
            Bonjour, Administrateur 👋
          </h2>
          <p className="mt-2 text-sm text-[#FFFFFF]/50">
            Voici un aperçu de la performance de votre plateforme aujourd’hui.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedEstablishment}
            onChange={(event) => setSelectedEstablishment(event.target.value)}
            className="w-full rounded-xl border border-white/10 bg-[#050505] px-4 py-3 text-xs font-semibold text-white shadow-sm outline-none focus:border-[#00DFA5]/50 sm:w-auto"
          >
            <option value="all">Tous les établissements</option>
            {establishments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div></section>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-6">
        <AdminMetric icon={Building2} label="Établissements" value={establishments.length} detail="sur la plateforme" />
        <AdminMetric icon={UserRound} label="Responsables" value={responsibles.length} detail="comptes actifs" />
        <AdminMetric icon={UsersRound} label="Clients fidélisés" value={detailLoading ? '—' : detail.loyaltyCustomers.toLocaleString('fr-FR')} detail="membres enregistrés" />
        <AdminMetric icon={Star} label="Note moyenne" value={detailLoading ? '—' : detail.averageRating.toFixed(1)} detail={detail.reviews ? `sur ${detail.reviews.toLocaleString('fr-FR')} avis` : 'sur 0 avis'} />
        <AdminMetric icon={MessageSquare} label="Avis reçus" value={detailLoading ? '—' : detail.reviews.toLocaleString('fr-FR')} detail={selectedName} />
        <AdminMetric icon={WalletCards} label="MRR" value={billing.available ? `${billing.mrr.toLocaleString('fr-FR')} DH` : '—'} detail={`${activeSubscriptions} abonnements actifs`} />
      </div>

      <section aria-label="Indicateurs complémentaires" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <AdminMetric icon={TrendingUp} label="Avis positifs" value={globalStats.positiveReviews.toLocaleString('fr-FR')} detail="notes de 4 et 5 étoiles" />
        <AdminMetric icon={AlertTriangle} label="Avis négatifs" value={globalStats.negativeReviews.toLocaleString('fr-FR')} detail="à surveiller" />
        <AdminMetric icon={Activity} label="Événements" value={globalStats.analyticsEvents.toLocaleString('fr-FR')} detail="activité enregistrée" />
        <AdminMetric icon={CreditCard} label="Paiements ce mois" value={billing.available ? billing.paymentsThisMonth.toLocaleString('fr-FR') : '—'} detail="transactions payées" />
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <EvolutionCharts
          reviewsData={overviewStats?.reviewsEvolution ?? []}
          scansData={overviewStats?.scansEvolution ?? []}
          loading={overviewStatsStatus === 'loading'}
        />
        <section className="overflow-hidden rounded-[24px] border border-white/[0.07] bg-[radial-gradient(ellipse_at_top,rgba(0,223,165,0.09),transparent_48%),linear-gradient(145deg,#151515,#090909)] p-5 shadow-[0_18px_48px_rgba(0,0,0,0.2)] sm:rounded-[28px] sm:p-6">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#00DFA5]">Réputation globale</p>
          <h3 className="mt-1 text-lg font-semibold text-white">Qualité des avis</h3>
          <p className="mt-1 text-xs leading-5 text-white/40">Répartition des avis positifs et des avis à surveiller sur la plateforme.</p>
          <div className="relative mx-auto mt-3 h-52 w-full max-w-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={[{ name: 'Avis positifs', value: globalStats.positiveReviews }, { name: 'Avis à surveiller', value: globalStats.negativeReviews }]} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius="67%" outerRadius="88%" paddingAngle={globalStats.positiveReviews + globalStats.negativeReviews > 0 ? 4 : 0} stroke="none" startAngle={90} endAngle={-270}>
                  <Cell fill="#00DFA5" /><Cell fill="#686D76" />
                </Pie>
                <ChartTooltip contentStyle={{ background: '#111111', border: '1px solid #00DFA5', borderRadius: 12, color: '#fff', fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-4xl font-semibold text-white">{globalStats.positiveReviews + globalStats.negativeReviews ? Math.round((globalStats.positiveReviews / (globalStats.positiveReviews + globalStats.negativeReviews)) * 100) : 0}%</span>
              <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/40">positifs</span>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"><span className="flex items-center gap-2 text-xs text-white/60"><span className="h-2.5 w-2.5 rounded-full bg-[#686D76]" />Avis positifs</span><strong className="text-sm text-white">{globalStats.positiveReviews.toLocaleString('fr-FR')}</strong></div>
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3"><span className="flex items-center gap-2 text-xs text-white/60"><span className="h-2.5 w-2.5 rounded-full bg-[#686D76]" />À surveiller</span><strong className="text-sm text-white">{globalStats.negativeReviews.toLocaleString('fr-FR')}</strong></div>
          </div>
        </section>
      </div>

      <EstablishmentPerformanceTable
        performanceData={establishmentPerformances}
        loading={establishmentPerformanceLoading}
        error={establishmentPerformanceError}
        onRetry={reloadEstablishmentPerformance}
      />

    </div>
  );
}

function AdminMetric({ icon: Icon, label, value, detail }: { icon: typeof Star; label: string; value: string | number; detail: string }) {
  console.log('[KPI PROOF] AdminMetric render:', {
    label,
    value,
    detail,
  });

  return (
    <div
      data-kpi-label={label}
      data-kpi-value={String(value)}
      className="group relative overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(145deg,#171717,#0C0C0C)] p-4 shadow-[0_14px_36px_rgba(0,0,0,0.18)] transition duration-200 hover:-translate-y-0.5 hover:border-[#00DFA5]/25 sm:rounded-[22px] sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl border border-[#00DFA5]/15 bg-[#686D76]/[0.08] text-[#00DFA5]"><Icon size={18} /></div>
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#FFFFFF]/45">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{value}</p>
      <p className="mt-2 text-[10px] leading-4 text-[#FFFFFF]/40">{detail}</p>
    </div>
  );
}

function QuickStat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#111111] px-4 py-3">
      <span className="text-xs text-[#FFFFFF]/50">{label}</span>
      <span className={`text-sm font-semibold ${alert ? 'text-[#00DFA5]' : 'text-[#00DFA5]'}`}>{value}</span>
    </div>
  );
}

/* =========================================================
   ESTABLISHMENTS
========================================================= */

/* =========================================================
   ESTABLISHMENTS
========================================================= */

type WorkspaceTab = 'profile' | 'wifi' | 'menu' | 'promotions' | 'reviews' | 'google' | 'loyalty' | 'team' | 'analytics' | 'public';

type MenuCategory = { id: string; name: string; description: string | null; display_order: number; active: boolean };
type MenuItem = { id: string; category_id: string; name: string; description: string | null; price: number; image_url: string | null; display_order: number; active: boolean };
type Promotion = { id: string; name: string; description: string | null; image_url: string | null; normal_price: number | null; promo_price: number | null; start_at: string | null; end_at: string | null; active: boolean; display_order: number };

type LoyaltyReward = {
  id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
  cost_mad: number;
};

type LoyaltySettings = {
  points_per_currency: number;
  currency: string;
  enabled: boolean;
};

function EstablishmentWorkspace({
  establishment,
  businessTypes,
  onBack,
  onReload,
}: {
  establishment: Establishment;
  businessTypes: AIBusinessType[];
  onBack: () => void;
  onReload: () => Promise<void>;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const workspaceTabFromPath = (pathname: string): WorkspaceTab => {
    const parts = pathname.split('/').filter(Boolean);
    const candidate = parts[3] as WorkspaceTab | undefined;
    const validTabs: WorkspaceTab[] = ['profile', 'wifi', 'menu', 'promotions', 'reviews', 'google', 'loyalty', 'team', 'analytics', 'public'];
    return candidate && validTabs.includes(candidate) ? candidate : 'profile';
  };
  const [tab, setTab] = useState<WorkspaceTab>(() => workspaceTabFromPath(window.location.pathname));

  useEffect(() => {
    setTab(workspaceTabFromPath(location.pathname));
  }, [location.pathname]);
  const establishmentProfileEngine = useEstablishmentProfile(establishment.id);

  useEffect(() => {
    console.log('[EstablishmentProfile] STATUS:', {
      status: establishmentProfileEngine.loading ? 'loading' : establishmentProfileEngine.profile ? 'success' : 'error',
      establishmentId: establishment.id,
      profile: establishmentProfileEngine.profile,
      isDirty: establishmentProfileEngine.isDirty,
      slugStatus: establishmentProfileEngine.slugStatus,
      error: establishmentProfileEngine.error?.message ?? null,
    });
  }, [
    establishment.id,
    establishmentProfileEngine.loading,
    establishmentProfileEngine.profile,
    establishmentProfileEngine.isDirty,
    establishmentProfileEngine.slugStatus,
    establishmentProfileEngine.error,
  ]);

  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(establishment);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltySettings>({ points_per_currency: 1, currency: 'MAD', enabled: true });
  const [customersCount, setCustomersCount] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const [team, setTeam] = useState<StaffMember[]>([]);
  const [eventsCount, setEventsCount] = useState(0);
  const [templates, setTemplates] = useState<any[]>([]);
  const [menuTemplate, setMenuTemplate] = useState('editorial');
  const [menuDisplayMode, setMenuDisplayMode] = useState<'digital' | 'pdf'>('digital');
  const [menuPdfUrl, setMenuPdfUrl] = useState<string | null>(null);
  const [menuAiPhotoMode, setMenuAiPhotoMode] = useState<'with_photos' | 'without_photos'>('with_photos');
  const [menuPdfUploading, setMenuPdfUploading] = useState(false);
  const [menuCategoryName, setMenuCategoryName] = useState('');
  const [menuItem, setMenuItem] = useState({ name: '', description: '', price: '', category_id: '' });
  const [menuImportOpen, setMenuImportOpen] = useState(false);
  const [menuImportFile, setMenuImportFile] = useState<File | null>(null);
  const [menuImportLoading, setMenuImportLoading] = useState(false);
  const [menuImportApplying, setMenuImportApplying] = useState(false);
  const [menuImportError, setMenuImportError] = useState('');
  const [editingMenuItemId, setEditingMenuItemId] = useState<string | null>(null);
  const [editingMenuItem, setEditingMenuItem] = useState({ name: '', description: '', price: '', category_id: '', image_url: '' });
  const [menuImageUploading, setMenuImageUploading] = useState(false);
  const [menuItemSaving, setMenuItemSaving] = useState(false);
  const [menuImportPreview, setMenuImportPreview] = useState<{
    categories: { name: string; description: string | null; items: { name: string; description: string | null; price: number }[] }[];
  } | null>(null);
  const [menuAiDesign, setMenuAiDesign] = useState<any | null>(null);
  const [menuAiDesignLoading, setMenuAiDesignLoading] = useState(false);
  const [promotion, setPromotion] = useState({ name: '', description: '', normal_price: '', promo_price: '' });
  const [reward, setReward] = useState({ name: '', description: '', points_required: '' });

  const publicLink = `${window.location.origin}/p/${establishment.slug}`;
  const [scannerLink, setScannerLink] = useState<string | null>(null);
  const [scannerQr, setScannerQr] = useState<string | null>(null);
  const businessType = businessTypes.find((x) => x.id === establishmentProfileEngine.profile?.ai_business_type_id)?.name ?? establishmentProfileEngine.profile?.business_type ?? profile.business_type ?? 'Établissement';

  const loadTab = async () => {
    if (tab === 'public') {
      const { data } = await supabase.from('establishments').select('*').eq('id', establishment.id).maybeSingle();
      if (data) setProfile(data);
    }
    if (tab === 'menu') {
      const [{ data: c }, { data: i }, { data: establishmentRow }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('establishment_id', establishment.id).order('display_order'),
        supabase.from('menu_items').select('*').eq('establishment_id', establishment.id).order('display_order'),
        supabase.from('establishments').select('menu_template_id,menu_display_mode,menu_pdf_url,menu_ai_design,menu_ai_photo_mode').eq('id', establishment.id).maybeSingle(),
      ]);
      setCategories(c ?? []);
      setMenuTemplate(establishmentRow?.menu_template_id ?? 'editorial');
      setMenuDisplayMode(establishmentRow?.menu_display_mode === 'pdf' ? 'pdf' : 'digital');
      setMenuPdfUrl(establishmentRow?.menu_pdf_url ?? null);
      setMenuAiDesign(establishmentRow?.menu_ai_design ?? null);
      setMenuAiPhotoMode(establishmentRow?.menu_ai_photo_mode === 'without_photos' ? 'without_photos' : 'with_photos');
      setItems(i ?? []);
      if (!menuItem.category_id && c?.[0]) setMenuItem((v) => ({ ...v, category_id: c[0].id }));
    }
    if (tab === 'promotions') {
      const { data } = await supabase.from('promotions').select('*').eq('establishment_id', establishment.id).order('display_order');
      setPromotions(data ?? []);
    }
    if (tab === 'loyalty') {
      try {
        const [
          { data: rewardsData, error: rewardsError },
          { data: settingsData, error: settingsError },
          { count, error: customersError },
        ] = await Promise.all([
          supabase
            .from('loyalty_rewards')
            .select('id, name, description, points_required, active, cost_mad')
            .eq('establishment_id', establishment.id)
            .order('points_required', { ascending: true }),
          supabase
            .from('loyalty_settings')
            .select('points_per_currency, currency, enabled')
            .eq('establishment_id', establishment.id)
            .maybeSingle(),
          supabase
            .from('loyalty_customers')
            .select('id', { count: 'exact', head: true })
            .eq('establishment_id', establishment.id),
        ]);

        if (rewardsError) throw rewardsError;
        if (settingsError) throw settingsError;
        if (customersError) throw customersError;

        setRewards(rewardsData ?? []);
        setLoyalty(
          settingsData ?? {
            points_per_currency: 1,
            currency: 'MAD',
            enabled: true,
          },
        );
        setCustomersCount(count ?? 0);
      } catch (error) {
        console.error('Erreur chargement fidélité:', error);
        setRewards([]);
        setLoyalty({ points_per_currency: 1, currency: 'MAD', enabled: true });
        setCustomersCount(0);
        alert(error instanceof Error ? error.message : 'Erreur lors du chargement de la fidélité.');
      }
    }
    if (tab === 'reviews') {
      const { data } = await supabase.from('reviews').select('*').eq('establishment_id', establishment.id).order('created_at', { ascending: false }).limit(100);
      setReviews(data ?? []);
    }
    if (tab === 'team') setTeam((await supabase.from('establishment_staff').select('id,establishment_id,user_id,role,active,created_at').eq('establishment_id', establishment.id).order('created_at')).data?.map((x: any) => ({ ...x, email: '—', name: 'Membre', profileRole: null })) ?? []);
    if (tab === 'analytics') {
      const { count } = await supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('establishment_id', establishment.id);
      setEventsCount(count ?? 0);
    }
    if (tab === 'public') {
      const { data } = await supabase.from('templates').select('*').order('name');
      setTemplates(data ?? []);
    }
  };

  useEffect(() => {
    loadTab();
  }, [tab, establishment.id]);

  useEffect(() => {
    let mounted = true;
    const loadScannerLink = async () => {
      const { data, error } = await supabase
        .from('establishment_scanner_links')
        .select('access_token')
        .eq('establishment_id', establishment.id)
        .maybeSingle();

      if (!mounted) return;
      if (error) {
        console.error('Erreur chargement lien scanner:', error);
        setScannerLink(null);
        setScannerQr(null);
        return;
      }

      const token = data?.access_token;
      const link = token ? window.location.origin + '/employee?scanner=' + encodeURIComponent(token) : null;
      setScannerLink(link);

      if (link) {
        try {
          const qr = await QRCode.toDataURL(link, {
            width: 320,
            margin: 2,
            errorCorrectionLevel: 'M',
            color: { dark: '#0D0D0D', light: '#FFFFFF' },
          });
          if (mounted) setScannerQr(qr);
        } catch (qrError) {
          console.error('Erreur génération QR scanner:', qrError);
          if (mounted) setScannerQr(null);
        }
      } else {
        setScannerQr(null);
      }
    };

    void loadScannerLink();
    return () => {
      mounted = false;
    };
  }, [establishment.id]);

  const saveTemplates = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('establishments')
      .update({
        page_template_id: profile.page_template_id || null,
        menu_template_id: profile.menu_template_id || null,
      })
      .eq('id', establishment.id);
    setSaving(false);
    if (error) return alert(error.message);
    alert('Templates enregistrés.');
  };

  const setMenuMode = async (mode: 'digital' | 'pdf') => {
    setMenuDisplayMode(mode);
    const { error } = await supabase.from('establishments').update({ menu_display_mode: mode }).eq('id', establishment.id);
    if (error) { alert(error.message); return; }
  };

  const uploadMenuPdf = async (file: File) => {
    if (file.type !== 'application/pdf') {
      alert('Sélectionne uniquement un fichier PDF.');
      return;
    }
    setMenuPdfUploading(true);
    try {
      const path = `${establishment.id}/menu-${Date.now()}.pdf`;
      const { error } = await supabase.storage.from('menu-pdfs').upload(path, file, {
        upsert: true,
        contentType: 'application/pdf',
        cacheControl: '31536000',
      });
      if (error) throw error;
      const { data } = supabase.storage.from('menu-pdfs').getPublicUrl(path);
      const { error: updateError } = await supabase.from('establishments').update({
        menu_pdf_url: data.publicUrl,
        menu_display_mode: 'pdf',
      }).eq('id', establishment.id);
      if (updateError) throw updateError;
      setMenuPdfUrl(data.publicUrl);
      setMenuDisplayMode('pdf');
      alert('Menu PDF importé. Il sera affiché tel quel sur la page publique.');
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Impossible d’importer le PDF.');
    } finally {
      setMenuPdfUploading(false);
    }
  };

  const removeMenuPdf = async () => {
    const { error } = await supabase.from('establishments').update({ menu_pdf_url: null, menu_display_mode: 'digital' }).eq('id', establishment.id);
    if (error) return alert(error.message);
    setMenuPdfUrl(null);
    setMenuDisplayMode('digital');
  };

  const saveMenuTemplate = async (templateId: string) => {
    setMenuTemplate(templateId);
    const { error } = await supabase
      .from('establishments')
      .update({ menu_template_id: templateId })
      .eq('id', establishment.id);

    if (error) {
      alert(error.message);
      return;
    }

    await onReload();
  };

  const saveMenuAiPhotoMode = async (mode: 'with_photos' | 'without_photos') => {
    setMenuAiPhotoMode(mode);
    const { error } = await supabase
      .from('establishments')
      .update({ menu_ai_photo_mode: mode })
      .eq('id', establishment.id);

    if (error) {
      alert(error.message);
      return;
    }
  };

  const saveMenuAiStyle = async (style: 'editorial' | 'immersive' | 'minimal' | 'luxury') => {
    if (!menuAiDesign) return;
    const nextDesign = { ...menuAiDesign, style };
    setMenuAiDesign(nextDesign);
    const { error } = await supabase
      .from('establishments')
      .update({ menu_ai_design: nextDesign })
      .eq('id', establishment.id);

    if (error) {
      alert(error.message);
      return;
    }
  };

  const importMenuWithAI = async () => {
    if (!menuImportFile) {
      setMenuImportError('Sélectionne un PDF ou une photo de menu.');
      return;
    }

    setMenuImportLoading(true);
    setMenuImportError('');
    setMenuImportPreview(null);

    try {
      const formData = new FormData();
      formData.append('file', menuImportFile);
      formData.append('establishment_id', establishment.id);

      const { data, error } = await supabase.functions.invoke('import-menu', {
        body: formData,
      });

      if (error) {
        let detailedMessage = error instanceof Error
          ? error.message
          : 'Erreur pendant l’analyse du menu.';

        try {
          const functionError = error as {
            context?: {
              json?: () => Promise<any>;
            };
          };

          const errorBody = await functionError.context?.json?.();

          if (errorBody?.error || errorBody?.message) {
            detailedMessage =
              errorBody.error ||
              errorBody.message ||
              detailedMessage;
          }
        } catch {
          // Supabase may return an error without a readable response body.
        }

        console.error('Erreur import menu IA:', error, detailedMessage);
        throw new Error(detailedMessage);
      }

      if (!data?.success || !data?.menu) {
        throw new Error(data?.error || 'Impossible d’analyser le menu.');
      }

      setMenuImportPreview(data.menu);
    } catch (error) {
      console.error('Erreur import menu IA:', error);
      setMenuImportError(error instanceof Error ? error.message : 'Erreur pendant l’analyse du menu.');
    } finally {
      setMenuImportLoading(false);
    }
  };

  const applyImportedMenu = async () => {
    if (!menuImportPreview) return;

    setMenuImportApplying(true);
    try {
      const createdCategories: any[] = [];
      const createdItems: any[] = [];

      for (const [categoryIndex, category] of menuImportPreview.categories.entries()) {
        const { data: categoryRow, error: categoryError } = await supabase
          .from('menu_categories')
          .insert({
            establishment_id: establishment.id,
            name: category.name.trim(),
            description: category.description?.trim() || null,
            display_order: categories.length + categoryIndex,
            active: true,
          })
          .select('id, name, description')
          .single();

        if (categoryError) throw categoryError;
        createdCategories.push({ ...categoryRow, sourceName: category.name });

        const rows = category.items
          .filter((item) => item.name?.trim())
          .map((item, index) => ({
            establishment_id: establishment.id,
            category_id: categoryRow.id,
            name: item.name.trim(),
            description: item.description?.trim() || null,
            price: Number.isFinite(Number(item.price)) ? Number(item.price) : 0,
            image_url: null,
            display_order: index,
            active: true,
          }));

        if (rows.length) {
          const { data: insertedItems, error: itemsError } = await supabase
            .from('menu_items')
            .insert(rows)
            .select('id,name,description,price,image_url,category_id');
          if (itemsError) throw itemsError;
          createdItems.push(...(insertedItems ?? []));
        }
      }

      const designMenu = {
        categories: createdCategories.map((category) => ({
          id: category.id,
          name: category.name,
          description: category.description ?? null,
          items: createdItems
            .filter((item) => item.category_id === category.id)
            .map((item) => ({
              id: item.id,
              name: item.name,
              description: item.description ?? null,
              price: item.price,
              image_url: item.image_url ?? null,
            })),
        })),
      };

      setMenuAiDesignLoading(true);
      try {
        const { data: designData, error: designError } = await supabase.functions.invoke(
          'design-menu',
          { body: { establishment_id: establishment.id, menu: designMenu } },
        );

        if (designError || !designData?.success || !designData?.design) {
          console.error('Design IA menu:', designError ?? designData);
        } else {
          setMenuAiDesign(designData.design);
          await supabase
            .from('establishments')
            .update({ menu_ai_design: designData.design })
            .eq('id', establishment.id);
        }
      } catch (designError) {
        console.error('Erreur génération design IA:', designError);
      } finally {
        setMenuAiDesignLoading(false);
      }

      setMenuImportOpen(false);
      setMenuImportFile(null);
      setMenuImportPreview(null);
      setMenuImportError('');
      await loadTab();
      alert('Menu importé avec succès. Le design premium IA a également été généré. Tu peux maintenant modifier chaque produit.');
    } catch (error) {
      console.error('Erreur création menu importé:', error);
      setMenuImportError(error instanceof Error ? error.message : 'Impossible d’enregistrer le menu.');
    } finally {
      setMenuImportApplying(false);
    }
  };

  const addCategory = async () => {
    if (!menuCategoryName.trim()) return;
    const { error } = await supabase.from('menu_categories').insert({ establishment_id: establishment.id, name: menuCategoryName.trim(), display_order: categories.length });
    if (error) return alert(error.message); setMenuCategoryName(''); loadTab();
  };

  const addMenuItem = async () => {
    if (!menuItem.name.trim() || !menuItem.category_id) return alert('Nom et catégorie obligatoires.');
    const { error } = await supabase.from('menu_items').insert({ establishment_id: establishment.id, category_id: menuItem.category_id, name: menuItem.name.trim(), description: menuItem.description.trim() || null, price: Number(menuItem.price) || 0, display_order: items.filter((x) => x.category_id === menuItem.category_id).length });
    if (error) return alert(error.message); setMenuItem({ name: '', description: '', price: '', category_id: menuItem.category_id }); loadTab();
                      <span className="text-[#FFFFFF]/40">Points <strong className="ml-1 text-[#00DFA5]">{item.points.toLocaleString('fr-FR')}</strong></span>
                      <span className="text-[#FFFFFF]/40">Récompenses <strong className="ml-1 text-[#00DFA5]">{item.rewards}</strong></span>
                      <span className="text-[#FFFFFF]/40">Coût récompenses <strong className="ml-1 text-[#00DFA5]">{formatMad(item.rewardCost)}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[#242424]/10 bg-[#111111] p-5 text-[#FFFFFF]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#FFFFFF]/50">Synthèse période</p>
          <h3 className="mt-2 text-xl font-semibold">Vue financière & réputation</h3>
          <div className="mt-6 space-y-4">
            <div><p className="text-xs text-[#FFFFFF]/50">CA fidélité</p><p className="mt-1 text-2xl font-semibold">{loading ? '—' : formatMad(revenue)}</p></div>
            <div><p className="text-xs text-[#FFFFFF]/50">Coût récompenses</p><p className="mt-1 text-2xl font-semibold">{loading ? '—' : formatMad(rewardCost)}</p></div>
            <div><p className="text-xs text-[#FFFFFF]/50">CA après coût récompenses</p><p className="mt-1 text-3xl font-semibold text-[#00DFA5]">{loading ? '—' : formatMad(netContribution)}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#111111]/10 px-4 py-3"><p className="text-[11px] text-[#FFFFFF]/50">Récompenses</p><p className="mt-1 text-lg font-semibold">{redemptionCount}</p></div>
              <div className="rounded-xl bg-[#111111]/10 px-4 py-3"><p className="text-[11px] text-[#FFFFFF]/50">Part coût</p><p className="mt-1 text-lg font-semibold">{loading ? '—' : `${rewardCostRate.toFixed(1)} %`}</p></div>
            </div>
          </div>
          <p className="mt-6 text-[11px] leading-5 text-[#FFFFFF]/40">Les indicateurs sont calculés uniquement à partir des données enregistrées dans les tables consultées. Aucun chiffre d’uptime ou de performance technique n’est inventé.</p>
        </div>
      </div>
    </div>
  );
}

function AdminAnalyticsCard({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-[#242424]/10 bg-[#111111] p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium text-[#FFFFFF]/45">{label}</p>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#686D76] text-[#00DFA5]">
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-5 text-2xl font-semibold text-[#00DFA5]">{value}</p>
      <p className="mt-1 text-[11px] text-[#FFFFFF]/35">{helper}</p>
    </div>
  );
}

/* =========================================================
   CONFIGURATION IA
========================================================= */

function AIConfigurationSection({
  view,
  businessTypes,
  reload,
}: {
  view: 'engine' | 'prompts';
  businessTypes: AIBusinessType[];
  reload: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [prompt, setPrompt] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [aiSettings, setAISettings] = useState<any>({ provider: 'openai', model: 'gpt-5.6-luna', enabled: true, temperature: 0.2, max_output_tokens: 4000, system_instructions: '', has_api_key: false });
  const [aiApiKey, setAIApiKey] = useState('');
  const [aiSettingsSaving, setAISettingsSaving] = useState(false);
  const [promotionPrompt, setPromotionPrompt] = useState('');
  const [promotionPromptSaving, setPromotionPromptSaving] = useState(false);

  useEffect(() => {
    (async () => { const { data, error } = await supabase.rpc('admin_get_ai_settings'); if (!error && data?.[0]) setAISettings(data[0]); })();
  }, []);

  useEffect(() => {
    const promotionType = businessTypes.find(
      (type) => type.name === 'Promotion IA — Image'
    );
    setPromotionPrompt(promotionType?.ai_prompt ?? '');
  }, [businessTypes]);

  const saveAISettings = async () => {
    if (String(aiSettings.provider ?? '').trim().toLowerCase() !== 'openai') return alert('Le moteur IA actuellement pris en charge par les fonctionnalités KELYANI est OpenAI. Sélectionne OpenAI avant d’enregistrer.');
    if (!aiSettings.model?.trim()) return alert('Le modèle est obligatoire.');
    if (Number(aiSettings.temperature) < 0 || Number(aiSettings.temperature) > 2) return alert('La température doit être entre 0 et 2.');
    if (!Number.isInteger(Number(aiSettings.max_output_tokens)) || Number(aiSettings.max_output_tokens) < 256 || Number(aiSettings.max_output_tokens) > 128000) return alert('Max output tokens invalide.');
    setAISettingsSaving(true);
    const { data, error } = await supabase.rpc('admin_save_ai_settings', { p_provider: aiSettings.provider.trim(), p_model: aiSettings.model.trim(), p_enabled: !!aiSettings.enabled, p_temperature: Number(aiSettings.temperature), p_max_output_tokens: Number(aiSettings.max_output_tokens), p_system_instructions: aiSettings.system_instructions ?? '', p_api_key: aiApiKey.trim() || null });
    setAISettingsSaving(false);
    if (error) return alert(`Impossible d’enregistrer la configuration IA : ${error.message}`);
    if (data?.[0]) setAISettings(data[0]);
    setAIApiKey('');
    alert('Configuration IA enregistrée.');
  };

  const savePromotionPrompt = async () => {
    const value = promotionPrompt.trim();
    if (!value) {
      alert('Veuillez saisir le prompt de génération des promotions.');
      return;
    }

    setPromotionPromptSaving(true);

    const existing = businessTypes.find(
      (type) => type.name === 'Promotion IA — Image'
    );

    const result = existing
      ? await supabase
          .from('ai_business_types')
          .update({
            ai_prompt: value,
            active: true,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id)
      : await supabase
          .from('ai_business_types')
          .insert({
            name: 'Promotion IA — Image',
            description: 'Prompt directeur artistique utilisé pour générer les visuels de promotions.',
            ai_prompt: value,
            active: true,
          });

    setPromotionPromptSaving(false);

    if (result.error) {
      console.error('Erreur prompt promotions IA:', result.error);
      alert(`Impossible d’enregistrer le prompt promotions : ${result.error.message}`);
      return;
    }

    alert('Prompt de génération des promotions enregistré.');
    await reload();
  };

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setName('');
    setDescription('');
    setPrompt('');
    setActive(true);
  };

  const startEdit = (type: AIBusinessType) => {
    setEditingId(type.id);
    setName(type.name);
    setDescription(type.description ?? '');
    setPrompt(type.ai_prompt);
    setActive(type.active);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const save = async () => {
    if (!name.trim()) {
      alert('Veuillez saisir le nom du type.');
      return;
    }

    if (!prompt.trim()) {
      alert('Veuillez saisir le prompt IA.');
      return;
    }

    setSaving(true);

    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      ai_prompt: prompt.trim(),
      active,
      updated_at: new Date().toISOString(),
    };

    const result = editingId
      ? await supabase
          .from('ai_business_types')
          .update(payload)
          .eq('id', editingId)
      : await supabase
          .from('ai_business_types')
          .insert(payload);

    setSaving(false);

    if (result.error) {
      console.error('Erreur type IA:', result.error);
      alert(`Impossible d'enregistrer le type : ${result.error.message}`);
      return;
    }

    alert(editingId ? 'Type IA modifié avec succès.' : 'Type IA créé avec succès.');
    resetForm();
    await reload();
  };

  const toggleActive = async (type: AIBusinessType) => {
    const { error } = await supabase
      .from('ai_business_types')
      .update({
        active: !type.active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', type.id);

    if (error) {
      console.error('Erreur activation type IA:', error);
      alert(`Impossible de modifier le type : ${error.message}`);
      return;
    }

    await reload();  };

  const deleteType = async (type: AIBusinessType) => {
    if (!window.confirm(
      `Supprimer le type « ${type.name} » ? Les établissements qui l'utilisent conserveront leur lien mais leur type IA deviendra vide.`    )) {
      return;
    }

    const { error } = await supabase
      .from('ai_business_types')
      .delete()
      .eq('id', type.id);

    if (error) {
      console.error('Erreur suppression type IA:', error);
      alert(`Impossible de supprimer le type : ${error.message}`);
      return;
    }

    await reload();
  };

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#00DFA5]/50">
            Intelligence artificielle
          </p>

          <h2 className="font-display text-3xl text-[#00DFA5] md:text-4xl">
            {view === 'engine' ? 'Moteur IA global' : 'Prompts et comportements métier'}
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#FFFFFF]/50">
            {view === 'engine'
              ? 'Configure le fournisseur, le modèle et les paramètres partagés par les fonctionnalités IA compatibles.'
              : 'Gère les prompts des promotions et les comportements métier attribués à chaque type d’établissement.'}
          </p>
        </div>

        {view === 'prompts' && (
          <button
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 py-3 text-sm font-semibold text-[#FFFFFF] transition hover:bg-[#111111]"
          >
            <Plus size={16} />
            Nouveau type
          </button>
        )}
      </div>

      {view === 'prompts' && (
      <div className="mb-6 rounded-2xl border border-[#00DFA5]/20 bg-[#111111] p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#00DFA5]">
              Génération des promotions
            </p>
            <h3 className="mt-1 font-display text-2xl text-[#00DFA5]">
              Prompt IA des visuels promotionnels
            </h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#FFFFFF]/50">
              C’est ici que l’administrateur définit les instructions utilisées par l’IA
              pour créer les images des promotions. Le responsable ne peut pas modifier ce prompt.
            </p>
          </div>
          <span className="rounded-full bg-[#111111]/5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-[#00DFA5]">
            Admin uniquement
          </span>
        </div>

        <div className="mt-5">
          <textarea
            value={promotionPrompt}
            onChange={(e) => setPromotionPrompt(e.target.value)}
            rows={10}
            placeholder="Décris le style visuel, la direction artistique, les règles de texte dans l’image et les contraintes à respecter..."
            className="w-full resize-y rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm leading-6 outline-none focus:border-[#242424]"
          />
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={savePromotionPrompt}
            disabled={promotionPromptSaving}
            className="rounded-xl bg-[#111111] px-5 py-3 text-sm font-semibold text-[#FFFFFF] disabled:opacity-50"
          >
            {promotionPromptSaving ? 'Enregistrement...' : 'Enregistrer le prompt promotions'}
          </button>
        </div>
      </div>

      )}

      {view === 'engine' && (
      <div className="mb-6 rounded-3xl border border-[#242424] bg-[#111111] p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#00DFA5]">Moteur IA global</p><h3 className="mt-1 text-xl font-semibold text-[#00DFA5]">Provider et modèle utilisés par l’analyse</h3></div><span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${aiSettings.enabled ? 'bg-[#111111] text-[#00DFA5]' : 'bg-[#111111] text-[#00DFA5]'}`}>{aiSettings.enabled ? 'IA ACTIVE' : 'IA DÉSACTIVÉE'}</span></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold">Provider / moteur</span><select value={String(aiSettings.provider ?? 'openai').toLowerCase()} onChange={e=>setAISettings((v:any)=>({...v,provider:e.target.value}))} className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm"><option value="openai">OpenAI</option></select><span className="mt-1 block text-xs text-[#FFFFFF]/40">Les fonctionnalités IA connectées à ce moteur utilisent actuellement OpenAI.</span></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold">Modèle</span><input value={aiSettings.model ?? ''} onChange={e=>setAISettings((v:any)=>({...v,model:e.target.value}))} placeholder="gpt-5.6-luna" className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm"/></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold">Température</span><input type="number" min="0" max="2" step="0.1" value={aiSettings.temperature ?? 0.2} onChange={e=>setAISettings((v:any)=>({...v,temperature:Number(e.target.value)}))} className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm"/></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold">Max output tokens</span><input type="number" value={aiSettings.max_output_tokens ?? 4000} onChange={e=>setAISettings((v:any)=>({...v,max_output_tokens:Number(e.target.value)}))} className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm"/></label>
          <label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold">Clé API <span className="font-normal text-[#FFFFFF]/35">{aiSettings.has_api_key ? '— une clé est déjà enregistrée, vide pour la conserver' : '— aucune clé enregistrée'}</span></span><input type="password" value={aiApiKey} onChange={e=>setAIApiKey(e.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm"/></label>
          <label className="flex items-center gap-3 rounded-xl bg-[#111111] p-4 md:col-span-2"><input type="checkbox" checked={!!aiSettings.enabled} onChange={e=>setAISettings((v:any)=>({...v,enabled:e.target.checked}))}/><span><strong className="block text-sm text-[#00DFA5]">Activer l’IA</strong><span className="text-xs text-[#FFFFFF]/40">Le moteur global alimente les fonctionnalités IA compatibles de KELYANI, y compris les réponses Google Business.</span></span></label>
          <label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold">Instructions système globales</span><textarea rows={5} value={aiSettings.system_instructions ?? ''} onChange={e=>setAISettings((v:any)=>({...v,system_instructions:e.target.value}))} className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm leading-6"/></label>
        </div>
        <div className="mt-5 flex justify-end"><button onClick={saveAISettings} disabled={aiSettingsSaving} className="rounded-xl bg-[#111111] px-5 py-3 text-sm font-semibold text-[#FFFFFF]">{aiSettingsSaving ? 'Enregistrement...' : 'Enregistrer le moteur IA'}</button></div>
      </div>

      )}

      {view === 'prompts' && (
        <>
      {showForm && (
        <div className="mb-6 rounded-2xl border border-[#00DFA5]/20 bg-[#111111] p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#00DFA5]">
                {editingId ? 'Modification' : 'Nouveau type'}
              </p>
              <h3 className="mt-1 font-display text-2xl text-[#00DFA5]">
                {editingId ? 'Modifier le type IA' : 'Créer un type IA'}
              </h3>
            </div>

            <button
              onClick={resetForm}
              className="text-[#FFFFFF]/40 hover:text-[#FFFFFF]"
            >
              <X size={20} />
            </button>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-xs font-semibold">
                Nom du type
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex : Restaurant"
                className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm outline-none focus:border-[#242424]"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs font-semibold">
                Description
              </label>
              <input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Ex : Restaurants, cafés et lounges"
                className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm outline-none focus:border-[#242424]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold">
                Prompt métier de l’IA
              </label>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={9}
                placeholder="Décris comment l’IA doit analyser ce type d’établissement..."
                className="w-full resize-y rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm leading-6 outline-none focus:border-[#242424]"
              />
              <p className="mt-2 text-[11px] text-[#FFFFFF]/35">
                Ce prompt reste dans l’espace Admin et sert de base métier à l’analyse.
              </p>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#111111] p-4 md:col-span-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-[#686D76]"
              />
              <span>
                <span className="block text-sm font-semibold text-[#00DFA5]">
                  Type actif
                </span>
                <span className="mt-1 block text-xs text-[#FFFFFF]/40">
                  Un type désactivé ne sera pas proposé lors de l’attribution à un établissement.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={resetForm}
              disabled={saving}
              className="rounded-xl border border-[#242424]/10 px-5 py-3 text-sm font-medium"
            >
              Annuler
            </button>

            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-[#111111] px-5 py-3 text-sm font-semibold text-[#FFFFFF] disabled:opacity-50"
            >
              <Save size={16} />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {businessTypes.map((type) => (
          <div
            key={type.id}
            className="rounded-3xl border border-[#242424] bg-[#111111] p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#111111] text-[#00DFA5]">
                    <Brain size={18} />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-[#00DFA5]">
                      {type.name}
                    </h3>
                    <p className="text-xs text-[#FFFFFF]/40">
                      {type.description || 'Aucune description'}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                      type.active
                        ? 'bg-[#111111] text-[#00DFA5]'
                        : 'bg-[#111111] text-[#00DFA5]'
                    }`}
                  >
                    {type.active ? 'ACTIF' : 'DÉSACTIVÉ'}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-[#111111] p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-[#FFFFFF]/35">
                    Prompt métier
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-[#FFFFFF]/60">
                    {type.ai_prompt}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  onClick={() => startEdit(type)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#242424]/10 px-3 py-2 text-xs font-medium transition hover:bg-[#111111]"
                >
                  <Pencil size={14} />
                  Modifier
                </button>

                <button
                  onClick={() => toggleActive(type)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    type.active
                      ? 'border-[#242424] text-[#00DFA5] hover:bg-[#111111]'
                      : 'border-[#242424] text-[#00DFA5] hover:bg-[#111111]'
                  }`}
                >
                  <Power size={14} />
                  {type.active ? 'Désactiver' : 'Activer'}
                </button>

                <button
                  onClick={() => deleteType(type)}
                  className="inline-flex items-center gap-2 rounded-lg border border-[#242424] px-3 py-2 text-xs font-medium text-[#00DFA5] transition hover:bg-[#111111]"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}

        {businessTypes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-[#242424]/15 bg-[#111111] p-12 text-center">
            <Brain size={32} className="mx-auto text-[#FFFFFF]/20" />
            <p className="mt-4 text-sm text-[#FFFFFF]/45">
              Aucun type IA configuré.
            </p>
          </div>
        )}
      </div>
        </>
      )}
    </div>
  );
}

/* =========================================================
   RAPPORTS PDF
========================================================= */
function PDFReportsSection({ establishments }: { establishments: Establishment[] }) {
  const [selectedId, setSelectedId] = useState(establishments[0]?.id ?? '');
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedId && establishments[0]) setSelectedId(establishments[0].id);
  }, [establishments, selectedId]);

  const selected = establishments.find((e) => e.id === selectedId);

  const printReport = async (kind: 'reviews'|'loyalty'|'team'|'analytics'|'complete') => {
    if (!selected) return alert('Sélectionne un établissement.');
    setLoading(true);

    const since = new Date();
    since.setDate(since.getDate() - period);

    const [{ data: reviews }, { data: tx }, { data: redemptions }, { data: staffRows }, { count: events }] = await Promise.all([
      supabase.from('reviews').select('rating,type,comment,status,created_at').eq('establishment_id', selected.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false }),
      supabase.from('loyalty_transactions').select('amount,points,created_at').eq('establishment_id', selected.id).eq('type','EARN').gte('created_at', since.toISOString()),
      supabase.rpc('get_loyalty_redemptions_analytics', {
        p_since: since.toISOString(),
        p_establishment_id: selected.id,
      }),
      supabase.from('establishment_staff').select('role,active,created_at').eq('establishment_id', selected.id),
      supabase.from('analytics_events').select('id',{count:'exact',head:true}).eq('establishment_id', selected.id).gte('created_at', since.toISOString())
    ]);

    setLoading(false);

    const r = reviews ?? [];
    const t = tx ?? [];
    const red = redemptions ?? [];
    const team = staffRows ?? [];
    const avg = r.length ? (r.reduce((sum:any, x:any) => sum + Number(x.rating || 0), 0) / r.length).toFixed(1) : '—';
    const revenue = t.reduce((sum:any, x:any) => sum + Number(x.amount || 0), 0);
    const points = t.reduce((sum:any, x:any) => sum + Number(x.points || 0), 0);
    const rewardCost = red.reduce((sum:any, x:any) => sum + Number(x.reward_cost_mad || 0), 0);
    const positive = r.filter((x:any) => Number(x.rating) >= 4).length;
    const negative = r.filter((x:any) => Number(x.rating) <= 3).length;
    const title = kind === 'complete' ? 'Rapport de performance' : kind === 'reviews' ? 'Rapport réputation & avis' : kind === 'loyalty' ? 'Rapport fidélité' : kind === 'team' ? 'Rapport équipe' : 'Rapport analytics';
    const generatedAt = new Date();
    const periodLabel = `Du ${since.toLocaleDateString('fr-FR')} au ${generatedAt.toLocaleDateString('fr-FR')}`;

    const reportBlock = (heading:string, content:string) => `<section class="report-section"><div class="section-heading"><span></span><h2>${heading}</h2></div>${content}</section>`;
    const kpi = (label:string, value:string, note:string='') => `<div class="kpi"><div class="kpi-label">${label}</div><div class="kpi-value">${value}</div>${note ? `<div class="kpi-note">${note}</div>` : ''}</div>`;

    const reviewRows = r.slice(0, 80).map((x:any) => `
      <tr><td><span class="rating">${Number(x.rating).toFixed(0)}/5</span></td><td>${x.type === 'positive' ? '<span class="badge positive">Positif</span>' : '<span class="badge negative">À surveiller</span>'}</td><td>${new Date(x.created_at).toLocaleDateString('fr-FR')}</td><td>${escapeHtml(x.comment || 'Aucun commentaire')}</td></tr>
    `).join('');

    const reviewContent = `
      <div class="kpi-grid">
        ${kpi('Avis reçus', String(r.length), periodLabel)}
        ${kpi('Note moyenne', avg === '—' ? '—' : avg + ' / 5', 'Sur la période')}
        ${kpi('Avis positifs', String(positive), r.length ? Math.round(positive / r.length * 100) + '% du volume' : '')}
        ${kpi('À surveiller', String(negative), '3/5 ou moins')}
      </div>
      <div class="insight"><strong>Lecture de la période</strong><p>${r.length ? `L’établissement a reçu ${r.length} avis avec une note moyenne de ${avg}/5. ${positive} avis sont à 4/5 ou plus et ${negative} à 3/5 ou moins.` : 'Aucun avis enregistré sur la période sélectionnée.'}</p></div>
      ${reviewRows ? `<div class="table-wrap"><table><thead><tr><th>Note</th><th>Sentiment</th><th>Date</th><th>Commentaire</th></tr></thead><tbody>${reviewRows}</tbody></table></div>` : '<div class="empty">Aucun avis à afficher.</div>'}
    `;

    const loyaltyContent = `
      <div class="kpi-grid">
        ${kpi('CA fidélité', formatReportMad(revenue), 'Transactions EARN')}
        ${kpi('Transactions', String(t.length))}
        ${kpi('Points générés', points.toLocaleString('fr-FR'))}
        ${kpi('Récompenses utilisées', String(red.length))}
        ${kpi('Coût récompenses', formatReportMad(rewardCost))}
      </div>
      <div class="insight"><strong>Programme fidélité</strong><p>${t.length ? `Le programme a généré ${points.toLocaleString('fr-FR')} points sur ${t.length} transactions, pour ${formatReportMad(revenue)} de montant associé.` : 'Aucune transaction fidélité enregistrée sur la période sélectionnée.'}</p></div>
    `;

    const teamContent = `
      <div class="kpi-grid">
        ${kpi('Membres', String(team.length))}
        ${kpi('Actifs', String(team.filter((x:any)=>x.active).length))}
        ${kpi('Responsables', String(team.filter((x:any)=>x.role === 'MANAGER').length))}
        ${kpi('Staff', String(team.filter((x:any)=>x.role === 'STAFF').length))}
      </div>
    `;

    const analyticsContent = `
      <div class="kpi-grid">${kpi('Événements', String(events ?? 0), 'Analytics')}${kpi('Période', period + ' jours')}${kpi('Début', since.toLocaleDateString('fr-FR'))}${kpi('Fin', generatedAt.toLocaleDateString('fr-FR'))}</div>
      <div class="insight"><strong>Activité mesurée</strong><p>${events ?? 0} événements analytics ont été enregistrés sur la période sélectionnée.</p></div>
    `;

    let body = '';
    if (kind === 'reviews') body = reportBlock('Réputation & avis', reviewContent);
    if (kind === 'loyalty') body = reportBlock('Fidélité', loyaltyContent);
    if (kind === 'team') body = reportBlock('Équipe', teamContent);
    if (kind === 'analytics') body = reportBlock('Analytics', analyticsContent);
    if (kind === 'complete') body = reportBlock('Réputation & avis', reviewContent) + reportBlock('Fidélité', loyaltyContent) + reportBlock('Équipe', teamContent) + reportBlock('Analytics', analyticsContent);

    const html = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><title>${escapeHtml(title)} — ${escapeHtml(selected.name)}</title>
<style>
@page{size:A4;margin:16mm 15mm 18mm}
*{box-sizing:border-box}body{margin:0;background:#fff;color:#FFFFFF;font-family:Inter,Arial,Helvetica,sans-serif;font-size:11px;line-height:1.55}
.page{max-width:800px;margin:auto}.cover{padding:0 0 26px;border-bottom:2px solid #686D76;margin-bottom:24px}
.brand{display:flex;justify-content:space-between;align-items:center;padding:8px 0 22px;border-bottom:1px solid #242424}
.brand-logo{display:flex;align-items:center}.brand-logo img{display:block;width:150px;height:auto;max-height:42px;object-fit:contain;object-position:left center}
.doc-type{font-size:9px;text-transform:uppercase;letter-spacing:2px;color:#B0B0B0;font-weight:700}
h1{font-size:31px;line-height:1.08;letter-spacing:-1.2px;margin:28px 0 8px;color:#686D76} .subtitle{font-size:13px;color:#B0B0B0;margin:0}
.meta{display:flex;gap:24px;flex-wrap:wrap;margin-top:20px;color:#B0B0B0;font-size:10px}.meta strong{display:block;color:#686D76;font-size:11px;margin-bottom:2px}
.report-section{margin-top:28px;break-inside:auto}.section-heading{display:flex;align-items:center;gap:9px;border-bottom:1px solid #242424;padding-bottom:9px;margin-bottom:13px}.section-heading span{width:4px;height:20px;border-radius:4px;background:#00DFA5}.section-heading h2{font-size:18px;color:#686D76;margin:0}
.kpi-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:12px 0}.kpi{border:1px solid #242424;border-radius:10px;padding:12px;background:#111111;min-height:76px}.kpi-label{font-size:8px;text-transform:uppercase;letter-spacing:1px;color:#B0B0B0;font-weight:700}.kpi-value{font-size:19px;font-weight:800;color:#686D76;margin-top:5px}.kpi-note{font-size:8px;color:#B0B0B0;margin-top:2px}
.insight{border-left:3px solid #00DFA5;background:#111111;padding:12px 14px;margin:15px 0;border-radius:0 8px 8px 0}.insight strong{color:#686D76}.insight p{margin:3px 0 0;color:#B0B0B0}
.table-wrap{border:1px solid #242424;border-radius:10px;overflow:hidden;margin-top:15px}table{width:100%;border-collapse:collapse}th{background:#686D76;color:#fff;text-align:left;font-size:8px;text-transform:uppercase;letter-spacing:.7px;padding:8px}td{padding:8px;border-bottom:1px solid #eee;font-size:9px;vertical-align:top}tr:last-child td{border-bottom:0}.rating{font-weight:800;color:#686D76}.badge{display:inline-block;padding:2px 6px;border-radius:99px;font-size:8px;font-weight:700}.positive{background:#111111;color:#686D76}.negative{background:#111111;color:#686D76}.empty{text-align:center;border:1px dashed #242424;padding:20px;color:#B0B0B0;border-radius:9px}
.footer{margin-top:35px;padding-top:12px;border-top:1px solid #242424;display:flex;justify-content:space-between;color:#B0B0B0;font-size:8px}.conf{color:#686D76;font-weight:700}
@media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact}.no-print{display:none!important}.report-section{break-inside:auto}.table-wrap{break-inside:auto}thead{display:table-header-group}}
</style></head><body><div class="page">
<div class="cover"><div class="brand"><div class="brand-logo"><img src="/kelyani-official-app-icon.webp" alt="KELYANI"></div><div class="doc-type">Rapport de performance</div></div>
<h1>${escapeHtml(title)}</h1><p class="subtitle">${escapeHtml(selected.name)}</p>
<div class="meta"><div><strong>Période</strong>${escapeHtml(periodLabel)}</div><div><strong>Généré le</strong>${generatedAt.toLocaleString('fr-FR')}</div><div><strong>Document</strong>Confidentiel</div></div></div>
${body}
<div class="footer"><span><img src="/kelyani-official-app-icon.webp" alt="KELYANI" style="height:18px;width:auto;object-fit:contain;display:block" /></span><span class="conf">${escapeHtml(selected.name)} · Document confidentiel</span></div>
</div></body></html>`;

    const win = window.open('', '_blank', 'width=1000,height=900');
    if (!win) return alert('Autorise les fenêtres popup pour générer le PDF.');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 350);
  };

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#00DFA5]/50">Reporting</p>
        <h2 className="font-display text-3xl text-[#00DFA5] md:text-4xl">Rapports PDF</h2>
        <p className="mt-2 max-w-2xl text-sm text-[#FFFFFF]/50">Générez des rapports structurés avec en-tête, indicateurs, tableaux et synthèse pour chaque établissement.</p>
      </div>
      <div className="rounded-3xl border border-[#242424] bg-[#111111] p-6 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block"><span className="mb-2 block text-xs font-semibold">Établissement</span><select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm">{establishments.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
          <label className="block"><span className="mb-2 block text-xs font-semibold">Période</span><select value={period} onChange={e=>setPeriod(Number(e.target.value))} className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-sm"><option value={7}>7 jours</option><option value={15}>15 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option><option value={180}>180 jours</option><option value={365}>365 jours</option></select></label>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {([['reviews','Avis & réputation'],['loyalty','Fidélité'],['team','Équipe'],['analytics','Analytics'],['complete','Rapport complet']] as const).map(([id,label])=><button key={id} onClick={()=>printReport(id)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-xs font-semibold text-[#00DFA5] hover:bg-[#111111] disabled:opacity-40"><Printer size={15}/>{loading?'Préparation…':label}</button>)}
        </div>
        <p className="mt-5 text-[11px] text-[#FFFFFF]/35">Le rapport s’ouvre dans une page imprimable A4 : choisissez « Enregistrer au format PDF » dans l’impression du navigateur.</p>
      </div>
    </div>
  );
}

function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#686D76;'}[char] as string)); }
function formatReportMad(value: number) { return `${value.toLocaleString('fr-FR',{minimumFractionDigits:0,maximumFractionDigits:0})} DH`; }

/* =========================================================
   EMPTY
========================================================= */

function EmptyStaff({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-3xl border border-[#242424] bg-[#111111] p-12 text-center shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#111111]/10 text-[#00DFA5]">
        <Icon size={25} />
      </div>

      <h3 className="mt-5 text-base font-semibold">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-[#FFFFFF]/45">
        {description}
      </p>
    </div>
  );
}


/* =========================================================
   BILLING
========================================================= */

function BillingSection({
  establishments,
  billing,
  reload,
}: {
  establishments: Establishment[];
  billing: BillingSnapshot;
  reload: () => Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [plan, setPlan] = useState('all');
  const [editingPlan, setEditingPlan] = useState<BillingPlan | null>(null);
  const [showPlanEditor, setShowPlanEditor] = useState(false);
  const [planForm, setPlanForm] = useState({ name: '', price_mad: '', interval: 'month', features: '' });
  const [savingPlan, setSavingPlan] = useState(false);
  const [assignmentEstablishmentId, setAssignmentEstablishmentId] = useState('');
  const [assignmentPlanId, setAssignmentPlanId] = useState('');
  const [assignmentStatus, setAssignmentStatus] = useState<'active' | 'trial'>('active');
  const [assignmentTrialDays, setAssignmentTrialDays] = useState('14');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [editingSubscription, setEditingSubscription] = useState<BillingSubscription | null>(null);
  const [subscriptionForm, setSubscriptionForm] = useState({
    planId: '',
    status: 'active' as 'active' | 'trial' | 'past_due' | 'unpaid' | 'canceled',
    trialDays: '14',
    startedAt: '',
    periodEnd: '',
  });

  const openPlanEditor = (value?: BillingPlan) => {
    setEditingPlan(value ?? null);
    setShowPlanEditor(true);
    setPlanForm({
      name: value?.name ?? '',
      price_mad: value ? String(value.price_mad) : '',
      interval: value?.interval ?? 'month',
      features: (value?.features ?? []).join('\n'),
    });
  };

  const savePlan = async () => {
    const name = planForm.name.trim();
    const price = Number(planForm.price_mad);
    const features = planForm.features.split('\n').map((x) => x.trim()).filter(Boolean);
    if (!name) return alert('Le nom du plan est obligatoire.');
    if (!Number.isFinite(price) || price < 0) return alert('Le prix doit être un montant valide.');
    setSavingPlan(true);
    const payload = { name, price_mad: price, interval: planForm.interval, features };
    const result = editingPlan
      ? await supabase.from('subscription_plans').update(payload).eq('id', editingPlan.id)
      : await supabase.from('subscription_plans').insert({ ...payload, active: true });
    setSavingPlan(false);
    if (result.error) return alert(`Impossible d'enregistrer le plan : ${result.error.message}`);
    setEditingPlan(null);
    setShowPlanEditor(false);
    setPlanForm({ name: '', price_mad: '', interval: 'month', features: '' });
    await reload();
  };

  const togglePlanActive = async (value: BillingPlan) => {
    const { error } = await supabase.from('subscription_plans').update({ active: !value.active }).eq('id', value.id);
    if (error) return alert(`Impossible de modifier le plan : ${error.message}`);
    await reload();
  };

  const deletePlan = async (value: BillingPlan) => {
    const used = billing.subscriptions.some((sub) => sub.plan_id === value.id);
    if (used) return alert('Ce plan est utilisé par un abonnement. Désactive-le plutôt que de le supprimer.');
    if (!confirm(`Supprimer le plan « ${value.name} » ?`)) return;
    const { error } = await supabase.from('subscription_plans').delete().eq('id', value.id);
    if (error) return alert(`Impossible de supprimer le plan : ${error.message}`);
    await reload();
  };

  const toLocalDateTimeInput = (value: string | null) => {
    if (!value) return '';
    const date = new Date(value);
    const pad = (part: number) => String(part).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const toIsoDate = (value: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  };

  const openSubscriptionEditor = (subscription: BillingSubscription) => {
    setEditingSubscription(subscription);
    setSubscriptionForm({
      planId: subscription.plan_id,
      status: ['active', 'trial', 'past_due', 'unpaid', 'canceled'].includes(subscription.status)
        ? subscription.status as 'active' | 'trial' | 'past_due' | 'unpaid' | 'canceled'
        : 'active',
      trialDays: String(Math.max(1, subscription.trial_days || 14)),
      startedAt: toLocalDateTimeInput(subscription.started_at),
      periodEnd: toLocalDateTimeInput(subscription.current_period_end),
    });
  };

  const closeSubscriptionEditor = () => {
    if (savingAssignment) return;
    setEditingSubscription(null);
  };

  const assignSubscription = async () => {
    if (!assignmentEstablishmentId || !assignmentPlanId) {
      return alert('Sélectionnez un établissement et un pack.');
    }

    const selectedPlan = billing.plans.find((item) => item.id === assignmentPlanId);
    if (!selectedPlan) return alert('Pack introuvable.');

    setSavingAssignment(true);
    const { error } = await supabase.rpc('assign_subscription_to_establishment', {
      p_establishment_id: assignmentEstablishmentId,
      p_plan_id: assignmentPlanId,
      p_status: assignmentStatus,
      p_trial_days: assignmentStatus === 'trial' ? Math.max(1, Number(assignmentTrialDays) || 14) : 0,
    });
    setSavingAssignment(false);

    if (error) {
      return alert(`Impossible d'attribuer le pack : ${error.message}`);
    }

    await reload();
    alert(`Le pack « ${selectedPlan.name} » a été attribué à l'établissement.`);
  };

  const saveSubscriptionEdit = async () => {
    if (!editingSubscription || !subscriptionForm.planId) {
      return alert('Sélectionnez un pack.');
    }

    const selectedPlan = billing.plans.find((item) => item.id === subscriptionForm.planId);
    if (!selectedPlan) return alert('Pack introuvable.');

    const startedAt = toIsoDate(subscriptionForm.startedAt);
    const periodEnd = toIsoDate(subscriptionForm.periodEnd);
    if (!startedAt || !periodEnd) {
      return alert('La date de début et la date de fin sont obligatoires.');
    }

    if (new Date(periodEnd).getTime() <= new Date(startedAt).getTime()) {
      return alert('La date de fin doit être postérieure à la date de début.');
    }

    const trialDays = subscriptionForm.status === 'trial'
      ? Math.max(1, Number(subscriptionForm.trialDays) || 14)
      : 0;

    setSavingAssignment(true);
    const { error } = await supabase.rpc('assign_subscription_to_establishment', {
      p_establishment_id: editingSubscription.establishment_id,
      p_plan_id: subscriptionForm.planId,
      p_status: subscriptionForm.status,
      p_trial_days: trialDays,
      p_started_at: startedAt,
      p_period_end: periodEnd,
    });
    setSavingAssignment(false);

    if (error) {
      return alert(`Impossible de modifier l'abonnement : ${error.message}`);
    }

    await reload();
    setEditingSubscription(null);
    alert(`L'abonnement de « ${establishmentMap.get(editingSubscription.establishment_id)?.name ?? 'cet établissement'} » a été mis à jour.`);
  };

  const establishmentMap = useMemo(
    () => new Map(establishments.map((e) => [e.id, e])),
    [establishments]
  );

  const filtered = billing.subscriptions.filter((sub) => {
    const e = establishmentMap.get(sub.establishment_id);
    const nameMatch = !search.trim() || e?.name.toLowerCase().includes(search.trim().toLowerCase());
    const statusMatch = status === 'all' || sub.status === status;
    const planMatch = plan === 'all' || sub.plan_id === plan;
    return nameMatch && statusMatch && planMatch;
  });

  const formatDate = (value: string | null) =>
    value ? new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value)) : '—';

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#00DFA5]/50">Business</p>
          <h2 className="font-display text-3xl text-[#00DFA5] md:text-4xl">Abonnements & facturation</h2>
          <p className="mt-2 text-sm text-[#FFFFFF]/50">Pilotez les plans, abonnements, paiements et échéances de vos commerces clients.</p>
        </div>
        <button onClick={reload} className="rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-3 text-xs font-semibold">Actualiser</button>
      </div>

      {!billing.available ? (
        <div className="mb-6 rounded-3xl border border-[#242424] bg-[#111111] p-5 text-sm text-[#00DFA5]">
          <strong>Module facturation non configuré.</strong> Les tables d’abonnement doivent être présentes dans Supabase pour activer le suivi réel.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={WalletCards} label="MRR" value={billing.available ? `${billing.mrr.toLocaleString('fr-FR', { maximumFractionDigits: 2 })} MAD` : '—'} />
        <StatCard icon={CreditCard} label="Plans actifs" value={billing.available ? billing.plans.filter((p) => p.active).length : '—'} />
        <StatCard icon={AlertTriangle} label="Paiements échoués" value={billing.available ? billing.failedPayments : '—'} />
        <StatCard icon={CalendarDays} label="Renouvellements < 30 j." value={billing.available ? billing.upcomingRenewals : '—'} />
      </div>

      <div className="mt-6 rounded-3xl border border-[#242424] bg-[#111111] p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-[#FFFFFF]/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un commerce..." className="w-full rounded-xl border border-[#242424]/10 bg-[#111111] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#242424]" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2.5 text-sm">
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="trial">Essai</option>
            <option value="past_due">En retard</option>
            <option value="unpaid">Impayé</option>
            <option value="canceled">Annulé</option>
          </select>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2.5 text-sm">
            <option value="all">Tous les plans</option>
            {billing.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[#242424]/10 bg-[#111111] p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-end">
          <div>
            <h3 className="text-sm font-semibold">Attribuer un pack à un établissement</h3>
            <p className="mt-1 text-xs text-[#FFFFFF]/45">Le pack devient immédiatement le pack actif de l’établissement. En période d’essai, l’interface responsable conserve le thème standard.</p>
          </div>
          <span className="rounded-full bg-[#111111]/5 px-3 py-1.5 text-[10px] font-semibold text-[#00DFA5]">Admin uniquement</span>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-[1.3fr_1fr_.8fr_.7fr_auto]">
          <select value={assignmentEstablishmentId} onChange={(e) => setAssignmentEstablishmentId(e.target.value)} className="rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2.5 text-sm outline-none focus:border-[#242424]">
            <option value="">Établissement</option>
            {establishments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select value={assignmentPlanId} onChange={(e) => setAssignmentPlanId(e.target.value)} className="rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2.5 text-sm outline-none focus:border-[#242424]">
            <option value="">Pack</option>
            {billing.plans.filter((item) => item.active).map((item) => <option key={item.id} value={item.id}>{item.name} · {Number(item.price_mad).toLocaleString('fr-FR')} MAD</option>)}
          </select>
          <select value={assignmentStatus} onChange={(e) => setAssignmentStatus(e.target.value as 'active' | 'trial')} className="rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2.5 text-sm outline-none focus:border-[#242424]">
            <option value="active">Actif</option>
            <option value="trial">Essai</option>
          </select>
          <input type="number" min="1" max="90" value={assignmentTrialDays} onChange={(e) => setAssignmentTrialDays(e.target.value)} disabled={assignmentStatus !== 'trial'} className="rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2.5 text-sm outline-none disabled:opacity-40" placeholder="Jours essai" />
          <button type="button" onClick={assignSubscription} disabled={savingAssignment} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-4 py-2.5 text-xs font-semibold text-[#FFFFFF] disabled:opacity-50">
            <CheckCircle2 size={14} /> {savingAssignment ? 'Attribution…' : 'Attribuer'}
          </button>
        </div>
      </div>

      <div className="mt-6 overflow-x-auto rounded-3xl border border-[#242424] bg-[#111111] shadow-sm">
        <div className="grid min-w-[760px] grid-cols-[1.5fr_1fr_.8fr_1fr_1fr] gap-4 border-b border-[#242424] px-5 py-4 text-[10px] font-semibold uppercase tracking-wider text-[#FFFFFF]/35">
          <span>Commerce</span><span>Plan</span><span>Statut</span><span>MRR</span><span>Échéance</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#FFFFFF]/40">Aucun abonnement correspondant.</div>
        ) : (
          filtered.map((sub) => {
            const e = establishmentMap.get(sub.establishment_id);
            return (
              <div key={sub.id} className="grid min-w-[900px] grid-cols-[1.35fr_1fr_.8fr_1fr_1fr_auto] items-center gap-4 border-b border-[#242424] px-5 py-4 text-sm last:border-0">
                <div><p className="font-semibold">{e?.name ?? 'Établissement supprimé'}</p><p className="text-xs text-[#FFFFFF]/35">{e?.city ?? 'Ville non définie'}</p></div>
                <span>{sub.plan?.name ?? '—'}</span>
                <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold ${sub.status === 'active' ? 'bg-[#111111] text-[#00DFA5]' : sub.status === 'trial' ? 'bg-[#111111] text-[#00DFA5]' : 'bg-[#111111] text-[#B0B0B0]'}`}>{sub.status}</span>
                <span className="font-semibold">{Number(sub.plan?.price_mad ?? 0).toLocaleString('fr-FR')} MAD</span>
                <span className="text-[#FFFFFF]/50">{formatDate(sub.current_period_end)}</span>
                <button type="button" onClick={() => openSubscriptionEditor(sub)} className="rounded-lg border border-[#242424]/10 bg-[#111111] px-3 py-2 text-[11px] font-semibold text-[#00DFA5] transition hover:border-[#00DFA5] hover:bg-[#111111]">
                  Modifier
                </button>
              </div>
            );
          })
        )}
      </div>

      {editingSubscription ? (
        <div className="fixed inset-0 z-[80] overflow-y-auto bg-[#111111]/50 p-4 backdrop-blur-sm sm:p-8">
          <div className="mx-auto min-h-full max-w-4xl flex items-center">
            <div className="w-full overflow-hidden rounded-3xl bg-[#111111] shadow-2xl">
              <div className="flex items-start justify-between gap-4 border-b border-[#242424]/10 bg-[#111111] px-6 py-5 sm:px-8">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#00DFA5]/50">Gestion abonnement</p>
                  <h3 className="mt-1 font-display text-2xl text-[#00DFA5]">Modifier l’abonnement</h3>
                  <p className="mt-1 text-xs text-[#FFFFFF]/45">
                    {establishmentMap.get(editingSubscription.establishment_id)?.name ?? 'Établissement'}
                  </p>
                </div>
                <button type="button" onClick={closeSubscriptionEditor} className="grid h-10 w-10 place-items-center rounded-xl border border-[#242424]/10 bg-[#111111] text-[#FFFFFF]/55 hover:bg-[#111111]" aria-label="Fermer">
                  <X size={18} />
                </button>
              </div>

              <div className="p-6 sm:p-8">
                <div className="grid gap-5 md:grid-cols-2">
                  <label className="text-xs font-semibold">
                    Pack
                    <select
                      value={subscriptionForm.planId}
                      onChange={(e) => setSubscriptionForm((v) => ({ ...v, planId: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-3 text-sm font-normal outline-none focus:border-[#242424]"
                    >
                      {billing.plans.filter((item) => item.active || item.id === subscriptionForm.planId).map((item) => (
                        <option key={item.id} value={item.id}>{item.name} · {Number(item.price_mad).toLocaleString('fr-FR')} MAD/{item.interval === 'year' ? 'an' : 'mois'}</option>
                      ))}
                    </select>
                  </label>

                  <label className="text-xs font-semibold">
                    Statut
                    <select
                      value={subscriptionForm.status}
                      onChange={(e) => setSubscriptionForm((v) => ({ ...v, status: e.target.value as typeof v.status }))}
                      className="mt-2 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-3 text-sm font-normal outline-none focus:border-[#242424]"
                    >
                      <option value="active">Actif</option>
                      <option value="trial">Période d’essai</option>
                      <option value="past_due">Paiement en retard</option>
                      <option value="unpaid">Impayé</option>
                      <option value="canceled">Annulé</option>
                    </select>
                  </label>

                  <label className="text-xs font-semibold">
                    Date de début
                    <input
                      type="datetime-local"
                      value={subscriptionForm.startedAt}
                      onChange={(e) => setSubscriptionForm((v) => ({ ...v, startedAt: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-3 text-sm font-normal outline-none focus:border-[#242424]"
                    />
                  </label>

                  <label className="text-xs font-semibold">
                    Date de fin / échéance
                    <input
                      type="datetime-local"
                      value={subscriptionForm.periodEnd}
                      onChange={(e) => setSubscriptionForm((v) => ({ ...v, periodEnd: e.target.value }))}
                      className="mt-2 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-3 text-sm font-normal outline-none focus:border-[#242424]"
                    />
                  </label>

                  <label className="text-xs font-semibold">
                    Durée de l’essai
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={subscriptionForm.trialDays}
                      onChange={(e) => setSubscriptionForm((v) => ({ ...v, trialDays: e.target.value }))}
                      disabled={subscriptionForm.status !== 'trial'}
                      className="mt-2 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-3 text-sm font-normal outline-none focus:border-[#242424] disabled:bg-[#111111]/5 disabled:text-[#FFFFFF]/30"
                    />
                    <span className="mt-1 block text-[10px] font-normal text-[#FFFFFF]/40">Utilisé lorsque le statut est « Période d’essai ».</span>
                  </label>

                  <div className="rounded-xl border border-[#242424]/10 bg-[#111111] p-4">
                    <p className="text-xs font-semibold">Prolonger rapidement l’échéance</p>
                    <p className="mt-1 text-[10px] text-[#FFFFFF]/40">Ajoute des jours à la date de fin actuelle.</p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {[7, 30, 90].map((days) => (
                        <button
                          key={days}
                          type="button"
                          onClick={() => {
                            const current = subscriptionForm.periodEnd ? new Date(subscriptionForm.periodEnd) : new Date();
                            current.setDate(current.getDate() + days);
                            setSubscriptionForm((v) => ({ ...v, periodEnd: toLocalDateTimeInput(current.toISOString()) }));
                          }}
                          className="rounded-lg border border-[#242424]/10 bg-[#111111] px-3 py-2 text-[11px] font-semibold text-[#00DFA5] hover:border-[#00DFA5] hover:bg-[#111111]"
                        >
                          +{days} jours
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-6 rounded-2xl border border-[#00DFA5]/20 bg-[#111111] p-4 text-xs text-[#FFFFFF]/60">
                  <strong className="text-[#FFFFFF]">Modification immédiate :</strong> le responsable verra le nouveau pack et les nouvelles dates dès que son abonnement sera rechargé. Les fonctionnalités restent déterminées par le pack sélectionné.
                </div>

                <div className="mt-7 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                  <button type="button" onClick={closeSubscriptionEditor} disabled={savingAssignment} className="rounded-xl border border-[#242424]/10 bg-[#111111] px-5 py-3 text-xs font-semibold disabled:opacity-50">
                    Annuler
                  </button>
                  <button type="button" onClick={saveSubscriptionEdit} disabled={savingAssignment} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-5 py-3 text-xs font-semibold text-[#FFFFFF] disabled:opacity-50">
                    <Save size={14} />
                    {savingAssignment ? 'Enregistrement…' : 'Enregistrer les modifications'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-8 rounded-3xl border border-[#242424] bg-[#111111] p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h3 className="text-sm font-semibold">Plans & fonctionnalités</h3>
            <p className="mt-1 text-xs text-[#FFFFFF]/45">Crée, modifie les prix et définis précisément ce que chaque abonnement inclut.</p>
          </div>
          <button onClick={() => openPlanEditor()} className="inline-flex items-center gap-2 rounded-xl bg-[#111111] px-4 py-2.5 text-xs font-semibold text-[#FFFFFF]"><Plus size={14} /> Nouveau plan</button>
        </div>

        {showPlanEditor ? (
          <div className="mt-5 rounded-2xl border border-[#242424]/10 bg-[#111111] p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold">Nom du plan<input value={planForm.name} onChange={(e) => setPlanForm((v) => ({ ...v, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#242424]" placeholder="Premium" /></label>
              <label className="text-xs font-semibold">Prix (MAD)<input type="number" min="0" value={planForm.price_mad} onChange={(e) => setPlanForm((v) => ({ ...v, price_mad: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2.5 text-sm font-normal outline-none focus:border-[#242424]" placeholder="499" /></label>
              <label className="text-xs font-semibold">Facturation<select value={planForm.interval} onChange={(e) => setPlanForm((v) => ({ ...v, interval: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2.5 text-sm font-normal"><option value="month">Mensuelle</option><option value="year">Annuelle</option></select></label>
            </div>
            <label className="mt-4 block text-xs font-semibold">Fonctionnalités incluses <span className="font-normal text-[#FFFFFF]/40">(une fonctionnalité par ligne)</span>
              <textarea rows={6} value={planForm.features} onChange={(e) => setPlanForm((v) => ({ ...v, features: e.target.value }))} className="mt-1 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-3 text-sm font-normal outline-none focus:border-[#242424]" placeholder={"Page publique\nAvis & réputation\nFidélité\nMenu\nPromotions\nAnalytics\nAssistant IA"} />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setEditingPlan(null); setShowPlanEditor(false); setPlanForm({ name: '', price_mad: '', interval: 'month', features: '' }); }} className="rounded-xl border border-[#242424]/10 bg-[#111111] px-4 py-2.5 text-xs font-semibold">Annuler</button>
              <button onClick={savePlan} disabled={savingPlan} className="inline-flex items-center gap-2 rounded-xl bg-[#111111] px-4 py-2.5 text-xs font-semibold text-[#FFFFFF] disabled:opacity-50"><Save size={14} /> {savingPlan ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {billing.plans.map((p) => (
            <div key={p.id} className="rounded-3xl border border-[#242424] bg-[#111111] p-5">
              <div className="flex items-start justify-between gap-3"><div><strong className="text-[#00DFA5]">{p.name}</strong><p className="mt-1 text-xs text-[#FFFFFF]/40">{p.interval === 'year' ? 'Annuel' : 'Mensuel'} · {p.active ? 'Actif' : 'Inactif'}</p></div><span className="text-lg font-semibold">{Number(p.price_mad).toLocaleString('fr-FR')} MAD</span></div>
              <div className="mt-4 space-y-1.5">{(p.features ?? []).length ? (p.features ?? []).map((feature) => <div key={feature} className="flex gap-2 text-xs text-[#FFFFFF]/60"><span className="text-[#00DFA5]">✓</span>{feature}</div>) : <p className="text-xs text-[#FFFFFF]/35">Aucune fonctionnalité définie.</p>}</div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => openPlanEditor(p)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2 text-xs font-semibold"><Pencil size={13} /> Modifier</button>
                <button onClick={() => togglePlanActive(p)} className="rounded-xl border border-[#242424]/10 bg-[#111111] px-3 py-2 text-xs font-semibold">{p.active ? 'Désactiver' : 'Activer'}</button>
                <button onClick={() => deletePlan(p)} title="Supprimer" className="rounded-xl border border-[#242424] bg-[#111111] px-3 py-2 text-[#00DFA5]"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoogleWalletStagingPanel() {
  const [walletCheck, setWalletCheck] = useState<{ status: 'idle' | 'loading' | 'ok' | 'error'; detail: string; checkedAt?: string }>({ status: 'idle', detail: '' });

  const runWalletCheck = async () => {
    setWalletCheck({ status: 'loading', detail: 'Vérification des secrets et de l’accès Google Wallet…' });
    try {
      const { data, error } = await supabase.functions.invoke('google-wallet-staging-check', { body: {} });
      if (error) throw new Error(error.message || 'Échec de l’appel Edge Function');
      if (!data?.success) throw new Error(data?.error || 'La vérification Google Wallet a échoué');
      setWalletCheck({ status: 'ok', detail: data.message || 'Authentification et API Google Wallet accessibles.', checkedAt: new Date().toISOString() });
    } catch (error) {
      setWalletCheck({ status: 'error', detail: error instanceof Error ? error.message : 'Erreur inconnue', checkedAt: new Date().toISOString() });
    }
  };

  return (
    <div className="mb-6 rounded-3xl border border-[#686D76]/40 bg-[#111111] p-6 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/40">Google Wallet · Staging</p>
          <h3 className="mt-2 text-lg font-semibold text-white">Test de connexion Google Wallet</h3>
          <p className="mt-1 max-w-2xl text-xs leading-5 text-white/50">Vérifie les secrets serveur, l’authentification du compte de service et l’accès à l’Issuer. Aucun pass ni donnée client n’est créé ou modifié.</p>
        </div>
        <button type="button" onClick={() => void runWalletCheck()} disabled={walletCheck.status === 'loading'} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#686D76] px-4 py-3 text-xs font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw size={14} className={walletCheck.status === 'loading' ? 'animate-spin' : ''} />
          {walletCheck.status === 'loading' ? 'Test en cours…' : 'Tester Google Wallet'}
        </button>
      </div>
      {walletCheck.status !== 'idle' && (
        <div className="mt-4 rounded-xl border border-[#686D76] bg-[#050505] p-4 text-xs leading-5 text-white/70">
          <div className="flex items-center gap-2 font-semibold">
            {walletCheck.status === 'ok' ? <CheckCircle2 size={15} /> : walletCheck.status === 'error' ? <AlertTriangle size={15} /> : <RefreshCw size={15} className="animate-spin" />}
            {walletCheck.status === 'ok' ? 'Connexion validée' : walletCheck.status === 'error' ? 'Test non validé' : 'Vérification en cours'}
          </div>
          <p className="mt-2 break-words">{walletCheck.detail}</p>
          {walletCheck.checkedAt && <p className="mt-2 text-[10px] opacity-60">Dernier test : {new Date(walletCheck.checkedAt).toLocaleString('fr-FR')}</p>}
        </div>
      )}
    </div>
  );
}
function SystemSection({
  billing,
  globalStats,
  establishments,
}: {
  billing: BillingSnapshot;
  globalStats: GlobalStats;
  establishments: Establishment[];}) {
  const SystemMetric = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-3xl border border-[#242424] bg-[#111111] p-5 shadow-sm">
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#FFFFFF]/35">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-[#00DFA5]">{value}</p>
    </div>  );

  type CheckStatus = 'checking' | 'ok' | 'error';

  type Check = {
    label: string;
    status: CheckStatus;
    detail: string;
    icon: typeof ShieldCheck;
  };

  const [checks, setChecks] = useState<Check[]>([]);
  const [checking, setChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<string | null>(null);

  const runChecks = async () => {
    setChecking(true);

    const next: Check[] = [
      { label: 'Base de données Supabase', status: 'checking', detail: 'Connexion en cours…', icon: ShieldCheck },
      { label: 'Session administrateur', status: 'checking', detail: 'Vérification en cours…', icon: LockKeyhole },
      { label: 'Configuration IA', status: 'checking', detail: 'Vérification en cours…', icon: Brain },
      { label: 'Fonction Analyse IA', status: 'checking', detail: 'Vérification du service…', icon: Activity },
      { label: 'Établissements', status: 'checking', detail: 'Vérification en cours…', icon: Building2 },
      { label: 'Analytics', status: 'checking', detail: 'Vérification en cours…', icon: TrendingUp },
      { label: 'Facturation', status: 'checking', detail: 'Vérification en cours…', icon: CreditCard },
    ];

    setChecks(next);

    try {
      const { error } = await supabase.from('establishments').select('id', { count: 'exact', head: true });
      next[0] = error
        ? { ...next[0], status: 'error', detail: error.message }
        : { ...next[0], status: 'ok', detail: 'Connexion Supabase opérationnelle' };
    } catch (error) {
      next[0] = { ...next[0], status: 'error', detail: error instanceof Error ? error.message : 'Erreur inconnue' };
    }

    try {
      const { data, error } = await supabase.auth.getUser();
      next[1] = error || !data.user
        ? { ...next[1], status: 'error', detail: error?.message ?? 'Aucune session administrateur active' }
        : { ...next[1], status: 'ok', detail: data.user.email ?? 'Session active' };
    } catch (error) {
      next[1] = { ...next[1], status: 'error', detail: error instanceof Error ? error.message : 'Erreur inconnue' };
    }

    try {
      const { data, error } = await supabase.rpc('admin_get_ai_settings');
      const settings = Array.isArray(data) ? data[0] : data;
      next[2] = error
        ? { ...next[2], status: 'error', detail: error.message }
        : { ...next[2], status: settings ? 'ok' : 'error', detail: settings ? 'Configuration IA accessible' : 'Aucune configuration IA trouvée' };
    } catch (error) {
      next[2] = { ...next[2], status: 'error', detail: error instanceof Error ? error.message : 'Erreur inconnue' };
    }

    try {
      const { data, error } = await supabase.functions.invoke('analyze-reviews', { body: { health_check: true } });
      if (error) {
        next[3] = { ...next[3], status: 'error', detail: error.message };
      } else if (data?.success === false && data?.error) {
        const noReviews = data.error.includes('Aucun avis');
        next[3] = { ...next[3], status: noReviews ? 'ok' : 'error', detail: noReviews ? 'Fonction accessible (aucun avis à analyser)' : data.error };
      } else {
        next[3] = { ...next[3], status: 'ok', detail: 'Fonction accessible' };
      }
    } catch (error) {
      next[3] = { ...next[3], status: 'error', detail: error instanceof Error ? error.message : 'Fonction inaccessible' };
    }

    next[4] = {
      ...next[4],
      status: establishments.length > 0 ? 'ok' : 'error',
      detail: establishments.length > 0 ? `${establishments.length} établissement${establishments.length > 1 ? 's' : ''} chargé${establishments.length > 1 ? 's' : ''}` : 'Aucun établissement chargé',
    };
    try {
      const { count, error } = await supabase
        .from('analytics_events')
        .select('id', { count: 'exact', head: true });
      next[5] = error
        ? { ...next[5], status: 'error', detail: error.message }
        : { ...next[5], status: 'ok', detail: `${(count ?? 0).toLocaleString('fr-FR')} événements analytics accessibles` };
    } catch (error) {
      next[5] = { ...next[5], status: 'error', detail: error instanceof Error ? error.message : 'Erreur inconnue' };
    }
    next[6] = {
      ...next[6],
      status: billing.available ? 'ok' : 'error',
      detail: billing.available ? `${billing.subscriptions.length} abonnement${billing.subscriptions.length > 1 ? 's' : ''} chargé${billing.subscriptions.length > 1 ? 's' : ''}` : 'Tables de facturation indisponibles ou non configurées',
    };
    setChecks(next);
    setLastChecked(new Date().toISOString());
    setChecking(false);
  };

  useEffect(() => {
    void runChecks();
  }, []);

  const okCount = checks.filter((check) => check.status === 'ok').length;
  const errorCount = checks.filter((check) => check.status === 'error').length;

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#00DFA5]/50">Plateforme</p>
          <h2 className="font-display text-3xl text-[#00DFA5] md:text-4xl">Supervision technique</h2>
          <p className="mt-2 max-w-2xl text-sm text-[#FFFFFF]/50">Diagnostic en temps réel des services critiques accessibles depuis l’Admin.</p>
        </div>
        <button onClick={() => void runChecks()} disabled={checking} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#111111] px-4 py-3 text-xs font-semibold text-[#FFFFFF] disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Vérification…' : 'Relancer le diagnostic'}
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <SystemMetric label="Contrôles OK" value={okCount} />
        <SystemMetric label="Erreurs" value={errorCount} />
        <SystemMetric label="Établissements" value={establishments.length} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {checks.map(({ label, status, detail, icon: Icon }) => (
          <div key={label} className="rounded-3xl border border-[#242424] bg-[#111111] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#111111]/10 text-[#00DFA5]"><Icon size={20} /></div>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${
                status === 'ok' ? 'bg-[#111111] text-[#00DFA5]' : status === 'error' ? 'bg-[#111111] text-[#00DFA5]' : 'bg-[#111111] text-[#00DFA5]'
              }`}>{status === 'ok' ? 'Opérationnel' : status === 'error' ? 'Erreur' : 'Vérification…'}</span>
            </div>
            <h3 className="mt-5 text-base font-semibold">{label}</h3>
            <p className="mt-2 break-words text-xs leading-5 text-[#FFFFFF]/45">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-3xl border border-[#242424] bg-[#111111] p-6 shadow-sm">
        <div className="flex items-center gap-3"><Filter size={17} className="text-[#00DFA5]" /><h3 className="font-semibold">État global</h3></div>
        <div className="mt-4 rounded-xl bg-[#111111] p-4 text-sm">
          {errorCount === 0 && checks.length > 0 ? <span className="font-semibold text-[#00DFA5]">Tous les contrôles exécutés sont opérationnels.</span> : <span className="font-semibold text-[#686D76]">{errorCount} contrôle{errorCount > 1 ? 's' : ''} nécessite{errorCount > 1 ? 'nt' : ''} une vérification.</span>}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <SystemMetric label="Avis" value={globalStats.reviews} />
          <SystemMetric label="Événements" value={globalStats.analyticsEvents} />
          <SystemMetric label="Abonnements" value={billing.available ? billing.subscriptions.length : 0} />
        </div>
        <p className="mt-4 text-xs leading-5 text-[#FFFFFF]/40">Dernier diagnostic : {lastChecked ? new Date(lastChecked).toLocaleString('fr-FR') : 'en cours'}. Les métriques d’uptime et de temps de chargement restent distinctes d’un diagnostic fonctionnel.</p>
      </div>
    </div>
  );
}