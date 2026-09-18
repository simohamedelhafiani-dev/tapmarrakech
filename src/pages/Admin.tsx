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
  Copy,
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
  CreditCard,
  AlertTriangle,
  Activity,
  Search,
  Filter,
  CalendarDays,
  ExternalLink,
  ShieldCheck,
  TrendingUp,
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
  const [globalStats, setGlobalStats] = useState<GlobalStats>({ reviews: 0, averageRating: 0, positiveReviews: 0, negativeReviews: 0, loyaltyCustomers: 0, analyticsEvents: 0 });
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
      .select('id, name, slug, ai_business_type_id, created_at, city, business_type')
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
    const [{ data: reviewRows }, { count: loyaltyCustomers }, { count: analyticsEvents }] = await Promise.all([
      supabase.from('reviews').select('rating'),
      supabase.from('loyalty_customers').select('id', { count: 'exact', head: true }),
      supabase.from('analytics_events').select('id', { count: 'exact', head: true }),
    ]);
    const ratings = (reviewRows ?? []).map((r: any) => Number(r.rating)).filter((r: number) => Number.isFinite(r));
    const averageRating = ratings.length ? ratings.reduce((a: number, r: number) => a + r, 0) / ratings.length : 0;
    setGlobalStats({
      reviews: ratings.length,
      averageRating,
      positiveReviews: ratings.filter((r: number) => r >= 4).length,
      negativeReviews: ratings.filter((r: number) => r <= 3).length,
      loyaltyCustomers: loyaltyCustomers ?? 0,
      analyticsEvents: analyticsEvents ?? 0,
    });
  };

  const loadBilling = async () => {
    const empty: BillingSnapshot = {
      available: false,
      plans: [],
      subscriptions: [],
      paymentsThisMonth: 0,
      failedPayments: 0,
      overdueInvoices: 0,
      upcomingRenewals: 0,
      mrr: 0,
    };

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
      setBilling(empty);
      return;
    }

    const normalizedSubscriptions: BillingSubscription[] = (subscriptions ?? []).map((s: any) => ({
      ...s,
      plan: Array.isArray(s.subscription_plans) ? s.subscription_plans[0] ?? null : s.subscription_plans ?? null,
    }));

    const mrr = normalizedSubscriptions
      .filter((s) => s.status === 'active')
      .reduce((sum, s) => sum + Number(s.plan?.price_mad ?? 0), 0);

    const now = Date.now();
    const in30Days = now + 30 * 24 * 60 * 60 * 1000;
    const upcomingRenewals = normalizedSubscriptions.filter((s) => {
      if (!s.current_period_end || s.status !== 'active') return false;
      const time = new Date(s.current_period_end).getTime();
      return time >= now && time <= in30Days;
    }).length;

    setBilling({
      available: true,
      plans: (plans ?? []) as BillingPlan[],
      subscriptions: normalizedSubscriptions,
      paymentsThisMonth: paymentsThisMonth ?? 0,
      failedPayments: failedPayments ?? 0,
      overdueInvoices: overdueInvoices ?? 0,
      upcomingRenewals,
      mrr,
    });
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
      id: 'codes',
      label: 'Codes récompenses',
      icon: Gift,
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
              globalStats={globalStats}
              billing={billing}
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


          {section === 'codes' && (
            <RewardCodesSection
              establishments={establishments}
            />
          )}

          {section === 'ai' && (
            <AIConfigurationSection
              businessTypes={aiBusinessTypes}
              reload={loadAIBusinessTypes}
            />
          )}

          {section === 'templates' && <Templates />}

          {section === 'billing' && (
            <BillingSection
              establishments={establishments}
              billing={billing}
              reload={loadBilling}
            />
          )}

          {section === 'system' && (
            <SystemSection
              billing={billing}
              globalStats={globalStats}
              establishments={establishments}
            />
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
  globalStats,
  billing,
}: {
  establishments: Establishment[];
  staff: StaffMember[];
  loading: boolean;
  globalStats: GlobalStats;
  billing: BillingSnapshot;
}) {
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={Building2} label="Établissements" value={loading ? '—' : establishments.length} />
        <StatCard icon={UserRound} label="Responsables" value={loading ? '—' : responsibles.length} />
        <StatCard icon={Users} label="Employés" value={loading ? '—' : employees.length} />
        <StatCard icon={MessageSquare} label="Avis reçus" value={loading ? '—' : globalStats.reviews} />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={BarChart3} label="Note moyenne globale" value={globalStats.reviews ? `${globalStats.averageRating.toFixed(1)} ★` : '—'} />
        <StatCard icon={CheckCircle2} label="Avis positifs" value={globalStats.positiveReviews} />
        <StatCard icon={Gift} label="Clients fidélité" value={globalStats.loyaltyCustomers} />
        <StatCard icon={BarChart3} label="Événements analytics" value={globalStats.analyticsEvents} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
          <div className="flex items-start justify-between gap-4">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest/45">Réputation globale</p><h3 className="mt-2 text-xl font-semibold text-forest">Santé des avis</h3></div>
            <span className="rounded-full bg-forest/10 px-3 py-1.5 text-xs font-semibold text-forest">{globalStats.reviews} avis</span>
          </div>
          <div className="mt-6 h-3 overflow-hidden rounded-full bg-ink/5"><div className="h-full rounded-full bg-forest" style={{ width: `${globalStats.reviews ? Math.round((globalStats.positiveReviews / globalStats.reviews) * 100) : 0}%` }} /></div>
          <div className="mt-3 flex justify-between text-xs text-ink/45"><span>{globalStats.positiveReviews} positifs</span><span>{globalStats.negativeReviews} ≤ 3 étoiles</span></div>
        </div>
        <div className="rounded-2xl border border-gold/20 bg-[#fdf9ef] p-6"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Pilotage</p><h3 className="mt-2 text-xl font-semibold text-forest">TapMarrakech</h3><p className="mt-3 text-sm leading-6 text-ink/55">Une vue globale pour piloter les établissements, la réputation, la fidélité et l’activité de la plateforme.</p></div>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={WalletCards} label="MRR" value={billing.available ? `${billing.mrr.toLocaleString('fr-FR')} MAD` : '—'} />
        <StatCard icon={CalendarDays} label="Renouvellements < 30 j." value={billing.available ? billing.upcomingRenewals : '—'} />
        <StatCard icon={AlertTriangle} label="Paiements échoués" value={billing.available ? billing.failedPayments : '—'} />
        <StatCard icon={CreditCard} label="Factures en retard" value={billing.available ? billing.overdueInvoices : '—'} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
        <div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-forest/45">Business</p>
              <h3 className="mt-2 text-xl font-semibold text-forest">Portefeuille clients</h3>
            </div>
            <TrendingUp size={20} className="text-forest" />
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniMetric label="Actifs" value={billing.subscriptions.filter((s) => s.status === 'active').length} />
            <MiniMetric label="Essais" value={billing.subscriptions.filter((s) => s.status === 'trial').length} />
            <MiniMetric label="Impayés" value={billing.subscriptions.filter((s) => ['past_due','unpaid'].includes(s.status)).length} />
            <MiniMetric label="Plans" value={billing.plans.length} />
          </div>
        </div>
        <div className="rounded-2xl border border-gold/20 bg-[#fdf9ef] p-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">Alertes</p>
          <div className="mt-4 space-y-3 text-sm">
            <AlertLine label="Paiements échoués" value={billing.failedPayments} />
            <AlertLine label="Factures en retard" value={billing.overdueInvoices} />
            <AlertLine label="Renouvellements à venir" value={billing.upcomingRenewals} />
          </div>
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
  billing,
}: {
  establishments: Establishment[];
  loading: boolean;
  reload: () => Promise<void>;
  businessTypes: AIBusinessType[];
  billing: BillingSnapshot;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('all');
  const [type, setType] = useState('all');
  const [accountStatus, setAccountStatus] = useState('all');
  const [plan, setPlan] = useState('all');

  const subscriptionByEstablishment = useMemo(
    () => new Map(billing.subscriptions.map((s) => [s.establishment_id, s])),
    [billing.subscriptions]
  );

  const cities = Array.from(new Set(establishments.map((e) => e.city).filter(Boolean))) as string[];
  const filteredEstablishments = establishments.filter((e) => {
    const haystack = `${e.name} ${e.slug} ${e.city ?? ''} ${e.business_type ?? ''}`.toLowerCase();
    return (!search.trim() || haystack.includes(search.trim().toLowerCase()))
      && (city === 'all' || e.city === city)
      && (type === 'all' || e.ai_business_type_id === type)
      && (accountStatus === 'all' || subscriptionByEstablishment.get(e.id)?.status === accountStatus)
      && (plan === 'all' || subscriptionByEstablishment.get(e.id)?.plan_id === plan);
  });

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

      <div className="mb-5 rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-3 text-ink/30" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un établissement..." className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-forest" />
          </div>
          <select value={city} onChange={(e) => setCity(e.target.value)} className="rounded-xl border border-ink/10 bg-[#f7f7f3] px-3 py-2.5 text-sm">
            <option value="all">Toutes les villes</option>
            {cities.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-ink/10 bg-[#f7f7f3] px-3 py-2.5 text-sm">
            <option value="all">Tous les secteurs</option>
            {businessTypes.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
          </select>
          <select value={accountStatus} onChange={(e) => setAccountStatus(e.target.value)} className="rounded-xl border border-ink/10 bg-[#f7f7f3] px-3 py-2.5 text-sm">
            <option value="all">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="trial">Essai</option>
            <option value="past_due">En retard</option>
            <option value="unpaid">Impayé</option>
            <option value="canceled">Annulé</option>
          </select>
          <select value={plan} onChange={(e) => setPlan(e.target.value)} className="rounded-xl border border-ink/10 bg-[#f7f7f3] px-3 py-2.5 text-sm">
            <option value="all">Tous les plans</option>
            {billing.plans.map((value) => <option key={value.id} value={value.id}>{value.name}</option>)}
          </select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-ink/40">Chargement...</div>
        ) : establishments.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink/50">Aucun établissement créé.</div>
        ) : (
          <div className="divide-y divide-ink/5">
            {filteredEstablishments.map((establishment) => {
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
                      <p className="mt-1 text-xs text-ink/40">{type ?? 'Type non défini'} · {establishment.city ?? 'Ville non définie'} · /r/{establishment.slug}</p>
                      <p className="mt-1 truncate text-[11px] text-ink/30">{accessLink}</p>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    {(() => {
                      const subscription = subscriptionByEstablishment.get(establishment.id);
                      return subscription ? (
                        <div className="hidden text-right md:block">
                          <p className="text-xs font-semibold text-forest">{subscription.plan?.name ?? 'Plan'}</p>
                          <p className="text-[10px] text-ink/35">{subscription.status}</p>
                        </div>
                      ) : (
                        <span className="hidden rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-700 md:inline-flex">Sans abonnement</span>
                      );
                    })()}
                    <span className="rounded-lg bg-forest px-4 py-2 text-xs font-semibold text-white">Gérer →</span>
                  </div>
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

type WorkspaceTab = 'profile' | 'wifi' | 'menu' | 'promotions' | 'reviews' | 'loyalty' | 'team' | 'analytics' | 'public' | 'billing';

type MenuCategory = { id: string; name: string; description: string | null; display_order: number; active: boolean };
type MenuItem = { id: string; category_id: string; name: string; description: string | null; price: number; image_url: string | null; display_order: number; active: boolean };
type Promotion = { id: string; name: string; description: string | null; image_url: string | null; normal_price: number | null; promo_price: number | null; start_at: string | null; end_at: string | null; active: boolean; display_order: number };

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
  const [wifi, setWifi] = useState({ network_name: '', wifi_password: '', active: true });
  const [showWifiPassword, setShowWifiPassword] = useState(false);
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [rewards, setRewards] = useState<any[]>([]);
  const [loyalty, setLoyalty] = useState<any>({ points_per_currency: 1, currency: 'MAD', enabled: true });
  const [customersCount, setCustomersCount] = useState(0);
  const [reviews, setReviews] = useState<any[]>([]);
  const [team, setTeam] = useState<any[]>([]);
  const [eventsCount, setEventsCount] = useState(0);
  const [templates, setTemplates] = useState<any[]>([]);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [subscription, setSubscription] = useState<BillingSubscription | null>(null);
  const [workspacePlans, setWorkspacePlans] = useState<BillingPlan[]>([]);
  const [billingPayments, setBillingPayments] = useState<any[]>([]);
  const [billingInvoices, setBillingInvoices] = useState<any[]>([]);
  const [billingError, setBillingError] = useState('');
  const [creatingSubscription, setCreatingSubscription] = useState(false);

  const [menuCategoryName, setMenuCategoryName] = useState('');
  const [menuItem, setMenuItem] = useState({ name: '', description: '', price: '', category_id: '' });
  const [promotion, setPromotion] = useState({ name: '', description: '', normal_price: '', promo_price: '' });
  const [reward, setReward] = useState({ name: '', description: '', points_required: '' });

  const businessType =
    businessTypes.find((x) => x.id === (profile.ai_business_type_id ?? establishment.ai_business_type_id))?.name ??
    profile.business_type ??
    'Établissement';

  const publicSlug = profile.slug || establishment.slug;
  const publicLink = `${window.location.origin}/r/${publicSlug}`;

  const loadTab = async () => {
    if (tab === 'profile' || tab === 'public') {
      const { data, error } = await supabase
        .from('establishments')
        .select('*')
        .eq('id', establishment.id)
        .maybeSingle();
      if (!error && data) setProfile(data);
    }

    if (tab === 'wifi') {
      const { data, error } = await supabase
        .from('establishment_wifi')
        .select('network_name,wifi_password,security_type,active')
        .eq('establishment_id', establishment.id)
        .maybeSingle();
      if (!error && data) {
        setWifi({
          network_name: data.network_name ?? '',
          wifi_password: data.wifi_password ?? '',
          active: data.active ?? true,
        });
      }
    }

    if (tab === 'menu') {
      const [{ data: c }, { data: i }] = await Promise.all([
        supabase.from('menu_categories').select('*').eq('establishment_id', establishment.id).order('display_order'),
        supabase.from('menu_items').select('*').eq('establishment_id', establishment.id).order('display_order'),
      ]);
      setCategories(c ?? []);
      setItems(i ?? []);
      if (!menuItem.category_id && c?.[0]) {
        setMenuItem((v) => ({ ...v, category_id: c[0].id }));
      }
    }

    if (tab === 'promotions') {
      const { data } = await supabase
        .from('promotions')
        .select('*')
        .eq('establishment_id', establishment.id)
        .order('display_order');
      setPromotions(data ?? []);
    }

    if (tab === 'loyalty') {
      const [{ data: r }, { data: l }, { count }] = await Promise.all([
        supabase.from('loyalty_rewards').select('*').eq('establishment_id', establishment.id).order('points_required'),
        supabase.from('loyalty_settings').select('*').eq('establishment_id', establishment.id).maybeSingle(),
        supabase.from('loyalty_customers').select('id', { count: 'exact', head: true }).eq('establishment_id', establishment.id),
      ]);
      setRewards(r ?? []);
      setLoyalty(l ?? { points_per_currency: 1, currency: 'MAD', enabled: true });
      setCustomersCount(count ?? 0);
    }

    if (tab === 'reviews') {
      const { data } = await supabase
        .from('reviews')
        .select('*')
        .eq('establishment_id', establishment.id)
        .order('created_at', { ascending: false })
        .limit(100);
      setReviews(data ?? []);
    }

    if (tab === 'team') {
      const { data: rows } = await supabase
        .from('establishment_staff')
        .select('id,establishment_id,user_id,role,active,created_at')
        .eq('establishment_id', establishment.id)
        .order('created_at');

      const userIds = (rows ?? []).map((r: any) => r.user_id).filter(Boolean);
      let profiles: any[] = [];
      if (userIds.length) {
        const { data } = await supabase.from('profiles').select('id,name,email,role').in('id', userIds);
        profiles = data ?? [];
      }
      const byId = new Map(profiles.map((p) => [p.id, p]));
      setTeam((rows ?? []).map((r: any) => ({ ...r, ...(byId.get(r.user_id) ?? {}) })));
    }

    if (tab === 'analytics') {
      const [{ count: events }, { data: reviewRows }] = await Promise.all([
        supabase.from('analytics_events').select('id', { count: 'exact', head: true }).eq('establishment_id', establishment.id),
        supabase.from('reviews').select('rating').eq('establishment_id', establishment.id),
      ]);
      setEventsCount(events ?? 0);
      setReviews(reviewRows ?? []);
    }

    if (tab === 'billing') {
      setBillingError('');
      const { data: plans } = await supabase.from('subscription_plans').select('id,name,price_mad,interval,active,features').eq('active', true).order('price_mad');
      setWorkspacePlans((plans ?? []) as BillingPlan[]);
      const { data: sub, error: subError } = await supabase
        .from('subscriptions')
        .select('id,establishment_id,plan_id,status,started_at,current_period_end,trial_days,subscription_plans(id,name,price_mad,interval,active)')
        .eq('establishment_id', establishment.id)
        .maybeSingle();

      if (subError) {
        setBillingError(subError.message);
        setSubscription(null);
        setBillingPayments([]);
        setBillingInvoices([]);
      } else {
        const normalized = sub
          ? {
              ...sub,
              plan: Array.isArray((sub as any).subscription_plans)
                ? (sub as any).subscription_plans[0] ?? null
                : (sub as any).subscription_plans ?? null,
            }
          : null;
        setSubscription(normalized as BillingSubscription | null);

        const [{ data: payments }, { data: invoices }] = await Promise.all([
          supabase.from('payments').select('id,amount_mad,status,paid_at,created_at,reference').eq('establishment_id', establishment.id).order('created_at', { ascending: false }).limit(20),
          supabase.from('invoices').select('id,number,amount_mad,status,due_at,paid_at,created_at').eq('establishment_id', establishment.id).order('created_at', { ascending: false }).limit(20),
        ]);
        setBillingPayments(payments ?? []);
        setBillingInvoices(invoices ?? []);
      }
    }

    if (tab === 'public') {
      const { data } = await supabase.from('templates').select('*').order('name');
      setTemplates(data ?? []);
      try {
        const QRCode = await import('qrcode');
        const url = await QRCode.toDataURL(publicLink, { width: 360, margin: 2 });
        setQrDataUrl(url);
      } catch (error) {
        console.error('QR generation error:', error);
      }
    }
  };

  useEffect(() => {
    loadTab();
  }, [tab, establishment.id, publicSlug]);

  const saveProfile = async () => {
    if (!profile.name?.trim() || !profile.slug?.trim()) {
      alert("Le nom et le slug sont obligatoires.");
      return;
    }
    setSaving(true);
    const payload = {
      name: profile.name.trim(),
      slug: profile.slug.trim(),
      ai_business_type_id: profile.ai_business_type_id || null,
      business_type: profile.business_type || businessType || null,
      address: profile.address || null,
      city: profile.city || null,
      phone: profile.phone || null,
      email: profile.email || null,
      website_url: profile.website_url || null,
      description: profile.description || null,
      instagram_url: profile.instagram_url || null,
      facebook_url: profile.facebook_url || null,
      tiktok_url: profile.tiktok_url || null,
      whatsapp_number: profile.whatsapp_number || null,
      page_template_id: profile.page_template_id || null,
      menu_template_id: profile.menu_template_id || null,
    };
    const { error } = await supabase.from('establishments').update(payload).eq('id', establishment.id);
    setSaving(false);
    if (error) return alert(`Erreur profil : ${error.message}`);
    setProfile((v: any) => ({ ...v, ...payload }));
    await onReload();
    alert('Établissement enregistré.');
  };

  const saveWifi = async () => {
    if (!wifi.network_name.trim()) return alert('Le nom du réseau est obligatoire.');
    setSaving(true);
    const { error } = await supabase.from('establishment_wifi').upsert(
      {
        establishment_id: establishment.id,
        network_name: wifi.network_name.trim(),
        wifi_password: wifi.wifi_password || null,
        security_type: 'WPA',
        active: wifi.active,
      },
      { onConflict: 'establishment_id' },
    );
    setSaving(false);
    if (error) return alert(`Erreur Wi-Fi : ${error.message}`);
    alert('Wi-Fi enregistré.');
  };

  const addCategory = async () => {
    if (!menuCategoryName.trim()) return alert('Nom de catégorie obligatoire.');
    const { error } = await supabase.from('menu_categories').insert({
      establishment_id: establishment.id,
      name: menuCategoryName.trim(),
      display_order: categories.length,
      active: true,
    });
    if (error) return alert(error.message);
    setMenuCategoryName('');
    await loadTab();
  };

  const addMenuItem = async () => {
    if (!menuItem.name.trim() || !menuItem.category_id) return alert('Nom et catégorie obligatoires.');
    const { error } = await supabase.from('menu_items').insert({
      establishment_id: establishment.id,
      category_id: menuItem.category_id,
      name: menuItem.name.trim(),
      description: menuItem.description.trim() || null,
      price: Number(menuItem.price) || 0,
      display_order: items.filter((x) => x.category_id === menuItem.category_id).length,
      active: true,
    });
    if (error) return alert(error.message);
    const categoryId = menuItem.category_id;
    setMenuItem({ name: '', description: '', price: '', category_id: categoryId });
    await loadTab();
  };

  const addPromotion = async () => {
    if (!promotion.name.trim()) return alert('Nom de promotion obligatoire.');
    const normal = promotion.normal_price ? Number(promotion.normal_price) : null;
    const promo = promotion.promo_price ? Number(promotion.promo_price) : null;
    if (normal !== null && promo !== null && promo > normal) return alert('Le prix promo ne peut pas dépasser le prix normal.');
    const { error } = await supabase.from('promotions').insert({
      establishment_id: establishment.id,
      name: promotion.name.trim(),
      description: promotion.description.trim() || null,
      normal_price: normal,
      promo_price: promo,
      active: true,
      display_order: promotions.length,
    });
    if (error) return alert(error.message);
    setPromotion({ name: '', description: '', normal_price: '', promo_price: '' });
    await loadTab();
  };

  const addReward = async () => {
    const points = Number(reward.points_required);
    if (!reward.name.trim() || !Number.isFinite(points) || points <= 0) return alert('Nom et nombre de points obligatoires.');
    const { error } = await supabase.from('loyalty_rewards').insert({
      establishment_id: establishment.id,
      name: reward.name.trim(),
      description: reward.description.trim() || null,
      points_required: points,
      active: true,
    });
    if (error) return alert(error.message);
    setReward({ name: '', description: '', points_required: '' });
    await loadTab();
  };

  const toggle = async (table: string, id: string, active: boolean) => {
    const { error } = await supabase.from(table).update({ active: !active }).eq('id', id);
    if (error) return alert(error.message);
    await loadTab();
  };

  const remove = async (table: string, id: string) => {
    if (!confirm('Supprimer cet élément ?')) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) return alert(error.message);
    await loadTab();
  };

  const createSubscription = async (planId?: string, trialDays: number = 14) => {
    if (subscription) return alert('Cet établissement possède déjà un abonnement.');
    setCreatingSubscription(true);

    let selectedPlanId = planId;
    if (!selectedPlanId) {
      selectedPlanId = workspacePlans[0]?.id;
    }

    if (!selectedPlanId) {
      const { data: defaultPlan, error: planError } = await supabase
        .from('subscription_plans')
        .select('id')
        .eq('active', true)
        .order('price_mad', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (planError || !defaultPlan) {
        setCreatingSubscription(false);
        return alert(`Impossible de trouver un plan actif : ${planError?.message ?? 'aucun plan disponible'}`);
      }
      selectedPlanId = defaultPlan.id;
    }

    const startedAt = new Date();
    const selectedPlan = workspacePlans.find((plan) => plan.id === selectedPlanId);
    const normalizedTrialDays = Math.max(0, Math.min(365, Number(trialDays) || 0));
    const status = normalizedTrialDays > 0 ? 'trial' : 'active';
    const periodEnd = new Date(startedAt);

    if (status === 'trial') {
      periodEnd.setDate(periodEnd.getDate() + normalizedTrialDays);
    } else if (selectedPlan?.interval === 'year') {
      periodEnd.setFullYear(periodEnd.getFullYear() + 1);
    } else {
      periodEnd.setMonth(periodEnd.getMonth() + 1);
    }

    const { error } = await supabase.from('subscriptions').insert({
      establishment_id: establishment.id,
      plan_id: selectedPlanId,
      status,
      trial_days: normalizedTrialDays,
      started_at: startedAt.toISOString(),
      current_period_end: periodEnd.toISOString(),
    });

    setCreatingSubscription(false);
    if (error) return alert(`Erreur création abonnement : ${error.message}`);
    await loadTab();
    await onReload();
  };

  const changeSubscriptionStatus = async (status: string) => {
    if (!subscription) return alert('Aucun abonnement pour cet établissement.');
    const { error } = await supabase.from('subscriptions').update({ status }).eq('id', subscription.id);
    if (error) return alert(`Erreur abonnement : ${error.message}`);
    await loadTab();
    await onReload();
  };

  const changeSubscriptionPlan = async (planId: string) => {
    if (!subscription) return alert('Aucun abonnement pour cet établissement.');
    const { error } = await supabase.from('subscriptions').update({ plan_id: planId }).eq('id', subscription.id);
    if (error) return alert(`Erreur plan : ${error.message}`);
    await loadTab();
    await onReload();
  };

  const saveLoyalty = async () => {
    const points = Number(loyalty.points_per_currency);
    if (!Number.isFinite(points) || points <= 0) return alert('Le nombre de points doit être supérieur à 0.');
    const { error } = await supabase.from('loyalty_settings').upsert(
      {
        establishment_id: establishment.id,
        points_per_currency: points,
        currency: loyalty.currency || 'MAD',
        enabled: !!loyalty.enabled,
      },
      { onConflict: 'establishment_id' },
    );
    if (error) return alert(`Erreur fidélité : ${error.message}`);
    alert('Paramètres fidélité enregistrés.');
  };

  const tabs: { id: WorkspaceTab; label: string }[] = [
    { id: 'profile', label: 'Profil' },
    { id: 'wifi', label: 'Wi-Fi' },
    { id: 'menu', label: 'Menu' },
    { id: 'promotions', label: 'Promotions' },
    { id: 'reviews', label: 'Avis' },
    { id: 'loyalty', label: 'Fidélité' },
    { id: 'team', label: 'Équipe' },
    { id: 'analytics', label: 'Analytics' },
    { id: 'public', label: 'Lien public' },
    { id: 'billing', label: 'Abonnement' },
  ];

  const field = (label: string, key: string, type = 'text') => (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-ink/50">{label}</span>
      <input
        type={type}
        value={profile[key] ?? ''}
        onChange={(e) => setProfile((v: any) => ({ ...v, [key]: e.target.value }))}
        className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest"
      />
    </label>
  );

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <button onClick={onBack} className="mb-3 text-xs font-semibold text-forest">← Retour aux établissements</button>
          <h2 className="font-display text-3xl text-forest">{profile.name ?? establishment.name}</h2>
          <p className="mt-1 text-sm text-ink/45">{businessType} · espace de gestion complet</p>
        </div>
        <a href={publicLink} target="_blank" rel="noreferrer" className="rounded-xl bg-forest px-4 py-3 text-center text-xs font-semibold text-white">Ouvrir la page publique ↗</a>
      </div>

      <div className="mb-6 flex gap-2 overflow-x-auto rounded-2xl border border-ink/5 bg-white p-2 shadow-sm">
        {tabs.map((x) => (
          <button key={x.id} onClick={() => setTab(x.id)} className={`whitespace-nowrap rounded-xl px-4 py-2.5 text-xs font-semibold ${tab === x.id ? 'bg-forest text-white' : 'text-ink/55 hover:bg-[#f7f7f3]'}`}>
            {x.label}
          </button>
        ))}
      </div>

      {tab === 'profile' && (
        <div className="grid gap-4 md:grid-cols-2">
          {field('Nom', 'name')}
          {field('Slug public', 'slug')}
          {field('Adresse', 'address')}
          {field('Ville', 'city')}
          {field('Téléphone', 'phone')}
          {field('Email', 'email', 'email')}
          {field('Site web', 'website_url')}
          {field('WhatsApp', 'whatsapp_number')}
          {field('Instagram', 'instagram_url')}
          {field('Facebook', 'facebook_url')}
          {field('TikTok', 'tiktok_url')}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-ink/50">Type</span>
            <select value={profile.ai_business_type_id ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, ai_business_type_id: e.target.value || null }))} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm">
              <option value="">Type non défini</option>
              {businessTypes.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </label>
          <label className="block md:col-span-2">
            <span className="mb-1 block text-xs font-medium text-ink/50">Description</span>
            <textarea value={profile.description ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, description: e.target.value }))} rows={4} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm" />
          </label>
          <div className="md:col-span-2">
            <button disabled={saving} onClick={saveProfile} className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer le profil'}</button>
          </div>
        </div>
      )}

      {tab === 'wifi' && (
        <div className="max-w-xl rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-semibold">Wi-Fi client</h3>
          <p className="mt-1 mb-5 text-xs text-ink/45">Le mot de passe est stocké dans la table Wi-Fi dédiée, séparée du profil public.</p>
          <div className="space-y-4">
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">Nom du réseau</span><input value={wifi.network_name} onChange={(e) => setWifi({ ...wifi, network_name: e.target.value })} className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /></label>
            <label className="block"><span className="mb-1 block text-xs font-medium text-ink/50">Mot de passe</span><div className="flex gap-2"><input type={showWifiPassword ? 'text' : 'password'} value={wifi.wifi_password} onChange={(e) => setWifi({ ...wifi, wifi_password: e.target.value })} className="min-w-0 flex-1 rounded-xl border border-ink/10 px-3 py-2.5 text-sm" autoComplete="new-password" /><button type="button" onClick={() => setShowWifiPassword((v) => !v)} className="rounded-xl border border-ink/10 px-3 text-xs font-semibold text-ink/55">{showWifiPassword ? 'Masquer' : 'Afficher'}</button></div></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={wifi.active} onChange={(e) => setWifi({ ...wifi, active: e.target.checked })} /> Module actif</label>
            <button disabled={saving} onClick={saveWifi} className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Enregistrer le Wi-Fi</button>
          </div>
        </div>
      )}

      {tab === 'menu' && (
        <div className="space-y-5">
          <div className="grid gap-5 md:grid-cols-2">
            <div className="rounded-2xl border border-ink/5 bg-white p-5">
              <h3 className="font-semibold">Catégories</h3>
              <div className="mt-4 flex gap-2"><input value={menuCategoryName} onChange={(e) => setMenuCategoryName(e.target.value)} placeholder="Ex. Entrées" className="min-w-0 flex-1 rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><button onClick={addCategory} className="rounded-xl bg-forest px-4 text-xs font-semibold text-white">Ajouter</button></div>
              <div className="mt-4 space-y-2">
                {categories.map((c) => (
                  <div key={c.id} className="flex items-center justify-between gap-3 rounded-xl bg-[#f7f7f3] px-3 py-2.5 text-sm"><span>{c.name}</span><div className="flex gap-2"><button onClick={() => toggle('menu_categories', c.id, c.active)} className="text-xs text-ink/45">{c.active ? 'Désactiver' : 'Activer'}</button><button onClick={() => remove('menu_categories', c.id)} className="text-xs text-red-500">Supprimer</button></div></div>
                ))}
              </div>
            </div>
            <div className="rounded-2xl border border-ink/5 bg-white p-5">
              <h3 className="font-semibold">Nouveau produit</h3>
              <div className="mt-4 space-y-3"><input value={menuItem.name} onChange={(e) => setMenuItem({ ...menuItem, name: e.target.value })} placeholder="Nom" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><select value={menuItem.category_id} onChange={(e) => setMenuItem({ ...menuItem, category_id: e.target.value })} className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"><option value="">Catégorie</option>{categories.filter((c) => c.active).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select><input value={menuItem.price} onChange={(e) => setMenuItem({ ...menuItem, price: e.target.value })} placeholder="Prix MAD" type="number" min="0" step="0.01" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><textarea value={menuItem.description} onChange={(e) => setMenuItem({ ...menuItem, description: e.target.value })} placeholder="Description" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><button onClick={addMenuItem} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Ajouter le produit</button></div>
            </div>
          </div>
          <div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Produits</h3><div className="mt-4 grid gap-2 md:grid-cols-2">{items.map((i) => <div key={i.id} className="rounded-xl bg-[#f7f7f3] p-3"><div className="flex justify-between gap-3"><strong className="text-sm">{i.name}</strong><span className="text-sm font-semibold">{Number(i.price).toFixed(2)} MAD</span></div><p className="mt-1 text-xs text-ink/45">{i.description || 'Sans description'}</p><div className="mt-2 flex gap-3"><button onClick={() => toggle('menu_items', i.id, i.active)} className="text-[11px] text-ink/45">{i.active ? 'Désactiver' : 'Activer'}</button><button onClick={() => remove('menu_items', i.id)} className="text-[11px] text-red-500">Supprimer</button></div></div>)}</div></div>
        </div>
      )}

      {tab === 'promotions' && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Créer une promotion</h3><div className="mt-4 grid gap-3 md:grid-cols-4"><input value={promotion.name} onChange={(e) => setPromotion({ ...promotion, name: e.target.value })} placeholder="Nom" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><input value={promotion.description} onChange={(e) => setPromotion({ ...promotion, description: e.target.value })} placeholder="Description" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><input value={promotion.normal_price} onChange={(e) => setPromotion({ ...promotion, normal_price: e.target.value })} placeholder="Prix normal" type="number" min="0" step="0.01" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><input value={promotion.promo_price} onChange={(e) => setPromotion({ ...promotion, promo_price: e.target.value })} placeholder="Prix promo" type="number" min="0" step="0.01" className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /></div><button onClick={addPromotion} className="mt-3 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Ajouter</button></div>
          <div className="grid gap-3 md:grid-cols-2">{promotions.map((p) => <div key={p.id} className="rounded-2xl border border-ink/5 bg-white p-5"><div className="flex justify-between gap-3"><strong>{p.name}</strong><span className="text-xs text-ink/40">{p.active ? 'Actif' : 'Inactif'}</span></div><p className="mt-2 text-sm text-ink/55">{p.description || 'Sans description'}</p><p className="mt-3 text-sm font-semibold">{p.promo_price ?? '—'} MAD <span className="ml-2 text-xs text-ink/35 line-through">{p.normal_price ?? ''}</span></p><div className="mt-3 flex gap-3"><button onClick={() => toggle('promotions', p.id, p.active)} className="text-xs text-ink/45">{p.active ? 'Désactiver' : 'Activer'}</button><button onClick={() => remove('promotions', p.id)} className="text-xs text-red-500">Supprimer</button></div></div>)}</div>
        </div>
      )}

      {tab === 'reviews' && (
        <div className="space-y-4"><div className="grid gap-3 md:grid-cols-3"><StatCard label="Avis" value={reviews.length} /><StatCard label="Note moyenne" value={reviews.length ? (reviews.reduce((a, r) => a + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : '—'} /><StatCard label="Dernier avis" value={reviews[0]?.created_at ? new Date(reviews[0].created_at).toLocaleDateString('fr-FR') : '—'} /></div><div className="rounded-2xl border border-ink/5 bg-white p-5">{reviews.length === 0 ? <p className="text-sm text-ink/45">Aucun avis.</p> : <div className="space-y-3">{reviews.map((r) => <div key={r.id} className="rounded-xl bg-[#f7f7f3] p-4"><div className="flex justify-between"><strong>{r.rating}/5</strong><span className="text-xs text-ink/35">{new Date(r.created_at).toLocaleDateString('fr-FR')}</span></div><p className="mt-2 text-sm text-ink/60">{r.feedback || r.comment || 'Aucun commentaire'}</p>{r.status ? <span className="mt-2 inline-block text-xs text-ink/40">Statut : {r.status}</span> : null}</div>)}</div>}</div></div>
      )}

      {tab === 'loyalty' && (
        <div className="space-y-5"><div className="grid gap-3 md:grid-cols-3"><StatCard label="Clients fidélité" value={customersCount} /><StatCard label="Récompenses" value={rewards.length} /><StatCard label="Programme" value={loyalty.enabled ? 'Actif' : 'Inactif'} /></div><div className="grid gap-5 md:grid-cols-2"><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Paramètres</h3><div className="mt-4 flex gap-3"><input type="number" min="0.01" step="0.01" value={loyalty.points_per_currency ?? 1} onChange={(e) => setLoyalty({ ...loyalty, points_per_currency: Number(e.target.value) })} className="w-32 rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><select value={loyalty.currency ?? 'MAD'} onChange={(e) => setLoyalty({ ...loyalty, currency: e.target.value })} className="rounded-xl border border-ink/10 px-3 py-2.5 text-sm"><option>MAD</option><option>EUR</option></select></div><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={loyalty.enabled ?? true} onChange={(e) => setLoyalty({ ...loyalty, enabled: e.target.checked })} /> Programme actif</label><button onClick={saveLoyalty} className="mt-4 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Enregistrer</button></div><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Nouvelle récompense</h3><div className="mt-4 space-y-3"><input value={reward.name} onChange={(e) => setReward({ ...reward, name: e.target.value })} placeholder="Nom" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><input value={reward.points_required} onChange={(e) => setReward({ ...reward, points_required: e.target.value })} placeholder="Points requis" type="number" min="1" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><textarea value={reward.description} onChange={(e) => setReward({ ...reward, description: e.target.value })} placeholder="Description" className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm" /><button onClick={addReward} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Ajouter</button></div></div></div><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Récompenses</h3><div className="mt-4 grid gap-2 md:grid-cols-2">{rewards.map((r) => <div key={r.id} className="flex items-center justify-between rounded-xl bg-[#f7f7f3] p-3"><span><strong className="text-sm">{r.name}</strong><span className="ml-2 text-xs text-ink/40">{r.points_required} pts</span></span><div className="flex gap-3"><button onClick={() => toggle('loyalty_rewards', r.id, r.active)} className="text-xs text-ink/45">{r.active ? 'Désactiver' : 'Activer'}</button><button onClick={() => remove('loyalty_rewards', r.id)} className="text-xs text-red-500">Supprimer</button></div></div>)}</div></div></div>
      )}

      {tab === 'team' && (
        <div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Équipe de l’établissement</h3><p className="mt-1 text-xs text-ink/45">Les comptes sont gérés depuis les sections Responsables / Employés de l’Admin.</p><div className="mt-5 space-y-2">{team.length === 0 ? <p className="text-sm text-ink/45">Aucun membre affecté.</p> : team.map((m) => <div key={m.id} className="flex items-center justify-between rounded-xl bg-[#f7f7f3] p-3 text-sm"><span><strong>{m.name || 'Utilisateur'}</strong><span className="ml-2 text-xs text-ink/40">{m.email || ''}</span></span><span className="text-xs text-ink/45">{m.role} · {m.active ? 'Actif' : 'Inactif'}</span></div>)}</div></div>
      )}

      {tab === 'analytics' && (
        <div className="space-y-5"><div className="grid gap-4 md:grid-cols-3"><StatCard label="Événements enregistrés" value={eventsCount} /><StatCard label="Avis" value={reviews.length} /><StatCard label="Note moyenne" value={reviews.length ? (reviews.reduce((a, r) => a + Number(r.rating || 0), 0) / reviews.length).toFixed(1) : '—'} /></div><div className="rounded-2xl border border-ink/5 bg-white p-5"><h3 className="font-semibold">Établissement</h3><p className="mt-2 text-sm text-ink/50">Les événements et avis sont filtrés sur cet établissement uniquement.</p></div></div>
      )}

      {tab === 'billing' && (
        <div className="space-y-5">
          {billingError ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
              <strong>Facturation non disponible.</strong>
              <p className="mt-1">{billingError}</p>
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-4">
            <StatCard icon={CreditCard} label="Plan" value={subscription?.plan?.name ?? 'Aucun'} />
            <StatCard label="MRR" value={subscription ? `${Number(subscription.plan?.price_mad ?? 0).toLocaleString('fr-FR')} MAD` : '—'} />
            <StatCard label="Statut" value={subscription?.status ?? '—'} />
            <StatCard label="Échéance" value={subscription?.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
              <h3 className="font-semibold">Gestion de l’abonnement</h3>
              {!subscription ? (
                <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">Aucun abonnement enregistré</p>
                  <p className="mt-1 text-xs leading-5 text-amber-800/80">Choisissez le plan et la durée d’essai pour cet établissement. Aucun essai n’est imposé.</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <select id="new-subscription-plan" defaultValue={workspacePlans[0]?.id ?? ''} className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm">
                      {workspacePlans.map((p) => <option key={p.id} value={p.id}>{p.name} · {Number(p.price_mad).toLocaleString('fr-FR')} MAD</option>)}
                    </select>
                    <select id="new-subscription-trial-days" defaultValue="14" className="w-full rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-sm">
                      <option value="0">Aucun essai</option>
                      <option value="7">Essai · 7 jours</option>
                      <option value="14">Essai · 14 jours</option>
                      <option value="30">Essai · 30 jours</option>
                      <option value="60">Essai · 60 jours</option>
                    </select>
                  </div>
                  <button
                    disabled={creatingSubscription || !workspacePlans.length}
                    onClick={() => {
                      const planValue = (document.getElementById('new-subscription-plan') as HTMLSelectElement | null)?.value;
                      const trialValue = Number((document.getElementById('new-subscription-trial-days') as HTMLSelectElement | null)?.value ?? 14);
                      createSubscription(planValue || undefined, trialValue);
                    }}
                    className="mt-2 w-full rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white disabled:opacity-40"
                  >
                    {creatingSubscription ? 'Création…' : 'Créer l’abonnement'}
                  </button>
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  <label className="block text-xs text-ink/50">Plan
                    <select value={subscription.plan_id} onChange={(e) => changeSubscriptionPlan(e.target.value)} className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm">
                      {workspacePlans.map((p) => <option key={p.id} value={p.id}>{p.name} · {Number(p.price_mad).toLocaleString('fr-FR')} MAD</option>)}
                    </select>
                  </label>
                  <div>
                    <p className="mb-2 text-xs text-ink/50">Période d’essai</p>
                    <select
                      value={subscription.trial_days ?? 0}
                      onChange={async (e) => {
                        const days = Number(e.target.value);
                        const nextStatus = days > 0 ? 'trial' : 'active';
                        const startedAt = subscription.started_at ? new Date(subscription.started_at) : new Date();
                        const nextEnd = new Date(startedAt);
                        if (nextStatus === 'trial') {
                          nextEnd.setDate(nextEnd.getDate() + days);
                        } else if (subscription.plan?.interval === 'year') {
                          nextEnd.setFullYear(nextEnd.getFullYear() + 1);
                        } else {
                          nextEnd.setMonth(nextEnd.getMonth() + 1);
                        }
                        const { error } = await supabase.from('subscriptions').update({ trial_days: days, status: nextStatus, current_period_end: nextEnd.toISOString() }).eq('id', subscription.id);
                        if (error) return alert(`Erreur période d’essai : ${error.message}`);
                        await loadTab();
                        await onReload();
                      }}
                      className="w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"
                    >
                      <option value={0}>Aucun essai</option>
                      <option value={7}>7 jours</option>
                      <option value={14}>14 jours</option>
                      <option value={30}>30 jours</option>
                      <option value={60}>60 jours</option>
                    </select>
                  </div>
                  <div>
                    <p className="mb-2 text-xs text-ink/50">Statut</p>
                    <div className="flex flex-wrap gap-2">
                      {['active','trial','past_due','unpaid','canceled'].map((value) => (
                        <button key={value} onClick={() => changeSubscriptionStatus(value)} className={`rounded-lg border px-3 py-2 text-[11px] font-semibold ${subscription.status === value ? 'border-forest bg-forest text-white' : 'border-ink/10 text-ink/50'}`}>{value}</button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
              <h3 className="font-semibold">Historique des paiements</h3>
              <div className="mt-4 space-y-2">
                {billingPayments.length === 0 ? <p className="text-sm text-ink/45">Aucun paiement enregistré.</p> : billingPayments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between rounded-xl bg-[#f7f7f3] px-3 py-3 text-sm">
                    <div><strong>{Number(payment.amount_mad ?? 0).toLocaleString('fr-FR')} MAD</strong><p className="text-[11px] text-ink/35">{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('fr-FR') : '—'} · {payment.reference ?? 'Sans référence'}</p></div>
                    <span className="text-xs font-semibold">{payment.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-sm">
            <h3 className="font-semibold">Factures</h3>
            <div className="mt-4 overflow-x-auto">
              {billingInvoices.length === 0 ? <p className="text-sm text-ink/45">Aucune facture enregistrée.</p> : (
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead><tr className="border-b border-ink/5 text-[10px] uppercase tracking-wider text-ink/35"><th className="pb-3">Facture</th><th className="pb-3">Montant</th><th className="pb-3">Statut</th><th className="pb-3">Échéance</th></tr></thead>
                  <tbody>{billingInvoices.map((invoice) => <tr key={invoice.id} className="border-b border-ink/5 last:border-0"><td className="py-3">{invoice.number ?? invoice.id.slice(0,8)}</td><td className="py-3">{Number(invoice.amount_mad ?? 0).toLocaleString('fr-FR')} MAD</td><td className="py-3">{invoice.status}</td><td className="py-3">{invoice.due_at ? new Date(invoice.due_at).toLocaleDateString('fr-FR') : '—'}</td></tr>)}</tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === 'public' && (
        <div className="space-y-5"><div className="grid gap-5 lg:grid-cols-[1fr_280px]"><div className="rounded-2xl border border-ink/5 bg-white p-6"><p className="text-xs font-semibold uppercase tracking-wider text-gold">Lien unique QR / NFC</p><h3 className="mt-2 break-all text-xl font-semibold">{publicLink}</h3><p className="mt-2 text-sm text-ink/50">Ce lien est l’entrée unique de l’expérience client : Wi-Fi, menu, promotions, fidélité, avis et modules adaptés au type d’établissement.</p><div className="mt-5 flex flex-wrap gap-2"><button onClick={() => navigator.clipboard.writeText(publicLink).then(() => alert('Lien copié.'))} className="rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Copier le lien</button><a href={publicLink} target="_blank" rel="noreferrer" className="rounded-xl border border-ink/10 px-4 py-2.5 text-xs font-semibold">Tester la page</a>{qrDataUrl ? <a href={qrDataUrl} download={`${publicSlug}-qr.png`} className="rounded-xl border border-ink/10 px-4 py-2.5 text-xs font-semibold">Télécharger le QR</a> : null}</div></div>{qrDataUrl ? <div className="rounded-2xl border border-ink/5 bg-white p-5 text-center"><img src={qrDataUrl} alt="QR code public" className="mx-auto h-56 w-56" /><p className="mt-3 text-xs text-ink/40">QR → lien public</p></div> : null}</div><div className="rounded-2xl border border-ink/5 bg-white p-6"><h3 className="font-semibold">Modules prévus pour ce type</h3><div className="mt-4 flex flex-wrap gap-2">{['Wi-Fi','Menu','Services','Restaurant','Activités','Voyages','Offres','Promotions','Réservation','Contact','Avis','Fidélité'].map((name) => <span key={name} className="rounded-full bg-[#f7f7f3] px-3 py-1.5 text-xs text-ink/60">{name}</span>)}</div><p className="mt-3 text-xs text-ink/40">L’Admin conserve l’accès à tous les modules ; la page client pourra ensuite appliquer le mapping automatique du type.</p></div><div className="rounded-2xl border border-ink/5 bg-white p-6"><h3 className="font-semibold">Templates</h3><div className="mt-4 grid gap-3 md:grid-cols-2"><label className="text-xs text-ink/50">Template page<select value={profile.page_template_id ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, page_template_id: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"><option value="">Automatique / défaut</option>{templates.filter((t) => t.kind === 'page' && t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label className="text-xs text-ink/50">Template menu<select value={profile.menu_template_id ?? ''} onChange={(e) => setProfile((v: any) => ({ ...v, menu_template_id: e.target.value || null }))} className="mt-1 w-full rounded-xl border border-ink/10 px-3 py-2.5 text-sm"><option value="">Automatique / défaut</option>{templates.filter((t) => t.kind === 'menu' && t.active).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select></label></div><button onClick={saveProfile} className="mt-4 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white">Enregistrer les templates</button></div></div>
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

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-[#f7f7f3] p-3">
      <p className="text-[10px] uppercase tracking-wider text-ink/35">{label}</p>
      <p className="mt-1 text-lg font-semibold text-forest">{value}</p>
    </div>
  );
}

function AlertLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-xl bg-white/70 px-3 py-2.5">
      <span className="text-ink/60">{label}</span>
      <span className={`font-semibold ${value > 0 ? 'text-red-600' : 'text-forest'}`}>{value}</span>
    </div>
  );
}

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
  const [dbStatus, setDbStatus] = useState<'checking' | 'ok' | 'error'>('checking');

  useEffect(() => {
    let mounted = true;
    supabase.from('establishments').select('id', { count: 'exact', head: true }).then(({ error }) => {
      if (mounted) setDbStatus(error ? 'error' : 'ok');
    });
    return () => { mounted = false; };
  }, []);

  const services = [
    { label: 'Base de données Supabase', status: dbStatus === 'ok' ? 'Opérationnel' : dbStatus === 'error' ? 'Erreur' : 'Vérification...', icon: ShieldCheck },
    { label: 'Pages publiques', status: establishments.length > 0 ? 'Configurées' : 'Aucun établissement', icon: ExternalLink },
    { label: 'Analytics', status: `${globalStats.analyticsEvents.toLocaleString('fr-FR')} événements`, icon: Activity },
    { label: 'Facturation', status: billing.available ? 'Connectée' : 'À configurer', icon: CreditCard },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">Plateforme</p>
        <h2 className="font-display text-3xl text-forest md:text-4xl">Supervision technique</h2>
        <p className="mt-2 max-w-2xl text-sm text-ink/50">Un point de contrôle sur les services réellement accessibles depuis l’Admin.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {services.map(({ label, status, icon: Icon }) => (
          <div key={label} className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest/10 text-forest"><Icon size={20} /></div>
              <span className={`rounded-full px-3 py-1.5 text-[10px] font-semibold ${status === 'Opérationnel' || status === 'Connectée' ? 'bg-green-100 text-green-700' : status === 'Erreur' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>{status}</span>
            </div>
            <h3 className="mt-5 text-base font-semibold">{label}</h3>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3"><Filter size={17} className="text-forest" /><h3 className="font-semibold">Contrôles disponibles</h3></div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <MiniMetric label="Établissements" value={establishments.length} />
          <MiniMetric label="Avis" value={globalStats.reviews} />
          <MiniMetric label="Événements" value={globalStats.analyticsEvents} />
        </div>
        <p className="mt-4 text-xs leading-5 text-ink/40">Les mesures d’uptime et de temps de chargement nécessitent un monitoring externe. Cette vue ne prétend pas mesurer une disponibilité qu’elle ne collecte pas encore.</p>
      </div>
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

    const { data, error } = await supabase
      .from('establishments')
      .insert({
        name: name.trim(),
        slug: slug.trim(),
        ai_business_type_id: aiBusinessTypeId,
      })
      .select('id')
      .single();

    setSaving(false);

    if (error) {
      console.error(error);
      alert(`Erreur : ${error.message}`);
      return;
    }

    // Création automatique d'un premier abonnement d'essai.
    // Si la facturation n'est pas encore installée dans Supabase, l'établissement reste créé.
    const { data: defaultPlan } = await supabase
      .from('subscription_plans')
      .select('id')
      .eq('active', true)
      .order('price_mad', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (defaultPlan && (data as any)?.id) {
      const establishmentId = (data as any)?.id;
      const startedAt = new Date();
      const trialEnd = new Date(startedAt);
      trialEnd.setDate(trialEnd.getDate() + 14);
      const { error: subscriptionError } = await supabase.from('subscriptions').insert({
        establishment_id: establishmentId,
        plan_id: defaultPlan.id,
        status: 'trial',
        started_at: startedAt.toISOString(),
        current_period_end: trialEnd.toISOString(),
      });
      if (subscriptionError) console.warn('Abonnement automatique non créé:', subscriptionError.message);
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
        ) : staff.length === 0 ? (
          <EmptyStaff
            icon={UserRound}
            title="Aucun responsable"
            description="Créez le premier responsable d’un établissement."
          />
        ) : (
          <div className="divide-y divide-ink/5">
            {staff.map((member) => {
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
        ) : staff.length === 0 ? (
          <EmptyStaff
            icon={Users}
            title="Aucun employé"
            description="Créez le premier employé d’un établissement."
          />
        ) : (
          <div className="divide-y divide-ink/5">
            {staff.map((member) => {
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
      console.error(
        'Erreur création compte:',
        error
      );

      alert(
        `Impossible de créer le compte : ${error.message}`
      );

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
}: {
  member: StaffMember;
  establishmentName: string;
  reload: () => Promise<void>;
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
   REWARD CODES
========================================================= */

function RewardCodesSection({
  establishments,
}: {
  establishments: Establishment[];
}) {
  const [selectedEstablishment, setSelectedEstablishment] =
    useState(establishments[0]?.id ?? '');

  const [code, setCode] = useState('');
  const [confirmCode, setConfirmCode] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (
      !selectedEstablishment &&
      establishments.length > 0
    ) {
      setSelectedEstablishment(
        establishments[0].id
      );
    }
  }, [establishments, selectedEstablishment]);

  const selectedName =
    establishments.find(
      (establishment) =>
        establishment.id === selectedEstablishment
    )?.name ?? '';

  const saveCode = async () => {
    if (!selectedEstablishment) {
      alert('Veuillez sélectionner un établissement.');
      return;
    }

    if (code.trim().length < 4) {
      alert(
        'Le code doit contenir au moins 4 caractères.'
      );
      return;
    }

    if (code !== confirmCode) {
      alert('Les deux codes ne correspondent pas.');
      return;
    }

    setSaving(true);

    const { data, error } = await supabase.rpc(
      'set_loyalty_admin_code',
      {
        target_establishment_id:
          selectedEstablishment,
        new_code: code,
      }
    );

    setSaving(false);

    if (error) {
      console.error(
        'Erreur code récompense:',
        error
      );

      alert(
        `Impossible d'enregistrer le code : ${error.message}`
      );

      return;
    }

    if (data !== true) {
      alert(
        "Le code n'a pas pu être enregistré."
      );
      return;
    }

    setCode('');
    setConfirmCode('');

    alert(
      `Code récompense enregistré pour ${selectedName}.`
    );
  };

  if (establishments.length === 0) {
    return (
      <div>
        <div className="mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
            Fidélité
          </p>

          <h2 className="font-display text-3xl text-forest md:text-4xl">
            Codes récompenses
          </h2>
        </div>

        <EmptyStaff
          icon={Gift}
          title="Aucun établissement"
          description="Créez d’abord un établissement avant de configurer son code récompense."
        />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
          Fidélité
        </p>

        <h2 className="font-display text-3xl text-forest md:text-4xl">
          Codes récompenses
        </h2>

        <p className="mt-2 max-w-2xl text-sm text-ink/50">
          Le code est utilisé uniquement lorsqu’une récompense
          est consommée. Il ne sert pas à se connecter.
        </p>
      </div>

      <div className="max-w-2xl rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start gap-4 rounded-xl border border-gold/20 bg-[#fdf9ef] p-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#f4ead3] text-gold">
            <LockKeyhole size={18} />
          </div>

          <div>
            <p className="text-sm font-semibold text-forest">
              Code sécurisé
            </p>

            <p className="mt-1 text-xs leading-5 text-ink/50">
              Tu définis ici le code de validation et tu le
              transmets au responsable de l’établissement.
              Le code n’est jamais affiché dans l’application
              après son enregistrement.
            </p>
          </div>
        </div>

        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-semibold">
              Établissement
            </label>

            <select
              value={selectedEstablishment}
              onChange={(e) =>
                setSelectedEstablishment(
                  e.target.value
                )
              }
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none focus:border-forest"
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

          <div>
            <label className="mb-2 block text-xs font-semibold">
              Nouveau code récompense
            </label>

            <input
              type="password"
              value={code}
              onChange={(e) =>
                setCode(e.target.value)
              }
              placeholder="Ex : 4829"
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-center text-lg tracking-[0.2em] outline-none focus:border-forest"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-semibold">
              Confirmer le code
            </label>

            <input
              type="password"
              value={confirmCode}
              onChange={(e) =>
                setConfirmCode(e.target.value)
              }
              placeholder="Retapez le code"
              className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-center text-lg tracking-[0.2em] outline-none focus:border-forest"
            />
          </div>

          <button
            onClick={saveCode}
            disabled={
              saving ||
              !code.trim() ||
              !confirmCode.trim()
            }
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white disabled:opacity-40"
          >
            <CheckCircle2 size={16} />

            {saving
              ? 'Enregistrement...'
              : 'Enregistrer le code'}
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

    setResult(data as ReviewAnalysisResponse);
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
  const [search, setSearch] = useState('');
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [reviewsPage, setReviewsPage] = useState(1);
  const [reviewsTotal, setReviewsTotal] = useState(0);
  const reviewsPageSize = 50;

  const loadReviews = async () => {
    setLoading(true);

    let query = supabase
      .from('reviews')
      .select(
        'id, establishment_id, rating, type, comment, name, phone, email, status, created_at',
        { count: 'exact' }
      )
      .order('created_at', { ascending: false });

    if (selectedEstablishment !== 'all') query = query.eq('establishment_id', selectedEstablishment);
    if (selectedStatus !== 'all') query = query.eq('status', selectedStatus);
    if (search.trim()) {
      const term = search.trim().replace(/,/g, ' ');
      query = query.or(`name.ilike.%${term}%,email.ilike.%${term}%,phone.ilike.%${term}%,comment.ilike.%${term}%`);
    }

    const from = (reviewsPage - 1) * reviewsPageSize;
    const { data, error, count } = await query.range(from, from + reviewsPageSize - 1);

    if (error) {
      console.error('Erreur avis:', error);
      setReviews([]);
    } else {
      setReviews(data ?? []);
      setReviewsTotal(count ?? 0);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadReviews();
  }, [selectedEstablishment, selectedStatus, search, reviewsPage]);

  useEffect(() => {
    setReviewsPage(1);
  }, [selectedEstablishment, selectedStatus, search]);

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
      const haystack = `${review.name ?? ''} ${review.comment ?? ''} ${review.email ?? ''} ${review.phone ?? ''}`.toLowerCase();
      const searchMatch = !search.trim() || haystack.includes(search.trim().toLowerCase());

      return establishmentMatch && statusMatch && searchMatch;
    });
  }, [reviews, selectedEstablishment, selectedStatus, search]);

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

  const updateStatus = async (id: string, status: AdminReview['status']) => {
    const { error } = await supabase.from('reviews').update({ status }).eq('id', id);
    if (error) return alert(`Impossible de mettre à jour l'avis : ${error.message}`);
    setReviews((current) => current.map((review) => review.id === id ? { ...review, status } : review));
  };

  const exportCsv = () => {
    const rows = filteredReviews.map((review) => [
      establishmentMap.get(review.establishment_id) ?? '', review.rating, review.type, review.status, review.name ?? '', review.phone ?? '', review.email ?? '', review.comment ?? '', review.created_at,
    ]);
    const csv = [['Établissement','Note','Type','Statut','Client','Téléphone','Email','Commentaire','Date'], ...rows]
      .map((row) => row.map((cell) => `\"${String(cell).replace(/\"/g, '\\\"')}\"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tapmarrakech-avis-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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

      <div className="mb-6 flex flex-col gap-3 md:flex-row">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un client, commentaire, email..." className="min-w-0 flex-1 rounded-xl border border-ink/10 bg-white px-4 py-3 text-sm outline-none focus:border-forest" />
        <button onClick={exportCsv} disabled={!filteredReviews.length} className="rounded-xl border border-ink/10 bg-white px-4 py-3 text-xs font-semibold disabled:opacity-40">Exporter CSV</button>
        <button onClick={() => setShowAnalysis((v) => !v)} className="rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white">{showAnalysis ? 'Masquer l’analyse' : 'Analyse & rapport IA'}</button>
      </div>

      {showAnalysis && <div className="mb-6"><ReviewAnalysisSection establishments={establishments} /></div>}

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
                      <span className="text-[11px] text-ink/30">Avis #{review.id.slice(0, 8)}</span>
                      <div className="mt-3 flex flex-wrap gap-2 lg:justify-end">
                        {(['Nouveau','En cours','Traité'] as const).map((status) => (
                          <button key={status} onClick={() => updateStatus(review.id, status)} className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-semibold ${review.status === status ? 'border-forest bg-forest text-white' : 'border-ink/10 text-ink/45 hover:bg-[#f7f7f3]'}`}>{status}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {reviewsTotal > 0 && (
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-ink/35">
            {Math.min((reviewsPage - 1) * reviewsPageSize + 1, reviewsTotal)}–{Math.min(reviewsPage * reviewsPageSize, reviewsTotal)} sur {reviewsTotal} avis
          </p>
          <div className="flex items-center gap-2">
            <button disabled={reviewsPage <= 1} onClick={() => setReviewsPage((p) => Math.max(1, p - 1))} className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-30">Précédent</button>
            <span className="text-xs text-ink/45">Page {reviewsPage} / {Math.max(1, Math.ceil(reviewsTotal / reviewsPageSize))}</span>
            <button disabled={reviewsPage >= Math.ceil(reviewsTotal / reviewsPageSize)} onClick={() => setReviewsPage((p) => p + 1)} className="rounded-lg border border-ink/10 bg-white px-3 py-2 text-xs font-semibold disabled:opacity-30">Suivant</button>
          </div>
        </div>
      )}
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
