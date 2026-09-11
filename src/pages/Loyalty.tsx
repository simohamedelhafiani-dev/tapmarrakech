import { useEffect, useMemo, useState } from 'react';
import {
  Gift,
  Plus,
  Search,
  Users,
  Star,
  Phone,
  Coins,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

type Establishment = {
  id: string;
  name: string;
};

type LoyaltyCustomer = {
  id: string;
  establishment_id: string;
  phone: string;
  first_name: string;
  points_balance: number;
  total_points_earned: number;
  total_points_redeemed: number;
  visit_count: number;
  last_visit_at: string | null;
  created_at: string;
};

type LoyaltyProgramSettings = {
  points_per_currency: number;
  currency: string;
  enabled: boolean;
};

export default function Loyalty() {
  const { user } = useAuth();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [programSettings, setProgramSettings] =
    useState<LoyaltyProgramSettings>({
      points_per_currency: 1,
      currency: 'MAD',
      enabled: true,
    });

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showPoints, setShowPoints] = useState<LoyaltyCustomer | null>(null);

  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');

  useEffect(() => {
    loadEstablishments();
  }, [user]);

  useEffect(() => {
    if (establishmentId) {
      loadCustomers();
      loadProgramSettings();
    }
  }, [establishmentId]);

  async function loadEstablishments() {
    if (!user) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('establishments')
      .select('id, name')
      .eq('user_id', user.id)
      .order('name');

    if (!error) {
      setEstablishments(data ?? []);

      if (data && data.length > 0) {
        setEstablishmentId(data[0].id);
      }
    }

    setLoading(false);
  }

  async function loadCustomers() {
    if (!establishmentId) return;

    setLoading(true);

    const { data, error } = await supabase
      .from('loyalty_customers')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false });

    if (!error) {
      setCustomers((data as LoyaltyCustomer[]) ?? []);
    }

    setLoading(false);
  }

  async function loadProgramSettings() {
    if (!establishmentId) return;

    const { data, error } = await supabase
      .from('loyalty_settings')
      .select('points_per_currency, currency, enabled')
      .eq('establishment_id', establishmentId)
      .maybeSingle();

    if (!error && data) {
      setProgramSettings({
        points_per_currency: Number(data.points_per_currency ?? 1),
        currency: data.currency ?? 'MAD',
        enabled: data.enabled ?? true,
      });
    } else {
      // Valeurs par défaut si aucun réglage n'est encore enregistré.
      setProgramSettings({
        points_per_currency: 1,
        currency: 'MAD',
        enabled: true,
      });
    }
  }

  const filteredCustomers = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return customers;

    return customers.filter(
      customer =>
        customer.first_name.toLowerCase().includes(value) ||
        customer.phone.toLowerCase().includes(value)
    );
  }, [customers, search]);

  const totalPoints = customers.reduce(
    (sum, customer) => sum + customer.points_balance,
    0
  );

  async function createCustomer() {
    if (!establishmentId || !phone.trim()) return;

    setSaving(true);

    const cleanPhone = phone.trim();

    const { error } = await supabase
      .from('loyalty_customers')
      .insert({
        establishment_id: establishmentId,
        phone: cleanPhone,
        first_name: firstName.trim(),
      });

    if (error) {
      if (error.code === '23505') {
        alert('Un client avec ce numéro existe déjà.');
      } else {
        alert(error.message);
      }

      setSaving(false);
      return;
    }

    setFirstName('');
    setPhone('');
    setShowNewCustomer(false);

    await loadCustomers();

    setSaving(false);
  }

  async function addPoints() {
    if (!showPoints || !establishmentId) return;

    const purchaseAmount = Number(amount);

    if (!purchaseAmount || purchaseAmount <= 0) {
      alert('Veuillez saisir un montant valide.');
      return;
    }

    if (!programSettings.enabled) {
      alert(
        'Le programme de fidélité est actuellement désactivé pour cet établissement.'
      );
      return;
    }

    const rate = Number(programSettings.points_per_currency);

    if (!Number.isFinite(rate) || rate <= 0) {
      alert(
        'Le taux de points est invalide. Vérifiez les paramètres du programme fidélité.'
      );
      return;
    }

    setSaving(true);

    // Calcul réel selon la configuration de l'établissement.
    // Exemple : 250 MAD × 2 points/MAD = 500 points.
    const points = Math.floor(purchaseAmount * rate);

    if (points <= 0) {
      alert(
        'Le montant est trop faible pour générer des points avec le taux actuel.'
      );
      setSaving(false);
      return;
    }

    const transactionReference = crypto.randomUUID();

    const { error: transactionError } = await supabase
      .from('loyalty_transactions')
      .insert({
        establishment_id: establishmentId,
        customer_id: showPoints.id,
        employee_id: user?.id ?? null,
        amount: purchaseAmount,
        points,
        type: 'EARN',
        description: `Achat de ${purchaseAmount.toFixed(2)} ${programSettings.currency}`,
        transaction_reference: transactionReference,
      });

    if (transactionError) {
      alert(transactionError.message);
      setSaving(false);
      return;
    }

    const { error: customerError } = await supabase
      .from('loyalty_customers')
      .update({
        points_balance: showPoints.points_balance + points,
        total_points_earned: showPoints.total_points_earned + points,
        visit_count: showPoints.visit_count + 1,
        last_visit_at: new Date().toISOString(),
      })
      .eq('id', showPoints.id)
      .eq('establishment_id', establishmentId);

    if (customerError) {
      alert(
        `La transaction a été enregistrée mais la mise à jour du client a échoué : ${customerError.message}`
      );
      setSaving(false);
      return;
    }

    setAmount('');
    setShowPoints(null);

    await loadCustomers();

    setSaving(false);
  }

  const calculatedPoints =
    Number(amount) > 0
      ? Math.floor(Number(amount) * programSettings.points_per_currency)
      : 0;

  if (loading && establishments.length === 0) {
    return (
      <div className="h-72 animate-pulse rounded-2xl bg-ink/5" />
    );
  }

  return (
    <div>
      {/* HEADER */}
      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            Fidélité
          </p>

          <h1 className="mt-2 font-display text-4xl text-forest">
            Compte Fidélité
          </h1>

          <p className="mt-2 text-sm text-ink/50">
            Fidélisez vos clients grâce à leur numéro de téléphone.
          </p>
        </div>

        <button
          onClick={() => setShowNewCustomer(true)}
          disabled={!establishmentId || !programSettings.enabled}
          className="flex w-fit items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={16} />
          Nouveau client
        </button>
      </div>

      {/* PROGRAM STATUS */}
      <div
        className={`mb-6 rounded-2xl border p-5 shadow-soft ${
          programSettings.enabled
            ? 'border-forest/10 bg-white'
            : 'border-red-200 bg-red-50'
        }`}
      >
        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gold">
              Programme fidélité
            </p>

            <p className="mt-1 text-sm font-medium text-forest">
              {programSettings.enabled
                ? 'Programme actif'
                : 'Programme désactivé'}
            </p>

            <p className="mt-1 text-xs text-ink/45">
              {programSettings.enabled
                ? `${programSettings.points_per_currency} point(s) par ${programSettings.currency}`
                : 'Aucun nouveau point ne peut être attribué.'}
            </p>
          </div>

          <div
            className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${
              programSettings.enabled
                ? 'bg-[#e5eee9] text-forest'
                : 'bg-red-100 text-red-700'
            }`}
          >
            {programSettings.enabled ? 'ACTIF' : 'INACTIF'}
          </div>
        </div>
      </div>

      {/* ESTABLISHMENT */}
      {establishments.length > 1 && (
        <div className="mb-6 rounded-2xl border border-ink/5 bg-white p-5 shadow-soft">
          <label className="text-xs font-medium text-ink/50">
            Établissement
          </label>

          <select
            value={establishmentId}
            onChange={e => setEstablishmentId(e.target.value)}
            className="mt-2 w-full max-w-md rounded-xl border border-ink/10 bg-[#fafaf7] px-4 py-3 text-sm text-ink outline-none"
          >
            {establishments.map(establishment => (
              <option key={establishment.id} value={establishment.id}>
                {establishment.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* STATS */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Clients fidélité"
          value={customers.length}
          icon={Users}
        />

        <Stat
          label="Points en circulation"
          value={totalPoints}
          icon={Coins}
        />

        <Stat
          label="Clients actifs"
          value={
            customers.filter(customer => customer.visit_count > 0).length
          }
          icon={Star}
        />

        <Stat
          label="Récompenses"
          value="Bientôt"
          icon={Gift}
        />
      </div>

      {/* CLIENTS */}
      <section className="mt-6 rounded-2xl border border-ink/5 bg-white shadow-soft">
        <div className="flex flex-col justify-between gap-4 border-b border-ink/5 p-5 md:flex-row md:items-center md:p-7">
          <div>
            <h2 className="font-display text-xl text-forest">
              Mes clients
            </h2>

            <p className="mt-1 text-xs text-ink/45">
              Recherchez un client par son prénom ou son numéro.
            </p>
          </div>

          <div className="relative w-full md:w-80">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/30"
            />

            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher un client..."
              className="w-full rounded-xl border border-ink/10 bg-[#fafaf7] py-2.5 pl-9 pr-3 text-xs outline-none focus:border-gold"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[700px] text-left">
            <thead>
              <tr className="border-b border-ink/5 text-[10px] uppercase tracking-wider text-ink/40">
                <th className="px-6 py-4">Client</th>
                <th className="px-6 py-4">Téléphone</th>
                <th className="px-6 py-4">Points</th>
                <th className="px-6 py-4">Visites</th>
                <th className="px-6 py-4">Dernière visite</th>
                <th className="px-6 py-4"></th>
              </tr>
            </thead>

            <tbody>
              {filteredCustomers.map(customer => (
                <tr
                  key={customer.id}
                  className="border-b border-ink/5 last:border-0"
                >
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm text-forest">
                      {customer.first_name || 'Client'}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-xs text-ink/55">
                    <span className="inline-flex items-center gap-2">
                      <Phone size={13} />
                      {customer.phone}
                    </span>
                  </td>

                  <td className="px-6 py-4">
                    <span className="rounded-full bg-[#f4ead3] px-3 py-1 text-xs font-semibold text-forest">
                      ⭐ {customer.points_balance}
                    </span>
                  </td>

                  <td className="px-6 py-4 text-xs text-ink/55">
                    {customer.visit_count}
                  </td>

                  <td className="px-6 py-4 text-xs text-ink/45">
                    {customer.last_visit_at
                      ? new Date(
                          customer.last_visit_at
                        ).toLocaleDateString('fr-FR')
                      : '—'}
                  </td>

                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setShowPoints(customer)}
                      disabled={!programSettings.enabled}
                      className="rounded-lg bg-forest px-3 py-2 text-[11px] font-semibold text-white transition hover:bg-forest-light disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      Ajouter des points
                    </button>
                  </td>
                </tr>
              ))}

              {!filteredCustomers.length && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-16 text-center text-sm text-ink/40"
                  >
                    {search
                      ? 'Aucun client trouvé.'
                      : 'Aucun client fidélité pour le moment.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* NEW CUSTOMER MODAL */}
      {showNewCustomer && (
        <Modal
          title="Nouveau client"
          onClose={() => setShowNewCustomer(false)}
        >
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-ink/60">
                Prénom
              </label>

              <input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                placeholder="Mohamed"
                className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">
                Numéro de téléphone *
              </label>

              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="06 XX XX XX XX"
                className="mt-2 w-full rounded-xl border border-ink/10 px-4 py-3 text-sm outline-none focus:border-gold"
              />
            </div>

            <button
              onClick={createCustomer}
              disabled={saving || !phone.trim()}
              className="w-full rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {saving ? 'Création...' : 'Créer le compte fidélité'}
            </button>
          </div>
        </Modal>
      )}

      {/* ADD POINTS MODAL */}
      {showPoints && (
        <Modal
          title="Ajouter des points"
          onClose={() => setShowPoints(null)}
        >
          <div className="space-y-5">
            <div className="rounded-xl bg-[#f7f7f3] p-4">
              <p className="text-xs text-ink/45">Client</p>

              <p className="mt-1 font-semibold text-forest">
                {showPoints.first_name || 'Client'}
              </p>

              <p className="mt-1 text-xs text-ink/50">
                {showPoints.phone}
              </p>

              <p className="mt-3 text-sm font-semibold text-gold">
                ⭐ {showPoints.points_balance} points
              </p>
            </div>

            <div>
              <label className="text-xs font-medium text-ink/60">
                Montant de l'achat
              </label>

              <div className="relative mt-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={e => setAmount(e.target.value)}
                  placeholder="250"
                  className="w-full rounded-xl border border-ink/10 px-4 py-3 pr-16 text-sm outline-none focus:border-gold"
                />

                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs text-ink/40">
                  {programSettings.currency}
                </span>
              </div>
            </div>

            {/* PROGRAM RULE */}
            <div className="rounded-xl bg-[#f7f7f3] p-4">
              <div className="flex justify-between text-xs text-ink/50">
                <span>Règle du programme</span>
                <strong className="text-forest">
                  {programSettings.points_per_currency} pt /{' '}
                  {programSettings.currency}
                </strong>
              </div>
            </div>

            {Number(amount) > 0 && (
              <div className="rounded-xl border border-gold/30 bg-[#f4ead3] p-4">
                <div className="flex justify-between text-xs">
                  <span>Points gagnés</span>
                  <strong>+{calculatedPoints}</strong>
                </div>

                <div className="mt-2 flex justify-between text-sm font-semibold text-forest">
                  <span>Nouveau solde</span>
                  <span>
                    {showPoints.points_balance + calculatedPoints}{' '}
                    points
                  </span>
                </div>
              </div>
            )}

            <button
              onClick={addPoints}
              disabled={
                saving ||
                Number(amount) <= 0 ||
                !programSettings.enabled
              }
              className="w-full rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white disabled:opacity-40"
            >
              {saving ? 'Validation...' : 'Valider les points'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink/50">{label}</p>

          <p className="mt-3 font-display text-3xl text-forest">
            {value}
          </p>
        </div>

        <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#e5eee9] text-forest">
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-5">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="font-display text-2xl text-forest">
            {title}
          </h2>

          <button
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-full bg-[#f7f7f3] text-ink/50"
          >
            <X size={17} />
          </button>
        </div>

        {children}
      </div>
    </div>
  );
}
