import { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
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
  LayoutTemplate,
  TrendingUp,
  DollarSign,
  UsersRound,
  Percent,
  Printer,
  CreditCard,
  AlertTriangle,
  Activity,
  Search,
  Filter,
  CalendarDays,
  ExternalLink,
  ShieldCheck,
  WalletCards,
  Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import Templates from '@/pages/Templates';

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
  | 'codes'
  | 'reviews'
  | 'analysis'
  | 'ai'
  | 'templates'
  | 'analytics'
  | 'reports'
  | 'billing'
  | 'system';

export default function Admin() {
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

  const employeeMembers = useMemo(
    () => staff.filter((member) => member.role === 'STAFF'),
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
      id: 'employees',
      label: 'Employés',
      icon: Users,
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
      id: 'codes',
      label: 'Codes récompenses',
      icon: Gift,
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
      id: 'templates',
      label: 'Templates',
      icon: LayoutTemplate,
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
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm transition ${
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
                Administrateur TapMarrakech
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

          <div>
            <p className="text-xs text-ink/40">
              Administration TapMarrakech
            </p>

            <h1 className="text-sm font-semibold text-ink">
              {currentLabel}
            </h1>
          </div>

          <button
            onClick={reloadAll}
            className="flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-medium text-ink transition hover:bg-[#f7f7f3]"
          >
            <RefreshCw size={14} />
            Actualiser
          </button>
        </header>

        <main className="mx-auto max-w-[1440px] p-5 md:p-10">
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

          {section === 'employees' && (
            <EmployeesSection
              establishments={establishments}
              staff={employeeMembers}
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

          {section === 'codes' && (
            <RewardCodesSection
              establishments={establishments}
              responsibleMembers={responsibleMembers}
            />
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

          {section === 'templates' && <Templates />}

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
  const [establishmentDetail, setEstablishmentDetail] = useState({
    reviews: 0,
    averageRating: 0,
    loyaltyCustomers: 0,
    analyticsEvents: 0,
    loyaltyRevenue: 0,
  });
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    const loadDetail = async () => {
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
        setEstablishmentDetail({
          reviews: ratings.length,
          averageRating: ratings.length ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length : 0,
          loyaltyCustomers: loyaltyCustomers ?? 0,
          analyticsEvents: analyticsEvents ?? 0,
          loyaltyRevenue: (revenueRows ?? []).reduce((sum, row) => sum + Number(row.amount ?? 0), 0),
        });
      } catch (error) {
        console.error('Erreur vue établissement Admin:', error);
        if (mounted) {
          setEstablishmentDetail({
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
    loadDetail();
    return () => { mounted = false; };
  }, [selectedEstablishment]);

  const responsibles = staff.filter(
    (member) => member.role === 'MANAGER'
  );

  const employees = staff.filter(
    (member) => member.role === 'STAFF'
  );

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
          Administration
        </p>

        <h2 className="font-display text-3xl text-forest md:text-4xl">
          Bienvenue dans votre espace Admin
        </h2>

        <p className="mt-2 max-w-2xl text-sm text-ink/50">
          Gérez les établissements, les responsables et les employés
          de TapMarrakech depuis un seul espace.
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <StatCard
          icon={Building2}
          label="Établissements"
          value={loading ? '—' : establishments.length}
        />

        <StatCard
          icon={UserRound}
          label="Responsables"
          value={loading ? '—' : responsibles.length}
        />

        <StatCard
          icon={Users}
          label="Employés"
          value={loading ? '—' : employees.length}
        />
      </div>

      <div className="mt-8 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">Pilotage global</p>
            <h3 className="mt-1 text-xl font-semibold text-forest">Vue par établissement</h3>
            <p className="mt-1 text-xs text-ink/40">Sélectionne un établissement pour isoler ses indicateurs, ou conserve la vue globale.</p>
          </div>
          <select
            value={selectedEstablishment}
            onChange={(e) => setSelectedEstablishment(e.target.value)}
            className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm font-medium outline-none focus:border-forest lg:w-80"
          >
            <option value="all">Tous les établissements</option>
            {establishments.map((establishment) => (
              <option key={establishment.id} value={establishment.id}>{establishment.name}</option>
            ))}
          </select>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <AdminAnalyticsCard icon={MessageSquare} label="Avis" value={detailLoading ? '—' : String(establishmentDetail.reviews)} helper={selectedEstablishment === 'all' ? 'tous établissements' : 'établissement sélectionné'} />
          <AdminAnalyticsCard icon={BarChart3} label="Note moyenne" value={detailLoading ? '—' : establishmentDetail.averageRating.toFixed(1) + ' ★'} helper="sur 5" />
          <AdminAnalyticsCard icon={UsersRound} label="Clients fidélité" value={detailLoading ? '—' : establishmentDetail.loyaltyCustomers.toLocaleString('fr-FR')} helper="clients enregistrés" />
          <AdminAnalyticsCard icon={Activity} label="Événements" value={detailLoading ? '—' : establishmentDetail.analyticsEvents.toLocaleString('fr-FR')} helper="analytics" />
          <AdminAnalyticsCard icon={DollarSign} label="CA fidélité" value={detailLoading ? '—' : establishmentDetail.loyaltyRevenue.toLocaleString('fr-FR') + ' DH'} helper="transactions EARN" />
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-xl bg-[#f7f7f3] p-4">
            <p className="text-xs text-ink/40">Abonnements actifs</p>
            <p className="mt-1 text-xl font-semibold text-forest">{billing.subscriptions.filter((item) => item.status === 'active').length}</p>
          </div>
          <div className="rounded-xl bg-[#f7f7f3] p-4">
            <p className="text-xs text-ink/40">MRR</p>
            <p className="mt-1 text-xl font-semibold text-forest">{billing.available ? billing.mrr.toLocaleString('fr-FR') + ' DH' : '—'}</p>
          </div>
          <div className="rounded-xl bg-[#f7f7f3] p-4">
            <p className="text-xs text-ink/40">Événements globaux</p>
            <p className="mt-1 text-xl font-semibold text-forest">{globalStats.analyticsEvents.toLocaleString('fr-FR')}</p>
          </div>
        </div>
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">Accès rapide</p>
            <h3 className="mt-1 text-lg font-semibold text-forest">Raccourcis administrateur</h3>
          </div>
          <span className="hidden text-xs text-ink/35 md:block">Accédez directement aux modules</span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { id: 'establishments' as AdminSection, label: 'Établissements', description: 'Gérer les établissements', icon: Building2 },
            { id: 'responsibles' as AdminSection, label: 'Responsables', description: 'Gérer les responsables', icon: UserRound },
            { id: 'employees' as AdminSection, label: 'Employés', description: 'Gérer les équipes', icon: Users },
            { id: 'reviews' as AdminSection, label: 'Avis reçus', description: 'Consulter les avis', icon: MessageSquare },
            { id: 'analysis' as AdminSection, label: 'Analyse des avis', description: 'Analyser la réputation', icon: Brain },
            { id: 'codes' as AdminSection, label: 'Récompenses', description: 'Gérer les codes', icon: Gift },
            { id: 'analytics' as AdminSection, label: 'Analytics', description: 'Voir les données', icon: TrendingUp },
            { id: 'reports' as AdminSection, label: 'Rapports PDF', description: 'Créer les rapports', icon: Printer },
          ].map(({ id, label, description, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className="group flex items-center gap-4 rounded-2xl border border-ink/5 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-forest/15 hover:shadow-md"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest/10 text-forest transition group-hover:bg-forest group-hover:text-white">
                <Icon size={19} strokeWidth={1.8} />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink">{label}</p>
                <p className="mt-1 truncate text-[11px] text-ink/40">{description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-ink">
          Établissements récents
        </h3>

        {loading ? (
          <p className="mt-5 text-sm text-ink/40">
            Chargement...
          </p>
        ) : establishments.length === 0 ? (
          <p className="mt-5 text-sm text-ink/40">
            Aucun établissement pour le moment.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {establishments.slice(0, 5).map((establishment) => {
              const establishmentStaff = staff.filter(
                (member) =>
                  member.establishment_id === establishment.id
              );

              const manager = establishmentStaff.find(
                (member) => member.role === 'MANAGER'
              );

              return (
                <div
                  key={establishment.id}
                  className="flex flex-col gap-4 rounded-xl bg-[#f7f7f3] px-4 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid h-9 w-9 place-items-center rounded-lg bg-forest text-white">
                      <Building2 size={17} />
                    </div>

                    <div>
                      <p className="text-sm font-medium">
                        {establishment.name}
                      </p>

                      <p className="text-xs text-ink/40">
                        /{establishment.slug}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-xs text-ink/45">
                      Responsable
                    </p>

                    <p className="mt-1 text-xs font-semibold text-forest">
                      {manager?.name ?? 'Non défini'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
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
}: {
  establishments: Establishment[];
  loading: boolean;
  reload: () => Promise<void>;
  businessTypes: AIBusinessType[];
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
  const [menuCategoryName, setMenuCategoryName] = useState('');
  const [menuItem, setMenuItem] = useState({ name: '', description: '', price: '', category_id: '' });
  const [promotion, setPromotion] = useState({ name: '', description: '', normal_price: '', promo_price: '' });
  const [reward, setReward] = useState({ name: '', description: '', points_required: '' });

  const publicLink = `${window.location.origin}/r/${establishment.slug}`;
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
      const [{ data: c }, { data: i }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('establishment_id', establishment.id).order('display_order'),
        supabase.from('menu_items').select('*').eq('establishment_id', establishment.id).order('display_order'),
      ]);
      setCategories(c ?? []); setItems(i ?? []);
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

  useEffect(() => { loadTab(); }, [tab, establishment.id]);

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
    { id: 'reviews', label: 'Avis' }, { id: 'loyalty', label: 'Fidélité' }, { id: 'team', label: 'Équipe' }, { id: 'analytics', label: 'Analytics' }, { id: 'public', label: 'Lien public' },
  ];

  const field = (label: string, key: string, type = 'text') => (
    <label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">{label}</span><input type={type} value={profile[key] ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, [key]: e.target.value }))} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest" /></label>
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div><button onClick={onBack} className="mb-3 text-xs font-semibold text-forest">← Retour aux établissements</button><h2 className="font-display text-3xl text-forest">{profile.name ?? establishment.name}</h2><p className="mt-1 text-sm text-ink/45">{businessType} · espace de gestion complet</p></div>
        <a href={publicLink} target="_blank" rel="noreferrer" className="rounded-xl bg-forest px-4 py-3 text-center text-xs font-semibold text-white">Ouvrir la page publique ↗</a>
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

      {tab === 'menu' && <div className="space-y-5"><div className="grid gap-5 md:grid-cols-2"><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Catégories</h3><div className="mt-4 flex gap-2"><input value={menuCategoryName} onChange={(e) => setMenuCategoryName(e.target.value)} placeholder="Ex. Entrées" className="min-w-0 flex-1 rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><button onClick={addCategory} className="rounded-xl bg-forest px-4 text-xs font-semibold text-white">Ajouter</button></div><div className="mt-4 space-y-2">{categories.map((c) => <div key={c.id} className="flex items-center justify-between rounded-xl bg-[#f7f7f3] px-3 py-2.5 text-sm"><span>{c.name}</span><button onClick={async () => { const { error } = await supabase.from('menu_categories').update({ active: !c.active }).eq('id', c.id); if (error) alert(error.message); else loadTab(); }} className="text-xs text-ink/45">{c.active ? 'Actif' : 'Inactif'}</button></div>)}</div></div><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Nouveau produit</h3><div className="mt-4 space-y-3"><input value={menuItem.name} onChange={(e) => setMenuItem({ ...menuItem, name: e.target.value })} placeholder="Nom" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><select value={menuItem.category_id} onChange={(e) => setMenuItem({ ...menuItem, category_id: e.target.value })} className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"><option value="">Catégorie</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input value={menuItem.price} onChange={(e) => setMenuItem({ ...menuItem, price: e.target.value })} placeholder="Prix MAD" type="number" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><textarea value={menuItem.description} onChange={(e) => setMenuItem({ ...menuItem, description: e.target.value })} placeholder="Description" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><button onClick={addMenuItem} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Ajouter le produit</button></div></div></div><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Produits</h3><div className="mt-4 grid gap-2 md:grid-cols-2">{items.map((i) => <div key={i.id} className="rounded-xl bg-[#f7f7f3] p-3"><div className="flex justify-between gap-3"><strong className="text-sm">{i.name}</strong><span className="text-sm font-semibold">{Number(i.price).toFixed(2)} MAD</span></div><p className="mt-1 text-xs text-ink/45">{i.description || 'Sans description'}</p><button onClick={async () => { const { error } = await supabase.from('menu_items').update({ active: !i.active }).eq('id', i.id); if (error) alert(error.message); else loadTab(); }} className="mt-2 text-[11px] text-ink/45">{i.active ? 'Désactiver' : 'Activer'}</button></div>)}</div></div></div>}

      {tab === 'promotions' && <div className="space-y-5"><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Créer une promotion</h3><div className="mt-4 grid gap-3 md:grid-cols-4"><input value={promotion.name} onChange={(e) => setPromotion({ ...promotion, name: e.target.value })} placeholder="Nom" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><input value={promotion.description} onChange={(e) => setPromotion({ ...promotion, description: e.target.value })} placeholder="Description" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><input value={promotion.normal_price} onChange={(e) => setPromotion({ ...promotion, normal_price: e.target.value })} placeholder="Prix normal" type="number" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><input value={promotion.promo_price} onChange={(e) => setPromotion({ ...promotion, promo_price: e.target.value })} placeholder="Prix promo" type="number" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /></div><button onClick={addPromotion} className="mt-3 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Ajouter</button></div><div className="grid gap-3 md:grid-cols-2">{promotions.map((p) => <div key={p.id} className="rounded-2xl border border-ink/5 bg-white p-5"><div className="flex justify-between"><strong>{p.name}</strong><button onClick={async () => { const { error } = await supabase.from('promotions').update({ active: !p.active }).eq('id', p.id); if (error) alert(error.message); else loadTab(); }} className="text-xs text-ink/45">{p.active ? 'Actif' : 'Inactif'}</button></div><p className="mt-2 text-sm text-ink/55">{p.description || 'Sans description'}</p><p className="mt-3 text-sm font-semibold">{p.promo_price ?? '—'} MAD <span className="ml-2 text-xs text-ink/35 line-through">{p.normal_price ?? ''}</span></p></div>)}</div></div>}

      {tab === 'reviews' && <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><StatCard label="Avis" value={reviews.length} /><StatCard label="Note moyenne" value={reviews.length ? (reviews.reduce((a, r) => a + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : '—'} /><StatCard label="Dernier avis" value={reviews[0] ? new Date(reviews[0].created_at).toLocaleDateString('fr-FR') : '—'} /></div><div className="rounded-2xl border border-ink/5 bg-white p-5">{reviews.length === 0 ? <p className="text-sm text-ink/45">Aucun avis.</p> : <div className="space-y-3">{reviews.map((r) => <div key={r.id} className="rounded-xl bg-[#f7f7f3] p-4"><div className="flex justify-between"><strong>{r.rating}/5</strong><span className="text-xs text-ink/35">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span></div><p className="mt-2 text-sm text-ink/60">{r.feedback || r.comment || 'Aucun commentaire'}</p></div>)}</div>}</div></div>}

      {tab === 'loyalty' && (
        <div className="space-y-5">
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

      {tab === 'analytics' && <div className="grid gap-4 md:grid-cols-3"><StatCard label="Événements enregistrés" value={eventsCount} /><StatCard label="Avis" value={reviews.length || '—'} /><StatCard label="Page publique" value="/r/:slug" /></div>}

      {tab === 'public' && <div className="space-y-5"><div className="rounded-2xl border border-ink/5 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wider text-gold">Lien unique QR / NFC</p><h3 className="mt-2 text-xl font-semibold">{publicLink}</h3><p className="mt-2 text-sm text-ink/50">Ce lien doit devenir la page client complète : Wi-Fi, menu, promotions, fidélité, avis et modules adaptés au type d’établissement.</p><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(publicLink).then(() => alert('Lien copié.'))} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Copier le lien</button><a href={publicLink} target="_blank" rel="noreferrer" className="rounded-xl border border-ink/10 px-4 py-2.5 text-xs font-semibold">Tester la page</a></div></div><div className="rounded-2xl border border-ink/5 bg-white p-6"><h3 className="font-semibold">Templates</h3><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-xs text-ink/50">Template page<select value={profile.page_template_id ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, page_template_id: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"><option value="">Automatique / défaut</option>{templates.filter((t) => t.kind === 'page' && t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="text-xs text-ink/50">Template menu<select value={profile.menu_template_id ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, menu_template_id: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"><option value="">Automatique / défaut</option>{templates.filter((t) => t.kind === 'menu' && t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div><button onClick={saveProfile} className="mt-4 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Enregistrer les templates</button></div></div>}
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

        <div className={role === 'employee' ? 'md:col-span-2' : ''}>
          <label className="mb-2 block text-xs font-semibold">
            Nom complet
          </label>

          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            placeholder={
              role === 'responsible'
                ? 'Ex : Ahmed Alaoui'
                : 'Ex : Yassine Benali'
            }
            className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest disabled:opacity-50"
          />
        </div>

        {role === 'responsible' && (
          <>
            <div>
              <label className="mb-2 block text-xs font-semibold">
                Email
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={saving}
                placeholder="email@exemple.com"
                className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest disabled:opacity-50"
              />
            </div>

            <div className="md:col-span-2">
              <label className="mb-2 block text-xs font-semibold">
                Mot de passe initial
              </label>

              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={saving}
                placeholder="Minimum 6 caractères"
                className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest disabled:opacity-50"
              />

              <p className="mt-2 text-[11px] text-ink/35">
                Tu peux donner ce mot de passe au responsable.
              </p>
            </div>
          </>
        )}

        {role === 'employee' && (
          <div className="md:col-span-2">
            <label className="mb-2 block text-xs font-semibold">
              Code de connexion employé
            </label>

            <input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              disabled={saving}
              placeholder="Ex : 4829"
              autoComplete="off"
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-center text-lg font-semibold tracking-[0.25em] outline-none focus:border-forest disabled:opacity-50"
            />

            <p className="mt-2 text-[11px] text-ink/35">
              Minimum 4 caractères. Le code est enregistré sous forme sécurisée et ne sera pas affiché dans l’application après la création.
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-3">
        <button
          onClick={close}
          disabled={saving}
          className="rounded-xl border border-ink/10 px-5 py-3 text-sm font-medium disabled:opacity-40"
        >
          Annuler
        </button>

        <button
          onClick={createAccount}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          <UserPlus size={16} />

          {saving
            ? role === 'employee'
              ? 'Création de l’employé...'
              : 'Création du compte...'
            : `Créer le ${roleLabel.toLowerCase()}`}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   STAFF ROW
========================================================= */

function StaffRow({
  member,
  establishmentName,
  reload,
  establishments,
}: {
  member: StaffMember;
  establishmentName: string;
  reload: () => Promise<void>;
  establishments: Establishment[];
}) {
  const [saving, setSaving] = useState(false);

  const toggleActive = async () => {
    setSaving(true);

    const { error } = await supabase
      .from('establishment_staff')
      .update({
        active: !member.active,
      })
      .eq('id', member.id);

    setSaving(false);

    if (error) {
      console.error(error);
      alert(
        `Impossible de modifier le compte : ${error.message}`
      );
      return;
    }

    await reload();
  };

  return (
    <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
      <div className="flex min-w-0 items-center gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest text-white">
          {member.role === 'MANAGER' ? (
            <UserRound size={19} />
          ) : (
            <Users size={19} />
          )}
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold text-forest">
            {member.name}
          </h3>

          <p className="mt-1 truncate text-xs text-ink/45">
            {member.email}
          </p>

          <p className="mt-1 text-xs text-ink/40">
            {establishmentName}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-[#f4ead3] px-3 py-1.5 text-[10px] font-semibold text-forest">
          {member.role === 'MANAGER'
            ? 'RESPONSABLE'
            : 'EMPLOYÉ'}
        </span>

        <span
          className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${
            member.active
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {member.active ? 'ACTIF' : 'DÉSACTIVÉ'}
        </span>

        <EditStaffButton member={member} establishments={establishments} reload={reload} />

        <button
          onClick={toggleActive}
          disabled={saving}
          className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
            member.active
              ? 'border-red-200 text-red-600 hover:bg-red-50'
              : 'border-green-200 text-green-700 hover:bg-green-50'
          } disabled:opacity-40`}
        >
          <Power size={14} />

          {saving
            ? '...'
            : member.active
            ? 'Désactiver'
            : 'Activer'}
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   EDIT STAFF
========================================================= */
function EditStaffButton({ member, establishments, reload }: { member: StaffMember; establishments: Establishment[]; reload: () => Promise<void> }) {
  const [open, setOpen] = useState(false);
  return <>
    <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-xs font-medium hover:bg-[#f7f7f3]"><Pencil size={14} />Modifier</button>
    {open && <EditStaffModal member={member} establishments={establishments} close={() => setOpen(false)} reload={reload} />}
  </>;
}

function EditStaffModal({ member, establishments, close, reload }: { member: StaffMember; establishments: Establishment[]; close: () => void; reload: () => Promise<void> }) {
  const isEmployee = member.role === 'STAFF';
  const [name, setName] = useState(member.name);
  const [email, setEmail] = useState(member.email === '—' ? '' : member.email);
  const [establishmentId, setEstablishmentId] = useState(member.establishment_id);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [active, setActive] = useState(member.active);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !establishmentId) return alert('Nom et établissement obligatoires.');
    if (!isEmployee && !email.trim()) return alert('Email du responsable obligatoire.');
    if (!isEmployee && password && password.length < 6) return alert('Le mot de passe doit contenir au moins 6 caractères.');
    if (isEmployee && code && (code.length < 4 || code.length > 12)) return alert('Le code employé doit contenir entre 4 et 12 caractères.');
    setSaving(true);
    const { data, error } = await supabase.functions.invoke('admin-update-staff-account', { body: { staff_id: member.id, establishment_id: establishmentId, name: name.trim(), email: isEmployee ? (member.email === '—' ? '' : member.email) : email.trim().toLowerCase(), password: isEmployee ? '' : password.trim(), active } });
    if (error || !data?.success) { setSaving(false); alert(error ? `Impossible de modifier le compte : ${error.message}` : (data?.error ?? 'Impossible de modifier le compte.')); return; }
    if (isEmployee && code.trim()) {
      const { error: codeError } = await supabase.rpc('admin_set_employee_access_code', { p_employee_id: member.user_id, p_establishment_id: establishmentId, p_code: code.trim(), p_active: active });
      if (codeError) { setSaving(false); alert(`Compte modifié mais code non enregistré : ${codeError.message}`); await reload(); close(); return; }
    }
    setSaving(false);
    await reload();
    close();
    alert('Compte modifié avec succès.');
  };

  const retire = async () => {
    if (!window.confirm(`Retirer ${member.name} de cet établissement ?`)) return;
    setSaving(true);
    const { error } = await supabase.from('establishment_staff').update({ active: false }).eq('id', member.id);
    if (!error && isEmployee) await supabase.rpc('admin_set_employee_access_status', { p_employee_id: member.user_id, p_establishment_id: member.establishment_id, p_active: false });
    setSaving(false);
    if (error) return alert(`Impossible de retirer le compte : ${error.message}`);
    await reload(); close();
  };

  return <div className="fixed inset-0 z-[80] grid place-items-center bg-ink/50 p-4">
    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Administration</p><h3 className="mt-1 font-display text-2xl text-forest">Modifier {isEmployee ? 'l’employé' : 'le responsable'}</h3></div><button onClick={close} disabled={saving}><X size={20}/></button></div>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block"><span className="mb-1 block text-xs font-semibold">Nom</span><input value={name} onChange={e=>setName(e.target.value)} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm"/></label>
        {!isEmployee && <label className="block"><span className="mb-1 block text-xs font-semibold">Email</span><input type="email" value={email} onChange={e=>setEmail(e.target.value)} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm"/></label>}
        <label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold">Établissement</span><select value={establishmentId} onChange={e=>setEstablishmentId(e.target.value)} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm">{establishments.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label>
        {!isEmployee && <label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold">Nouveau mot de passe <span className="font-normal text-ink/35">(laisser vide pour conserver)</span></span><input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm"/></label>}
        {isEmployee && <label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold">Nouveau code employé <span className="font-normal text-ink/35">(laisser vide pour conserver)</span></span><input value={code} onChange={e=>setCode(e.target.value)} placeholder="4 à 12 caractères" className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-center text-lg tracking-[0.2em]"/></label>}
        <label className="flex items-center gap-3 rounded-xl bg-[#f7f7f3] p-4 md:col-span-2"><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/><span><strong className="block text-sm text-forest">Accès actif</strong><span className="text-xs text-ink/40">Désactiver coupe l’accès sans supprimer l’historique.</span></span></label>
      </div>
      <div className="mt-6 flex flex-wrap justify-between gap-3"><button onClick={retire} disabled={saving} className="rounded-xl border border-red-200 px-4 py-3 text-xs font-semibold text-red-600">Retirer de l’établissement</button><div className="flex gap-3"><button onClick={close} disabled={saving} className="rounded-xl border border-ink/10 px-5 py-3 text-sm">Annuler</button><button onClick={save} disabled={saving} className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white">{saving ? 'Enregistrement...' : 'Enregistrer'}</button></div></div>
    </div>
  </div>;
}

/* =========================================================
   REWARD CODES
========================================================= */

function RewardCodesSection({
  establishments,
  responsibleMembers,
}: {
  establishments: Establishment[];
  responsibleMembers: StaffMember[];
}) {
  const [selectedEstablishment, setSelectedEstablishment] = useState(establishments[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!selectedEstablishment && establishments.length > 0) {
      setSelectedEstablishment(establishments[0].id);
    }
  }, [establishments, selectedEstablishment]);

  const saveCode = async () => {
    if (!selectedEstablishment) return alert('Veuillez sélectionner un établissement.');
    if (code.trim().length < 4) return alert('Le code doit contenir au moins 4 caractères.');
    if (code !== confirmCode) return alert('Les deux codes ne correspondent pas.');

    setSaving(true);
    try {
      const { data, error } = await supabase.rpc('set_loyalty_admin_code', {
        target_establishment_id: selectedEstablishment,
        new_code: code,
      });

      if (error) throw error;
      if (data !== true) throw new Error("Le code n'a pas pu être enregistré.");

      setCode('');
      setConfirmCode('');
      alert('Code récompense enregistré. Le responsable peut maintenant l’utiliser pour valider les récompenses.');
    } catch (error) {
      console.error('Erreur code récompense:', error);
      alert(`Impossible d'enregistrer le code : ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    } finally {
      setSaving(false);
    }
  };

  if (establishments.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">Fidélité</p>
          <h2 className="font-display text-3xl text-forest md:text-4xl">Codes récompenses</h2>
        </div>
        <EmptyStaff icon={Gift} title="Aucun établissement" description="Créez d’abord un établissement avant de configurer son code récompense." />
      </div>
    );
  }

  const responsibleByEstablishment = new Map<string, StaffMember[]>();
  for (const member of responsibleMembers) {
    const list = responsibleByEstablishment.get(member.establishment_id) ?? [];
    list.push(member);
    responsibleByEstablishment.set(member.establishment_id, list);
  }

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">Fidélité</p>
        <h2 className="font-display text-3xl text-forest md:text-4xl">Codes récompenses</h2>
        <p className="mt-2 max-w-3xl text-sm text-ink/50">
          Gestion des responsables et du code de validation des récompenses. Pour des raisons de sécurité, le code existant n’est jamais relu ni affiché en clair : l’Admin peut uniquement le remplacer.
        </p>
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        {establishments.map((establishment) => {
          const responsibles = responsibleByEstablishment.get(establishment.id) ?? [];
          const isSelected = selectedEstablishment === establishment.id;
          return (
            <button
              key={establishment.id}
              type="button"
              onClick={() => setSelectedEstablishment(establishment.id)}
              className={`rounded-2xl border bg-white p-5 text-left shadow-sm transition ${isSelected ? 'border-gold/50 ring-2 ring-gold/10' : 'border-ink/5 hover:border-ink/15'}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ink/35">Établissement</p>
                  <h3 className="mt-1 text-base font-semibold text-forest">{establishment.name}</h3>
                </div>
                <span className="rounded-full bg-forest/10 px-3 py-1 text-[10px] font-semibold text-forest">
                  {responsibles.length} responsable{responsibles.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className="mt-4 space-y-2">
                {responsibles.length === 0 ? (
                  <p className="text-xs text-ink/40">Aucun responsable affecté.</p>
                ) : responsibles.map((member) => (
                  <div key={member.id} className="flex items-center justify-between rounded-xl bg-[#f7f7f3] px-3 py-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink">{member.name}</p>
                      <p className="truncate text-xs text-ink/40">{member.email}</p>
                    </div>
                    <span className="shrink-0 rounded-lg bg-white px-2 py-1 font-mono text-xs text-ink/45">••••••</span>
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Configuration</p>
            <h3 className="mt-1 text-xl font-semibold text-forest">
              Code de {establishments.find((item) => item.id === selectedEstablishment)?.name ?? 'l’établissement'}
            </h3>
            <p className="mt-2 text-xs leading-5 text-ink/45">
              Le responsable conserve son accès. Une demande de changement peut être traitée ici en remplaçant le code actuel.
            </p>
          </div>
          <div className="rounded-xl bg-[#f7f7f3] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/35">Code actuel</p>
            <p className="mt-1 font-mono text-sm tracking-[0.2em] text-ink/50">••••••</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold">Nouveau code récompense</span>
            <input type="password" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Minimum 4 caractères" autoComplete="new-password" className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-center text-lg tracking-[0.2em] outline-none focus:border-forest" />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold">Confirmer le code</span>
            <input type="password" value={confirmCode} onChange={(e) => setConfirmCode(e.target.value)} placeholder="Retapez le code" autoComplete="new-password" className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-center text-lg tracking-[0.2em] outline-none focus:border-forest" />
          </label>
        </div>

        <div className="mt-5 flex items-center gap-3 rounded-xl border border-gold/20 bg-[#fdf9ef] p-4">
          <LockKeyhole size={18} className="shrink-0 text-gold" />
          <p className="text-xs leading-5 text-ink/50">
            Le stockage du code reste protégé par le mécanisme existant. Cette interface ne tente pas de récupérer le code en clair.
          </p>
        </div>

        <div className="mt-5 flex justify-end">
          <button onClick={saveCode} disabled={saving || !code.trim() || !confirmCode.trim()} className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-40">
            <CheckCircle2 size={16} />
            {saving ? 'Enregistrement...' : 'Remplacer le code'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   ANALYSE DES AVIS
========================================================= */

type ReviewAnalysis = {
  summary: string;
  sentiment: string;
  satisfaction_score: number;
  strengths: string[];
  weaknesses: string[];
  recurring_issues: {
    topic: string;
    frequency: string;
    priority: string;
    explanation: string;
  }[];
  recommendations: {
    priority: string;
    action: string;
    reason: string;
  }[];
  actions_prioritaires: {
    priority: string;
    action: string;
    reason: string;
    impact: string;
  }[];
};

type ReviewAnalysisResponse = {
  success: boolean;
  statistics: {
    total_reviews: number;
    average_rating: number;
    positive_reviews: number;
    negative_reviews: number;
    rating_distribution: Record<string, number>;
  };
  analysis: ReviewAnalysis;
};

function ReviewAnalysisSection({
  establishments,
}: {
  establishments: Establishment[];
}) {
  const [selectedEstablishment, setSelectedEstablishment] = useState('all');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReviewAnalysisResponse | null>(null);
  const [error, setError] = useState('');

  const analyzeReviews = async () => {
    setLoading(true);
    setError('');
    setResult(null);

    const { data, error: functionError } = await supabase.functions.invoke(
      'analyze-reviews',
      {
        body:
          selectedEstablishment === 'all'
            ? {}
            : { establishment_id: selectedEstablishment },
      }
    );

    if (functionError) {
      console.error('Erreur analyse IA:', functionError);
      setError(
        functionError.message ||
          'Impossible de lancer l’analyse des avis.'
      );
      setLoading(false);
      return;
    }

    if (!data?.success || !data?.analysis) {
      console.error('Réponse analyse IA invalide:', data);
      setError(
        data?.error ||
          'La réponse de l’IA est invalide.'
      );
      setLoading(false);
      return;
    }

    const rawAnalysis = data.analysis as Partial<ReviewAnalysis>;

    const normalizedAnalysis: ReviewAnalysis = {
      summary:
        typeof rawAnalysis.summary === 'string'
          ? rawAnalysis.summary
          : '',
      sentiment:
        typeof rawAnalysis.sentiment === 'string'
          ? rawAnalysis.sentiment
          : 'Non déterminé',
      satisfaction_score:
        typeof rawAnalysis.satisfaction_score === 'number'
          ? rawAnalysis.satisfaction_score
          : 0,
      strengths: Array.isArray(rawAnalysis.strengths)
        ? rawAnalysis.strengths.filter(
            (item): item is string => typeof item === 'string'
          )
        : [],
      weaknesses: Array.isArray(rawAnalysis.weaknesses)
        ? rawAnalysis.weaknesses.filter(
            (item): item is string => typeof item === 'string'
          )
        : [],
      recurring_issues: Array.isArray(rawAnalysis.recurring_issues)
        ? rawAnalysis.recurring_issues.filter(
            (item): item is ReviewAnalysis['recurring_issues'][number] =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof item.topic === 'string' &&
              typeof item.frequency === 'string' &&
              typeof item.priority === 'string' &&
              typeof item.explanation === 'string'
          )
        : [],
      recommendations: Array.isArray(rawAnalysis.recommendations)
        ? rawAnalysis.recommendations.filter(
            (item): item is ReviewAnalysis['recommendations'][number] =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof item.priority === 'string' &&
              typeof item.action === 'string' &&
              typeof item.reason === 'string'
          )
        : [],
      actions_prioritaires: Array.isArray(rawAnalysis.actions_prioritaires)
        ? rawAnalysis.actions_prioritaires.filter(
            (item): item is ReviewAnalysis['actions_prioritaires'][number] =>
              Boolean(item) &&
              typeof item === 'object' &&
              typeof item.priority === 'string' &&
              typeof item.action === 'string' &&
              typeof item.reason === 'string' &&
              typeof item.impact === 'string'
          )
        : [],
    };

    setResult({
      ...(data as ReviewAnalysisResponse),
      analysis: normalizedAnalysis,
    });
    setLoading(false);
  };

  const selectedName =
    selectedEstablishment === 'all'
      ? 'Tous les établissements'
      : establishments.find((item) => item.id === selectedEstablishment)?.name ??
        'Établissement';

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
            Intelligence artificielle
          </p>

          <h2 className="font-display text-3xl text-forest md:text-4xl">
            Analyse des avis
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-ink/50">
            Analyse automatiquement les avis clients et transforme les retours en
            actions concrètes adaptées au secteur de l’établissement.
          </p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end">
          <div className="flex-1">
            <label className="mb-2 block text-xs font-semibold">
              Établissement à analyser
            </label>

            <select
              value={selectedEstablishment}
              onChange={(e) => {
                setSelectedEstablishment(e.target.value);
                setResult(null);
                setError('');
              }}
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
            >
              <option value="all">Tous les établissements</option>
              {establishments.map((establishment) => (
                <option key={establishment.id} value={establishment.id}>
                  {establishment.name}
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={analyzeReviews}
            disabled={loading || establishments.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Brain size={17} />
            {loading ? 'Analyse en cours...' : 'Analyser avec l’IA'}
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {!result && !loading && !error && (
        <div className="rounded-2xl border border-dashed border-ink/10 bg-white p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-forest/10 text-forest">
            <Brain size={25} />
          </div>
          <h3 className="mt-5 text-base font-semibold">
            Prêt à analyser les avis
          </h3>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-ink/45">
            Choisis un établissement ou tous les établissements, puis lance
            l’analyse IA.
          </p>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-ink/5 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto h-9 w-9 animate-spin rounded-full border-2 border-forest border-t-transparent" />
          <p className="mt-4 text-sm font-medium text-ink/60">
            L’IA analyse les avis de {selectedName}...
          </p>
          <p className="mt-1 text-xs text-ink/35">
            Cela peut prendre quelques secondes.
          </p>
        </div>
      )}

      {result && !loading && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={MessageSquare}
              label="Avis analysés"
              value={result.statistics.total_reviews}
            />
            <StatCard
              icon={BarChart3}
              label="Note moyenne"
              value={`${result.statistics.average_rating.toFixed(1)} ★`}
            />
            <StatCard
              icon={CheckCircle2}
              label="Avis positifs"
              value={result.statistics.positive_reviews}
            />
            <StatCard
              icon={MessageSquare}
              label="Avis négatifs / moyens"
              value={result.statistics.negative_reviews}
            />
          </div>

          <div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest/45">
                  Synthèse IA
                </p>
                <h3 className="mt-2 text-xl font-semibold text-forest">
                  {selectedName}
                </h3>
              </div>

              <div className="rounded-xl bg-[#f7f7f3] px-4 py-3 text-center">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink/35">
                  Satisfaction
                </p>
                <p className="mt-1 text-2xl font-semibold text-forest">
                  {result.analysis.satisfaction_score}/100
                </p>
              </div>
            </div>

            <p className="mt-5 text-sm leading-7 text-ink/70">
              {result.analysis.summary}
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest">
                Sentiment : {result.analysis.sentiment}
              </span>
              <span className="rounded-full bg-ink/5 px-3 py-1.5 text-xs font-semibold text-ink/55">
                {result.statistics.total_reviews} avis analysés
              </span>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <AnalysisListCard
              title="Points forts"
              items={result.analysis.strengths}
              emptyText="Aucun point fort clairement identifié."
            />
            <AnalysisListCard
              title="Points à améliorer"
              items={result.analysis.weaknesses}
              emptyText="Aucun point faible clairement identifié."
            />
          </div>

          <div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest/45">
                Thèmes récurrents
              </p>
              <h3 className="mt-2 text-xl font-semibold text-forest">
                Ce qui ressort des avis
              </h3>
            </div>

            {result.analysis.recurring_issues.length === 0 ? (
              <p className="mt-5 text-sm text-ink/45">
                Aucun thème récurrent suffisamment clair n’a été identifié.
              </p>
            ) : (
              <div className="mt-5 space-y-3">
                {result.analysis.recurring_issues.map((issue, index) => (
                  <div
                    key={`${issue.topic}-${index}`}
                    className="rounded-xl border border-ink/5 bg-[#fdfdfb] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-ink">{issue.topic}</h4>
                      <span className="rounded-full bg-ink/5 px-2.5 py-1 text-[10px] font-semibold text-ink/50">
                        {issue.frequency}
                      </span>
                      <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                        Priorité : {issue.priority}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink/60">
                      {issue.explanation}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest/45">
                Plan d’action
              </p>
              <h3 className="mt-2 text-xl font-semibold text-forest">
                3 actions prioritaires
              </h3>
              <p className="mt-2 text-sm text-ink/45">
                Les actions proposées sont basées sur les avis analysés et le
                secteur de l’établissement.
              </p>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-3">
              {result.analysis.actions_prioritaires.map((action, index) => (
                <div
                  key={`${action.action}-${index}`}
                  className="rounded-2xl border border-ink/5 bg-[#fdfdfb] p-5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-forest text-sm font-semibold text-white">
                      {index + 1}
                    </span>
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700">
                      {action.priority}
                    </span>
                  </div>

                  <h4 className="mt-4 font-semibold leading-6 text-ink">
                    {action.action}
                  </h4>

                  <p className="mt-3 text-sm leading-6 text-ink/55">
                    <strong className="text-ink/70">Pourquoi :</strong>{' '}
                    {action.reason}
                  </p>

                  <p className="mt-3 text-sm leading-6 text-ink/55">
                    <strong className="text-ink/70">Impact attendu :</strong>{' '}
                    {action.impact}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {result.analysis.recommendations.length > 0 && (
            <div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest/45">
                Recommandations complémentaires
              </p>
              <div className="mt-4 space-y-3">
                {result.analysis.recommendations.map((recommendation, index) => (
                  <div
                    key={`${recommendation.action}-${index}`}
                    className="rounded-xl border border-ink/5 bg-[#fdfdfb] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-forest/10 px-2.5 py-1 text-[10px] font-semibold text-forest">
                        {recommendation.priority}
                      </span>
                      <h4 className="font-semibold text-ink">
                        {recommendation.action}
                      </h4>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-ink/55">
                      {recommendation.reason}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={analyzeReviews}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-3 text-xs font-semibold text-ink transition hover:bg-[#f7f7f3] disabled:opacity-40"
            >
              <RefreshCw size={14} />
              Relancer l’analyse
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function AnalysisListCard({
  title,
  items,
  emptyText,
}: {
  title: string;
  items: string[];
  emptyText: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest/45">
        {title}
      </p>

      {items.length === 0 ? (
        <p className="mt-5 text-sm text-ink/45">{emptyText}</p>
      ) : (
        <div className="mt-5 space-y-3">
          {items.map((item, index) => (
            <div
              key={`${item}-${index}`}
              className="flex gap-3 rounded-xl bg-[#fdfdfb] p-4"
            >
              <span className="mt-0.5 text-sm font-semibold text-forest">
                ✓
              </span>
              <p className="text-sm leading-6 text-ink/65">{item}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================
   REVIEWS
========================================================= */

type AdminReview = {
  id: string;
  establishment_id: string;
  rating: number;
  type: 'positive' | 'negative';
  comment: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  status: 'Nouveau' | 'En cours' | 'Traité';
  created_at: string;
};

function ReviewsSection({
  establishments,
}: {
  establishments: Establishment[];
}) {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEstablishment, setSelectedEstablishment] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');

  const loadReviews = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('reviews')
      .select(
        'id, establishment_id, rating, type, comment, name, phone, email, status, created_at'
      )
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur avis:', error);
      setReviews([]);
    } else {
      setReviews(data ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const establishmentMap = useMemo(
    () =>
      new Map(
        establishments.map((establishment) => [
          establishment.id,
          establishment.name,
        ])
      ),
    [establishments]
  );

  const filteredReviews = useMemo(() => {
    return reviews.filter((review) => {
      const establishmentMatch =
        selectedEstablishment === 'all' ||
        review.establishment_id === selectedEstablishment;

      const statusMatch =
        selectedStatus === 'all' || review.status === selectedStatus;

      return establishmentMatch && statusMatch;
    });
  }, [reviews, selectedEstablishment, selectedStatus]);

  const newCount = reviews.filter(
    (review) => review.status === 'Nouveau'
  ).length;

  const positiveCount = reviews.filter(
    (review) => review.type === 'positive'
  ).length;

  const averageRating =
    reviews.length > 0
      ? (
          reviews.reduce((total, review) => total + review.rating, 0) /
          reviews.length
        ).toFixed(1)
      : '0.0';

  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
            Réputation
          </p>

          <h2 className="font-display text-3xl text-forest md:text-4xl">
            Avis reçus
          </h2>

          <p className="mt-2 max-w-2xl text-sm text-ink/50">
            Consultez les avis reçus par tous les établissements TapMarrakech.
          </p>
        </div>

        <button
          onClick={loadReviews}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-3 text-xs font-semibold transition hover:bg-[#f7f7f3]"
        >
          <RefreshCw size={14} />
          Actualiser
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={MessageSquare}
          label="Total avis"
          value={loading ? '—' : reviews.length}
        />

        <StatCard
          icon={CheckCircle2}
          label="Nouveaux"
          value={loading ? '—' : newCount}
        />

        <StatCard
          icon={BarChart3}
          label="Note moyenne"
          value={loading ? '—' : `${averageRating} ★`}
        />

        <StatCard
          icon={MessageSquare}
          label="Avis positifs"
          value={loading ? '—' : positiveCount}
        />
      </div>

      <div className="mb-6 rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs font-semibold">
              Établissement
            </label>

            <select
              value={selectedEstablishment}
              onChange={(e) => setSelectedEstablishment(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
            >
              <option value="all">Tous les établissements</option>

              {establishments.map((establishment) => (
                <option key={establishment.id} value={establishment.id}>
                  {establishment.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold">
              Statut
            </label>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
            >
              <option value="all">Tous les statuts</option>
              <option value="Nouveau">Nouveau</option>
              <option value="En cours">En cours</option>
              <option value="Traité">Traité</option>
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-sm">
        {loading ? (
          <div className="p-10 text-center text-sm text-ink/40">
            Chargement des avis...
          </div>
        ) : filteredReviews.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-forest/10 text-forest">
              <MessageSquare size={25} />
            </div>

            <h3 className="mt-5 text-base font-semibold">Aucun avis</h3>

            <p className="mx-auto mt-2 max-w-md text-sm text-ink/45">
              Aucun avis ne correspond aux filtres sélectionnés.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-ink/5">
            {filteredReviews.map((review) => {
              const establishmentName =
                establishmentMap.get(review.establishment_id) ??
                'Établissement inconnu';

              return (
                <div
                  key={review.id}
                  className="p-5 transition hover:bg-[#fdfdfb]"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-lg bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest">
                          {establishmentName}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${
                            review.type === 'positive'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {review.type === 'positive' ? 'POSITIF' : 'NÉGATIF'}
                        </span>

                        <span
                          className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${
                            review.status === 'Nouveau'
                              ? 'bg-blue-100 text-blue-700'
                              : review.status === 'En cours'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {review.status}
                        </span>
                      </div>

                      <div className="mt-4 flex items-center gap-2">
                        <div className="flex gap-0.5">
                          {Array.from({ length: 5 }).map((_, index) => (
                            <span
                              key={index}
                              className={
                                index < review.rating
                                  ? 'text-gold'
                                  : 'text-ink/15'
                              }
                            >
                              ★
                            </span>
                          ))}
                        </div>

                        <span className="text-xs font-semibold text-ink/60">
                          {review.rating}/5
                        </span>
                      </div>

                      {review.comment && (
                        <p className="mt-4 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-ink/70">
                          « {review.comment} »
                        </p>
                      )}

                      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink/40">
                        {review.name && (
                          <span>
                            Client :{' '}
                            <strong className="font-medium text-ink/60">
                              {review.name}
                            </strong>
                          </span>
                        )}

                        {review.phone && <span>Tél : {review.phone}</span>}

                        {review.email && <span>Email : {review.email}</span>}

                        <span>{formatDate(review.created_at)}</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span className="text-[11px] text-ink/30">
                        Avis #{review.id.slice(0, 8)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reviews.length > 0 && (
        <p className="mt-4 text-xs text-ink/35">
          {filteredReviews.length} avis affiché
          {filteredReviews.length > 1 ? 's' : ''} sur {reviews.length}.
        </p>
      )}
    </div>
  );
}

/* =========================================================
   PILOTAGE ANALYTICS ADMIN
========================================================= */

function AdminAnalyticsSection({
  establishments,
}: {
  establishments: Establishment[];
}) {
  const [period, setPeriod] = useState<7 | 30 | 90 | 180 | 365>(30);
  const [selectedEstablishment, setSelectedEstablishment] = useState('all');
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<Array<{ establishment_id: string; amount: number | null; points: number; created_at: string }>>([]);
  const [redemptions, setRedemptions] = useState<Array<{ establishment_id: string; points_used: number; reward_cost_mad: number | null; created_at: string }>>([]);
  const [reviews, setReviews] = useState<Array<{ establishment_id: string; rating: number; type: string | null; created_at: string }>>([]);
  const [events, setEvents] = useState<Array<{ establishment_id: string; created_at: string }>>([]);

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const since = new Date();
      since.setDate(since.getDate() - period);
      const establishmentFilter = selectedEstablishment === 'all' ? null : selectedEstablishment;

      let txQuery = supabase.from('loyalty_transactions').select('establishment_id, amount, points, created_at').gte('created_at', since.toISOString()).eq('type', 'EARN');
      let redemptionQuery = supabase.from('loyalty_redemptions').select('establishment_id, points_used, reward_cost_mad, created_at').gte('created_at', since.toISOString());
      let reviewQuery = supabase.from('reviews').select('establishment_id, rating, type, created_at').gte('created_at', since.toISOString());
      let eventQuery = supabase.from('analytics_events').select('establishment_id, created_at').gte('created_at', since.toISOString());

      if (establishmentFilter) {
        txQuery = txQuery.eq('establishment_id', establishmentFilter);
        redemptionQuery = redemptionQuery.eq('establishment_id', establishmentFilter);
        reviewQuery = reviewQuery.eq('establishment_id', establishmentFilter);
        eventQuery = eventQuery.eq('establishment_id', establishmentFilter);
      }

      const [txResult, redemptionResult, reviewResult, eventResult] = await Promise.all([
        txQuery,
        redemptionQuery,
        reviewQuery,
        eventQuery,
      ]);

      if (txResult.error) throw txResult.error;
      if (redemptionResult.error) throw redemptionResult.error;
      if (reviewResult.error) throw reviewResult.error;
      if (eventResult.error) throw eventResult.error;

      setTransactions(txResult.data ?? []);
      setRedemptions(redemptionResult.data ?? []);
      setReviews(reviewResult.data ?? []);
      setEvents(eventResult.data ?? []);
    } catch (error) {
      console.error('Erreur analytics globales:', error);
      setTransactions([]);
      setRedemptions([]);
      setReviews([]);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [period, selectedEstablishment]);

  const establishmentMap = useMemo(
    () => new Map(establishments.map((item) => [item.id, item.name])),
    [establishments]
  );

  const visibleTransactions = useMemo(
    () => transactions.filter((row) => establishmentMap.has(row.establishment_id)),
    [transactions, establishmentMap]
  );
  const visibleRedemptions = useMemo(
    () => redemptions.filter((row) => establishmentMap.has(row.establishment_id)),
    [redemptions, establishmentMap]
  );
  const visibleReviews = useMemo(
    () => reviews.filter((row) => establishmentMap.has(row.establishment_id)),
    [reviews, establishmentMap]
  );
  const visibleEvents = useMemo(
    () => events.filter((row) => establishmentMap.has(row.establishment_id)),
    [events, establishmentMap]
  );

  const revenue = visibleTransactions.reduce((sum, row) => sum + Number(row.amount ?? 0), 0);
  const transactionCount = visibleTransactions.length;
  const averageTicket = transactionCount > 0 ? revenue / transactionCount : 0;
  const pointsEarned = visibleTransactions.reduce((sum, row) => sum + Number(row.points ?? 0), 0);
  const redemptionCount = visibleRedemptions.length;
  const rewardCost = visibleRedemptions.reduce((sum, row) => sum + Number(row.reward_cost_mad ?? 0), 0);
  const netContribution = revenue - rewardCost;
  const rewardCostRate = revenue > 0 ? (rewardCost / revenue) * 100 : 0;
  const averageRating = visibleReviews.length
    ? visibleReviews.reduce((sum, row) => sum + Number(row.rating ?? 0), 0) / visibleReviews.length
    : 0;
  const positiveReviews = visibleReviews.filter((row) => row.type === 'positive' || Number(row.rating) >= 4).length;
  const negativeReviews = visibleReviews.filter((row) => row.type === 'negative' || Number(row.rating) <= 3).length;

  const byEstablishment = useMemo(() => {
    const map = new Map<string, {
      id: string;
      name: string;
      revenue: number;
      transactions: number;
      rewards: number;
      rewardCost: number;
      reviews: number;
      ratingTotal: number;
      events: number;
      points: number;
    }>();

    for (const establishment of establishments) {
      map.set(establishment.id, {
        id: establishment.id,
        name: establishment.name,
        revenue: 0,
        transactions: 0,
        rewards: 0,
        rewardCost: 0,
        reviews: 0,
        ratingTotal: 0,
        events: 0,
        points: 0,
      });
    }

    for (const row of transactions) {
      const item = map.get(row.establishment_id);
      if (!item) continue;
      item.revenue += Number(row.amount ?? 0);
      item.transactions += 1;
      item.points += Number(row.points ?? 0);
    }
    for (const row of redemptions) {
      const item = map.get(row.establishment_id);
      if (!item) continue;
      item.rewards += 1;
      item.rewardCost += Number(row.reward_cost_mad ?? 0);
    }
    for (const row of reviews) {
      const item = map.get(row.establishment_id);
      if (!item) continue;
      item.reviews += 1;
      item.ratingTotal += Number(row.rating ?? 0);
    }
    for (const row of events) {
      const item = map.get(row.establishment_id);
      if (!item) continue;
      item.events += 1;
    }

    return Array.from(map.values()).filter((item) =>
      selectedEstablishment === 'all'
        ? item.revenue > 0 || item.rewards > 0 || item.reviews > 0 || item.events > 0
        : item.id === selectedEstablishment
    );
  }, [establishments, transactions, redemptions, reviews, events, selectedEstablishment]);

  const formatMad = (value: number) =>
    `${value.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} DH`;

  return (
    <div>
      <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">Pilotage</p>
          <h2 className="font-display text-3xl text-forest md:text-4xl">Analytics globales</h2>
          <p className="mt-2 max-w-3xl text-sm text-ink/50">
            Une vue consolidée des avis, de la fidélité et des événements enregistrés pour chaque établissement.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select value={selectedEstablishment} onChange={(e) => setSelectedEstablishment(e.target.value)} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm font-medium text-ink outline-none focus:border-forest">
            <option value="all">Tous les établissements</option>
            {establishments.map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}</option>)}
          </select>
          <select value={period} onChange={(e) => setPeriod(Number(e.target.value) as 7 | 30 | 90 | 180 | 365)} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm font-medium text-ink outline-none focus:border-forest">
            <option value={7}>7 derniers jours</option>
            <option value={30}>30 derniers jours</option>
            <option value={90}>3 derniers mois</option>
            <option value={180}>6 derniers mois</option>
            <option value={365}>12 derniers mois</option>
          </select>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <AdminAnalyticsCard icon={MessageSquare} label="Avis" value={loading ? '—' : String(visibleReviews.length)} helper={`${positiveReviews} positifs · ${negativeReviews} négatifs`} />
        <AdminAnalyticsCard icon={BarChart3} label="Note moyenne" value={loading ? '—' : `${averageRating.toFixed(1)} ★`} helper="sur 5" />
        <AdminAnalyticsCard icon={DollarSign} label="CA fidélité" value={loading ? '—' : formatMad(revenue)} helper={`${transactionCount} transactions`} />
        <AdminAnalyticsCard icon={TrendingUp} label="Panier moyen" value={loading ? '—' : formatMad(averageTicket)} helper="par transaction" />
        <AdminAnalyticsCard icon={UsersRound} label="Points distribués" value={loading ? '—' : pointsEarned.toLocaleString('fr-FR')} helper="sur la période" />
        <AdminAnalyticsCard icon={Activity} label="Événements" value={loading ? '—' : visibleEvents.length.toLocaleString('fr-FR')} helper="analytics" />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-2xl border border-ink/10 bg-white p-5">
          <div className="mb-5">
            <h3 className="text-base font-semibold text-forest">Détail par établissement</h3>
            <p className="mt-1 text-xs text-ink/40">Avis, fidélité, récompenses et analytics sur la période sélectionnée.</p>
          </div>
          {loading ? (
            <div className="py-12 text-center text-sm text-ink/40">Chargement…</div>
          ) : byEstablishment.length === 0 ? (
            <div className="rounded-xl bg-[#f7f7f3] p-8 text-center text-sm text-ink/40">Aucune donnée sur cette période.</div>
          ) : (
            <div className="space-y-3">
              {byEstablishment.map((item) => (
                <div key={item.id} className="rounded-xl border border-ink/5 bg-[#fbfbf8] p-4">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-ink">{item.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2 text-[11px] text-ink/45">
                        <span>{item.reviews} avis</span>
                        <span>·</span>
                        <span>{item.ratingTotal && item.reviews ? (item.ratingTotal / item.reviews).toFixed(1) : '0.0'} ★</span>
                        <span>·</span>
                        <span>{item.events} événements</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-right text-xs">
                      <span className="text-ink/40">CA fidélité <strong className="ml-1 text-forest">{formatMad(item.revenue)}</strong></span>
                      <span className="text-ink/40">Transactions <strong className="ml-1 text-forest">{item.transactions}</strong></span>
                      <span className="text-ink/40">Points <strong className="ml-1 text-forest">{item.points.toLocaleString('fr-FR')}</strong></span>
                      <span className="text-ink/40">Récompenses <strong className="ml-1 text-forest">{item.rewards}</strong></span>
                      <span className="text-ink/40">Coût récompenses <strong className="ml-1 text-forest">{formatMad(item.rewardCost)}</strong></span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-ink/10 bg-forest p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/50">Synthèse période</p>
          <h3 className="mt-2 text-xl font-semibold">Vue financière & réputation</h3>
          <div className="mt-6 space-y-4">
            <div><p className="text-xs text-white/50">CA fidélité</p><p className="mt-1 text-2xl font-semibold">{loading ? '—' : formatMad(revenue)}</p></div>
            <div><p className="text-xs text-white/50">Coût récompenses</p><p className="mt-1 text-2xl font-semibold">{loading ? '—' : formatMad(rewardCost)}</p></div>
            <div><p className="text-xs text-white/50">CA après coût récompenses</p><p className="mt-1 text-3xl font-semibold text-gold">{loading ? '—' : formatMad(netContribution)}</p></div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/10 px-4 py-3"><p className="text-[11px] text-white/50">Récompenses</p><p className="mt-1 text-lg font-semibold">{redemptionCount}</p></div>
              <div className="rounded-xl bg-white/10 px-4 py-3"><p className="text-[11px] text-white/50">Part coût</p><p className="mt-1 text-lg font-semibold">{loading ? '—' : `${rewardCostRate.toFixed(1)} %`}</p></div>
            </div>
          </div>
          <p className="mt-6 text-[11px] leading-5 text-white/40">Les indicateurs sont calculés uniquement à partir des données enregistrées dans les tables consultées. Aucun chiffre d’uptime ou de performance technique n’est inventé.</p>
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
    <div className="rounded-2xl border border-ink/10 bg-white p-5">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-medium text-ink/45">{label}</p>
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-[#f4ead3] text-forest">
          <Icon size={17} />
        </div>
      </div>
      <p className="mt-5 text-2xl font-semibold text-forest">{value}</p>
      <p className="mt-1 text-[11px] text-ink/35">{helper}</p>
    </div>
  );
}

/* =========================================================
   CONFIGURATION IA
========================================================= */

function AIConfigurationSection({
  businessTypes,
  reload,
}: {
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

  useEffect(() => {
    (async () => { const { data, error } = await supabase.rpc('admin_get_ai_settings'); if (!error && data?.[0]) setAISettings(data[0]); })();
  }, []);

  const saveAISettings = async () => {
    if (!aiSettings.provider?.trim() || !aiSettings.model?.trim()) return alert('Provider et modèle sont obligatoires.');
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

    await reload();
  };

  const deleteType = async (type: AIBusinessType) => {
    if (!window.confirm(
      `Supprimer le type « ${type.name} » ? Les établissements qui l'utilisent conserveront leur lien mais leur type IA deviendra vide.`
    )) {
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
            Intelligence artificielle
          </p>

          <h2 className="font-display text-3xl text-forest md:text-4xl">
            Configuration IA
          </h2>

          <p className="mt-2 max-w-3xl text-sm leading-6 text-ink/50">
            Configure les comportements métier de l’IA. Chaque établissement utilise
            automatiquement le prompt correspondant au type que tu lui attribues.
          </p>
        </div>

        <button
          onClick={() => {
            resetForm();
            setShowForm(true);
          }}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-light"
        >
          <Plus size={16} />
          Nouveau type
        </button>
      </div>

      <div className="mb-6 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Moteur IA global</p><h3 className="mt-1 text-xl font-semibold text-forest">Provider et modèle utilisés par l’analyse</h3></div><span className={`rounded-full px-3 py-1 text-[10px] font-semibold ${aiSettings.enabled ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{aiSettings.enabled ? 'IA ACTIVE' : 'IA DÉSACTIVÉE'}</span></div>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <label className="block"><span className="mb-1 block text-xs font-semibold">Provider / moteur</span><input value={aiSettings.provider ?? ''} onChange={e=>setAISettings((v:any)=>({...v,provider:e.target.value}))} placeholder="openai" className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm"/></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold">Modèle</span><input value={aiSettings.model ?? ''} onChange={e=>setAISettings((v:any)=>({...v,model:e.target.value}))} placeholder="gpt-5.6-luna" className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm"/></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold">Température</span><input type="number" min="0" max="2" step="0.1" value={aiSettings.temperature ?? 0.2} onChange={e=>setAISettings((v:any)=>({...v,temperature:Number(e.target.value)}))} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm"/></label>
          <label className="block"><span className="mb-1 block text-xs font-semibold">Max output tokens</span><input type="number" value={aiSettings.max_output_tokens ?? 4000} onChange={e=>setAISettings((v:any)=>({...v,max_output_tokens:Number(e.target.value)}))} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm"/></label>
          <label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold">Clé API <span className="font-normal text-ink/35">{aiSettings.has_api_key ? '— une clé est déjà enregistrée, vide pour la conserver' : '— aucune clé enregistrée'}</span></span><input type="password" value={aiApiKey} onChange={e=>setAIApiKey(e.target.value)} autoComplete="new-password" className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm"/></label>
          <label className="flex items-center gap-3 rounded-xl bg-[#f7f7f3] p-4 md:col-span-2"><input type="checkbox" checked={!!aiSettings.enabled} onChange={e=>setAISettings((v:any)=>({...v,enabled:e.target.checked}))}/><span><strong className="block text-sm text-forest">Activer l’IA</strong><span className="text-xs text-ink/40">Le moteur global est utilisé par l’Edge Function d’analyse des avis.</span></span></label>
          <label className="block md:col-span-2"><span className="mb-1 block text-xs font-semibold">Instructions système globales</span><textarea rows={5} value={aiSettings.system_instructions ?? ''} onChange={e=>setAISettings((v:any)=>({...v,system_instructions:e.target.value}))} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm leading-6"/></label>
        </div>
        <div className="mt-5 flex justify-end"><button onClick={saveAISettings} disabled={aiSettingsSaving} className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white">{aiSettingsSaving ? 'Enregistrement...' : 'Enregistrer le moteur IA'}</button></div>
      </div>

      {showForm && (
        <div className="mb-6 rounded-2xl border border-gold/20 bg-white p-6 shadow-sm">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
                {editingId ? 'Modification' : 'Nouveau type'}
              </p>
              <h3 className="mt-1 font-display text-2xl text-forest">
                {editingId ? 'Modifier le type IA' : 'Créer un type IA'}
              </h3>
            </div>

            <button
              onClick={resetForm}
              className="text-ink/40 hover:text-ink"
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
                className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
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
                className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
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
                className="w-full resize-y rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm leading-6 outline-none focus:border-forest"
              />
              <p className="mt-2 text-[11px] text-ink/35">
                Ce prompt reste dans l’espace Admin et sert de base métier à l’analyse.
              </p>
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-[#f7f7f3] p-4 md:col-span-2">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => setActive(e.target.checked)}
                className="h-4 w-4 accent-[#173d32]"
              />
              <span>
                <span className="block text-sm font-semibold text-forest">
                  Type actif
                </span>
                <span className="mt-1 block text-xs text-ink/40">
                  Un type désactivé ne sera pas proposé lors de l’attribution à un établissement.
                </span>
              </span>
            </label>
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <button
              onClick={resetForm}
              disabled={saving}
              className="rounded-xl border border-ink/10 px-5 py-3 text-sm font-medium"
            >
              Annuler
            </button>

            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
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
            className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-forest text-gold">
                    <Brain size={18} />
                  </div>

                  <div>
                    <h3 className="text-base font-semibold text-forest">
                      {type.name}
                    </h3>
                    <p className="text-xs text-ink/40">
                      {type.description || 'Aucune description'}
                    </p>
                  </div>

                  <span
                    className={`rounded-full px-3 py-1 text-[10px] font-semibold ${
                      type.active
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {type.active ? 'ACTIF' : 'DÉSACTIVÉ'}
                  </span>
                </div>

                <div className="mt-4 rounded-xl bg-[#f7f7f3] p-4">
                  <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-ink/35">
                    Prompt métier
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-ink/60">
                    {type.ai_prompt}
                  </p>
                </div>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <button
                  onClick={() => startEdit(type)}
                  className="inline-flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-xs font-medium transition hover:bg-[#f7f7f3]"
                >
                  <Pencil size={14} />
                  Modifier
                </button>

                <button
                  onClick={() => toggleActive(type)}
                  className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-medium transition ${
                    type.active
                      ? 'border-red-200 text-red-600 hover:bg-red-50'
                      : 'border-green-200 text-green-700 hover:bg-green-50'
                  }`}
                >
                  <Power size={14} />
                  {type.active ? 'Désactiver' : 'Activer'}
                </button>

                <button
                  onClick={() => deleteType(type)}
                  className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 transition hover:bg-red-50"
                >
                  Supprimer
                </button>
              </div>
            </div>
          </div>
        ))}

        {businessTypes.length === 0 && (
          <div className="rounded-2xl border border-dashed border-ink/15 bg-white p-12 text-center">
            <Brain size={32} className="mx-auto text-ink/20" />
            <p className="mt-4 text-sm text-ink/45">
              Aucun type IA configuré.
            </p>
          </div>
        )}
      </div>
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
  useEffect(() => { if (!selectedId && establishments[0]) setSelectedId(establishments[0].id); }, [establishments, selectedId]);
  const selected = establishments.find(e => e.id === selectedId);

  const printReport = async (kind: 'reviews'|'loyalty'|'team'|'analytics'|'complete') => {
    if (!selected) return alert('Sélectionne un établissement.');
    setLoading(true);
    const since = new Date(); since.setDate(since.getDate() - period);
    const [{ data: reviews }, { data: tx }, { data: redemptions }, { data: staffRows }, { count: events }] = await Promise.all([
      supabase.from('reviews').select('rating,type,comment,status,created_at').eq('establishment_id', selected.id).gte('created_at', since.toISOString()).order('created_at', { ascending: false }),
      supabase.from('loyalty_transactions').select('amount,points,created_at').eq('establishment_id', selected.id).eq('type','EARN').gte('created_at', since.toISOString()),
      supabase.from('loyalty_redemptions').select('points_used,reward_cost_mad,created_at').eq('establishment_id', selected.id).gte('created_at', since.toISOString()),
      supabase.from('establishment_staff').select('role,active,created_at').eq('establishment_id', selected.id),
      supabase.from('analytics_events').select('id',{count:'exact',head:true}).eq('establishment_id', selected.id).gte('created_at', since.toISOString())
    ]);
    setLoading(false);
    const r=reviews??[], t=tx??[], red=redemptions??[], team=staffRows??[];
    const avg=r.length ? (r.reduce((a:any,x:any)=>a+Number(x.rating||0),0)/r.length).toFixed(1) : '—';
    const ca=t.reduce((a:any,x:any)=>a+Number(x.amount||0),0);
    const rewardCost=red.reduce((a:any,x:any)=>a+Number(x.reward_cost_mad||0),0);
    const title = kind==='complete' ? 'Rapport complet' : kind==='reviews' ? 'Rapport réputation & avis' : kind==='loyalty' ? 'Rapport fidélité' : kind==='team' ? 'Rapport équipe' : 'Rapport analytics';
    const section = (kind==='reviews'||kind==='complete') ? `<h2>Réputation & avis</h2><p><b>Avis :</b> ${r.length} · <b>Note moyenne :</b> ${avg} / 5 · <b>Positifs :</b> ${r.filter((x:any)=>x.type==='positive').length} · <b>Nouveaux :</b> ${r.filter((x:any)=>x.status==='Nouveau').length}</p>${r.slice(0,80).map((x:any)=>`<div class="item"><b>${x.rating}/5</b> · ${x.type==='positive'?'Positif':'Négatif'} · ${new Date(x.created_at).toLocaleDateString('fr-FR')}<br>${escapeHtml(x.comment||'Aucun commentaire')}</div>`).join('')}` : '';
    const loyalty = (kind==='loyalty'||kind==='complete') ? `<h2>Fidélité</h2><p><b>CA fidélité :</b> ${formatReportMad(ca)} · <b>Transactions :</b> ${t.length} · <b>Points :</b> ${t.reduce((a:any,x:any)=>a+Number(x.points||0),0).toLocaleString('fr-FR')} · <b>Récompenses :</b> ${red.length} · <b>Coût récompenses :</b> ${formatReportMad(rewardCost)}</p>` : '';
    const teamHtml = (kind==='team'||kind==='complete') ? `<h2>Équipe</h2><p><b>Membres :</b> ${team.length} · <b>Actifs :</b> ${team.filter((x:any)=>x.active).length} · <b>Responsables :</b> ${team.filter((x:any)=>x.role==='MANAGER').length} · <b>Employés :</b> ${team.filter((x:any)=>x.role==='STAFF').length}</p>` : '';
    const analytics = (kind==='analytics'||kind==='complete') ? `<h2>Analytics</h2><p><b>Événements :</b> ${events??0} · <b>Période :</b> ${period} jours</p>` : '';
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)} - ${escapeHtml(selected.name)}</title><style>body{font-family:Arial,sans-serif;color:#17241f;padding:32px;max-width:900px;margin:auto}h1{color:#173d32;margin-bottom:4px}h2{margin-top:28px;border-bottom:1px solid #ddd;padding-bottom:8px}.meta{color:#666;font-size:12px}.item{padding:10px 0;border-bottom:1px solid #eee;font-size:13px;line-height:1.5}@media print{body{padding:0}}</style></head><body><h1>${escapeHtml(title)}</h1><div class="meta">${escapeHtml(selected.name)} · ${new Date().toLocaleDateString('fr-FR')} · ${period} derniers jours</div>${section}${loyalty}${teamHtml}${analytics}</body></html>`;
    const win=window.open('','_blank','width=1000,height=800'); if(!win) return alert('Autorise les fenêtres popup pour générer le PDF.'); win.document.write(html); win.document.close(); win.focus(); setTimeout(()=>win.print(),250);
  };
  return <div><div className="mb-8"><p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">Reporting</p><h2 className="font-display text-3xl text-forest md:text-4xl">Rapports PDF</h2><p className="mt-2 max-w-2xl text-sm text-ink/50">Exporte les rapports réputation, fidélité, équipe, analytics ou le rapport complet d’un établissement.</p></div><div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm"><div className="grid gap-4 md:grid-cols-2"><label className="block"><span className="mb-2 block text-xs font-semibold">Établissement</span><select value={selectedId} onChange={e=>setSelectedId(e.target.value)} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm">{establishments.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}</select></label><label className="block"><span className="mb-2 block text-xs font-semibold">Période</span><select value={period} onChange={e=>setPeriod(Number(e.target.value))} className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm"><option value={7}>7 jours</option><option value={15}>15 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option><option value={180}>180 jours</option><option value={365}>365 jours</option></select></label></div><div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[['reviews','Avis & réputation'],['loyalty','Fidélité'],['team','Équipe'],['analytics','Analytics'],['complete','Rapport complet']].map(([id,label])=><button key={id} onClick={()=>printReport(id as any)} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-xs font-semibold text-forest hover:bg-white disabled:opacity-40"><Printer size={15}/>{loading?'Préparation…':label}</button>)}</div><p className="mt-5 text-[11px] text-ink/35">Le bouton ouvre la fenêtre d’impression du navigateur : choisis ensuite « Enregistrer au format PDF ».</p></div></div>;
}
function escapeHtml(value: string) { return value.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[char] as string)); }
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
    <div className="rounded-2xl border border-ink/5 bg-white p-12 text-center shadow-sm">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-forest/10 text-forest">
        <Icon size={25} />
      </div>

      <h3 className="mt-5 text-base font-semibold">
        {title}
      </h3>

      <p className="mx-auto mt-2 max-w-md text-sm text-ink/45">
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">Business</p>
          <h2 className="font-display text-3xl text-forest md:text-4xl">Abonnements & facturation</h2>
          <p className="mt-2 text-sm text-ink/50">Pilotez les plans, abonnements, paiements et échéances de vos commerces clients.</p>
        </div>
        <button onClick={reload} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-xs font-semibold">Actualiser</button>
      </div>

      {!billing.available ? (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
          <strong>Module facturation non configuré.</strong> Les tables d’abonnement doivent être présentes dans Supabase pour activer le suivi réel.
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={WalletCards} label="MRR" value={billing.available ? `${billing.mrr.toLocaleString('fr-FR')} MAD` : '—'} />
        <StatCard icon={CreditCard} label="Plans actifs" value={billing.available ? billing.plans.filter((p) => p.active).length : '—'} />
        <StatCard icon={AlertTriangle} label="Paiements échoués" value={billing.available ? billing.failedPayments : '—'} />
        <StatCard icon={CalendarDays} label="Renouvellements < 30 j." value={billing.available ? billing.upcomingRenewals : '—'} />
      </div>

      <div className="mt-6 rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-[1.4fr_1fr_1fr]">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-ink/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un commerce..." className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-forest" />
          </div>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-ink/10 bg-[#f7f7f3] px-3 py-2.5 text-sm">
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="trial">Essai</option>
            <option value="past_due">En retard</option>
            <option value="unpaid">Impayé</option>
            <option value="canceled">Annulé</option>
          </select>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded-xl border border-ink/10 bg-[#f7f7f3] px-3 py-2.5 text-sm">
            <option value="all">Tous les plans</option>
            {billing.plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-ink/5 bg-white shadow-sm overflow-hidden">
        <div className="grid grid-cols-[1.5fr_1fr_.8fr_1fr_1fr] gap-4 border-b border-ink/5 px-5 py-4 text-[10px] font-semibold uppercase tracking-wider text-ink/35">
          <span>Commerce</span><span>Plan</span><span>Statut</span><span>MRR</span><span>Échéance</span>
        </div>
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink/40">Aucun abonnement correspondant.</div>
        ) : filtered.map((sub) => {
          const e = establishmentMap.get(sub.establishment_id);
          return (
            <div key={sub.id} className="grid grid-cols-[1.5fr_1fr_.8fr_1fr_1fr] gap-4 border-b border-ink/5 px-5 py-4 text-sm last:border-0">
              <div><p className="font-semibold">{e?.name ?? 'Établissement supprimé'}</p><p className="text-xs text-ink/35">{e?.city ?? 'Ville non définie'}</p></div>
              <span>{sub.plan?.name ?? '—'}</span>
              <span className={`w-fit rounded-full px-2.5 py-1 text-[10px] font-semibold ${sub.status === 'active' ? 'bg-green-100 text-green-700' : sub.status === 'trial' ? 'bg-blue-100 text-blue-700' : sub.status === 'past_due' ? 'bg-amber-100 text-amber-700' : sub.status === 'unpaid' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'}`}>{sub.status}</span>
              <span className="font-semibold">{Number(sub.plan?.price_mad ?? 0).toLocaleString('fr-FR')} MAD</span>
              <span className="text-ink/50">{formatDate(sub.current_period_end)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-8 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <h3 className="text-sm font-semibold">Plans & fonctionnalités</h3>
            <p className="mt-1 text-xs text-ink/45">Crée, modifie les prix et définis précisément ce que chaque abonnement inclut.</p>
          </div>
          <button onClick={() => openPlanEditor()} className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white"><Plus size={14} /> Nouveau plan</button>
        </div>

        {showPlanEditor ? (
          <div className="mt-5 rounded-2xl border border-forest/10 bg-[#fbfbf8] p-5">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs font-semibold">Nom du plan<input value={planForm.name} onChange={(e) => setPlanForm((v) => ({ ...v, name: e.target.value }))} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-forest" placeholder="Premium" /></label>
              <label className="text-xs font-semibold">Prix (MAD)<input type="number" min="0" value={planForm.price_mad} onChange={(e) => setPlanForm((v) => ({ ...v, price_mad: e.target.value }))} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm font-normal outline-none focus:border-forest" placeholder="499" /></label>
              <label className="text-xs font-semibold">Facturation<select value={planForm.interval} onChange={(e) => setPlanForm((v) => ({ ...v, interval: e.target.value }))} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm font-normal"><option value="month">Mensuelle</option><option value="year">Annuelle</option></select></label>
            </div>
            <label className="mt-4 block text-xs font-semibold">Fonctionnalités incluses <span className="font-normal text-ink/40">(une fonctionnalité par ligne)</span>
              <textarea rows={6} value={planForm.features} onChange={(e) => setPlanForm((v) => ({ ...v, features: e.target.value }))} className="mt-1 w-full rounded-xl border border-ink/10 bg-white px-3 py-3 text-sm font-normal outline-none focus:border-forest" placeholder={"Page publique\nAvis & réputation\nFidélité\nMenu\nPromotions\nAnalytics\nAssistant IA"} />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => { setEditingPlan(null); setShowPlanEditor(false); setPlanForm({ name: '', price_mad: '', interval: 'month', features: '' }); }} className="rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-xs font-semibold">Annuler</button>
              <button onClick={savePlan} disabled={savingPlan} className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-50"><Save size={14} /> {savingPlan ? 'Enregistrement…' : 'Enregistrer'}</button>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {billing.plans.map((p) => (
            <div key={p.id} className="rounded-2xl border border-ink/5 bg-[#fdfdfb] p-5">
              <div className="flex items-start justify-between gap-3"><div><strong className="text-forest">{p.name}</strong><p className="mt-1 text-xs text-ink/40">{p.interval === 'year' ? 'Annuel' : 'Mensuel'} · {p.active ? 'Actif' : 'Inactif'}</p></div><span className="text-lg font-semibold">{Number(p.price_mad).toLocaleString('fr-FR')} MAD</span></div>
              <div className="mt-4 space-y-1.5">{(p.features ?? []).length ? (p.features ?? []).map((feature) => <div key={feature} className="flex gap-2 text-xs text-ink/60"><span className="text-forest">✓</span>{feature}</div>) : <p className="text-xs text-ink/35">Aucune fonctionnalité définie.</p>}</div>
              <div className="mt-5 flex gap-2">
                <button onClick={() => openPlanEditor(p)} className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-semibold"><Pencil size={13} /> Modifier</button>
                <button onClick={() => togglePlanActive(p)} className="rounded-xl border border-ink/10 bg-white px-3 py-2 text-xs font-semibold">{p.active ? 'Désactiver' : 'Activer'}</button>
                <button onClick={() => deletePlan(p)} title="Supprimer" className="rounded-xl border border-red-100 bg-white px-3 py-2 text-red-600"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
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
  establishments: Establishment[];
}) {
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
    next[5] = { ...next[5], status: 'ok', detail: `${globalStats.analyticsEvents.toLocaleString('fr-FR')} événements enregistrés` };
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
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">Plateforme</p>
          <h2 className="font-display text-3xl text-forest md:text-4xl">Supervision technique</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink/50">Diagnostic en temps réel des services critiques accessibles depuis l’Admin.</p>
        </div>
        <button onClick={() => void runChecks()} disabled={checking} className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">
          <RefreshCw size={14} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Vérification…' : 'Relancer le diagnostic'}
        </button>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <MiniMetric label="Contrôles OK" value={okCount} />
        <MiniMetric label="Erreurs" value={errorCount} />
        <MiniMetric label="Établissements" value={establishments.length} />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {checks.map(({ label, status, detail, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest/10 text-forest"><Icon size={20} /></div>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${
                status === 'ok' ? 'bg-green-100 text-green-700' : status === 'error' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
              }`}>{status === 'ok' ? 'Opérationnel' : status === 'error' ? 'Erreur' : 'Vérification…'}</span>
            </div>
            <h3 className="mt-5 text-base font-semibold">{label}</h3>
            <p className="mt-2 break-words text-xs leading-5 text-ink/45">{detail}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><Filter size={17} className="text-forest" /><h3 className="font-semibold">État global</h3></div>
        <div className="mt-4 rounded-xl bg-[#f7f7f3] p-4 text-sm">
          {errorCount === 0 && checks.length > 0 ? <span className="font-semibold text-forest">Tous les contrôles exécutés sont opérationnels.</span> : <span className="font-semibold text-[#a15c50]">{errorCount} contrôle{errorCount > 1 ? 's' : ''} nécessite{errorCount > 1 ? 'nt' : ''} une vérification.</span>}
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <MiniMetric label="Avis" value={globalStats.reviews} />
          <MiniMetric label="Événements" value={globalStats.analyticsEvents} />
          <MiniMetric label="Abonnements" value={billing.available ? billing.subscriptions.length : 0} />
        </div>
        <p className="mt-4 text-xs leading-5 text-ink/40">Dernier diagnostic : {lastChecked ? new Date(lastChecked).toLocaleString('fr-FR') : 'en cours'}. Les métriques d’uptime et de temps de chargement restent distinctes d’un diagnostic fonctionnel.</p>
      </div>
    </div>
  );
}
