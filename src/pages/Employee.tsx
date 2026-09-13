import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  UserPlus,
  Coins,
  Gift,
  X,
  CheckCircle2,
  Phone,
  User,
  CalendarDays,
  Building2,
  Receipt,
  LockKeyhole,
  WalletCards,
  LogOut,
  KeyRound,
} from 'lucide-react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Establishment = {
  id: string;
  name: string;
};

type LoyaltyCustomer = {
  id: string;
  establishment_id: string;
  loyalty_number: string;
  phone: string;
  first_name: string;
  last_name: string | null;
  birth_date: string | null;
  points_balance: number;
  total_points_earned: number;
  total_points_redeemed: number;
  visit_count: number;
  last_visit_at: string | null;
  created_at: string;
};

type LoyaltyReward = {
  id: string;
  establishment_id: string;
  name: string;
  description: string | null;
  points_required: number;
  active: boolean;
};

type ProgramSettings = {
  points_per_currency: number;
  currency: string;
  enabled: boolean;
};

type EmployeeSession = {
  access_token: string;
  session_token: string;
  employee_id: string;
  employee_name: string;
  establishment_id: string;
  establishment_name: string;
  expires_at: string;
};

const EMPLOYEE_SESSION_KEY = 'tapmarrakech_employee_session';

export default function Employee() {
  const [session, setSession] = useState<EmployeeSession | null>(null);
  const [employeeCode, setEmployeeCode] = useState('');
  const [loginLoading, setLoginLoading] = useState(true);
  const [loginSaving, setLoginSaving] = useState(false);

  const employeeSupabase = useMemo<SupabaseClient | null>(() => {
    if (!session?.access_token) return null;

    return createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_ANON_KEY,
      {
        global: {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }, [session]);

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [rewards, setRewards] = useState<LoyaltyReward[]>([]);
  const [settings, setSettings] = useState<ProgramSettings>({
    points_per_currency: 1,
    currency: 'MAD',
    enabled: true,
  });

  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showNewCustomer, setShowNewCustomer] = useState(false);
  const [showPoints, setShowPoints] = useState<LoyaltyCustomer | null>(null);
  const [showRewards, setShowRewards] = useState<LoyaltyCustomer | null>(null);
  const [selectedReward, setSelectedReward] = useState<LoyaltyReward | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [pointsResponsibleCode, setPointsResponsibleCode] = useState('');

  const [rewardCode, setRewardCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'OTHER'>('CASH');

  useEffect(() => {
    try {
      const raw = localStorage.getItem(EMPLOYEE_SESSION_KEY);
      if (!raw) {
        setLoginLoading(false);
        return;
      }

      const stored = JSON.parse(raw) as EmployeeSession;
      const expiresAt = new Date(stored.expires_at).getTime();

      if (!stored.access_token || !stored.session_token || !expiresAt || expiresAt <= Date.now()) {
        localStorage.removeItem(EMPLOYEE_SESSION_KEY);
        setLoginLoading(false);
        return;
      }

      setSession(stored);
      setEstablishmentId(stored.establishment_id);
    } catch (error) {
      console.error('Session employé invalide:', error);
      localStorage.removeItem(EMPLOYEE_SESSION_KEY);
    } finally {
      setLoginLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session || !employeeSupabase) return;
    setEstablishmentId(session.establishment_id);
    loadEstablishments();
  }, [session, employeeSupabase]);

  useEffect(() => {
    if (!establishmentId || !employeeSupabase) return;
    loadCustomers();
    loadRewards();
    loadSettings();
  }, [establishmentId, employeeSupabase]);

  async function loginEmployee() {
    const code = employeeCode.trim();

    if (code.length < 4) {
      alert('Veuillez saisir votre code employé.');
      return;
    }

    setLoginSaving(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/employee-login`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ code }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        alert(result?.error ?? 'Code employé incorrect.');
        return;
      }

      const nextSession: EmployeeSession = {
        access_token: result.access_token,
        session_token: result.refresh_token,
        employee_id: result.employee_id,
        employee_name: result.employee_name,
        establishment_id: result.establishment_id,
        establishment_name: result.establishment_name,
        expires_at: result.expires_at,
      };

      localStorage.setItem(EMPLOYEE_SESSION_KEY, JSON.stringify(nextSession));
      setEmployeeCode('');
      setSession(nextSession);
      setEstablishmentId(nextSession.establishment_id);
    } catch (error) {
      console.error('Erreur connexion employé:', error);
      alert('Impossible de se connecter pour le moment.');
    } finally {
      setLoginSaving(false);
    }
  }

  async function logoutEmployee() {
    try {
      if (employeeSupabase && session?.session_token) {
        await employeeSupabase.rpc('logout_employee', {
          p_session_token: session.session_token,
        });
      }
    } catch (error) {
      console.error('Erreur déconnexion employé:', error);
    } finally {
      localStorage.removeItem(EMPLOYEE_SESSION_KEY);
      setSession(null);
      setEstablishmentId('');
      setEstablishments([]);
      setCustomers([]);
      setRewards([]);
      setEmployeeCode('');
    }
  }

  async function loadEstablishments() {
    if (!employeeSupabase) return;

    setLoading(true);

    const { data, error } = await employeeSupabase.rpc('get_my_establishments');

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const places = (data ?? []).map((item: { id: string; name: string }) => ({
      id: item.id,
      name: item.name,
    }));

    setEstablishments(places);

    if (places.length > 0) {
      setEstablishmentId(prev => prev || places[0].id);
    }

    setLoading(false);
  }

  async function loadCustomers() {
    if (!employeeSupabase) return;
    if (!establishmentId) return;

    const { data, error } = await employeeSupabase
      .from('loyalty_customers')
      .select('*')
      .eq('establishment_id', establishmentId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      return;
    }

    setCustomers((data as LoyaltyCustomer[]) ?? []);
  }

  async function loadRewards() {
    if (!employeeSupabase) return;
    if (!establishmentId) return;

    const { data, error } = await employeeSupabase
      .from('loyalty_rewards')
      .select('id, establishment_id, name, description, points_required, active')
      .eq('establishment_id', establishmentId)
      .eq('active', true)
      .order('points_required', { ascending: true });

    if (error) {
      console.error(error);
      setRewards([]);
      return;
    }

    setRewards((data as LoyaltyReward[]) ?? []);
  }

  async function loadSettings() {
    if (!employeeSupabase) return;
    if (!establishmentId) return;

    const { data, error } = await employeeSupabase
      .from('loyalty_settings')
      .select('points_per_currency, currency, enabled')
      .eq('establishment_id', establishmentId)
      .maybeSingle();

    if (!error && data) {
      setSettings({
        points_per_currency: Number(data.points_per_currency ?? 1),
        currency: data.currency ?? 'MAD',
        enabled: data.enabled ?? true,
      });
    }
  }

  const filteredCustomers = useMemo(() => {
    const value = search.trim().toLowerCase();

    if (!value) return customers.slice(0, 20);

    return customers.filter(customer => {
      const fullName = `${customer.first_name} ${customer.last_name ?? ''}`.toLowerCase();
      return (
        customer.loyalty_number.toLowerCase().includes(value) ||
        fullName.includes(value) ||
        customer.phone.toLowerCase().includes(value)
      );
    });
  }, [customers, search]);

  async function createCustomer() {
    if (!employeeSupabase) return;
    if (!establishmentId) return;

    if (!firstName.trim()) {
      alert('Veuillez saisir le prénom.');
      return;
    }

    if (!lastName.trim()) {
      alert('Veuillez saisir le nom.');
      return;
    }

    if (!phone.trim()) {
      alert('Veuillez saisir le numéro de téléphone.');
      return;
    }

    setSaving(true);

    const { data, error } = await employeeSupabase
      .from('loyalty_customers')
      .insert({
        establishment_id: establishmentId,
        phone: phone.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        birth_date: birthDate || null,
      })
      .select('*')
      .single();

    setSaving(false);

    if (error) {
      if (error.code === '23505') {
        alert('Un client avec ce numéro existe déjà dans cet établissement.');
      } else {
        alert(error.message);
      }
      return;
    }

    setFirstName('');
    setLastName('');
    setPhone('');
    setBirthDate('');
    setShowNewCustomer(false);
    setSearch(data.phone);

    await loadCustomers();
  }

  async function addPoints() {
    if (!employeeSupabase) return;
    if (!showPoints || !establishmentId) return;

    const amount = Number(purchaseAmount);
    const code = pointsResponsibleCode.trim();

    if (!settings.enabled) {
      alert('Le programme de fidélité est désactivé pour cet établissement.');
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Veuillez saisir un montant valide.');
      return;
    }

    if (code.length < 4) {
      alert('Le code responsable est obligatoire.');
      return;
    }

    setSaving(true);

    const { data, error } = await employeeSupabase.rpc('add_loyalty_points', {
      p_establishment_id: establishmentId,
      p_customer_id: showPoints.id,
      p_amount: amount,
      p_responsible_code: code,
      p_description: `Achat de ${amount.toFixed(2)} ${settings.currency}`,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    const newBalance = Number(data ?? 0);
    const earned = Math.floor(amount * Number(settings.points_per_currency));

    alert(`+${earned} points ajoutés. Nouveau solde : ${newBalance} points.`);

    setPurchaseAmount('');
    setPointsResponsibleCode('');
    setShowPoints(null);
    await loadCustomers();
  }

  function openRewards(customer: LoyaltyCustomer) {
    setShowRewards(customer);
    setSelectedReward(null);
    setRewardCode('');
    setInvoiceNumber('');
    setInvoiceAmount('');
    setPaymentMethod('CASH');
  }

  async function redeemReward() {
    if (!employeeSupabase) return;
    if (!showRewards || !selectedReward || !establishmentId) return;

    if (showRewards.points_balance < selectedReward.points_required) {
      alert('Le client ne possède pas assez de points.');
      return;
    }

    if (rewardCode.trim().length < 4) {
      alert('Le code responsable est obligatoire.');
      return;
    }

    if (!invoiceNumber.trim()) {
      alert('Le numéro de facture est obligatoire.');
      return;
    }

    const amount = Number(invoiceAmount);

    if (!Number.isFinite(amount) || amount <= 0) {
      alert('Veuillez saisir un montant de facture valide.');
      return;
    }

    setSaving(true);

    const { data, error } = await employeeSupabase.rpc('redeem_loyalty_reward', {
      p_establishment_id: establishmentId,
      p_customer_id: showRewards.id,
      p_reward_id: selectedReward.id,
      p_reward_code: rewardCode.trim(),
      p_invoice_number: invoiceNumber.trim(),
      p_invoice_amount: amount,
      p_payment_method: paymentMethod,
    });

    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    const result = Array.isArray(data) ? data[0] : data;

    alert(
      `Récompense validée.\n\n${selectedReward.name}\nNouveau solde : ${Number(
        result?.new_points_balance ?? 0
      )} points.`
    );

    setShowRewards(null);
    setSelectedReward(null);
    setRewardCode('');
    setInvoiceNumber('');
    setInvoiceAmount('');
    await loadCustomers();
  }

  const selectedEstablishmentName =
    establishments.find(item => item.id === establishmentId)?.name ?? '';

  if (loginLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f7f3]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-[#f7f7f3] px-4 py-8">
        <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-md items-center justify-center">
          <div className="w-full rounded-[2rem] border border-ink/5 bg-white p-7 shadow-2xl md:p-9">
            <div className="mb-8 text-center">
              <div className="font-display text-3xl tracking-tight text-forest">
                Tap<span className="text-gold">Marrakech</span>
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
                Espace employé
              </p>
              <h1 className="mt-2 font-display text-3xl text-forest">
                Entrez votre code
              </h1>
              <p className="mt-2 text-sm leading-6 text-ink/45">
                Votre code suffit pour retrouver automatiquement votre établissement.
              </p>
            </div>

            <div className="relative">
              <KeyRound size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30" />
              <input
                autoFocus
                type="password"
                inputMode="numeric"
                value={employeeCode}
                onChange={e => setEmployeeCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') loginEmployee();
                }}
                placeholder="Code de connexion"
                className="w-full rounded-2xl border border-ink/10 bg-[#f7f7f3] py-4 pl-12 pr-4 text-center text-lg tracking-[0.25em] outline-none focus:border-forest"
              />
            </div>

            <button
              onClick={loginEmployee}
              disabled={loginSaving}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-forest py-4 text-sm font-semibold text-white transition hover:bg-forest-light disabled:opacity-50"
            >
              <KeyRound size={17} />
              {loginSaving ? 'Connexion...' : 'Accéder à mon espace'}
            </button>

            <button
              onClick={() => {
                window.location.href = '/login';
              }}
              className="mt-5 w-full text-center text-xs font-medium text-ink/40 hover:text-forest"
            >
              ← Retour aux accès TapMarrakech
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center bg-[#f7f7f3]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-forest border-t-transparent" />
      </div>
    );
  }

  if (establishments.length === 0) {
    return (
      <div className="min-h-screen bg-[#f7f7f3] p-6">
        <div className="mx-auto max-w-4xl rounded-3xl border border-ink/5 bg-white p-10 text-center shadow-sm">
          <Building2 className="mx-auto mb-4 text-forest" size={42} />
          <h1 className="font-display text-3xl text-forest">
            Aucun établissement
          </h1>
          <p className="mt-2 text-sm text-ink/50">
            Votre compte n’est rattaché à aucun établissement.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f7f7f3] p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-forest/50">
              Espace employé
            </p>
            <h1 className="mt-2 font-display text-3xl text-forest md:text-4xl">
              Fidélité
            </h1>
            <p className="mt-2 text-sm text-ink/50">
              Recherchez un client, ajoutez ses points ou utilisez une récompense.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <div className="rounded-xl border border-ink/5 bg-white px-4 py-3">
              <p className="text-[11px] uppercase tracking-wide text-ink/40">
                Établissement
              </p>
              <p className="mt-1 text-sm font-semibold text-forest">
                {session.establishment_name || selectedEstablishmentName}
              </p>
            </div>

            <button
              onClick={logoutEmployee}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
            >
              <LogOut size={17} />
              Déconnexion
            </button>
          </div>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-[1fr_auto]">
          <div className="relative">
            <Search
              size={19}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/30"
            />
            <input
              type="search"
              name="customer-search"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="N° fidélité, téléphone, prénom ou nom..."
              className="w-full rounded-2xl border border-ink/10 bg-white py-4 pl-12 pr-4 text-sm outline-none focus:border-forest"
            />
          </div>

          <button
            onClick={() => setShowNewCustomer(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-forest px-5 py-4 text-sm font-semibold text-white transition hover:bg-forest-light"
          >
            <UserPlus size={18} />
            Nouveau client
          </button>
        </div>

        <div className="mb-6 rounded-2xl border border-ink/5 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-ink/40">Programme fidélité</p>
              <p className="mt-1 text-sm font-semibold text-forest">
                {settings.enabled
                  ? `${settings.points_per_currency} point(s) / ${settings.currency}`
                  : 'Désactivé'}
              </p>
            </div>
            <Coins size={25} className="text-forest/50" />
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-ink/5 bg-white shadow-sm">
          {filteredCustomers.length === 0 ? (
            <div className="p-12 text-center">
              <User size={38} className="mx-auto text-ink/20" />
              <h2 className="mt-4 font-display text-2xl text-forest">
                Aucun client trouvé
              </h2>
              <p className="mt-2 text-sm text-ink/40">
                Recherchez un autre numéro ou créez un nouveau client.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-ink/5">
              {filteredCustomers.map(customer => (
                <div
                  key={customer.id}
                  className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-forest/10 text-forest">
                      <User size={21} />
                    </div>

                    <div className="min-w-0">
                      <p className="truncate font-semibold text-forest">
                        {customer.first_name} {customer.last_name ?? ''}
                      </p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink/45">
                        <span className="inline-flex items-center gap-1">
                          <Phone size={13} />
                          {customer.phone}
                        </span>
                        <span className="font-medium text-forest/60">
                          N° {customer.loyalty_number}
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="rounded-xl bg-[#f7f7f3] px-4 py-2 text-center">
                      <p className="text-[10px] uppercase tracking-wide text-ink/40">
                        Points
                      </p>
                      <p className="font-semibold text-forest">
                        {customer.points_balance}
                      </p>
                    </div>

                    <button
                      onClick={() => setShowPoints(customer)}
                      className="inline-flex items-center gap-2 rounded-xl border border-forest/15 px-4 py-2.5 text-xs font-semibold text-forest hover:bg-forest/5"
                    >
                      <Coins size={16} />
                      Ajouter points
                    </button>

                    <button
                      onClick={() => openRewards(customer)}
                      className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white hover:bg-forest-light"
                    >
                      <Gift size={16} />
                      Récompenses
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showNewCustomer && (
        <Modal title="Nouveau client" onClose={() => setShowNewCustomer(false)}>
          <div className="space-y-4">
            <Field
              icon={<User size={16} />}
              label="Prénom"
              value={firstName}
              onChange={setFirstName}
              placeholder="Prénom"
            />
            <Field
              icon={<User size={16} />}
              label="Nom"
              value={lastName}
              onChange={setLastName}
              placeholder="Nom"
            />
            <Field
              icon={<Phone size={16} />}
              label="Téléphone"
              value={phone}
              onChange={setPhone}
              placeholder="06 XX XX XX XX"
              type="tel"
            />
            <Field
              icon={<CalendarDays size={16} />}
              label="Date de naissance (optionnel)"
              value={birthDate}
              onChange={setBirthDate}
              type="date"
            />

            <button
              disabled={saving}
              onClick={createCustomer}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <UserPlus size={17} />
              {saving ? 'Création...' : 'Créer le client'}
            </button>
          </div>
        </Modal>
      )}

      {showPoints && (
        <Modal
          title="Ajouter des points"
          onClose={() => {
            if (!saving) {
              setShowPoints(null);
              setPurchaseAmount('');
                        setPointsResponsibleCode('');
            }
          }}
        >
          <div className="rounded-2xl bg-[#f7f7f3] p-4">
            <p className="font-semibold text-forest">
              {showPoints.first_name} {showPoints.last_name ?? ''}
            </p>
            <p className="mt-1 text-xs text-ink/45">{showPoints.phone}</p>
            <p className="mt-1 text-xs font-medium text-forest/60">N° fidélité : {showPoints.loyalty_number}</p>
            <div className="mt-4 flex items-center justify-between border-t border-ink/5 pt-3">
              <span className="text-xs text-ink/45">Solde actuel</span>
              <span className="font-bold text-forest">
                {showPoints.points_balance} points
              </span>
            </div>
          </div>

          <div className="mt-5 space-y-4">
            <Field
              icon={<Receipt size={16} />}
              label={`Montant de la facture (${settings.currency})`}
              value={purchaseAmount}
              onChange={setPurchaseAmount}
              placeholder="500"
              type="number"
            />

            <Field
              icon={<LockKeyhole size={16} />}
              label="Code responsable"
              value={pointsResponsibleCode}
              onChange={setPointsResponsibleCode}
              placeholder="Code"
              type="password"
            />

            {purchaseAmount && Number(purchaseAmount) > 0 && (
              <div className="rounded-xl border border-forest/10 bg-forest/5 p-3 text-sm text-forest">
                Cet achat générera environ{' '}
                <strong>
                  {Math.floor(
                    Number(purchaseAmount) * settings.points_per_currency
                  )}
                </strong>{' '}
                points.
              </div>
            )}
          </div>

          <button
            disabled={saving}
            onClick={addPoints}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white disabled:opacity-50"
          >
            <CheckCircle2 size={17} />
            {saving ? 'Validation...' : 'Valider les points'}
          </button>
        </Modal>
      )}

      {showRewards && (
        <Modal
          title="Utiliser une récompense"
          onClose={() => {
            if (!saving) {
              setShowRewards(null);
              setSelectedReward(null);
            }
          }}
          wide
        >
          <div className="grid gap-5 md:grid-cols-[1fr_1fr]">
            <div>
              <div className="rounded-2xl bg-[#f7f7f3] p-4">
                <p className="text-xs text-ink/40">Client</p>
                <p className="mt-1 font-semibold text-forest">
                  {showRewards.first_name} {showRewards.last_name ?? ''}
                </p>
                <p className="mt-1 text-xs text-ink/45">{showRewards.phone}</p>
                <p className="mt-1 text-xs font-medium text-forest/60">N° fidélité : {showRewards.loyalty_number}</p>
                <div className="mt-4 flex items-center justify-between border-t border-ink/5 pt-3">
                  <span className="text-xs text-ink/45">Solde</span>
                  <span className="font-bold text-forest">
                    {showRewards.points_balance} points
                  </span>
                </div>
              </div>

              <div className="mt-4 space-y-2">
                {rewards.length === 0 ? (
                  <div className="rounded-xl border border-ink/5 p-5 text-center text-sm text-ink/45">
                    Aucune récompense active.
                  </div>
                ) : (
                  rewards.map(reward => {
                    const available =
                      showRewards.points_balance >= reward.points_required;

                    return (
                      <button
                        key={reward.id}
                        disabled={!available}
                        onClick={() => setSelectedReward(reward)}
                        className={`w-full rounded-xl border p-4 text-left transition ${
                          selectedReward?.id === reward.id
                            ? 'border-forest bg-forest/5'
                            : 'border-ink/10 bg-white'
                        } ${!available ? 'cursor-not-allowed opacity-40' : 'hover:border-forest/30'}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-forest">
                              {reward.name}
                            </p>
                            {reward.description && (
                              <p className="mt-1 text-xs text-ink/45">
                                {reward.description}
                              </p>
                            )}
                          </div>
                          <span className="shrink-0 rounded-lg bg-[#f7f7f3] px-2.5 py-1 text-xs font-semibold text-forest">
                            {reward.points_required} pts
                          </span>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-ink/5 bg-white p-5">
              {!selectedReward ? (
                <div className="grid min-h-[280px] place-items-center text-center">
                  <div>
                    <Gift size={38} className="mx-auto text-ink/20" />
                    <p className="mt-4 text-sm text-ink/45">
                      Sélectionnez une récompense.
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  <div className="rounded-xl bg-forest p-4 text-white">
                    <p className="text-xs text-white/60">Récompense sélectionnée</p>
                    <p className="mt-1 font-semibold">{selectedReward.name}</p>
                    <p className="mt-1 text-xs text-white/70">
                      {selectedReward.points_required} points seront débités.
                    </p>
                  </div>

                  <div className="mt-5 space-y-4">
                    <Field
                      icon={<LockKeyhole size={16} />}
                      label="Code responsable"
                      value={rewardCode}
                      onChange={setRewardCode}
                      placeholder="Code"
                      type="password"
                    />

                    <Field
                      icon={<Receipt size={16} />}
                      label="Numéro de facture"
                      value={invoiceNumber}
                      onChange={setInvoiceNumber}
                      placeholder="FAC-00125"
                    />

                    <Field
                      icon={<Receipt size={16} />}
                      label={`Montant de la facture (${settings.currency})`}
                      value={invoiceAmount}
                      onChange={setInvoiceAmount}
                      placeholder="500"
                      type="number"
                    />

                    <div>
                      <label className="mb-2 block text-xs font-semibold text-ink/50">
                        Paiement
                      </label>
                      <div className="grid grid-cols-3 gap-2">
                        {[
                          ['CASH', 'Espèces'],
                          ['CARD', 'Carte'],
                          ['OTHER', 'Autre'],
                        ].map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() =>
                              setPaymentMethod(value as 'CASH' | 'CARD' | 'OTHER')
                            }
                            className={`rounded-xl border px-2 py-2.5 text-xs font-semibold ${
                              paymentMethod === value
                                ? 'border-forest bg-forest/5 text-forest'
                                : 'border-ink/10 text-ink/50'
                            }`}
                          >
                            <WalletCards size={14} className="mx-auto mb-1" />
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      disabled={saving}
                      onClick={redeemReward}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white disabled:opacity-50"
                    >
                      <CheckCircle2 size={17} />
                      {saving ? 'Validation...' : 'Valider la récompense'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({
  title,
  onClose,
  children,
  wide = false,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4">
      <div
        className={`max-h-[92vh] w-full overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl ${
          wide ? 'max-w-4xl' : 'max-w-md'
        }`}
      >
        <div className="mb-5 flex items-center justify-between">
          <h2 className="font-display text-2xl text-forest">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-ink/40 hover:bg-[#f7f7f3]"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  icon,
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-semibold text-ink/50">
        {label}
      </label>
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink/30">
          {icon}
        </span>
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-xl border border-ink/10 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-forest"
        />
      </div>
    </div>
  );
}
