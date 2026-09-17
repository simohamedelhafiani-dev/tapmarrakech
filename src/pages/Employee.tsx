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
  CreditCard,
  Pencil,
  Printer,
} from 'lucide-react';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type Establishment = {
  id: string;
  name: string;
  logo_url: string | null;
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

  const [establishmentId, setEstablishmentId] = useState('');
  const [establishmentLogoUrl, setEstablishmentLogoUrl] = useState<string | null>(null);
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
  const [showCard, setShowCard] = useState<LoyaltyCustomer | null>(null);
  const [editCustomer, setEditCustomer] = useState<LoyaltyCustomer | null>(null);
  const [selectedReward, setSelectedReward] = useState<LoyaltyReward | null>(null);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editBirthDate, setEditBirthDate] = useState('');

  const [purchaseAmount, setPurchaseAmount] = useState('');
  const [pointsResponsibleCode, setPointsResponsibleCode] = useState('');
  const [pointsInvoiceNumber, setPointsInvoiceNumber] = useState('');

  const [rewardCode, setRewardCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceAmount, setInvoiceAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'OTHER'>('CASH');

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(EMPLOYEE_SESSION_KEY);
      if (!raw) {
        setLoginLoading(false);
        return;
      }

      const stored = JSON.parse(raw) as EmployeeSession;
      const expiresAt = new Date(stored.expires_at).getTime();

      if (!stored.access_token || !stored.session_token || !expiresAt || expiresAt <= Date.now()) {
        sessionStorage.removeItem(EMPLOYEE_SESSION_KEY);
        setLoginLoading(false);
        return;
      }

      setSession(stored);
      setEstablishmentId(stored.establishment_id);
    } catch (error) {
      console.error('Session employé invalide:', error);
      sessionStorage.removeItem(EMPLOYEE_SESSION_KEY);
    } finally {
      setLoginLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session || !employeeSupabase) return;
    setEstablishmentId(session.establishment_id);
  }, [session, employeeSupabase]);

  useEffect(() => {
    if (!session || !employeeSupabase) {
      setEstablishmentLogoUrl(null);
      return;
    }

    let cancelled = false;

    async function loadEstablishmentBranding() {
      const { data, error } = await employeeSupabase.rpc('get_my_employee_establishments');

      if (error) {
        console.error('Erreur chargement logo établissement:', error);
        if (!cancelled) setEstablishmentLogoUrl(null);
        return;
      }

      const places = (data ?? []) as Establishment[];
      const currentPlace = places.find(place => place.id === session.establishment_id);

      if (!cancelled) {
        setEstablishmentLogoUrl(currentPlace?.logo_url ?? null);
      }
    }

    loadEstablishmentBranding();

    return () => {
      cancelled = true;
    };
  }, [session, employeeSupabase]);

  useEffect(() => {
    if (!establishmentId || !employeeSupabase) {
      if (!session) setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadEmployeeData() {
      setLoading(true);
      try {
        await Promise.all([
          loadCustomers(),
          loadRewards(),
          loadSettings(),
        ]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadEmployeeData();

    return () => {
      cancelled = true;
    };
  }, [establishmentId, employeeSupabase, session]);

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
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
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

      sessionStorage.setItem(EMPLOYEE_SESSION_KEY, JSON.stringify(nextSession));
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
      sessionStorage.removeItem(EMPLOYEE_SESSION_KEY);
      setSession(null);
      setEstablishmentId('');
      setEstablishmentLogoUrl(null);
      setCustomers([]);
      setRewards([]);
      setEmployeeCode('');
    }
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
        String(customer.loyalty_number ?? '').toLowerCase().includes(value) ||
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

    const loyaltyNumber = String(data.loyalty_number ?? '').trim();
    if (!loyaltyNumber) {
      alert('Le client a été créé mais son numéro de fidélité est absent. Exécute d’abord le SQL de génération du numéro que je t’ai donné.');
      await loadCustomers();
      return;
    }

    alert(`Client créé avec succès.\n\nNuméro de fidélité : ${loyaltyNumber}`);
    setShowCard(data as LoyaltyCustomer);
    await loadCustomers();
  }

  function openEditCustomer(customer: LoyaltyCustomer) {
    setEditCustomer(customer);
    setEditFirstName(customer.first_name ?? '');
    setEditLastName(customer.last_name ?? '');
    setEditPhone(customer.phone ?? '');
    setEditBirthDate(customer.birth_date ?? '');
  }

  async function updateCustomer() {
    if (!employeeSupabase || !editCustomer) return;

    if (!editFirstName.trim() || !editLastName.trim() || !editPhone.trim()) {
      alert('Prénom, nom et téléphone sont obligatoires.');
      return;
    }

    setSaving(true);

    const { data, error } = await employeeSupabase.rpc('update_loyalty_customer', {
      p_customer_id: editCustomer.id,
      p_first_name: editFirstName.trim(),
      p_last_name: editLastName.trim(),
      p_phone: editPhone.trim(),
      p_birth_date: editBirthDate || null,
    });

    setSaving(false);

    if (error) {
      if (error.code === '23505') {
        alert('Un client avec ce numéro existe déjà dans cet établissement.');
      } else {
        alert(error.message);
      }
      return;
    }

    const updated = Array.isArray(data) ? data[0] : data;
    setEditCustomer(null);
    setEditFirstName('');
    setEditLastName('');
    setEditPhone('');
    setEditBirthDate('');
    await loadCustomers();

    if (updated) {
      setShowCard(updated as LoyaltyCustomer);
    }

    alert('Informations du client mises à jour.');
  }

  function printLoyaltyCard(customer: LoyaltyCustomer) {
    const popup = window.open('', '_blank', 'width=700,height=520');
    if (!popup) {
      alert("Autorisez les fenêtres pop-up pour imprimer la carte.");
      return;
    }

    const establishment = session?.establishment_name ?? 'Votre établissement';
    const logoUrl = establishmentLogoUrl ?? '';
    const fullName = `${customer.first_name} ${customer.last_name ?? ''}`.trim();

    popup.document.write(`
      <!doctype html>
      <html lang="fr">
        <head>
          <meta charset="utf-8" />
          <title>Carte fidélité ${customer.loyalty_number}</title>
          <style>
            * { box-sizing: border-box; }
            body { margin: 0; padding: 40px; background: #f7f7f3; font-family: Arial, sans-serif; }
            .card { width: 640px; max-width: 100%; margin: 0 auto; padding: 34px; border-radius: 28px; background: #173f35; color: white; box-shadow: 0 20px 50px rgba(0,0,0,.16); }
            .small { margin-top: 8px; color: rgba(255,255,255,.65); font-size: 12px; text-transform: uppercase; letter-spacing: 2px; }
            .brand { display: flex; align-items: center; gap: 14px; }
            .brand img { width: 58px; height: 58px; object-fit: contain; border-radius: 12px; background: #ffffff; padding: 5px; }
            .establishment { margin-top: 18px; font-size: 22px; font-weight: 700; color: #ffffff; }
            .name { margin-top: 55px; font-size: 26px; font-weight: 700; }
            .number-label { margin-top: 30px; color: rgba(255,255,255,.6); font-size: 11px; text-transform: uppercase; letter-spacing: 2px; }
            .number { margin-top: 6px; font-size: 30px; font-weight: 800; letter-spacing: 3px; color: #d3a84c; }
            .footer { margin-top: 28px; display: flex; justify-content: space-between; color: rgba(255,255,255,.55); font-size: 11px; }
            @media print { body { padding: 0; background: white; } .card { box-shadow: none; } }
          </style>
        </head>
        <body>
          <div class="card">
            <div class="brand">
              ${logoUrl ? `<img src="${logoUrl}" alt="Logo" />` : ''}
              <div>
                <div class="small">Carte de fidélité</div>
                <div class="establishment">${establishment}</div>
              </div>
            </div>
            <div class="name">${fullName}</div>
            <div class="number-label">Numéro de fidélité</div>
            <div class="number">${customer.loyalty_number}</div>
            <div class="footer"><span>Présentez cette carte à chaque visite</span><span>by Tap Marrakech</span></div>
          </div>
          <script>window.onload = () => { window.print(); };</script>
        </body>
      </html>
    `);
    popup.document.close();
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
      p_invoice_number: pointsInvoiceNumber.trim() || null,
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
    setPointsInvoiceNumber('');
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

  const selectedEstablishmentName = session?.establishment_name ?? '';

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
              <div className="mb-4 flex justify-center">
                <img
                  src="/tapmarrakech-logo.png"
                  alt="TapMarrakech"
                  className="h-16 w-16 object-contain"
                />
              </div>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[0.2em] text-gold">
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

  return (
    <div className="min-h-screen bg-[#f7f7f3] p-4 md:p-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex justify-center">
          <div className="flex items-center gap-3 rounded-2xl border border-ink/5 bg-white px-5 py-3 shadow-sm">
            {establishmentLogoUrl ? (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-ink/10 bg-white p-1.5">
                <img
                  src={establishmentLogoUrl}
                  alt={`Logo ${session.establishment_name}`}
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-ink/10 bg-white text-forest">
                <Building2 size={24} />
              </div>
            )}

            <div className="min-w-0 max-w-[300px] text-center">
              <p className="truncate text-base font-semibold text-forest md:text-lg">
                {session.establishment_name || selectedEstablishmentName}
              </p>
              <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.18em] text-gold">
                Établissement
              </p>
            </div>
          </div>
        </div>

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

          <button
            onClick={logoutEmployee}
            className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-white px-4 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={17} />
            Déconnexion
          </button>
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
                      onClick={() => openEditCustomer(customer)}
                      className="inline-flex items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-xs font-semibold text-ink/60 hover:border-forest/20 hover:text-forest"
                    >
                      <Pencil size={16} />
                      Modifier
                    </button>

                    <button
                      onClick={() => setShowCard(customer)}
                      className="inline-flex items-center gap-2 rounded-xl border border-gold/30 bg-white px-4 py-2.5 text-xs font-semibold text-forest hover:bg-gold/5"
                    >
                      <CreditCard size={16} />
                      Carte
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

      {editCustomer && (
        <Modal
          title="Modifier le client"
          onClose={() => {
            if (!saving) setEditCustomer(null);
          }}
        >
          <div className="mb-5 rounded-2xl bg-[#f7f7f3] p-4">
            <p className="text-xs text-ink/40">Numéro de fidélité</p>
            <p className="mt-1 text-xl font-bold tracking-wider text-forest">
              {editCustomer.loyalty_number}
            </p>
            <p className="mt-2 text-xs text-ink/40">Le numéro reste inchangé.</p>
          </div>

          <div className="space-y-4">
            <Field icon={<User size={16} />} label="Prénom" value={editFirstName} onChange={setEditFirstName} placeholder="Prénom" />
            <Field icon={<User size={16} />} label="Nom" value={editLastName} onChange={setEditLastName} placeholder="Nom" />
            <Field icon={<Phone size={16} />} label="Téléphone" value={editPhone} onChange={setEditPhone} placeholder="06 XX XX XX XX" type="tel" />
            <Field icon={<CalendarDays size={16} />} label="Date de naissance" value={editBirthDate} onChange={setEditBirthDate} type="date" />

            <button
              disabled={saving}
              onClick={updateCustomer}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white disabled:opacity-50"
            >
              <CheckCircle2 size={17} />
              {saving ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </Modal>
      )}

      {showCard && (
        <Modal
          title="Carte de fidélité"
          onClose={() => setShowCard(null)}
        >
          <div className="overflow-hidden rounded-[1.75rem] bg-forest p-6 text-white shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-4">
                {establishmentLogoUrl ? (
                  <img
                    src={establishmentLogoUrl}
                    alt={`Logo ${session.establishment_name}`}
                    className="h-14 w-14 rounded-xl bg-white object-contain p-1.5"
                  />
                ) : (
                  <div className="grid h-14 w-14 place-items-center rounded-xl bg-white/10">
                    <Building2 size={24} className="text-gold" />
                  </div>
                )}

                <div className="min-w-0">
                  <p className="text-2xl font-bold tracking-tight">
                    Carte de fidélité
                  </p>
                  <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">
                    {session.establishment_name}
                  </p>
                </div>
              </div>
              <CreditCard size={28} className="shrink-0 text-gold/80" />
            </div>

            <div className="mt-12">
              <p className="text-xl font-bold">
                {showCard.first_name} {showCard.last_name ?? ''}
              </p>
              <p className="mt-1 text-xs text-white/55">{session.establishment_name}</p>
            </div>

            <div className="mt-7 rounded-2xl bg-white/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">
                Numéro de fidélité
              </p>
              <p className="mt-1 text-2xl font-bold tracking-[0.18em] text-gold">
                {showCard.loyalty_number}
              </p>
            </div>
          </div>

          <div className="mt-5 flex gap-3">
            <button
              onClick={() => printLoyaltyCard(showCard)}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-forest py-3.5 text-sm font-semibold text-white"
            >
              <Printer size={17} />
              Imprimer / PDF
            </button>
            <button
              onClick={() => setShowCard(null)}
              className="rounded-xl border border-ink/10 px-5 py-3.5 text-sm font-semibold text-ink/60"
            >
              Fermer
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
              setPointsInvoiceNumber('');
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
              icon={<Receipt size={16} />}
              label="Numéro de facture (optionnel)"
              value={pointsInvoiceNumber}
              onChange={setPointsInvoiceNumber}
              placeholder="FAC-2026-001"
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
      <footer className="mt-10 pb-4 text-center text-xs font-medium text-ink/35">by Tap Marrakech</footer>
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
