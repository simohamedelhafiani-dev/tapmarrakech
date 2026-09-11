import { useEffect, useState } from 'react';
import {
  BarChart3,
  Building2,
  Gift,
  LogOut,
  Menu,
  Users,
  UserRound,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

type Establishment = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};

type AdminSection =
  | 'overview'
  | 'establishments'
  | 'responsibles'
  | 'employees'
  | 'codes';

export default function Admin() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const [section, setSection] = useState<AdminSection>('overview');
  const [open, setOpen] = useState(false);

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);

  const loadEstablishments = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from('establishments')
      .select('id, name, slug, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erreur établissements:', error);
      setEstablishments([]);
    } else {
      setEstablishments(data ?? []);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadEstablishments();
  }, []);

  const logout = async () => {
    await signOut();
    navigate('/login');
  };

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
      id: 'codes',
      label: 'Codes récompenses',
      icon: Gift,
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
        </header>

        <main className="mx-auto max-w-[1440px] p-5 md:p-10">
          {section === 'overview' && (
            <Overview
              establishments={establishments}
              loading={loading}
            />
          )}

          {section === 'establishments' && (
            <EstablishmentsSection
              establishments={establishments}
              loading={loading}
              reload={loadEstablishments}
            />
          )}

          {section === 'responsibles' && (
            <EmptySection
              icon={UserRound}
              title="Responsables"
              description="La gestion des responsables sera disponible ici."
            />
          )}

          {section === 'employees' && (
            <EmptySection
              icon={Users}
              title="Employés"
              description="La gestion des employés sera disponible ici."
            />
          )}

          {section === 'codes' && (
            <EmptySection
              icon={Gift}
              title="Codes récompenses"
              description="La gestion des codes de récompenses sera disponible ici."
            />
          )}
        </main>
      </div>
    </div>
  );
}

function Overview({
  establishments,
  loading,
}: {
  establishments: Establishment[];
  loading: boolean;
}) {
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
          value="—"
        />

        <StatCard
          icon={Users}
          label="Employés"
          value="—"
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
            {establishments.slice(0, 5).map((establishment) => (
              <div
                key={establishment.id}
                className="flex items-center justify-between rounded-xl bg-[#f7f7f3] px-4 py-3"
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

                <span className="rounded-full bg-green-100 px-3 py-1 text-[10px] font-semibold text-green-700">
                  Actif
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EstablishmentsSection({
  establishments,
  loading,
  reload,
}: {
  establishments: Establishment[];
  loading: boolean;
  reload: () => Promise<void>;
}) {
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
            Gestion
          </p>

          <h2 className="font-display text-3xl text-forest md:text-4xl">
            Établissements
          </h2>

          <p className="mt-2 text-sm text-ink/50">
            Gérez les commerces présents sur TapMarrakech.
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
        />
      )}

      <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-sm text-ink/40">
            Chargement...
          </div>
        ) : establishments.length === 0 ? (
          <div className="p-10 text-center">
            <Building2
              size={35}
              className="mx-auto text-ink/20"
            />

            <p className="mt-4 text-sm text-ink/50">
              Aucun établissement créé.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-ink/5">
            {establishments.map((establishment) => (
              <div
                key={establishment.id}
                className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
              >
                <div className="flex items-center gap-4">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-forest text-white">
                    <Building2 size={19} />
                  </div>

                  <div>
                    <h3 className="text-sm font-semibold">
                      {establishment.name}
                    </h3>

                    <p className="mt-1 text-xs text-ink/40">
                      Slug : {establishment.slug}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      navigator.clipboard.writeText(
                        `${window.location.origin}/c/${establishment.slug}`
                      )
                    }
                    className="rounded-lg border border-ink/10 px-3 py-2 text-xs font-medium transition hover:bg-[#f7f7f3]"
                  >
                    🔗 Copier le lien
                  </button>

                  <span className="rounded-lg bg-green-100 px-3 py-2 text-xs font-semibold text-green-700">
                    Actif
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CreateEstablishmentForm({
  close,
  reload,
}: {
  close: () => void;
  reload: () => Promise<void>;
}) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
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

    setSaving(true);

    const { error } = await supabase
      .from('establishments')
      .insert({
        name: name.trim(),
        slug: slug.trim(),
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
            Créez d’abord l’établissement. Nous ajouterons ensuite son
            responsable et ses employés.
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
            onChange={(e) => setSlug(generateSlug(e.target.value))}
            placeholder="restaurant-atlas"
            className="w-full rounded-xl border border-ink/10 bg-[#f7f7f3] px-4 py-3 text-sm outline-none transition focus:border-forest"
          />
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

function EmptySection({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof Users;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="mb-8">
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
          Administration
        </p>

        <h2 className="font-display text-3xl text-forest md:text-4xl">
          {title}
        </h2>
      </div>

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
    </div>
  );
}
