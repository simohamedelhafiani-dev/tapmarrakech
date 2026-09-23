import { useEffect, useMemo, useState } from 'react';
import { useLanguage, type Language } from '@/contexts/LanguageContext';
import {
  BarChart3,
  Bell,
  Building2,
  Gift,
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import LoyaltyProgramCustomization from '@/components/LoyaltyProgramCustomization';

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
  | 'system';

export default function Admin() {
  const { language, setLanguage } = useLanguage();
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState<AdminSection>('overview');
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
  const [staffLoading, setStaffLoading] = useState(true);

  const loadEstablishments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('establishments')
      .select('id, name, slug, ai_business_type_id, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur établissements:', error);
      setEstablishments([]);
    } else {
      setEstablishments(data ?? []);
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
      const [{ data: reviewRows }, { count: loyaltyCustomers }, { count: analyticsEvents }] = await Promise.all([
        supabase.from('reviews').select('rating'),
        supabase.from('loyalty_customers').select('id', { count: 'exact', head: true }),
        supabase.from('analytics_events').select('id', { count: 'exact', head: true }),
      ]);
      const ratings = (reviewRows ?? []).map((row) => Number(row.rating)).filter((rating) => Number.isFinite(rating));
      const averageRating = ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0;
      setGlobalStats({ reviews: ratings.length, averageRating, positiveReviews: ratings.filter((rating) => rating >= 4).length, negativeReviews: ratings.filter((rating) => rating <= 3).length, loyaltyCustomers: loyaltyCustomers ?? 0, analyticsEvents: analyticsEvents ?? 0 });
    } catch (error) {
      console.error('Erreur statistiques globales:', error);
      setGlobalStats({ reviews: 0, averageRating: 0, positiveReviews: 0, negativeReviews: 0, loyaltyCustomers: 0, analyticsEvents: 0 });
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
      const mrr = normalizedSubscriptions.filter((subscription) => subscription.status === 'active').reduce((sum, subscription) => sum + Number(subscription.plan?.price_mad ?? 0), 0);
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
      id: 'reviews',
      label: 'Avis reçus',
      icon: MessageSquare,
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
      label: 'Configuration IA',
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
      id: 'system',
      label: 'Supervision technique',
      icon: Activity,
    },
  ];

  const currentLabel =
    menuItems.find((item) => item.id === section)?.label ??
    'Vue d’ensemble';

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
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col bg-forest px-4 py-5 text-white shadow-xl transition-transform lg:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-9 flex items-center justify-between px-2">
          <div className="flex min-h-[64px] flex-1 items-center justify-center">
            <img
              src="/tapmarrakech-logo.png"
              alt="TapMarrakech"
              className="h-[72px] w-auto max-w-[180px] object-contain"
            />
          </div>

          <button
            className="lg:hidden"
            onClick={() => setOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <p className="mb-3 px-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/35">
          Administration
        </p>

        <nav className="space-y-1">
          {menuItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setSection(id);
                setOpen(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[13px] transition ${
                section === id
                  ? 'bg-white text-forest shadow-lg'
                  : 'text-white/65 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon size={18} strokeWidth={1.8} />
              {label}
            </button>
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
                Administrateur
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

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center gap-4 border-b border-ink/5 bg-[#f7f7f3]/90 px-4 py-3 backdrop-blur-xl sm:px-6 md:px-8">
          <button onClick={() => setOpen(true)} className="text-ink lg:hidden" aria-label="Ouvrir le menu">
            <Menu />
          </button>

          <div className="hidden min-w-0 flex-1 max-w-[560px] lg:block">
            <div className="flex h-11 items-center gap-3 rounded-xl border border-ink/5 bg-white px-4 shadow-sm">
              <Search size={16} className="text-ink/30" />
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
              <div className="grid h-7 w-7 place-items-center rounded-full bg-forest text-xs font-semibold text-white">{user?.email?.[0]?.toUpperCase() ?? 'A'}</div>
              <div className="max-w-[130px] leading-tight">
                <p className="truncate text-xs font-semibold text-ink">{user?.email ?? 'Administrateur'}</p>
                <p className="text-[9px] text-ink/40">Administrateur</p>
              </div>
            </div>
            <label className="hidden items-center gap-2 rounded-full border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink/60 shadow-sm sm:flex">
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
            onClick={reloadAll}
            className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-[#f7f7f3]">
            <RefreshCw size={14} />
            <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1500px] p-4 sm:p-5 md:p-8 lg:p-10">
          {section === 'overview' && (
            <Overview
              establishments={establishments}
              staff={staff}
              loading={loading || staffLoading}
              onNavigate={setSection}
              billing={billing}
              globalStats={globalStats}
            />
          )}

          {section === 'establishments' && (
            <EstablishmentsSection
              establishments={establishments}
              loading={loading}
              reload={loadEstablishments}
              businessTypes={aiBusinessTypes}
              billing={billing}
            />
          )}

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
            <AIConfigurationSection
              businessTypes={aiBusinessTypes}
              reload={loadAIBusinessTypes}
            />
          )}

          {section === 'reports' && (
            <PDFReportsSection establishments={establishments} />
          )}

          {section === 'billing' && (
            <BillingSection establishments={establishments} billing={billing} reload={loadBilling} />
          )}

          {section === 'system' && (
            <SystemSection billing={billing} globalStats={globalStats} establishments={establishments} />
          )}
        </main>
      </div>
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

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setDetailLoading(true);
      try {
        const reviewQuery = selectedEstablishment === 'all'
          ? supabase.from('reviews').select('rating')
          : supabase.from('reviews').select('rating').eq('establishment_id', selectedEstablishment);
        const customerQuery = selectedEstablishment === 'all'
          ? supabase.from('loyalty_customers').select('id', { count: 'exact', head: true })
          : supabase.from('loyalty_customers').select('id', { count: 'exact', head: true }).eq('establishment_id', selectedEstablishment);
        const eventsQuery = selectedEstablishment === 'all'
          ? supabase.from('analytics_events').select('id', { count: 'exact', head: true })
          : supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('establishment_id', selectedEstablishment);
        const revenueQuery = selectedEstablishment === 'all'
          ? supabase.from('loyalty_transactions').select('amount').eq('type', 'EARN')
          : supabase.from('loyalty_transactions').select('amount').eq('type', 'EARN').eq('establishment_id', selectedEstablishment);

        const [{ data: reviews }, { count: loyaltyCustomers }, { count: analyticsEvents }, { data: revenueRows }] =
          await Promise.all([reviewQuery, customerQuery, eventsQuery, revenueQuery]);

        if (!mounted) return;
        const ratings = (reviews ?? []).map((row) => Number(row.rating)).filter(Number.isFinite);
        setDetail({
          reviews: ratings.length,
          averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0,
          loyaltyCustomers: loyaltyCustomers ?? 0,
          analyticsEvents: analyticsEvents ?? 0,
          loyaltyRevenue: (revenueRows ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
        });
      } catch (error) {
        console.error('Erreur vue Admin:', error);
      } finally {
        if (mounted) setDetailLoading(false);
      }
    };
    void load();
    return () => { mounted = false; };
  }, [selectedEstablishment]);

  const responsibles = staff.filter((member) => member.role === 'MANAGER');
  const activeSubscriptions = billing.subscriptions.filter((item) => item.status === 'active').length;
  const selectedName = selectedEstablishment === 'all'
    ? 'Tous les établissements'
    : establishments.find((item) => item.id === selectedEstablishment)?.name ?? 'Établissement';

  const quickActions = [
    { id: 'establishments' as AdminSection, label: 'Ajouter un établissement', icon: Building2 },
    { id: 'responsibles' as AdminSection, label: 'Gérer les responsables', icon: UserRound },
    { id: 'reviews' as AdminSection, label: 'Voir les avis', icon: MessageSquare },
    { id: 'reports' as AdminSection, label: 'Générer un rapport', icon: Printer },
  ];

  const recent = establishments.slice(0, 5);

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-forest/45">Vue globale</p>
          <h2 className="text-3xl font-semibold tracking-tight text-ink md:text-[38px]">
            Bonjour, Administrateur 👋
          </h2>
          <p className="mt-2 text-sm text-ink/50">
            Voici un aperçu de la performance de votre plateforme aujourd’hui.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedEstablishment}
            onChange={(event) => setSelectedEstablishment(event.target.value)}
            className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-xs font-semibold text-ink shadow-sm outline-none"
          >
            <option value="all">Tous les établissements</option>
            {establishments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <AdminMetric icon={Building2} label="Établissements" value={loading ? '—' : establishments.length} detail="sur la plateforme" />
        <AdminMetric icon={UserRound} label="Responsables" value={loading ? '—' : responsibles.length} detail="comptes actifs" />
        <AdminMetric icon={UsersRound} label="Clients fidélisés" value={detailLoading ? '—' : detail.loyaltyCustomers.toLocaleString('fr-FR')} detail="membres enregistrés" />
        <AdminMetric icon={Star} label="Note moyenne" value={detailLoading ? '—' : detail.averageRating.toFixed(1)} detail={detail.reviews ? `sur ${detail.reviews.toLocaleString('fr-FR')} avis` : 'sur 0 avis'} />
        <AdminMetric icon={MessageSquare} label="Avis reçus" value={detailLoading ? '—' : detail.reviews.toLocaleString('fr-FR')} detail={selectedName} />
        <AdminMetric icon={WalletCards} label="MRR" value={billing.available ? `${billing.mrr.toLocaleString('fr-FR')} DH` : '—'} detail={`${activeSubscriptions} abonnements actifs`} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.65fr_.85fr]">
        <div className="rounded-3xl border border-ink/5 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest/45">Pilotage</p>
              <h3 className="mt-1 text-lg font-semibold text-ink">Performance de la plateforme</h3>
            </div>
            <span className="rounded-full bg-forest/5 px-3 py-1.5 text-[10px] font-semibold text-forest">Temps réel</span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl bg-[#f7f7f3] p-5">
              <p className="text-xs text-ink/45">Avis</p>
              <p className="mt-2 text-3xl font-semibold text-forest">{detailLoading ? '—' : detail.reviews.toLocaleString('fr-FR')}</p>
              <p className="mt-1 text-[11px] text-ink/35">note moyenne {detailLoading ? '—' : detail.averageRating.toFixed(1)} / 5</p>
            </div>
            <div className="rounded-2xl bg-[#f7f7f3] p-5">
              <p className="text-xs text-ink/45">Fidélité</p>
              <p className="mt-2 text-3xl font-semibold text-forest">{detailLoading ? '—' : detail.loyaltyCustomers.toLocaleString('fr-FR')}</p>
              <p className="mt-1 text-[11px] text-ink/35">clients actifs</p>
            </div>
            <div className="rounded-2xl bg-[#f7f7f3] p-5">
              <p className="text-xs text-ink/45">Activité</p>
              <p className="mt-2 text-3xl font-semibold text-forest">{detailLoading ? '—' : detail.analyticsEvents.toLocaleString('fr-FR')}</p>
              <p className="mt-1 text-[11px] text-ink/35">événements analytics</p>
            </div>
          </div>

          <div className="mt-5 rounded-2xl border border-forest/10 bg-forest p-5 text-white">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">Fidélité</p>
                <h4 className="mt-1 text-lg font-semibold">Une expérience qui fait revenir les clients.</h4>
                <p className="mt-1 text-xs text-white/55">CA fidélité sélectionné : {detail.loyaltyRevenue.toLocaleString('fr-FR')} DH</p>
              </div>
              <button onClick={() => onNavigate('codes')} className="rounded-xl bg-gold px-4 py-2.5 text-xs font-bold text-forest transition hover:bg-gold/90">Gérer la fidélité →</button>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-ink/5 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest/45">Activité</p>
              <h3 className="mt-1 text-lg font-semibold">Derniers établissements</h3>
            </div>
            <button onClick={() => onNavigate('establishments')} className="text-xs font-semibold text-forest">Voir tout →</button>
          </div>
          <div className="mt-5 space-y-2">
            {recent.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink/35">Aucun établissement.</p>
            ) : recent.map((item) => (
              <button key={item.id} onClick={() => onNavigate('establishments')} className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-[#f7f7f3]">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest/10 text-forest"><Building2 size={17} /></div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{item.name}</p>
                  <p className="mt-0.5 text-[11px] text-ink/35">/{item.slug}</p>
                </div>
                <span className="text-[10px] font-semibold text-forest">Ouvrir →</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
        <div className="rounded-3xl border border-ink/5 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest/45">Accès rapide</p>
              <h3 className="mt-1 text-lg font-semibold">Actions administrateur</h3>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {quickActions.map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => onNavigate(id)} className="group flex items-center gap-3 rounded-2xl border border-ink/5 bg-[#fbfbf8] p-4 text-left transition hover:-translate-y-0.5 hover:border-forest/15 hover:bg-white hover:shadow-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-forest shadow-sm group-hover:bg-forest group-hover:text-white"><Icon size={17} /></span>
                <span className="text-xs font-semibold">{label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-ink/5 bg-white p-6 shadow-soft">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-forest/45">Santé plateforme</p>
              <h3 className="mt-1 text-lg font-semibold">Statistiques rapides</h3>
            </div>
            <button onClick={() => onNavigate('system')} className="text-xs font-semibold text-forest">Supervision →</button>
          </div>
          <div className="mt-5 space-y-3">
            <QuickStat label="Événements analytics" value={globalStats.analyticsEvents.toLocaleString('fr-FR')} />
            <QuickStat label="Abonnements actifs" value={String(activeSubscriptions)} />
            <QuickStat label="Paiements échoués" value={String(billing.failedPayments)} alert={billing.failedPayments > 0} />
            <QuickStat label="Renouvellements < 30 j." value={String(billing.upcomingRenewals)} />
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminMetric({ icon: Icon, label, value, detail }: { icon: typeof Star; label: string; value: string | number; detail: string }) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-4 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-forest/10 text-forest"><Icon size={18} /></div>
      </div>
      <p className="mt-4 text-xs font-medium text-ink/45">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-ink">{value}</p>
      <p className="mt-1 text-[10px] text-ink/35">{detail}</p>
    </div>
  );
}

function QuickStat({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-[#f7f7f3] px-4 py-3">
      <span className="text-xs text-ink/50">{label}</span>
      <span className={`text-sm font-semibold ${alert ? 'text-red-600' : 'text-forest'}`}>{value}</span>
    </div>
  );
}

/* =========================================================
   ESTABLISHMENTS
========================================================= */

function EstablishmentsSection({
  establishments,
  loading,
  reload,
  businessTypes,
  billing,
}: {
  establishments: Establishment[];
  loading: boolean;
  reload: () => Promise<void>;
  businessTypes: AIBusinessType[];
  billing: BillingSnapshot;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = establishments.find((item) => item.id === selectedId) ?? null;

  if (selected) {
    return (
      <EstablishmentWorkspace
        establishment={selected}
        businessTypes={businessTypes}
        onBack={() => setSelectedId(null)}
        onReload={reload}
      />
    );
  }

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">Gestion</p>
          <h2 className="font-display text-3xl text-forest md:text-4xl">Établissements</h2>
          <p className="mt-2 text-sm text-ink/50">Cliquez sur un établissement pour ouvrir son espace de gestion complet.</p>
        </div>
        <CreateEstablishmentButton reload={reload} businessTypes={businessTypes} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-ink/40">Chargement...</div>
        ) : establishments.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink/50">Aucun établissement créé.</div>
        ) : (
          <div className="divide-y divide-ink/5">
            {establishments.map((establishment) => {
              const accessLink = `${window.location.origin}/r/${establishment.slug}`;
              const type = businessTypes.find((item) => item.id === establishment.ai_business_type_id)?.name;
              return (
                <button
                  key={establishment.id}
                  onClick={() => setSelectedId(establishment.id)}
                  className="flex w-full flex-col gap-4 p-5 text-left transition hover:bg-[#fbfbf8] md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-forest text-white"><Building2 size={19} /></div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{establishment.name}</h3>
                      <p className="mt-1 text-xs text-ink/40">{type ?? 'Type non défini'} · /r/{establishment.slug}</p>
                      <p className="mt-1 truncate text-[11px] text-ink/30">{accessLink}</p>
                      {(() => {
                        const subscription = billing.subscriptions.find(
                          (item) =>
                            item.establishment_id === establishment.id &&
                            ['active', 'trial'].includes(item.status),
                        );
                        return subscription ? (
                          <span className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-forest/5 px-2.5 py-1 text-[10px] font-semibold text-forest">
                            <CreditCard size={12} />
                            {subscription.plan?.name ?? 'Abonnement'} · {subscription.status === 'trial' ? 'Essai' : 'Actif'}
                          </span>
                        ) : (
                          <span className="mt-2 inline-flex items-center rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-medium text-ink/40">
                            Aucun abonnement actif
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white">Gérer →</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateEstablishmentButton({
  reload,
  businessTypes,
}: {
  reload: () => Promise<void>;
  businessTypes: AIBusinessType[];
}) {
  const [showForm, setShowForm] = useState(false);
  return (
    <>
      <button onClick={() => setShowForm(true)} className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white hover:bg-forest-light">+ Ajouter un établissement</button>
      {showForm && <CreateEstablishmentForm close={() => setShowForm(false)} reload={reload} businessTypes={businessTypes} />}
    </>
  );
}

type WorkspaceTab = 'profile' | 'wifi' | 'menu' | 'promotions' | 'reviews' | 'loyalty' | 'team' | 'analytics' | 'public';

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
  const [tab, setTab] = useState<WorkspaceTab>('profile');
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(establishment);
  const [wifi, setWifi] = useState({ ssid: '', password: '', active: true });
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
  const businessType = businessTypes.find((x) => x.id === establishment.ai_business_type_id)?.name ?? profile.business_type ?? 'Établissement';

  const loadTab = async () => {
    if (tab === 'profile' || tab === 'public') {
      const { data } = await supabase.from('establishments').select('*').eq('id', establishment.id).maybeSingle();
      if (data) setProfile(data);
    }
    if (tab === 'wifi') {
      const { data } = await supabase.from('establishment_wifi').select('ssid,wifi_password,active').eq('establishment_id', establishment.id).maybeSingle();
      if (data) setWifi({ ssid: data.ssid ?? '', password: data.wifi_password ?? '', active: data.active ?? true });
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
        return;
      }

      const token = data?.access_token;
      setScannerLink(token ? window.location.origin + '/employee?scanner=' + encodeURIComponent(token) : null);
    };

    void loadScannerLink();
    return () => {
      mounted = false;
    };
  }, [establishment.id]);

  const saveProfile = async () => {
    setSaving(true);
    const payload = {
      name: profile.name, slug: profile.slug, business_type: profile.business_type || null, ai_business_type_id: profile.ai_business_type_id || null, address: profile.address || null,
      city: profile.city || null, phone: profile.phone || null, email: profile.email || null, website_url: profile.website_url || null,
      description: profile.description || null, instagram_url: profile.instagram_url || null, facebook_url: profile.facebook_url || null,
      tiktok_url: profile.tiktok_url || null, whatsapp_number: profile.whatsapp_number || null,
      page_template_id: profile.page_template_id || null, menu_template_id: profile.menu_template_id || null,
      logo_url: profile.logo_url || null,
    };
    const { error } = await supabase.from('establishments').update(payload).eq('id', establishment.id);
    setSaving(false);
    if (error) return alert(error.message);
    await onReload(); alert('Établissement enregistré.');
  };

  const saveWifi = async () => {
    setSaving(true);
    const { error } = await supabase.from('establishment_wifi').upsert({ establishment_id: establishment.id, ssid: wifi.ssid, wifi_password: wifi.password || null, active: wifi.active }, { onConflict: 'establishment_id' });
    setSaving(false); if (error) return alert(error.message); alert('Wi-Fi enregistré.');
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
  };

  const startEditMenuItem = (item: MenuItem) => {
    setEditingMenuItemId(item.id);
    setEditingMenuItem({ name: item.name, description: item.description ?? '', price: String(item.price ?? ''), category_id: item.category_id, image_url: item.image_url ?? '' });
  };

  const uploadMenuItemImage = async (file: File) => {
    if (!editingMenuItemId) return;
    setMenuImageUploading(true);
    try {
      const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${establishment.id}/${editingMenuItemId}-${Date.now()}.${extension}`;
      const { error } = await supabase.storage.from('menu-images').upload(path, file, { upsert: true, contentType: file.type, cacheControl: '31536000' });
      if (error) throw error;
      const { data } = supabase.storage.from('menu-images').getPublicUrl(path);
      setEditingMenuItem((current) => ({ ...current, image_url: data.publicUrl }));
    } catch (error) {
      console.error('Erreur upload photo menu:', error);
      alert(error instanceof Error ? error.message : 'Impossible d’envoyer la photo.');
    } finally {
      setMenuImageUploading(false);
    }
  };

  const saveEditedMenuItem = async () => {
    if (!editingMenuItemId || !editingMenuItem.name.trim() || !editingMenuItem.category_id) {
      alert('Nom et catégorie obligatoires.');
      return;
    }
    setMenuItemSaving(true);
    const { error } = await supabase.from('menu_items').update({
      name: editingMenuItem.name.trim(),
      description: editingMenuItem.description.trim() || null,
      price: Number(editingMenuItem.price) || 0,
      category_id: editingMenuItem.category_id,
      image_url: editingMenuItem.image_url.trim() || null,
    }).eq('id', editingMenuItemId).eq('establishment_id', establishment.id);
    setMenuItemSaving(false);
    if (error) return alert(error.message);
    setEditingMenuItemId(null);
    await loadTab();
  };

  const addPromotion = async () => {
    if (!promotion.name.trim()) return;
    const { error } = await supabase.from('promotions').insert({ establishment_id: establishment.id, name: promotion.name.trim(), description: promotion.description.trim() || null, normal_price: promotion.normal_price ? Number(promotion.normal_price) : null, promo_price: promotion.promo_price ? Number(promotion.promo_price) : null, active: true, display_order: promotions.length });
    if (error) return alert(error.message); setPromotion({ name: '', description: '', normal_price: '', promo_price: '' }); loadTab();
  };

  const saveLoyaltySettings = async () => {
    const pointsPerCurrency = Number(loyalty.points_per_currency);

    if (!Number.isFinite(pointsPerCurrency) || pointsPerCurrency <= 0) {
      alert('Le nombre de points par unité monétaire doit être supérieur à 0.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase
        .from('loyalty_settings')
        .upsert(
          {
            establishment_id: establishment.id,
            points_per_currency: pointsPerCurrency,
            currency: loyalty.currency,
            enabled: loyalty.enabled,
          },
          { onConflict: 'establishment_id' },
        );

      if (error) throw error;

      setLoyalty((current) => ({
        ...current,
        points_per_currency: pointsPerCurrency,
      }));
      alert('Paramètres fidélité enregistrés.');
    } catch (error) {
      console.error('Erreur enregistrement paramètres fidélité:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Erreur lors de l’enregistrement des paramètres fidélité.',
      );
    } finally {
      setSaving(false);
    }
  };

  const addReward = async () => {
    const pointsRequired = Number(reward.points_required);

    if (!reward.name.trim()) {
      alert('Le nom de la récompense est obligatoire.');
      return;
    }

    if (!Number.isInteger(pointsRequired) || pointsRequired <= 0) {
      alert('Les points requis doivent être un entier supérieur à 0.');
      return;
    }

    try {
      setSaving(true);

      const { error } = await supabase.from('loyalty_rewards').insert({
        establishment_id: establishment.id,
        name: reward.name.trim(),
        description: reward.description.trim() || null,
        points_required: pointsRequired,
        active: true,
      });

      if (error) throw error;

      setReward({ name: '', description: '', points_required: '' });
      await loadTab();
    } catch (error) {
      console.error('Erreur ajout récompense:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Erreur lors de l’ajout de la récompense.',
      );
    } finally {
      setSaving(false);
    }
  };

  const toggleReward = async (rewardItem: LoyaltyReward) => {
    try {
      setSaving(true);

      const { error } = await supabase
        .from('loyalty_rewards')
        .update({ active: !rewardItem.active })
        .eq('id', rewardItem.id)
        .eq('establishment_id', establishment.id);

      if (error) throw error;

      await loadTab();
    } catch (error) {
      console.error('Erreur modification récompense:', error);
      alert(
        error instanceof Error
          ? error.message
          : 'Erreur lors de la modification de la récompense.',
      );
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'profile', label: 'Profil' }, { id: 'wifi', label: 'Wi-Fi' }, { id: 'menu', label: 'Menu' }, { id: 'promotions', label: 'Promotions' },
    { id: 'reviews', label: 'Avis' }, { id: 'loyalty', label: 'Fidélité' }, { id: 'team', label: 'Équipe' }, { id: 'analytics', label: 'Analytics' }, { id: 'public', label: 'Liens publics' },
  ];

  const field = (label: string, key: string, type = 'text') => (
    <label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">{label}</span><input type={type} value={profile[key] ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, [key]: e.target.value }))} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest" /></label>
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><button onClick={onBack} className="mb-3 text-xs font-semibold text-forest">← Retour aux établissements</button><h2 className="font-display text-3xl text-forest">{profile.name ?? establishment.name}</h2><p className="mt-1 text-sm text-ink/45">{businessType} · espace de gestion complet</p></div>
        <div className="flex flex-wrap gap-2">
          {scannerLink && <a href={scannerLink} target="_blank" rel="noreferrer" className="rounded-xl border border-gold/30 bg-white px-4 py-3 text-xs font-semibold text-forest">Scanner fidélité ↗</a>}
          <a href={publicLink} target="_blank" rel="noreferrer" className="rounded-xl bg-forest px-4 py-3 text-center text-xs font-semibold text-white">Ouvrir la page publique ↗</a>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-gold/20 bg-[#fbf8ee] p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest">Scanner fidélité</p>
            <p className="mt-1 text-xs text-ink/50">Lien permanent à donner aux employés pour scanner les cartes et ajouter les points.</p>
            <p className="mt-2 break-all text-[11px] text-ink/35">{scannerLink ?? 'Génération du lien…'}</p>
          </div>
          {scannerLink && <div className="flex gap-2">
            <button type="button" onClick={() => navigator.clipboard.writeText(scannerLink).then(() => alert('Lien scanner copié.'))} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Copier le lien</button>
            <a href={scannerLink} target="_blank" rel="noreferrer" className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-xs font-semibold text-forest">Ouvrir</a>
          </div>}
        </div>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-ink/5 bg-white p-2 shadow-sm">
        {tabs.map((x) => <button key={x.id} onClick={() => setTab(x.id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold ${tab === x.id ? 'bg-forest text-white' : 'text-ink/55 hover:bg-[#f7f7f3]'}`}>{x.label}</button>)}
      </div>

      {tab === 'profile' && <div className="grid gap-4 md:grid-cols-2">
        {field('Nom', 'name')}{field('Slug public', 'slug')}{field('Adresse', 'address')}{field('Ville', 'city')}{field('Téléphone', 'phone')}{field('Email', 'email', 'email')}{field('Site web', 'website_url')}{field('WhatsApp', 'whatsapp_number')}{field('Instagram', 'instagram_url')}{field('Facebook', 'facebook_url')}{field('TikTok', 'tiktok_url')}
        <label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">Type</span><select value={profile.ai_business_type_id ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, ai_business_type_id: e.target.value || null }))} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm">{businessTypes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        <label className="block md:col-span-2"><span className="mb-1 block text-xs font-medium text-ink/50">Description</span><textarea value={profile.description ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, description: e.target.value }))} rows={4} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" /></label>
        <div className="md:col-span-2 rounded-2xl border border-ink/5 bg-[#f7f7f3] p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center">
            <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-forest text-2xl font-semibold text-gold">
              {profile.logo_url ? <img src={profile.logo_url} alt={`Logo ${profile.name ?? establishment.name}`} className="h-full w-full object-cover" /> : (profile.name ?? establishment.name)?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-forest">Logo de l’établissement</p>
              <p className="mt-1 text-xs leading-5 text-ink/45">Le même logo est utilisé par la page publique et les espaces établissement lorsque l’URL est renseignée.</p>
              <input value={profile.logo_url ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, logo_url: e.target.value }))} placeholder="https://.../logo.png" className="mt-3 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest" />
              {profile.logo_url && <button type="button" onClick={() => setProfile((v: any) => ({ ...v, logo_url: null }))} className="mt-2 text-xs font-medium text-red-600">Supprimer le logo</button>}
            </div>
          </div>
        </div>
        <div className="md:col-span-2"><button disabled={saving} onClick={saveProfile} className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white">{saving ? 'Enregistrement...' : 'Enregistrer le profil'}</button></div>
      </div>}

      {tab === 'wifi' && <div className="max-w-xl rounded-2xl border border-ink/5 bg-white p-6 shadow-sm"><h3 className="text-lg font-semibold">Wi-Fi client</h3><p className="mt-1 mb-5 text-xs text-ink/45">Ces informations alimenteront le module Wi-Fi de la page publique.</p><div className="space-y-4"><label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">Nom du réseau</span><input value={wifi.ssid} onChange={(e) => setWifi({ ...wifi, ssid: e.target.value })} className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /></label><label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">Mot de passe</span><input value={wifi.password} onChange={(e) => setWifi({ ...wifi, password: e.target.value })} className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wifi.active} onChange={(e) => setWifi({ ...wifi, active: e.target.checked })} /> Module actif</label><button disabled={saving} onClick={saveWifi} className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white">Enregistrer le Wi-Fi</button></div></div>}

      {tab === 'menu' && <div className="space-y-5">
        <div className="rounded-2xl border border-forest/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-forest/10 text-forest">
                <Sparkles size={21} />
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Import intelligent</p>
                <h3 className="mt-1 text-xl font-semibold text-forest">Créer le menu avec l’IA</h3>
                <p className="mt-1 max-w-2xl text-xs leading-5 text-ink/45">
                  Envoie le PDF ou des photos du menu. L’IA détecte les catégories, plats, descriptions et prix, puis tu vérifies avant publication.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => { setMenuImportOpen(true); setMenuImportError(''); }}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-xs font-semibold text-white"
            >
              <Upload size={15} />
              Importer mon menu
            </button>
          </div>
        </div>

        {menuImportOpen && (
          <div className="rounded-2xl border border-gold/20 bg-[#fbf8ee] p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-forest">Importer un menu</h3>
                <p className="mt-1 text-xs text-ink/45">PDF, JPG, PNG ou WEBP. Tu peux commencer avec un menu complet en PDF.</p>
              </div>
              <button type="button" onClick={() => { setMenuImportOpen(false); setMenuImportPreview(null); setMenuImportError(''); }} className="text-xs font-semibold text-ink/40">Fermer</button>
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-ink/15 bg-white p-5">
              <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl py-8 text-center">
                <FileText size={28} className="text-gold" />
                <span className="text-sm font-semibold text-forest">{menuImportFile ? menuImportFile.name : 'Choisir le PDF ou les photos du menu'}</span>
                <span className="text-xs text-ink/40">Le fichier est analysé uniquement pour construire le brouillon du menu.</span>
                <input
                  type="file"
                  accept=".pdf,image/jpeg,image/png,image/webp"
                  className="sr-only"
                  onChange={(e) => { setMenuImportFile(e.target.files?.[0] ?? null); setMenuImportPreview(null); setMenuImportError(''); }}
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={importMenuWithAI} disabled={!menuImportFile || menuImportLoading} className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50">
                <Sparkles size={14} />
                {menuImportLoading ? 'Analyse du menu…' : 'Analyser avec l’IA'}
              </button>
            </div>

            {menuImportError && <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-xs text-red-700">{menuImportError}</div>}

            {menuImportPreview && (
              <div className="mt-5 rounded-2xl border border-ink/5 bg-white p-5">
                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                  <div>
                    <h4 className="font-semibold text-forest">Menu détecté</h4>
                    <p className="mt-1 text-xs text-ink/40">
                      {menuImportPreview.categories.length} catégorie(s) · {menuImportPreview.categories.reduce((sum, c) => sum + c.items.length, 0)} produit(s)
                    </p>
                  </div>
                  <button type="button" onClick={applyImportedMenu} disabled={menuImportApplying} className="rounded-xl bg-gold px-4 py-2.5 text-xs font-bold text-forest disabled:opacity-50">
                    {menuImportApplying ? 'Création du menu…' : 'Créer ce menu'}
                  </button>
                </div>

                <div className="mt-5 space-y-4">
                  {menuImportPreview.categories.map((category, categoryIndex) => (
                    <div key={categoryIndex} className="rounded-xl bg-[#f7f7f3] p-4">
                      <div className="font-semibold text-forest">{category.name}</div>
                      <div className="mt-3 space-y-2">
                        {category.items.map((item, itemIndex) => (
                          <div key={itemIndex} className="grid gap-2 rounded-xl bg-white p-3 md:grid-cols-[1.2fr_.7fr_1.8fr]">
                            <input value={item.name} onChange={(e) => setMenuImportPreview((current) => current ? ({ ...current, categories: current.categories.map((c, ci) => ci === categoryIndex ? ({ ...c, items: c.items.map((it, ii) => ii === itemIndex ? ({ ...it, name: e.target.value }) : it) }) : c) }) : current)} className="rounded-lg border border-ink/10 px-3 py-2 text-xs" />
                            <input type="number" value={item.price} onChange={(e) => setMenuImportPreview((current) => current ? ({ ...current, categories: current.categories.map((c, ci) => ci === categoryIndex ? ({ ...c, items: c.items.map((it, ii) => ii === itemIndex ? ({ ...it, price: Number(e.target.value) }) : it) }) : c) }) : current)} className="rounded-lg border border-ink/10 px-3 py-2 text-xs" />
                            <input value={item.description ?? ''} onChange={(e) => setMenuImportPreview((current) => current ? ({ ...current, categories: current.categories.map((c, ci) => ci === categoryIndex ? ({ ...c, items: c.items.map((it, ii) => ii === itemIndex ? ({ ...it, description: e.target.value }) : it) }) : c) }) : current)} className="rounded-lg border border-ink/10 px-3 py-2 text-xs" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-forest/10 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Mode d'affichage</p>
              <h3 className="mt-1 text-xl font-semibold text-forest">Comment afficher le menu ?</h3>
              <p className="mt-1 text-xs text-ink/45">Choisis entre un vrai menu numérique construit dans la plateforme ou le PDF original du commerce.</p>
            </div>
            <span className="rounded-full bg-[#f7f7f3] px-3 py-1.5 text-[11px] font-semibold text-forest">{menuDisplayMode === 'pdf' ? 'PDF original' : 'Menu numérique'}</span>
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <button type="button" onClick={() => void setMenuMode('digital')} className={`rounded-2xl border p-4 text-left ${menuDisplayMode === 'digital' ? 'border-gold ring-2 ring-gold/20' : 'border-ink/10'}`}>
              <div className="font-semibold text-forest">✨ Menu numérique</div>
              <p className="mt-1 text-xs text-ink/45">Templates, photos, catégories, produits et édition directement dans la plateforme.</p>
            </button>
            <div className={`rounded-2xl border p-4 ${menuDisplayMode === 'pdf' ? 'border-gold ring-2 ring-gold/20' : 'border-ink/10'}`}>
              <div className="font-semibold text-forest">📄 Garder le menu original</div>
              <p className="mt-1 text-xs text-ink/45">Importe le PDF tel quel. Aucun template et aucune analyse IA.</p>
              <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">
                <Upload size={14} />
                {menuPdfUploading ? 'Import en cours…' : menuPdfUrl ? 'Remplacer le PDF' : 'Importer le PDF'}
                <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={menuPdfUploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadMenuPdf(file); e.currentTarget.value = ''; }} />
              </label>
              {menuPdfUrl && (
                <div className="mt-3 flex items-center gap-3 text-xs">
                  <a href={menuPdfUrl} target="_blank" rel="noreferrer" className="text-forest underline">Voir le PDF</a>
                  <button type="button" onClick={() => void removeMenuPdf()} className="text-red-600">Retirer</button>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gold/20 bg-[#fbf8ee] p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Design du menu</p>
              <h3 className="mt-1 text-xl font-semibold text-forest">Design premium par l’IA</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-ink/45">
                Après l’import, l’IA construit automatiquement la hiérarchie du menu : couverture, introduction, produits mis en avant et catégories. Le contenu produit reste celui de l’établissement.
              </p>
            </div>
            <button
              type="button"
              disabled={menuAiDesignLoading || categories.length === 0}
              onClick={async () => {
                setMenuAiDesignLoading(true);
                try {
                  const designMenu = {
                    categories: categories.map((category) => ({
                      id: category.id,
                      name: category.name,
                      description: category.description ?? null,
                      items: (items.filter((item) => item.category_id === category.id)).map((item) => ({
                        id: item.id,
                        name: item.name,
                        description: item.description ?? null,
                        price: item.price,
                        image_url: item.image_url ?? null,
                      })),
                    })),
                  };
                  const { data, error } = await supabase.functions.invoke('design-menu', {
                    body: {
                      establishment_id: establishment.id,
                      menu: designMenu,
                      photo_mode: menuAiPhotoMode,
                    },
                  });
                  if (error || !data?.success || !data?.design) throw new Error(error?.message || data?.error || 'Design IA indisponible.');
                  setMenuAiDesign(data.design);
                  const { error: saveError } = await supabase.from('establishments').update({ menu_ai_design: data.design }).eq('id', establishment.id);
                  if (saveError) throw saveError;
                  alert('Design premium IA généré.');
                } catch (error) {
                  alert(error instanceof Error ? error.message : 'Impossible de générer le design IA.');
                } finally {
                  setMenuAiDesignLoading(false);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              <Sparkles size={14} />
              {menuAiDesignLoading ? 'Création du design…' : 'Générer le design premium'}
            </button>
          </div>

          <div className="mt-5">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/35">Photos du menu</p>
            <div className="grid gap-3 md:grid-cols-2">
              <button
                type="button"
                onClick={() => void saveMenuAiPhotoMode('with_photos')}
                className={`rounded-2xl border p-4 text-left transition ${menuAiPhotoMode === 'with_photos' ? 'border-gold bg-white ring-2 ring-gold/20' : 'border-ink/10 bg-white/60 hover:border-gold/50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-forest">Avec photos</p>
                    <p className="mt-1 text-xs leading-5 text-ink/45">Les photos réellement ajoutées aux produits peuvent être affichées.</p>
                  </div>
                  {menuAiPhotoMode === 'with_photos' && <span className="rounded-full bg-forest px-2.5 py-1 text-[9px] font-bold uppercase text-white">Actif</span>}
                </div>
              </button>
              <button
                type="button"
                onClick={() => void saveMenuAiPhotoMode('without_photos')}
                className={`rounded-2xl border p-4 text-left transition ${menuAiPhotoMode === 'without_photos' ? 'border-gold bg-white ring-2 ring-gold/20' : 'border-ink/10 bg-white/60 hover:border-gold/50'}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-forest">Sans photos</p>
                    <p className="mt-1 text-xs leading-5 text-ink/45">Le menu reste éditorial et aucun espace photo n'est réservé.</p>
                  </div>
                  {menuAiPhotoMode === 'without_photos' && <span className="rounded-full bg-forest px-2.5 py-1 text-[9px] font-bold uppercase text-white">Actif</span>}
                </div>
              </button>
            </div>
          </div>

          {menuAiDesign && (
            <div className="mt-5 space-y-4">
              <div>
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink/35">Direction visuelle</p>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {[
                    { id: 'editorial', name: 'Editorial', text: 'Éditorial, élégant et très lisible.', tone: 'bg-[#f0ece2]' },
                    { id: 'luxury', name: 'Luxury', text: 'Premium, raffiné avec accents dorés.', tone: 'bg-[#f3eee2]' },
                    { id: 'immersive', name: 'Immersive', text: 'Plus visuel et immersif.', tone: 'bg-[#ebe5d8]' },
                    { id: 'minimal', name: 'Minimal', text: 'Sobre, moderne et épuré.', tone: 'bg-white' },
                  ].map((styleOption) => (
                    <button
                      key={styleOption.id}
                      type="button"
                      onClick={() => void saveMenuAiStyle(styleOption.id as 'editorial' | 'immersive' | 'minimal' | 'luxury')}
                      className={`rounded-2xl border p-4 text-left transition ${menuAiDesign.style === styleOption.id ? 'border-gold bg-white ring-2 ring-gold/20' : 'border-ink/10 bg-white/60 hover:border-gold/50'}`}
                    >
                      <div className={`mb-3 h-12 rounded-xl ${styleOption.tone}`}>
                        <div className="flex h-full items-center gap-2 px-3">
                          <span className="h-1.5 w-12 rounded-full bg-forest/70" />
                          <span className="h-1.5 w-6 rounded-full bg-gold" />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-forest">{styleOption.name}</strong>
                        {menuAiDesign.style === styleOption.id && <span className="rounded-full bg-forest px-2 py-1 text-[9px] font-bold uppercase text-white">Actif</span>}
                      </div>
                      <p className="mt-1 text-[11px] leading-4 text-ink/40">{styleOption.text}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-xl bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/35">Hero</p>
                  <p className="mt-1 font-semibold text-forest">{menuAiDesign.hero?.title ?? establishment.name}</p>
                </div>
                <div className="rounded-xl bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-ink/35">Sections</p>
                  <p className="mt-1 font-semibold text-forest">{Array.isArray(menuAiDesign.sections) ? menuAiDesign.sections.length : 0} catégorie(s)</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gold/20 bg-[#fbf8ee] p-6 shadow-sm">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Design manuel</p>
              <h3 className="mt-1 text-xl font-semibold text-forest">Choisir le template</h3>
              <p className="mt-1 text-xs text-ink/45">Le template sélectionné sera utilisé automatiquement sur la page publique de cet établissement.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-forest shadow-sm">Actuel : {menuTemplate === 'luxury' ? 'Luxury' : menuTemplate === 'cards' ? 'Cards' : menuTemplate === 'dark' ? 'Dark' : 'Editorial'}</span>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { id: 'editorial', name: 'Editorial', description: 'Épuré, élégant et très lisible.', tone: 'bg-white', accent: 'bg-forest' },
              { id: 'luxury', name: 'Luxury', description: 'Restaurant premium avec détails dorés.', tone: 'bg-[#fbf8ee]', accent: 'bg-gold' },
              { id: 'cards', name: 'Cards', description: 'Photos produits et présentation visuelle.', tone: 'bg-white', accent: 'bg-forest' },
              { id: 'dark', name: 'Dark', description: 'Ambiance lounge, sombre et sophistiquée.', tone: 'bg-forest', accent: 'bg-gold' },
            ].map((template) => (
              <button
                key={template.id}
                type="button"
                onClick={() => void saveMenuTemplate(template.id)}
                className={`group overflow-hidden rounded-2xl border text-left transition ${menuTemplate === template.id ? 'border-gold ring-2 ring-gold/20' : 'border-ink/8 hover:border-gold/50'}`}
              >
                <div className={`h-28 p-4 ${template.tone} `}>
                  <div className="flex items-center justify-between">
                    <span className={`h-2 w-16 rounded-full ${template.accent}`}></span>
                    <span className={`h-2 w-6 rounded-full ${template.id === 'dark' ? 'bg-white/40' : 'bg-ink/10'}`}></span>
                  </div>
                  <div className="mt-5 space-y-2">
                    <div className={`h-2 w-3/4 rounded-full ${template.id === 'dark' ? 'bg-white/30' : 'bg-ink/10'}`}></div>
                    <div className={`h-2 w-1/2 rounded-full ${template.id === 'dark' ? 'bg-white/20' : 'bg-ink/5'}`}></div>
                    <div className="flex justify-between gap-3">
                      <div className={`h-2 w-1/3 rounded-full ${template.id === 'dark' ? 'bg-white/20' : 'bg-ink/5'}`}></div>
                      <div className={`h-2 w-10 rounded-full ${template.accent}`}></div>
                    </div>
                  </div>
                </div>
                <div className="bg-white p-4">
                  <div className="flex items-center justify-between gap-2">
                    <strong className="text-sm text-forest">{template.name}</strong>
                    {menuTemplate === template.id && <span className="rounded-full bg-forest px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-white">Actif</span>}
                  </div>
                  <p className="mt-1 text-[11px] leading-4 text-ink/40">{template.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2"><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Catégories</h3><div className="mt-4 flex gap-2"><input value={menuCategoryName} onChange={(e) => setMenuCategoryName(e.target.value)} placeholder="Ex. Entrées" className="min-w-0 flex-1 rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><button onClick={addCategory} className="rounded-xl bg-forest px-4 text-xs font-semibold text-white">Ajouter</button></div><div className="mt-4 space-y-2">{categories.map((c) => <div key={c.id} className="flex items-center justify-between rounded-xl bg-[#f7f7f3] px-3 py-2.5 text-sm"><span>{c.name}</span><button onClick={async () => { const { error } = await supabase.from('menu_categories').update({ active: !c.active }).eq('id', c.id); if (error) alert(error.message); else loadTab(); }} className="text-xs text-ink/45">{c.active ? 'Actif' : 'Inactif'}</button></div>)}</div></div><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Nouveau produit</h3><div className="mt-4 space-y-3"><input value={menuItem.name} onChange={(e) => setMenuItem({ ...menuItem, name: e.target.value })} placeholder="Nom" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><select value={menuItem.category_id} onChange={(e) => setMenuItem({ ...menuItem, category_id: e.target.value })} className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"><option value="">Catégorie</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input value={menuItem.price} onChange={(e) => setMenuItem({ ...menuItem, price: e.target.value })} placeholder="Prix MAD" type="number" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><textarea value={menuItem.description} onChange={(e) => setMenuItem({ ...menuItem, description: e.target.value })} placeholder="Description" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><button onClick={addMenuItem} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Ajouter le produit</button></div></div></div><div className="rounded-2xl border border-ink/5 bg-white p-5"><div className="flex items-center justify-between gap-3"><div><h3 className="font-semibold">Produits</h3><p className="mt-1 text-xs text-ink/40">Modifie un produit existant sans le supprimer.</p></div><span className="rounded-full bg-[#f7f7f3] px-3 py-1 text-[11px] text-ink/45">${items.length} produit${items.length > 1 ? 's' : ''}</span></div><div className="mt-4 grid gap-3 md:grid-cols-2">{items.map((i) => <div key={i.id} className="rounded-2xl border border-ink/5 bg-[#f7f7f3] p-3"><div className="flex gap-3">{i.image_url ? <img src={i.image_url} alt="" className="h-16 w-16 shrink-0 rounded-xl object-cover" /> : <div className="grid h-16 w-16 shrink-0 place-items-center rounded-xl bg-white text-[10px] text-ink/25">Photo</div>}<div className="min-w-0 flex-1"><div className="flex justify-between gap-3"><strong className="truncate text-sm">{i.name}</strong><span className="shrink-0 text-sm font-semibold">{Number(i.price).toFixed(2)} MAD</span></div><p className="mt-1 line-clamp-2 text-xs text-ink/45">{i.description || 'Sans description'}</p></div></div><div className="mt-3 flex items-center justify-between"><button onClick={() => startEditMenuItem(i)} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-[11px] font-semibold text-forest"><Pencil size={13} /> Modifier</button><button onClick={async () => { const { error } = await supabase.from('menu_items').update({ active: !i.active }).eq('id', i.id); if (error) alert(error.message); else loadTab(); }} className="text-[11px] text-ink/45">{i.active ? 'Désactiver' : 'Activer'}</button></div></div>)}</div></div></div>}

      {editingMenuItemId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gold">Édition du produit</p><h3 className="mt-1 text-xl font-semibold text-forest">Modifier le produit</h3></div><button type="button" onClick={() => setEditingMenuItemId(null)} className="rounded-xl p-2 text-ink/40 hover:bg-[#f7f7f3]"><X size={18} /></button></div>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">Nom du produit</span><input value={editingMenuItem.name} onChange={(e) => setEditingMenuItem((v) => ({ ...v, name: e.target.value }))} className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">Catégorie</span><select value={editingMenuItem.category_id} onChange={(e) => setEditingMenuItem((v) => ({ ...v, category_id: e.target.value }))} className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm">{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">Prix (MAD)</span><input type="number" min="0" step="0.01" value={editingMenuItem.price} onChange={(e) => setEditingMenuItem((v) => ({ ...v, price: e.target.value }))} className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">URL photo</span><input value={editingMenuItem.image_url} onChange={(e) => setEditingMenuItem((v) => ({ ...v, image_url: e.target.value }))} placeholder="https://..." className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /></label>
              <label className="block md:col-span-2"><span className="mb-1 block text-xs font-medium text-ink/50">Description / composants</span><textarea rows={5} value={editingMenuItem.description} onChange={(e) => setEditingMenuItem((v) => ({ ...v, description: e.target.value }))} placeholder="Ex. tomates, mozzarella, basilic, huile d'olive..." className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /></label>
            </div>
            <div className="mt-4 rounded-2xl border border-dashed border-ink/15 bg-[#f7f7f3] p-4"><div className="flex flex-col gap-4 sm:flex-row sm:items-center"><div className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-white">{editingMenuItem.image_url ? <img src={editingMenuItem.image_url} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-xs text-ink/30">Pas de photo</div>}</div><div><p className="text-sm font-semibold text-forest">Photo du produit</p><p className="mt-1 text-xs text-ink/40">JPG, PNG ou WEBP.</p><label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white"><Upload size={14} />{menuImageUploading ? 'Envoi…' : 'Choisir une photo'}<input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={menuImageUploading} onChange={(e) => { const file = e.target.files?.[0]; if (file) void uploadMenuItemImage(file); e.currentTarget.value = ''; }} /></label></div></div></div>
            <div className="mt-6 flex justify-end gap-2"><button type="button" onClick={() => setEditingMenuItemId(null)} className="rounded-xl border border-ink/10 px-4 py-2.5 text-xs font-semibold">Annuler</button><button type="button" disabled={menuItemSaving || menuImageUploading} onClick={saveEditedMenuItem} className="rounded-xl bg-forest px-5 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{menuItemSaving ? 'Enregistrement…' : 'Enregistrer les modifications'}</button></div>
          </div>
        </div>
      )}
      {tab === 'promotions' && <div className="space-y-5"><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Créer une promotion</h3><div className="mt-4 grid gap-3 md:grid-cols-4"><input value={promotion.name} onChange={(e) => setPromotion({ ...promotion, name: e.target.value })} placeholder="Nom" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><input value={promotion.description} onChange={(e) => setPromotion({ ...promotion, description: e.target.value })} placeholder="Description" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><input value={promotion.normal_price} onChange={(e) => setPromotion({ ...promotion, normal_price: e.target.value })} placeholder="Prix normal" type="number" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><input value={promotion.promo_price} onChange={(e) => setPromotion({ ...promotion, promo_price: e.target.value })} placeholder="Prix promo" type="number" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /></div><button onClick={addPromotion} className="mt-3 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Ajouter</button></div><div className="grid gap-3 md:grid-cols-2">{promotions.map((p) => <div key={p.id} className="rounded-2xl border border-ink/5 bg-white p-5"><div className="flex justify-between"><strong>{p.name}</strong><button onClick={async () => { const { error } = await supabase.from('promotions').update({ active: !p.active }).eq('id', p.id); if (error) alert(error.message); else loadTab(); }} className="text-xs text-ink/45">{p.active ? 'Actif' : 'Inactif'}</button></div><p className="mt-2 text-sm text-ink/55">{p.description || 'Sans description'}</p><p className="mt-3 text-sm font-semibold">{p.promo_price ?? '—'} MAD <span className="ml-2 text-xs text-ink/35 line-through">{p.normal_price ?? ''}</span></p></div>)}</div></div>}

      {tab === 'reviews' && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><StatCard label="Avis" value={reviews.length} /><StatCard label="Note moyenne" value={reviews.length ? (reviews.reduce((a, r) => a + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : '—'} /><StatCard label="Dernier avis" value={reviews[0] ? new Date(reviews[0].created_at).toLocaleDateString('fr-FR') : '—'} /></div><div className="rounded-2xl border border-ink/5 bg-white p-5">{reviews.length === 0 ? <p className="text-sm text-ink/45">Aucun avis.</p> : <div className="space-y-3">{reviews.map((r) => <div key={r.id} className="rounded-xl bg-[#f7f7f3] p-4"><div className="flex justify-between"><strong>{r.rating}/5</strong><span className="text-xs text-ink/35">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span></div><p className="mt-2 text-sm text-ink/60">{r.feedback || r.comment || 'Aucun commentaire'}</p></div>)}</div>}</div></div>}

      {tab === 'loyalty' && (
        <div className="space-y-5">
          <LoyaltyProgramCustomization establishmentId={establishment.id} />
          <div className="grid gap-3 md:grid-cols-3">
            <StatCard label="Clients fidélité" value={customersCount} />
            <StatCard label="Récompenses" value={rewards.length} />
            <StatCard label="Programme" value={loyalty.enabled ? 'Actif' : 'Inactif'} />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-ink/5 bg-white p-5">
              <h3 className="font-semibold">Paramètres</h3>

              <div className="mt-4 flex gap-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/50">
                    Points par unité monétaire
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    step="0.01"
                    value={loyalty.points_per_currency}
                    onChange={(e) =>
                      setLoyalty({
                        ...loyalty,
                        points_per_currency: Number(e.target.value),
                      })
                    }
                    className="w-40 rounded-xl border border-ink/10 px-3 py-2.5 text-sm"
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-ink/50">
                    Devise
                  </span>
                  <select
                    value={loyalty.currency}
                    onChange={(e) =>
                      setLoyalty({ ...loyalty, currency: e.target.value })
                    }
                    className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm"
                  >
                    <option value="MAD">MAD</option>
                    <option value="EUR">EUR</option>
                  </select>
                </label>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={loyalty.enabled}
                  onChange={(e) =>
                    setLoyalty({ ...loyalty, enabled: e.target.checked })
                  }
                />
                Programme actif
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={saveLoyaltySettings}
                className="mt-4 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </button>
            </div>

            <div className="rounded-2xl border border-ink/5 bg-white p-5">
              <h3 className="font-semibold">Nouvelle récompense</h3>

              <div className="mt-4 space-y-3">
                <input
                  value={reward.name}
                  onChange={(e) =>
                    setReward({ ...reward, name: e.target.value })
                  }
                  placeholder="Nom"
                  className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"
                />

                <input
                  value={reward.points_required}
                  onChange={(e) =>
                    setReward({
                      ...reward,
                      points_required: e.target.value,
                    })
                  }
                  placeholder="Points requis"
                  type="number"
                  min="1"
                  step="1"
                  className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"
                />

                <textarea
                  value={reward.description}
                  onChange={(e) =>
                    setReward({ ...reward, description: e.target.value })
                  }
                  placeholder="Description"
                  rows={3}
                  className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"
                />

                <button
                  type="button"
                  disabled={saving}
                  onClick={addReward}
                  className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Ajout...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-ink/5 bg-white p-5">
            <h3 className="font-semibold">Récompenses</h3>

            <div className="mt-4 grid gap-2 md:grid-cols-2">
              {rewards.length === 0 ? (
                <p className="text-sm text-ink/45">
                  Aucune récompense configurée.
                </p>
              ) : (
                rewards.map((rewardItem) => (
                  <div
                    key={rewardItem.id}
                    className="flex items-center justify-between rounded-xl bg-[#f7f7f3] p-3"
                  >
                    <span>
                      <strong className="text-sm">
                        {rewardItem.name}
                      </strong>
                      <span className="ml-2 text-xs text-ink/40">
                        {rewardItem.points_required} pts
                      </span>
                    </span>

                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleReward(rewardItem)}
                      className="text-xs text-ink/45 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {rewardItem.active ? 'Actif' : 'Inactif'}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'team' && <div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Équipe de l’établissement</h3><p className="mt-1 text-xs text-ink/45">Les comptes sont gérés depuis les sections Responsables / Employés de l’Admin.</p><div className="mt-5 space-y-2">{team.length === 0 ? <p className="text-sm text-ink/45">Aucun membre affecté.</p> : team.map((m) => <div key={m.id} className="flex justify-between rounded-xl bg-[#f7f7f3] p-3 text-sm"><span>{m.name}</span><span className="text-xs text-ink/45">{m.role} · {m.active ? 'Actif' : 'Inactif'}</span></div>)}</div></div>}

      {tab === 'analytics' && <div className="grid gap-4 md:grid-cols-3"><StatCard label="Événements enregistrés" value={eventsCount} /><StatCard label="Avis" value={reviews.length || '—'} /><StatCard label="Page publique" value={`/p/${establishment.slug}`} /></div>}

      {tab === 'public' && (
  <div className="space-y-5">
    <div className="rounded-2xl border border-gold/20 bg-[#fbf8ee] p-6">
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-forest">Liens publics de l’établissement</p>
      <h3 className="mt-2 text-xl font-semibold text-ink">Accès client</h3>
      <p className="mt-2 text-sm text-ink/50">Tous les liens que l’Admin peut copier et ouvrir pour QR / NFC.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {[
          { label: 'Page établissement', description: 'Page publique principale', url: publicLink },
          { label: 'Programme fidélité', description: 'Accès direct au programme fidélité', url: window.location.origin + '/p/' + establishment.slug + '/loyalty' },
          { label: 'Menu digital', description: 'Accès direct au menu', url: window.location.origin + '/p/' + establishment.slug + '/menu' },
          { label: 'Avis Google', description: 'Accès direct à la section avis', url: window.location.origin + '/p/' + establishment.slug + '/reviews' },
        ].map((link) => (
          <div key={link.label} className="rounded-2xl border border-ink/5 bg-white p-4">
            <p className="text-sm font-semibold text-ink">{link.label}</p>
            <p className="mt-1 text-xs text-ink/45">{link.description}</p>
            <p className="mt-3 break-all rounded-lg bg-[#f7f7f3] p-2.5 text-[10px] text-ink/45">{link.url}</p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={() => navigator.clipboard.writeText(link.url).then(() => alert('Lien copié.'))} className="rounded-xl bg-forest px-3 py-2 text-[11px] font-semibold text-white">Copier</button>
              <a href={link.url} target="_blank" rel="noreferrer" className="rounded-xl border border-ink/10 px-3 py-2 text-[11px] font-semibold text-forest">Ouvrir ↗</a>
            </div>
          </div>
        ))}
      </div>
    </div>
    <div className="rounded-2xl border border-ink/5 bg-white p-6">
      <h3 className="font-semibold">Templates</h3>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-xs text-ink/50">Template page<select value={profile.page_template_id ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, page_template_id: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"><option value="">Automatique / défaut</option>{templates.filter((t) => t.kind === 'page' && t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
        <label className="text-xs text-ink/50">Template menu<select value={profile.menu_template_id ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, menu_template_id: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm"><option value="">Automatique / défaut</option>{templates.filter((t) => t.kind === 'menu' && t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      </div>
      <button onClick={saveProfile} className="mt-4 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Enregistrer les templates</button>
    </div>
  </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon?: typeof Building2;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        {Icon ? (
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-forest/10 text-forest">
            <Icon size={19} />
          </div>
        ) : null}
        <span className="text-2xl font-semibold text-forest">{value}</span>
      </div>
      <p className="mt-3 text-xs font-medium text-ink/50">{label}</p>
    </div>
  );
}

function CreateEstablishmentForm({
  close,
  reload,
  businessTypes,
}: {
  close: () => void;
  reload: () => Promise<void>;
  businessTypes: AIBusinessType[];
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [aiBusinessTypeId, setAIBusinessTypeId] = useState('');
  const [saving, setSaving] = useState(false);

  const generateSlug = (value: string) => {
    return value
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  };

  const handleNameChange = (value: string) => {
    setName(value);
    setSlug(generateSlug(value));
  };

  const create = async () => {
    if (!name.trim() || !slug.trim()) {
      alert('Veuillez remplir le nom de l’établissement.');
      return;
    }

    if (!aiBusinessTypeId) {
      alert('Veuillez sélectionner le type de l’établissement.');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('establishments')
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        ai_business_type_id: aiBusinessTypeId,
      });

    setSaving(false);

    if (error) {
      console.error(error);
      alert(`Erreur : ${error.message}`);
      return;
    }

    alert('Établissement créé avec succès.');

    setName('');
    setSlug('');
    setAIBusinessTypeId('');

    close();
    await reload();
  };

  return (
    <div className="mb-6 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">
            Nouvel établissement
          </h3>

          <p className="mt-1 text-xs text-ink/40">
            Créez d’abord l’établissement. Vous pourrez ensuite
            créer son responsable et ses employés.
          </p>
        </div>

        <button
          onClick={close}
          className="text-ink/40 hover:text-ink"
        >
          <X size={20} />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-xs font-semibold">
            Nom de l’établissement
          </label>

          <input
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="Ex : Restaurant Atlas"
            className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none transition focus:border-forest"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold">
            Slug
          </label>

          <input
            value={slug}
            onChange={(e) =>
              setSlug(generateSlug(e.target.value))
            }
            placeholder="restaurant-atlas"
            className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none transition focus:border-forest"
          />
        </div>

        <div className="md:col-span-2">
          <label className="mb-2 block text-xs font-semibold">
            Type d’établissement
          </label>

          <select
            value={aiBusinessTypeId}
            onChange={(e) => setAIBusinessTypeId(e.target.value)}
            className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
          >
            <option value="">Sélectionner le type de commerce</option>
            {businessTypes.filter((type) => type.active).map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>

          <p className="mt-2 text-[11px] text-ink/35">
            Ce choix détermine le comportement de l’analyse IA pour cet établissement.
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <button
          onClick={close}
          className="rounded-xl border border-ink/10 px-5 py-3 text-sm font-medium"
        >
          Annuler
        </button>

        <button
          onClick={create}
          disabled={saving}
          className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Création...' : 'Créer l’établissement'}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   RESPONSIBLES
========================================================= */

function ResponsiblesSection({
  establishments,
  staff,
  loading,
  reload,
}: {
  establishments: Establishment[];
  staff: StaffMember[];
  loading: boolean;
  reload: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] = useState('all');

  const establishmentMap = useMemo(
    () =>
      new Map(
        establishments.map((establishment) => [
          establishment.id,
          establishment,
        ])
      ),
    [establishments]
  );

  const visibleStaff =
    selectedEstablishment === 'all'
      ? staff
      : staff.filter(
          (member) => member.establishment_id === selectedEstablishment
        );

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
            Administration
          </p>

          <h2 className="font-display text-3xl text-forest md:text-4xl">
            Responsables
          </h2>

          <p className="mt-2 text-sm text-ink/50">
            Créez et gérez les responsables de chaque établissement.
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          disabled={establishments.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          <UserPlus size={16} />
          Nouveau responsable
        </button>
      </div>

      <div className="mb-5 max-w-xl rounded-2xl border border-ink/5 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-xs font-semibold">Établissement sélectionné</label>
        <select value={selectedEstablishment} onChange={(e) => setSelectedEstablishment(e.target.value)} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest">
          <option value="all">Tous les établissements</option>
          {establishments.map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}</option>)}
        </select>
      </div>

      {showForm && (
        <CreateStaffForm
          role="responsible"
          establishments={establishments}
          close={() => setShowForm(false)}
          reload={reload}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-ink/40">
            Chargement...
          </div>
        ) : visibleStaff.length === 0 ? (
          <EmptyStaff
            icon={UserRound}
            title="Aucun responsable"
            description="Créez le premier responsable d’un établissement."
          />
        ) : (
          <div className="divide-y divide-ink/5">
            {visibleStaff.map((member) => {
              const establishment =
                establishmentMap.get(member.establishment_id);

              return (
                <StaffRow
                  key={member.id}
                  member={member}
                  establishmentName={
                    establishment?.name ?? 'Établissement inconnu'
                  }
                  reload={reload}
                  establishments={establishments}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   EMPLOYEES
========================================================= */

function EmployeesSection({
  establishments,
  staff,
  loading,
  reload,
}: {
  establishments: Establishment[];
  staff: StaffMember[];
  loading: boolean;
  reload: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);
  const [selectedEstablishment, setSelectedEstablishment] = useState('all');

  const establishmentMap = useMemo(
    () =>
      new Map(
        establishments.map((establishment) => [
          establishment.id,
          establishment,
        ])
      ),
    [establishments]
  );

  const visibleStaff = selectedEstablishment === 'all' ? staff : staff.filter((member) => member.establishment_id === selectedEstablishment);

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
            Administration
          </p>

          <h2 className="font-display text-3xl text-forest md:text-4xl">
            Employés
          </h2>

          <p className="mt-2 text-sm text-ink/50">
            Créez et gérez les employés rattachés aux établissements.
          </p>
        </div>

        <button
          onClick={() => setShowForm(true)}
          disabled={establishments.length === 0}
          className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          <UserPlus size={16} />
          Nouvel employé
        </button>
      </div>

      <div className="mb-5 max-w-xl rounded-2xl border border-ink/5 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-xs font-semibold">Établissement sélectionné</label>
        <select value={selectedEstablishment} onChange={(e) => setSelectedEstablishment(e.target.value)} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest">
          <option value="all">Tous les établissements</option>
          {establishments.map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}</option>)}
        </select>
      </div>

      {showForm && (
        <CreateStaffForm
          role="employee"
          establishments={establishments}
          close={() => setShowForm(false)}
          reload={reload}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-ink/40">
            Chargement...
          </div>
        ) : visibleStaff.length === 0 ? (
          <EmptyStaff
            icon={Users}
            title="Aucun employé"
            description="Créez le premier employé d’un établissement."
          />
        ) : (
          <div className="divide-y divide-ink/5">
            {visibleStaff.map((member) => {
              const establishment =
                establishmentMap.get(member.establishment_id);

              return (
                <StaffRow
                  key={member.id}
                  member={member}
                  establishmentName={
                    establishment?.name ?? 'Établissement inconnu'
                  }
                  reload={reload}
                  establishments={establishments}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* =========================================================
   CREATE STAFF
========================================================= */

function CreateStaffForm({
  role,
  establishments,
  close,
  reload,
}: {
  role: 'responsible' | 'employee';
  establishments: Establishment[];
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [establishmentId, setEstablishmentId] = useState(
    establishments[0]?.id ?? ''
  );
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);

  const roleLabel =
    role === 'responsible' ? 'Responsable' : 'Employé';

  const createAccount = async () => {
    if (!establishmentId) {
      alert('Veuillez sélectionner un établissement.');
      return;
    }

    if (!name.trim()) {
      alert('Veuillez saisir le nom.');
      return;
    }

    // Les employés utilisent uniquement un code pour se connecter.
    if (role === 'employee') {
      if (code.trim().length < 4) {
        alert('Le code employé doit contenir au moins 4 caractères.');
        return;
      }

      setSaving(true);

      const { data, error } = await supabase.functions.invoke(
        'create-employee',
        {
          body: {
            establishment_id: establishmentId,
            name: name.trim(),
            code: code.trim(),
          },
        }
      );

      setSaving(false);

      if (error) {
        console.error('Erreur création employé:', error);
        alert(`Impossible de créer l’employé : ${error.message}`);
        return;
      }

      if (!data?.success) {
        alert(
          data?.error ??
            'Impossible de créer l’employé.'
        );
        return;
      }

      const establishmentName =
        establishments.find((item) => item.id === establishmentId)?.name ??
        'Établissement';

      alert(
        `Employé créé avec succès.\n\nNom : ${name.trim()}\nÉtablissement : ${establishmentName}\nCode de connexion : ${code.trim()}\n\nConserve bien ce code : il sera utilisé par l’employé pour accéder à son espace.`
      );

      setName('');
      setCode('');

      close();
      await reload();
      return;
    }

    // Les responsables conservent la connexion classique email + mot de passe.
    if (!email.trim()) {
      alert('Veuillez saisir l’email.');
      return;
    }

    if (password.length < 6) {
      alert(
        'Le mot de passe doit contenir au moins 6 caractères.'
      );
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.functions.invoke(
      'create-staff-account',
      {
        body: {
          establishment_id: establishmentId,
          email: email.trim().toLowerCase(),
          password,
          name: name.trim(),
          role,
        },
      }
    );

    setSaving(false);

    if (error) {
      console.error('Erreur création compte:', error);

      let detail = error.message;
      try {
        const context = (error as { context?: Response }).context;
        if (context) {
          const raw = await context.clone().text();
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as { error?: string; message?: string; details?: string };
              detail = parsed.error ?? parsed.message ?? parsed.details ?? raw;
            } catch {
              detail = raw;
            }
          }
        }
      } catch (diagnosticError) {
        console.error('Impossible de lire la réponse de l’Edge Function:', diagnosticError);
      }

      alert(`Impossible de créer le compte : ${detail}`);
      return;
    }

    if (!data?.success) {
      alert(
        data?.error ??
          'Impossible de créer le compte.'
      );
      return;
    }

    alert(
      `${roleLabel} créé avec succès.\n\nEmail : ${email.trim().toLowerCase()}\nMot de passe : ${password}`
    );

    setName('');
    setEmail('');
    setPassword('');

    close();
    await reload();
  };

  return (
    <div className="mb-6 rounded-2xl border border-gold/20 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
            Nouveau compte
          </p>

          <h3 className="mt-1 font-display text-2xl text-forest">
            Créer un {roleLabel.toLowerCase()}
          </h3>

          <p className="mt-1 text-xs text-ink/40">
            {role === 'employee'
              ? 'L’employé se connectera uniquement avec son code.'
              : 'Le responsable se connectera avec son email et son mot de passe.'}
          </p>
        </div>

        <button
          onClick={close}
          disabled={saving}
          className="text-ink/40 hover:text-ink disabled:opacity-40"
        >
          <X size={20} />
        </button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="mb-2 block text-xs font-semibold">
            Établissement
          </label>

          <select
            value={establishmentId}
            onChange={(e) =>
              setEstablishmentId(e.target.value)
            }
            disabled={saving}
            className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest disabled:opacity-50"
          >
            {establishments.map((establishment) => (
              <option
                key={establishment.id}
                value={establishment.id}
              >
                {establishment.name}
              </option>
            ))}
          </select>
        </div>
