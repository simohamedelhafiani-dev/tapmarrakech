import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight,
  Cake,
  CheckCircle2,
  Gift,
  MessageCircle,
  ShoppingBag,
  Star,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
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
  establishment_id: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  loyalty_number: string | null;
  points_balance: number;
  total_points_earned: number;
  total_points_redeemed: number;
  visit_count: number;
  last_visit_at: string | null;
  birth_date: string | null;
  created_at: string;
};

type LoyaltyTransaction = {
  id: string;
  establishment_id: string;
  customer_id: string;
  employee_id: string | null;
  amount: number | null;
  points: number;
  type: string;
  created_at: string;
};

type LoyaltyRedemption = {
  id: string;
  establishment_id: string;
  customer_id: string;
  employee_id: string | null;
  points_used: number;
  invoice_amount: number | null;
  discount_amount: number | null;
  amount_paid: number | null;
  redemption_type: string;
  created_at: string;
};

type BirthdayReward = {
  id: string;
  establishment_id: string;
  customer_id: string;
  birthday_date: string;
  reward_name: string;
  reward_points: number;
  reward_amount: number;
  status: string;
};

type EmployeeStat = {
  id: string;
  name: string;
  purchases: number;
  revenue: number;
};

const ranges = [
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
  icon: typeof Users;
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

function formatMoney(value: number) {
  return `${value.toLocaleString('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })} DH`;
}

function formatDate(date: string | null) {
  if (!date) return '—';

  return new Date(`${date}T12:00:00`).toLocaleDateString(
    'fr-FR',
    {
      day: '2-digit',
      month: 'short',
    }
  );
}

function getCustomerName(customer: LoyaltyCustomer) {
  const name = [
    customer.first_name,
    customer.last_name,
  ]
    .filter(Boolean)
    .join(' ')
    .trim();

  return name || customer.phone || customer.loyalty_number || 'Client';
}

export default function Dashboard() {
  const { user, role } = useAuth();

  const [places, setPlaces] = useState<Establishment[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [customers, setCustomers] = useState<LoyaltyCustomer[]>([]);
  const [transactions, setTransactions] = useState<
    LoyaltyTransaction[]
  >([]);
  const [redemptions, setRedemptions] = useState<
    LoyaltyRedemption[]
  >([]);
  const [birthdays, setBirthdays] = useState<
    BirthdayReward[]
  >([]);
  const [employeeStats, setEmployeeStats] = useState<
    EmployeeStat[]
  >([]);

  const [profileName, setProfileName] = useState('');
  const [period, setPeriod] = useState('30d');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setPlaces([]);
      setReviews([]);
      setCustomers([]);
      setTransactions([]);
      setRedemptions([]);
      setBirthdays([]);
      setEmployeeStats([]);
      setProfileName('');
      setLoading(false);
      return;
    }

    const load = async () => {
      setLoading(true);

      try {
        // ------------------------------------------------------
        // PROFIL
        // ------------------------------------------------------

        const { data: profile } = await supabase
          .from('profiles')
          .select('name')
          .eq('id', user.id)
          .maybeSingle();

        setProfileName(
          profile?.name ||
            user.user_metadata?.name ||
            user.email?.split('@')[0] ||
            'Utilisateur'
        );

        // ------------------------------------------------------
        // ÉTABLISSEMENTS ACCESSIBLES
        // ------------------------------------------------------

        const {
          data: establishments,
          error: establishmentsError,
        } = await supabase.rpc('get_my_establishments');

        if (establishmentsError) {
          console.error(
            'Erreur établissements:',
            establishmentsError
          );

          setPlaces([]);
          setLoading(false);
          return;
        }

        const accessiblePlaces =
          (establishments ?? []) as Establishment[];

        setPlaces(accessiblePlaces);

        const ids = accessiblePlaces.map(
          (establishment) => establishment.id
        );

        if (!ids.length) {
          setReviews([]);
          setCustomers([]);
          setTransactions([]);
          setRedemptions([]);
          setBirthdays([]);
          setEmployeeStats([]);
          setLoading(false);
          return;
        }

        // ------------------------------------------------------
        // AVIS
        // ------------------------------------------------------

        const {
          data: reviewsData,
          error: reviewsError,
        } = await supabase
          .from('reviews')
          .select('*, establishment:establishments(name)')
          .in('establishment_id', ids)
          .order('created_at', {
            ascending: false,
          });

        if (reviewsError) {
          console.error(
            'Erreur avis:',
            reviewsError
          );
        }

        setReviews((reviewsData as Review[]) ?? []);

        // ------------------------------------------------------
        // CLIENTS FIDÉLITÉ
        // ------------------------------------------------------

        const {
          data: customersData,
          error: customersError,
        } = await supabase
          .from('loyalty_customers')
          .select(
            `
              id,
              establishment_id,
              first_name,
              last_name,
              phone,
              loyalty_number,
              points_balance,
              total_points_earned,
              total_points_redeemed,
              visit_count,
              last_visit_at,
              birth_date,
              created_at
            `
          )
          .in('establishment_id', ids);

        if (customersError) {
          console.error(
            'Erreur clients fidélité:',
            customersError
          );
        }

        const customerRows =
          (customersData as LoyaltyCustomer[]) ?? [];

        setCustomers(customerRows);

        // ------------------------------------------------------
        // TRANSACTIONS
        // ------------------------------------------------------

        const {
          data: transactionsData,
          error: transactionsError,
        } = await supabase
          .from('loyalty_transactions')
          .select(
            `
              id,
              establishment_id,
              customer_id,
              employee_id,
              amount,
              points,
              type,
              created_at
            `
          )
          .in('establishment_id', ids)
          .order('created_at', {
            ascending: false,
          });

        if (transactionsError) {
          console.error(
            'Erreur transactions:',
            transactionsError
          );
        }

        const transactionRows =
          (transactionsData as LoyaltyTransaction[]) ?? [];

        setTransactions(transactionRows);

        // ------------------------------------------------------
        // RÉCOMPENSES UTILISÉES
        // ------------------------------------------------------

        const {
          data: redemptionsData,
          error: redemptionsError,
        } = await supabase
          .from('loyalty_redemptions')
          .select(
            `
              id,
              establishment_id,
              customer_id,
              employee_id,
              points_used,
              invoice_amount,
              discount_amount,
              amount_paid,
              redemption_type,
              created_at
            `
          )
          .in('establishment_id', ids)
          .order('created_at', {
            ascending: false,
          });

        if (redemptionsError) {
          console.error(
            'Erreur récompenses:',
            redemptionsError
          );
        }

        setRedemptions(
          (redemptionsData as LoyaltyRedemption[]) ?? []
        );

        // ------------------------------------------------------
        // ANNIVERSAIRES
        // ------------------------------------------------------

        const {
          data: birthdayData,
          error: birthdayError,
        } = await supabase
          .from('loyalty_birthday_rewards')
          .select(
            `
              id,
              establishment_id,
              customer_id,
              birthday_date,
              reward_name,
              reward_points,
              reward_amount,
              status
            `
          )
          .in('establishment_id', ids)
          .eq('status', 'AVAILABLE')
          .order('birthday_date', {
            ascending: true,
          });

        if (birthdayError) {
          console.error(
            'Erreur anniversaires:',
            birthdayError
          );
        }

        setBirthdays(
          (birthdayData as BirthdayReward[]) ?? []
        );

        // ------------------------------------------------------
        // PERFORMANCE EMPLOYÉS
        // ------------------------------------------------------

        const employeeIds = Array.from(
          new Set(
            transactionRows
              .map((transaction) => transaction.employee_id)
              .filter(Boolean) as string[]
          )
        );

        if (employeeIds.length) {
          const { data: employeeProfiles } =
            await supabase
              .from('profiles')
              .select('id, name, email')
              .in('id', employeeIds);

          const profileMap = new Map<
            string,
            string
          >();

          (
            employeeProfiles ?? []
          ).forEach((employee: any) => {
            profileMap.set(
              employee.id,
              employee.name ||
                employee.email ||
                'Employé'
            );
          });

          const statsMap = new Map<
            string,
            EmployeeStat
          >();

          transactionRows.forEach((transaction) => {
            if (!transaction.employee_id) return;

            if (
              transaction.type !== 'EARN'
            ) {
              return;
            }

            const existing = statsMap.get(
              transaction.employee_id
            );

            if (existing) {
              existing.purchases += 1;
              existing.revenue +=
                Number(transaction.amount) || 0;
            } else {
              statsMap.set(
                transaction.employee_id,
                {
                  id: transaction.employee_id,
                  name:
                    profileMap.get(
                      transaction.employee_id
                    ) || 'Employé',
                  purchases: 1,
                  revenue:
                    Number(transaction.amount) || 0,
                }
              );
            }
          });

          setEmployeeStats(
            Array.from(statsMap.values())
              .sort(
                (a, b) =>
                  b.purchases - a.purchases
              )
              .slice(0, 5)
          );
        } else {
          setEmployeeStats([]);
        }
      } catch (error) {
        console.error(
          'Erreur dashboard:',
          error
        );

        setPlaces([]);
        setReviews([]);
        setCustomers([]);
        setTransactions([]);
        setRedemptions([]);
        setBirthdays([]);
        setEmployeeStats([]);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, role]);

  // ----------------------------------------------------------
  // STATISTIQUES GÉNÉRALES
  // ----------------------------------------------------------

  const positiveReviews = reviews.filter(
    (review) => review.rating >= 4
  ).length;

  const averageRating = reviews.length
    ? (
        reviews.reduce(
          (total, review) =>
            total + review.rating,
          0
        ) / reviews.length
      ).toFixed(1)
    : '—';

  const purchaseTransactions =
    transactions.filter(
      (transaction) =>
        transaction.type === 'EARN'
    );

  const totalRevenue =
    purchaseTransactions.reduce(
      (total, transaction) =>
        total +
        (Number(transaction.amount) || 0),
      0
    );

  const totalVisits =
    purchaseTransactions.length;

  const totalRewards =
    redemptions.length;

  const activeCustomers =
    customers.filter((customer) => {
      if (!customer.last_visit_at) {
        return false;
      }

      const lastVisit = new Date(
        customer.last_visit_at
      );

      const diff =
        Date.now() -
        lastVisit.getTime();

      return (
        diff <=
        30 * 24 * 60 * 60 * 1000
      );
    }).length;

  const inactiveCustomers =
    customers.length - activeCustomers;

  const selectedRange =
    ranges.find(
      (range) => range.key === period
    ) ?? ranges[0];

  // ----------------------------------------------------------
  // GRAPHIQUE ACTIVITÉ
  // ----------------------------------------------------------

  const activityChart = useMemo(() => {
    const now = new Date();

    const numberOfPeriods =
      selectedRange.days <= 30
        ? 7
        : selectedRange.days <= 90
          ? 9
          : 12;

    const periodDays =
      selectedRange.days /
      numberOfPeriods;

    return Array.from(
      { length: numberOfPeriods },
      (_, index) => {
        const end = new Date(now);

        end.setDate(
          now.getDate() -
            Math.round(
              (numberOfPeriods -
                1 -
                index) *
                periodDays
            )
        );

        const start = new Date(end);

        start.setDate(
          end.getDate() -
            Math.max(
              1,
              Math.round(periodDays)
            )
        );

        const rows =
          purchaseTransactions.filter(
            (transaction) => {
              const date = new Date(
                transaction.created_at
              );

              return (
                date >= start &&
                date <= end
              );
            }
          );

        return {
          name:
            selectedRange.days <= 30
              ? `${index + 1}`
              : `P${index + 1}`,
          clients: rows.length,
          revenue: rows.reduce(
            (sum, row) =>
              sum +
              (Number(row.amount) || 0),
            0
          ),
        };
      }
    );
  }, [
    purchaseTransactions,
    selectedRange.days,
  ]);

  // ----------------------------------------------------------
  // DERNIERS AVIS
  // ----------------------------------------------------------

  const latestReviews =
    reviews.slice(0, 4);

  // ----------------------------------------------------------
  // ANNIVERSAIRES PROCHES
  // ----------------------------------------------------------

  const upcomingBirthdays =
    birthdays
      .filter((birthday) => {
        const birthdayDate =
          new Date(
            `${birthday.birthday_date}T12:00:00`
          );

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        const maxDate = new Date(today);

        maxDate.setDate(
          today.getDate() + 30
        );

        return (
          birthdayDate >= today &&
          birthdayDate <= maxDate
        );
      })
      .sort(
        (a, b) =>
          new Date(
            a.birthday_date
          ).getTime() -
          new Date(
            b.birthday_date
          ).getTime()
      )
      .slice(0, 5);

  const birthdayCustomers =
    upcomingBirthdays.map(
      (birthday) =>
        customers.find(
          (customer) =>
            customer.id ===
            birthday.customer_id
        )
    );

  // ----------------------------------------------------------
  // CONTEXTE ÉTABLISSEMENT
  // ----------------------------------------------------------

  const isResponsible =
    role === 'responsible';

  const establishmentName =
    isResponsible &&
    places.length === 1
      ? places[0].name
      : null;

  const roleLabel =
    role === 'admin'
      ? 'Administrateur'
      : role === 'responsible'
        ? 'Responsable'
        : role === 'employee'
          ? 'Employé'
          : 'Compte';

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 animate-pulse rounded-2xl bg-ink/5" />

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 8 }).map(
            (_, index) => (
              <div
                key={index}
                className="h-32 animate-pulse rounded-2xl bg-ink/5"
              />
            )
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="pb-8">
      {/* ====================================================
          HEADER
      ==================================================== */}

      <div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
            {roleLabel}
            {establishmentName
              ? ` · ${establishmentName}`
              : ''}
          </p>

          <h1 className="mt-2 font-display text-4xl text-forest">
            Bonjour {profileName} 👋
          </h1>

          <p className="mt-2 max-w-2xl text-sm text-ink/50">
            {establishmentName
              ? `Voici la santé globale de ${establishmentName}.`
              : 'Voici la santé globale de votre réseau TapMarrakech.'}
          </p>
        </div>

        <Link
          to="/dashboard/establishments"
          className="flex w-fit items-center gap-2 rounded-xl border border-ink/10 bg-white px-4 py-2.5 text-xs font-semibold text-forest transition hover:border-gold"
        >
          Gérer mes établissements
          <ArrowUpRight size={15} />
        </Link>
      </div>

      {/* ====================================================
          KPI PRINCIPAUX
      ==================================================== */}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Clients fidélisés"
          value={customers.length}
          detail={`${activeCustomers} actifs sur les 30 derniers jours`}
          icon={Users}
          accent="bg-[#e5eee9] text-forest"
        />

        <Stat
          label="Visites validées"
          value={totalVisits}
          detail="Achats enregistrés dans la fidélité"
          icon={ShoppingBag}
          accent="bg-[#f4ead3] text-gold"
        />

        <Stat
          label="CA fidélité"
          value={formatMoney(totalRevenue)}
          detail="Montant des achats enregistrés"
          icon={Wallet}
          accent="bg-[#e5eee9] text-forest"
        />

        <Stat
          label="Récompenses utilisées"
          value={totalRewards}
          detail="Récompenses fidélité consommées"
          icon={Gift}
          accent="bg-[#f4e4e1] text-[#a15c50]"
        />
      </div>

      {/* ====================================================
          KPI RÉPUTATION / CLIENTS
      ==================================================== */}

      <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Note moyenne"
          value={averageRating}
          detail="Sur 5 étoiles"
          icon={Star}
          accent="bg-[#f4ead3] text-gold"
        />

        <Stat
          label="Avis positifs"
          value={positiveReviews}
          detail={
            reviews.length
              ? `${Math.round(
                  (positiveReviews /
                    reviews.length) *
                    100
                )}% des avis`
              : 'Pas encore de données'
          }
          icon={MessageCircle}
          accent="bg-[#e5eee9] text-forest"
        />

        <Stat
          label="Clients actifs"
          value={activeCustomers}
          detail="Dernière visite ≤ 30 jours"
          icon={TrendingUp}
          accent="bg-[#e5eee9] text-forest"
        />

        <Stat
          label="Clients inactifs"
          value={inactiveCustomers}
          detail="À réactiver"
          icon={CheckCircle2}
          accent="bg-[#f4e4e1] text-[#a15c50]"
        />
      </div>

      {/* ====================================================
          GRAPHIQUE ACTIVITÉ
      ==================================================== */}

      <section className="mt-6 rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div>
            <h2 className="font-display text-xl text-forest">
              Activité fidélité
            </h2>

            <p className="mt-1 text-xs text-ink/45">
              Évolution des achats et du chiffre
              d'affaires enregistré
            </p>
          </div>

          <select
            value={period}
            onChange={(event) =>
              setPeriod(event.target.value)
            }
            className="rounded-lg border border-ink/10 bg-[#fafaf7] px-3 py-2 text-xs text-ink/65 outline-none"
          >
            {ranges.map((range) => (
              <option
                key={range.key}
                value={range.key}
              >
                {range.label}
              </option>
            ))}
          </select>
        </div>

        <div className="mt-8 h-72">
          <ResponsiveContainer
            width="100%"
            height="100%"
          >
            <LineChart data={activityChart}>
              <CartesianGrid
                vertical={false}
                stroke="#edf0eb"
              />

              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: '#9ca89f',
                  fontSize: 11,
                }}
              />

              <YAxis
                yAxisId="left"
                allowDecimals={false}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: '#9ca89f',
                  fontSize: 11,
                }}
              />

              <YAxis
                yAxisId="right"
                orientation="right"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: '#9ca89f',
                  fontSize: 11,
                }}
              />

              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #edf0eb',
                  fontSize: 12,
                }}
                formatter={(
                  value: number,
                  name: string
                ) => {
                  if (name === 'CA') {
                    return [
                      formatMoney(
                        Number(value)
                      ),
                      'CA',
                    ];
                  }

                  return [
                    value,
                    'Achats',
                  ];
                }}
              />

              <Line
                yAxisId="left"
                type="monotone"
                dataKey="clients"
                name="Achats"
                stroke="#17352a"
                strokeWidth={3}
                dot={false}
              />

              <Line
                yAxisId="right"
                type="monotone"
                dataKey="revenue"
                name="CA"
                stroke="#c8a96b"
                strokeWidth={3}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* ====================================================
          ANNIVERSAIRES + EMPLOYÉS
      ==================================================== */}

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        {/* ANNIVERSAIRES */}

        <section className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl text-forest">
                Prochains anniversaires
              </h2>

              <p className="mt-1 text-xs text-ink/45">
                Clients à contacter dans les 30 jours
              </p>
            </div>

            <Cake
              size={20}
              className="text-gold"
            />
          </div>

          <div className="mt-6 space-y-4">
            {upcomingBirthdays.length ? (
              upcomingBirthdays.map(
                (birthday, index) => {
                  const customer =
                    birthdayCustomers[index];

                  return (
                    <div
                      key={birthday.id}
                      className="flex items-center justify-between rounded-xl bg-[#fafaf7] p-4"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#f4ead3] text-gold">
                          <Cake size={17} />
                        </div>

                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-forest">
                            {customer
                              ? getCustomerName(
                                  customer
                                )
                              : 'Client'}
                          </p>

                          <p className="mt-0.5 text-[11px] text-ink/45">
                            {birthday.reward_name}
                          </p>
                        </div>
                      </div>

                      <span className="ml-3 shrink-0 rounded-lg bg-white px-3 py-1.5 text-[11px] font-semibold text-gold">
                        {formatDate(
                          birthday.birthday_date
                        )}
                      </span>
                    </div>
                  );
                }
              )
            ) : (
              <div className="py-10 text-center">
                <Cake
                  size={28}
                  className="mx-auto text-ink/15"
                />

                <p className="mt-3 text-sm text-ink/40">
                  Aucun anniversaire prévu dans
                  les 30 prochains jours.
                </p>
              </div>
            )}
          </div>
        </section>

        {/* EMPLOYÉS */}

        <section className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
          <div>
            <h2 className="font-display text-xl text-forest">
              Performance des employés
            </h2>

            <p className="mt-1 text-xs text-ink/45">
              Achats enregistrés par collaborateur
            </p>
          </div>

          <div className="mt-6 h-64">
            {employeeStats.length ? (
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={employeeStats}
                  layout="vertical"
                  margin={{
                    left: 10,
                    right: 10,
                  }}
                >
                  <CartesianGrid
                    horizontal={false}
                    stroke="#edf0eb"
                  />

                  <XAxis
                    type="number"
                    allowDecimals={false}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: '#9ca89f',
                      fontSize: 11,
                    }}
                  />

                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: '#17352a',
                      fontSize: 11,
                    }}
                  />

                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border:
                        '1px solid #edf0eb',
                      fontSize: 12,
                    }}
                  />

                  <Bar
                    dataKey="purchases"
                    name="Achats"
                    fill="#c8a96b"
                    radius={[
                      0,
                      5,
                      5,
                      0,
                    ]}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="grid h-full place-items-center text-center">
                <div>
                  <Users
                    size={28}
                    className="mx-auto text-ink/15"
                  />

                  <p className="mt-3 text-sm text-ink/40">
                    Les performances apparaîtront
                    après les premiers achats.
                  </p>
                </div>
              </div>
            )}
          </div>

          {employeeStats.length > 0 && (
            <div className="mt-4 space-y-2">
              {employeeStats
                .slice(0, 3)
                .map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between text-xs"
                  >
                    <span className="font-medium text-ink/65">
                      {employee.name}
                    </span>

                    <span className="text-ink/40">
                      {employee.purchases}{' '}
                      achat
                      {employee.purchases > 1
                        ? 's'
                        : ''}{' '}
                      ·{' '}
                      {formatMoney(
                        employee.revenue
                      )}
                    </span>
                  </div>
                ))}
            </div>
          )}
        </section>
      </div>

      {/* ====================================================
          DERNIERS AVIS + CLIENTS
      ==================================================== */}

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        {/* AVIS */}

        <section className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl text-forest">
                Derniers retours
              </h2>

              <p className="mt-1 text-xs text-ink/45">
                Les avis les plus récents
              </p>
            </div>

            <Link
              to="/dashboard/reviews"
              className="text-xs font-semibold text-gold"
            >
              Tout voir
            </Link>
          </div>

          <div className="mt-6 space-y-5">
            {latestReviews.length ? (
              latestReviews.map((review) => (
                <div
                  key={review.id}
                  className="border-b border-ink/5 pb-4 last:border-0"
                >
                  <div className="flex justify-between">
                    <Stars
                      rating={review.rating}
                    />

                    <span className="text-[10px] text-ink/35">
                      {new Date(
                        review.created_at
                      ).toLocaleDateString(
                        'fr-FR'
                      )}
                    </span>
                  </div>

                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-ink/65">
                    {review.comment ||
                      'Avis positif sans commentaire'}
                  </p>
                </div>
              ))
            ) : (
              <div className="py-10 text-center text-sm text-ink/40">
                Vos premiers avis apparaîtront ici.
              </div>
            )}
          </div>
        </section>

        {/* RÉSUMÉ CLIENTS */}

        <section className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft md:p-7">
          <div>
            <h2 className="font-display text-xl text-forest">
              Base clients
            </h2>

            <p className="mt-1 text-xs text-ink/45">
              État de votre portefeuille client
            </p>
          </div>

          <div className="mt-7 space-y-6">
            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink/55">
                  Clients actifs
                </span>

                <span className="font-semibold text-forest">
                  {activeCustomers}
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/5">
                <div
                  className="h-full rounded-full bg-forest"
                  style={{
                    width: `${
                      customers.length
                        ? Math.min(
                            100,
                            (activeCustomers /
                              customers.length) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-ink/55">
                  Clients à réactiver
                </span>

                <span className="font-semibold text-[#a15c50]">
                  {inactiveCustomers}
                </span>
              </div>

              <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/5">
                <div
                  className="h-full rounded-full bg-[#a15c50]"
                  style={{
                    width: `${
                      customers.length
                        ? Math.min(
                            100,
                            (inactiveCustomers /
                              customers.length) *
                              100
                          )
                        : 0
                    }%`,
                  }}
                />
              </div>
            </div>

            <div className="rounded-xl bg-[#fafaf7] p-4">
              <p className="text-xs text-ink/45">
                Points actuellement détenus
              </p>

              <p className="mt-2 font-display text-2xl text-forest">
                {customers
                  .reduce(
                    (sum, customer) =>
                      sum +
                      Number(
                        customer.points_balance
                      ),
                    0
                  )
                  .toLocaleString('fr-FR')}
              </p>
            </div>

            <Link
              to="/dashboard/loyalty"
              className="flex items-center justify-center gap-2 rounded-xl bg-forest px-4 py-3 text-xs font-semibold text-white transition hover:opacity-90"
            >
              Ouvrir la fidélité
              <ArrowUpRight size={15} />
            </Link>
          </div>
        </section>
      </div>

      {/* ====================================================
          CTA ANALYTICS
      ==================================================== */}

      <div className="mt-6 rounded-2xl bg-forest p-6 text-white md:p-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-gold">
              TapMarrakech
            </p>

            <h2 className="mt-2 font-display text-2xl">
              Transformez vos données en décisions.
            </h2>

            <p className="mt-1 max-w-xl text-sm text-white/50">
              Suivez vos clients, vos achats, votre
              réputation et votre fidélisation depuis
              un seul espace.
            </p>
          </div>

          <Link
            to="/dashboard/analytics"
            className="flex w-fit items-center gap-2 rounded-xl bg-gold px-4 py-3 text-xs font-semibold text-forest transition hover:bg-[#d5b878]"
          >
            Explorer les analytics
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
    </div>
  );
}
