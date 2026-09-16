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

type AdminSection =
  | 'overview'
  | 'establishments'
  | 'responsibles'
  | 'employees'
  | 'codes'
  | 'reviews'
  | 'analysis'
  | 'ai'
  | 'templates';

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState<AdminSection>('overview');
  const [open, setOpen] = useState(false);

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [aiBusinessTypes, setAIBusinessTypes] = useState<AIBusinessType[]>([]);

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

  useEffect(() => {
    loadEstablishments();
    loadStaff();
    loadAIBusinessTypes();
  }, []);

  const reloadAll = async () => {
    await Promise.all([
      loadEstablishments(),
      loadStaff(),
      loadAIBusinessTypes(),
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
      id: 'ai',
      label: 'Configuration IA',
      icon: Brain,
    },
    {
      id: 'templates',
      label: 'Templates',
      icon: LayoutTemplate,
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
            />
          )}

          {section === 'ai' && (
            <AIConfigurationSection
              businessTypes={aiBusinessTypes}
              reload={loadAIBusinessTypes}
            />
          )}

          {section === 'templates' && <Templates />}
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
}: {
  establishments: Establishment[];
  staff: StaffMember[];
  loading: boolean;
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
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<Establishment | null>(null);

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
            Gestion globale
          </p>
          <h2 className="font-display text-3xl text-forest md:text-4xl">Établissements</h2>
          <p className="mt-2 text-sm text-ink/50">
            Chaque établissement possède maintenant son espace de gestion centralisé.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-xl bg-forest px-5 py-3 text-sm font-semibold text-white transition hover:bg-forest-light"
        >
          + Ajouter un établissement
        </button>
      </div>

      {showForm && (
        <CreateEstablishmentForm
          close={() => setShowForm(false)}
          reload={reload}
          businessTypes={businessTypes}
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-ink/40">Chargement...</div>
        ) : establishments.length === 0 ? (
          <div className="p-10 text-center">
            <Building2 size={35} className="mx-auto text-ink/20" />
            <p className="mt-4 text-sm text-ink/50">Aucun établissement créé.</p>
          </div>
        ) : (
          <div className="divide-y divide-ink/5">
            {establishments.map((establishment) => {
              const accessLink = `${window.location.origin}/r/${establishment.slug}`;
              const type = businessTypes.find((item) => item.id === establishment.ai_business_type_id)?.name;

              return (
                <div key={establishment.id} className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-forest text-white">
                      <Building2 size={19} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-semibold">{establishment.name}</h3>
                      <p className="mt-1 text-xs text-ink/40">{type ?? 'Type non défini'} · /r/{establishment.slug}</p>
                      <p className="mt-1 break-all text-[11px] text-ink/35">{accessLink}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelected(establishment)}
                      className="rounded-lg bg-forest px-3 py-2 text-xs font-semibold text-white transition hover:bg-forest-light"
                    >
                      Gérer l’établissement
                    </button>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(accessLink);
                        alert('Lien public copié.');
                      }}
                      className="inline-flex items-center gap-2 rounded-lg border border-ink/10 px-3 py-2 text-xs font-medium transition hover:bg-[#f7f7f3]"
                    >
                      <Copy size={14} /> Copier le lien
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selected && (
        <EstablishmentWorkspace
          establishment={selected}
          businessTypes={businessTypes}
          close={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function EstablishmentWorkspace({
  establishment,
  businessTypes,
  close,
}: {
  establishment: Establishment;
  businessTypes: AIBusinessType[];
  close: () => void;
}) {
  const [tab, setTab] = useState<'general' | 'menu' | 'promotions' | 'reviews' | 'loyalty' | 'team' | 'analytics' | 'ai'>('general');
  const [details, setDetails] = useState<any>(null);
  const [counts, setCounts] = useState({ menu: 0, promotions: 0, reviews: 0, customers: 0, staff: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      const [est, menu, promotions, reviews, customers, staff] = await Promise.all([
        supabase.from('establishments').select('*').eq('id', establishment.id).maybeSingle(),
        supabase.from('menu_items').select('id', { count: 'exact', head: true }).eq('establishment_id', establishment.id),
        supabase.from('promotions').select('id', { count: 'exact', head: true }).eq('establishment_id', establishment.id),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('establishment_id', establishment.id),
        supabase.from('loyalty_customers').select('id', { count: 'exact', head: true }).eq('establishment_id', establishment.id),
        supabase.from('establishment_staff').select('id', { count: 'exact', head: true }).eq('establishment_id', establishment.id),
      ]);
      if (!active) return;
      setDetails(est.data ?? establishment);
      setCounts({
        menu: menu.count ?? 0,
        promotions: promotions.count ?? 0,
        reviews: reviews.count ?? 0,
        customers: customers.count ?? 0,
        staff: staff.count ?? 0,
      });
    })();
    return () => { active = false; };
  }, [establishment]);

  const update = (key: string, value: any) => setDetails((current: any) => ({ ...(current ?? establishment), [key]: value }));

  const saveGeneral = async () => {
    if (!details) return;
    setSaving(true);
    const payload = {
      name: details.name,
      slug: details.slug,
      business_type: details.business_type ?? null,
      address: details.address ?? null,
      city: details.city ?? null,
      phone: details.phone ?? null,
      email: details.email ?? null,
      website_url: details.website_url ?? null,
      description: details.description ?? null,
      instagram_url: details.instagram_url ?? null,
      facebook_url: details.facebook_url ?? null,
      tiktok_url: details.tiktok_url ?? null,
      whatsapp_number: details.whatsapp_number ?? null,
    };
    const { error } = await supabase.from('establishments').update(payload).eq('id', establishment.id);
    setSaving(false);
    if (error) alert(`Impossible d'enregistrer : ${error.message}`);
    else alert('Établissement enregistré.');
  };

  const tabs = [
    ['general', 'Général'], ['menu', 'Menu'], ['promotions', 'Promotions'], ['reviews', 'Avis'],
    ['loyalty', 'Fidélité'], ['team', 'Équipe'], ['analytics', 'Analytics'], ['ai', 'IA'],
  ] as const;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/50 p-3 backdrop-blur-sm md:p-8">
      <div className="mx-auto min-h-[calc(100vh-24px)] max-w-[1380px] overflow-hidden rounded-3xl bg-[#f7f7f3] shadow-2xl md:min-h-[calc(100vh-64px)]">
        <div className="flex items-center justify-between border-b border-ink/10 bg-forest px-5 py-5 text-white md:px-8">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gold">Espace établissement</p>
            <h3 className="mt-1 truncate font-display text-2xl">{details?.name ?? establishment.name}</h3>
            <p className="mt-1 text-xs text-white/50">/r/{establishment.slug}</p>
          </div>
          <button onClick={close} className="rounded-xl p-2 text-white/60 transition hover:bg-white/10 hover:text-white"><X size={22} /></button>
        </div>

        <div className="overflow-x-auto border-b border-ink/10 bg-white px-4 md:px-6">
          <div className="flex min-w-max gap-1 py-2">
            {tabs.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)} className={`rounded-xl px-4 py-2.5 text-xs font-semibold transition ${tab === id ? 'bg-forest text-white' : 'text-ink/50 hover:bg-[#f7f7f3]'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 md:p-8">
          {tab === 'general' && details && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {[
                  ['name', 'Nom'], ['slug', 'Slug'], ['address', 'Adresse'], ['city', 'Ville'],
                  ['phone', 'Téléphone'], ['email', 'Email'], ['website_url', 'Site web'],
                  ['instagram_url', 'Instagram'], ['facebook_url', 'Facebook'], ['tiktok_url', 'TikTok'], ['whatsapp_number', 'WhatsApp'],
                ].map(([key, label]) => (
                  <label key={key} className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink/40">{label}</span>
                    <input value={details[key] ?? ''} onChange={(e) => update(key, e.target.value)} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest" />
                  </label>
                ))}
                <label className="block">
                  <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink/40">Type</span>
                  <select value={details.business_type ?? ''} onChange={(e) => update('business_type', e.target.value)} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none">
                    <option value="">Non défini</option>
                    {businessTypes.map((type) => <option key={type.id} value={type.name}>{type.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="block">
                <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-ink/40">Description</span>
                <textarea value={details.description ?? ''} onChange={(e) => update('description', e.target.value)} rows={4} className="w-full rounded-xl border border-ink/10 bg-white px-3 py-2.5 text-sm outline-none focus:border-forest" />
              </label>
              <div className="flex flex-wrap gap-3">
                <button onClick={saveGeneral} disabled={saving} className="rounded-xl bg-forest px-5 py-3 text-xs font-semibold text-white disabled:opacity-50">{saving ? 'Enregistrement...' : 'Enregistrer les informations'}</button>
                <button onClick={() => window.open(`${window.location.origin}/r/${establishment.slug}`, '_blank')} className="rounded-xl border border-ink/10 bg-white px-5 py-3 text-xs font-semibold">Ouvrir la page publique</button>
              </div>

              <div className="grid gap-4 md:grid-cols-5">
                {[
                  ['Menu', counts.menu], ['Promotions', counts.promotions], ['Avis', counts.reviews], ['Clients fidélité', counts.customers], ['Équipe', counts.staff],
                ].map(([label, value]) => <div key={String(label)} className="rounded-2xl border border-ink/5 bg-white p-5"><p className="text-xs text-ink/40">{label}</p><p className="mt-2 text-2xl font-semibold text-forest">{value}</p></div>)}
              </div>
            </div>
          )}

          {tab !== 'general' && (
            <div className="rounded-2xl border border-dashed border-ink/10 bg-white p-8 text-center">
              <h4 className="font-display text-2xl text-forest">{tabs.find(([id]) => id === tab)?.[1]}</h4>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-ink/50">
                Cet espace est réservé à la gestion globale de cet établissement. La base est maintenant préparée pour brancher le module directement ici sans donner à l’Admin une restriction de type d’établissement.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                {tab === 'menu' && <button onClick={() => window.open('/dashboard/menu', '_blank')} className="rounded-xl bg-forest px-5 py-3 text-xs font-semibold text-white">Ouvrir le gestionnaire Menu</button>}
                {tab === 'reviews' && <button onClick={() => window.open('/admin', '_blank')} className="rounded-xl bg-forest px-5 py-3 text-xs font-semibold text-white">Ouvrir les avis Admin</button>}
                {tab === 'loyalty' && <button onClick={() => window.open('/dashboard/loyalty', '_blank')} className="rounded-xl bg-forest px-5 py-3 text-xs font-semibold text-white">Ouvrir la fidélité</button>}
              </div>
            </div>
          )}
        </div>
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
   STAT
========================================================= */

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Building2;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-forest/10 text-forest">
          <Icon size={19} />
        </div>

        <span className="text-2xl font-semibold text-forest">
          {value}
        </span>
      </div>

      <p className="mt-5 text-xs font-medium text-ink/50">
        {label}
      </p>
    </div>
  );
}
