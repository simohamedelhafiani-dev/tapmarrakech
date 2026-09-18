import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  ExternalLink,
  Globe2,
  Heart,
  Menu,
  QrCode,
  Settings,
  Sparkles,
  Wifi,
  CheckCircle2,
  Coins,
  Gift,
  MessageCircle,
  Users,
  Star,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { Establishment, Review } from '@/lib/types';
import { Stars } from '@/components/Stars';

type LoyaltyCustomer = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string;
  points_balance: number | null;
  total_points_earned: number | null;
  total_points_redeemed: number | null;
  visit_count: number | null;
  created_at: string;
  last_visit_at: string | null;
};

type LoyaltyTransaction = {
  id: string;
  establishment_id: string;
  customer_id: string;
  employee_id: string | null;
  points: number | null;
  amount: number | null;
  description: string | null;
  type: string;
  invoice_number: string | null;
  created_at: string;
};

type LoyaltyRedemption = {
  id: string;
  establishment_id: string;
  customer_id: string;
  reward_id: string;
  employee_id: string | null;
  points_used: number | null;
  invoice_number: string | null;
  invoice_amount: number | null;
  discount_amount: number | null;
  amount_paid: number | null;
  payment_method: string | null;
  redemption_type: string | null;
  reward_cost_mad: number | null;
  created_at: string;
};

const ranges = [
  {
    key: '7d',
    label: '7 derniers jours',
    days: 7,
  },
  {
    key: '30d',
    label: '30 derniers jours',
    days: 30,
  },
  {
    key: '3m',
    label: '3 mois',
    days: 90,
  },
  {
    key: '6m',
    label: '6 mois',
    days: 180,
  },
  {
    key: '12m',
    label: '12 mois',
    days: 365,
  },
];

function Stat({
  label,
  value,
  detail,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: typeof Star;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink/50">
            {label}
          </p>

          <p className="mt-3 font-display text-3xl text-forest">
            {value}
          </p>
        </div>

        <div
          className={`grid h-10 w-10 place-items-center rounded-xl ${accent}`}
        >
          <Icon size={18} />
        </div>
      </div>

      <p className="mt-4 text-[11px] text-ink/45">
        {detail}
      </p>
    </div>
  );
}

export default function Dashboard() {
  const { user, role } = useAuth();

  const [places, setPlaces] = useState<Establishment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loyaltyCustomers, setLoyaltyCustomers] = useState<LoyaltyCustomer[]>([]);
  const [loyaltyTransactions, setLoyaltyTransactions] = useState<LoyaltyTransaction[]>([]);
  const [loyaltyRedemptions, setLoyaltyRedemptions] = useState<LoyaltyRedemption[]>([]);
  const [pointsPerCurrency, setPointsPerCurrency] = useState(1);
  const [loyaltyLoading, setLoyaltyLoading] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [redemptionsLoading, setRedemptionsLoading] = useState(false);
  const [profileName, setProfileName] = useState<string>('');
  const [period, setPeriod] = useState('30d');
  const [selectedEstablishmentId, setSelectedEstablishmentId] = useState<string | null>(
    null
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlaces([]);
      setReviews([]);
      setProfileName('');
      setSelectedEstablishmentId(null);
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);

      try {
        /*
         * Charger le profil
         */
        const { data: profile, error: profileError } =
          await supabase
            .from('profiles')
            .select('name')
            .eq('id', user.id)
            .maybeSingle();

        if (profileError) {
          console.error(
            'Erreur chargement profil:',
            profileError
          );
        }

        setProfileName(
          profile?.name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Utilisateur'
        );

        /*
         * Charger les établissements accessibles
         *
         * ADMIN :
         * → tous les établissements
         *
         * RESPONSABLE :
         * → uniquement ses établissements rattachés
         */
        const {
          data: establishments,
          error: establishmentsError,
        } = await supabase.rpc('get_my_establishments');

        if (establishmentsError) {
          console.error(
            'Erreur chargement établissements:',
            establishmentsError
          );

          setPlaces([]);
          setReviews([]);
          setSelectedEstablishmentId(null);
          setLoading(false);
          return;
        }

        const accessiblePlaces =
          (establishments ?? []) as Establishment[];

        setPlaces(accessiblePlaces);

        /*
         * Restaurer l'établissement sélectionné.
         *
         * Si aucun choix n'a encore été enregistré, on utilise
         * le premier établissement accessible.
         *
         * Si l'ancien choix n'existe plus ou n'est plus accessible,
         * on revient automatiquement au premier établissement.
         */
        const storageKey = `tapmarrakech:selected-establishment:${user.id}`;
        const storedId = window.localStorage.getItem(storageKey);

        const validStoredPlace = accessiblePlaces.find(
          (place) => place.id === storedId
        );

        const nextId =
          validStoredPlace?.id ??
          accessiblePlaces[0]?.id ??
          null;

        setSelectedEstablishmentId(nextId);

        if (nextId) {
          window.localStorage.setItem(storageKey, nextId);
        } else {
          window.localStorage.removeItem(storageKey);
        }
      } catch (error) {
        console.error(
          'Erreur inattendue dashboard:',
          error
        );

        setPlaces([]);
        setReviews([]);
        setSelectedEstablishmentId(null);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, role]);

  /*
   * Charger uniquement les avis de l'établissement sélectionné.
   *
   * Cette séparation est importante pour que les statistiques,
   * le graphique et les derniers retours correspondent toujours
   * à l'établissement actuellement choisi.
   */
  useEffect(() => {
    let active = true;

    const loadReviews = async () => {
      if (!selectedEstablishmentId) {
        setReviews([]);
        return;
      }

      const {
        data,
        error,
      } = await supabase
        .from('reviews')
        .select(
          '*, establishment:establishments(name)'
        )
        .eq('establishment_id', selectedEstablishmentId)
        .order('created_at', {
          ascending: false,
        });

      if (error) {
        console.error(
          'Erreur chargement avis:',
          error
        );

        if (active) {
          setReviews([]);
        }

        return;
      }

      if (active) {
        setReviews((data as Review[]) ?? []);
      }
    };

    loadReviews();

    return () => {
      active = false;
    };
  }, [selectedEstablishmentId]);

  useEffect(() => {
    let active = true;

    const loadLoyalty = async () => {
      if (!selectedEstablishmentId) {
        setLoyaltyCustomers([]);
        setLoyaltyTransactions([]);
        setLoyaltyRedemptions([]);
        return;
      }

      setLoyaltyLoading(true);

      const { data, error } = await supabase
        .from('loyalty_customers')
        .select(
          'id, first_name, last_name, phone, points_balance, total_points_earned, total_points_redeemed, visit_count, created_at, last_visit_at'
        )
        .eq('establishment_id', selectedEstablishmentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erreur chargement fidélité:', error);
        if (active) setLoyaltyCustomers([]);
      } else if (active) {
        setLoyaltyCustomers((data as LoyaltyCustomer[]) ?? []);
      }

      if (active) setLoyaltyLoading(false);
    };

    loadLoyalty();

    return () => {
      active = false;
    };
  }, [selectedEstablishmentId]);

  useEffect(() => {
    let active = true;

    const loadLoyaltySettings = async () => {
      if (!selectedEstablishmentId) {
        setPointsPerCurrency(1);
        return;
      }

      const { data, error } = await supabase
        .from('loyalty_settings')
        .select('points_per_currency')
        .eq('establishment_id', selectedEstablishmentId)
        .maybeSingle();

      if (error) {
        console.error('Erreur chargement paramètres fidélité:', error);
        if (active) setPointsPerCurrency(1);
      } else if (active) {
        setPointsPerCurrency(Number(data?.points_per_currency || 1));
      }
    };

    loadLoyaltySettings();

    return () => {