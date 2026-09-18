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
      const client = employeeSupabase;
      const currentSession = session;
      if (!client || !currentSession) return;

      const { data, error } = await client.rpc('get_my_employee_establishments');

      if (error) {
        console.error('Erreur chargement logo établissement:', error);
        if (!cancelled) setEstablishmentLogoUrl(null);
        return;
      }

      const places = (data ?? []) as Establishment[];
      const currentPlace = places.find(place => place.id === currentSession.establishment_id);

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