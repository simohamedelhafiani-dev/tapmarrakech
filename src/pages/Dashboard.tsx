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
import { getMySubscriptionAccess, type SubscriptionAccess } from '@/lib/subscriptionAccess';

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

type DashboardStats = {
  period_days: number;
  reviews_count: number;
  average_rating: number;
  positive_reviews_count: number;
  negative_reviews_count: number;
  pending_reviews_count: number;
  loyalty_customers_count: number;
  returning_customers_count: number;
  active_customers_count: number;
  visits_total: number;
  points_balance_total: number;
  points_earned_total: number;
  points_redeemed_total: number;
  analytics_events_count: number;
  current_analytics_events_count: number;
  current_reviews_count: number;
  previous_reviews_count: number;
  review_growth: number;
  current_registrations_count: number;
  previous_registrations_count: number;
  registration_growth: number;
  returning_rate: number;
  active_rate: number;
  redemption_rate: number;
  current_revenue: number;
  previous_revenue: number;
  total_revenue: number;
  current_transactions_count: number;
  average_basket: number;
  current_redemptions_count: number;
  previous_redemptions_count: number;
  redemption_growth: number;
  points_redeemed_on_period: number;
  reward_value_on_period: number;
  redemption_revenue: number;
  reward_cost_on_period: number;
  net_contribution: number;
  real_roi: number | null;
  reward_efficiency: number;
  points_per_currency: number;
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
    <div className="min-h-screen space-y-5 pb-6">
      <section className="relative overflow-hidden rounded-[28px] border border-[#242424] bg-[#111111] p-5 shadow-[0_24px_80px_rgba(0,0,0,.22)] sm:p-7 lg:p-8">
        <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full border border-[#C9A45C]/10" />
        <div className="pointer-events-none absolute bottom-[-90px] right-[20%] h-56 w-56 rounded-full bg-[#C9A45C]/[0.035] blur-3xl" />
        <div className="relative z-10">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[#C9A45C]/20 bg-[#C9A45C]/[0.06] px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-[#E1C27A]">${roleLabel}</span>
                {establishmentName && <span className="truncate rounded-full border border-[#242424] bg-[#050505] px-2.5 py-1 text-[9px] font-semibold text-[#F5F5DC]/45">{establishmentName}</span>}
              </div>
              <h1 className="mt-4 max-w-3xl font-display text-3xl leading-[1.02] tracking-[-0.035em] text-white sm:text-4xl lg:text-5xl">
                Faites de chaque client
                <span className="block text-[#C9A45C]">un client régulier.</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-[#F5F5DC]/40">
                Bonjour {profileName || 'à vous'}. Voici l’essentiel de votre activité, sans bruit.
              </p>
            </div>

            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row lg:flex-col">
              {places.length > 0 && (
                <select id="dashboard-establishment" value={selectedEstablishmentId ?? ''} onChange={(event) => changeEstablishment(event.target.value)} className="h-11 min-w-[210px] rounded-2xl border border-[#242424] bg-[#050505] px-3 text-xs font-semibold text-white outline-none focus:border-[#C9A45C]/55" aria-label="Établissement actif">
                  {places.map((place) => <option className="bg-[#111111]" key={place.id} value={place.id}>{place.name}</option>)}
                </select>
              )}
              {!isResponsible && (
                <Link to="/dashboard/establishments" className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#C9A45C] px-4 text-xs font-bold text-[#050505] transition hover:bg-[#E1C27A]">
                  Gérer les établissements <ArrowUpRight size={15} />
                </Link>
              )}
            </div>
          </div>

          <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: 'Avis', value: dashboardStatsLoading ? '—' : String(dashboardStats?.reviews_count ?? 0), icon: MessageCircle },
              { label: 'Note', value: dashboardStatsLoading ? '—' : String((dashboardStats?.average_rating ?? 0).toFixed(1)), icon: Star },
              { label: 'Clients', value: dashboardStatsLoading ? '—' : String(dashboardStats?.loyalty_customers_count ?? loyaltyCustomers.length), icon: Users },
              { label: 'Taux de retour', value: dashboardStatsLoading ? '—' : ${`${analytics.returningRate.toFixed(0)}%`, icon: TrendingUp },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="rounded-2xl border border-[#242424] bg-[#050505]/75 px-4 py-4">
                <Icon size={15} className="text-[#C9A45C]" />
                <p className="mt-3 text-xl font-semibold tracking-tight text-white">{value}</p>
                <p className="mt-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#F5F5DC]/25">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.22em] text-[#C9A45C]">Actions</p>
            <h2 className="mt-1 text-lg font-semibold text-white">Piloter votre établissement</h2>
          </div>
          <span className="hidden text-[10px] text-[#F5F5DC]/25 sm:block">Tout ce dont vous avez besoin, au même endroit.</span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {[
            { label: 'Avis clients', detail: 'Répondre & analyser', to: '/dashboard/reviews', icon: MessageCircle },
            { label: 'Fidélité', detail: 'Clients & récompenses', to: '/dashboard/loyalty', icon: Heart },
            { label: 'Menu digital', detail: 'Menu & présentation', to: '/dashboard/menu', icon: Menu },
            { label: 'Analytics', detail: 'Comprendre les chiffres', to: '/dashboard/analytics', icon: BarChart3 },
          ].map(({ label, detail, to, icon: Icon }) => (
            <Link key={label} to={to} className="group rounded-2xl border border-[#242424] bg-[#111111] p-4 transition hover:-translate-y-0.5 hover:border-[#C9A45C]/40 hover:bg-[#151515]">
              <div className="flex items-start justify-between gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#E1C27A]"><Icon size={18} /></span>
                <ArrowUpRight size={15} className="text-[#F5F5DC]/20 transition group-hover:text-[#C9A45C]" />
              </div>
              <p className="mt-5 text-sm font-semibold text-white">{label}</p>
              <p className="mt-1 text-[10px] text-[#F5F5DC]/30">{detail}</p>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.45fr_.75fr]">
        <section className="overflow-hidden rounded-[24px] border border-[#242424] bg-[#111111] p-5 sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Activité</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Votre relation client</h2>
            </div>
            <select value={period} onChange={(event) => setPeriod(event.target.value)} className="h-9 rounded-xl border border-[#242424] bg-[#050505] px-3 text-[10px] font-semibold text-[#F5F5DC]/55 outline-none focus:border-[#C9A45C]/50" aria-label="Période">
              {ranges.map((range) => <option className="bg-[#111111]" key={range.key} value={range.key}>{range.label}</option>)}
            </select>
          </div>

          <div className="mt-6 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart} barGap={5}>
                <CartesianGrid stroke="#242424" vertical={false} />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#F5F5DC', opacity: 0.3, fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#F5F5DC', opacity: 0.2, fontSize: 9 }} width={28} />
                <Tooltip contentStyle={{ background: '#111111', border: '1px solid #242424', borderRadius: 14, color: '#fff' }} />
                <Bar dataKey="positive" stackId="reviews" fill="#C9A45C" radius={[4,4,0,0]} />
                <Bar dataKey="negative" stackId="reviews" fill="#6B6254" radius={[4,4,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-[24px] border border-[#242424] bg-[#111111] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Fidélité</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Clients qui reviennent</h2>
            </div>
            <Heart size={18} className="text-[#C9A45C]" />
          </div>
          <div className="mt-6 rounded-2xl border border-[#242424] bg-[#050505] p-5">
            <p className="text-[10px] text-[#F5F5DC]/35">Taux de retour</p>
            <p className="mt-2 font-display text-4xl text-[#E1C27A]">${analytics.returningRate.toFixed(1)}%</p>
            <p className="mt-2 text-xs leading-5 text-[#F5F5DC]/35">{analytics.returningCustomers} clients ont effectué au moins deux visites.</p>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-[#050505] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[#F5F5DC]/25">Visites</p><p className="mt-2 text-xl font-semibold text-white">{dashboardStatsLoading ? '—' : analytics.visits.toLocaleString('fr-FR')}</p></div>
            <div className="rounded-2xl bg-[#050505] p-4"><p className="text-[9px] uppercase tracking-[0.14em] text-[#F5F5DC]/25">Récompenses</p><p className="mt-2 text-xl font-semibold text-white">{redemptionsLoading ? '—' : analytics.currentRedemptions}</p></div>
          </div>
          <Link to="/dashboard/loyalty" className="mt-3 flex h-10 items-center justify-center gap-2 rounded-xl border border-[#C9A45C]/25 text-[10px] font-bold text-[#E1C27A] transition hover:bg-[#C9A45C]/10">Ouvrir la fidélité <ArrowUpRight size={14} /></Link>
        </section>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_.9fr]">
        <section className="rounded-[24px] border border-[#242424] bg-[#111111] p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">Derniers retours</p>
              <h2 className="mt-1 text-lg font-semibold text-white">Ce que disent vos clients</h2>
            </div>
            <Link to="/dashboard/reviews" className="text-[10px] font-semibold text-[#C9A45C]">Voir tout</Link>
          </div>
          <div className="mt-4 divide-y divide-[#242424]">
            {latest.length === 0 ? <div className="py-8 text-center text-xs text-[#F5F5DC]/25">Aucun avis pour le moment.</div> : latest.map((review) => (
              <div key={review.id} className="flex gap-3 py-4">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#C9A45C]"><Star size={15} /></div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2"><Stars rating={review.rating} /><span className="text-[9px] text-[#F5F5DC]/25">{new Date(review.created_at).toLocaleDateString('fr-FR')}</span></div>
                    <span className="text-[9px] text-[#F5F5DC]/25">{review.status}</span>
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#F5F5DC]/55">{review.comment || 'Avis sans commentaire.'}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[24px] border border-[#242424] bg-[#111111] p-5 sm:p-6">
          <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#C9A45C]">KELYANI</p>
          <h2 className="mt-1 font-display text-2xl leading-tight text-white">Faites de chaque client un client régulier.</h2>
          <p className="mt-2 text-xs leading-5 text-[#F5F5DC]/35">Vos avis, votre fidélité et vos données réunis dans un seul espace.</p>
          {isResponsible && (
            <div className="mt-5 rounded-2xl border border-[#242424] bg-[#050505] p-4">
              <div className="flex items-center justify-between">
                <div><p className="text-[9px] uppercase tracking-[0.14em] text-[#F5F5DC]/25">Abonnement</p><p className="mt-1 text-sm font-semibold text-white">{subscriptionLoading ? 'Chargement…' : subscription?.plan_name || 'Aucun abonnement'}</p></div>
                {subscription && <span className="rounded-full bg-[#C9A45C]/10 px-2.5 py-1 text-[9px] font-bold text-[#E1C27A]">{subscription.subscription_status === 'trial' ? 'Essai' : 'Actif'}</span>}
              </div>
              {subscription && <p className="mt-3 text-[10px] text-[#F5F5DC]/30">Valable jusqu’au {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString('fr-FR') : '—'}</p>}
            </div>
          )}
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Link to="/dashboard/menu" className="rounded-xl bg-[#C9A45C] px-3 py-3 text-center text-[10px] font-bold text-[#050505]">Menu digital</Link>
            <Link to="/dashboard/loyalty" className="rounded-xl border border-[#242424] px-3 py-3 text-center text-[10px] font-bold text-[#F5F5DC]/60 hover:border-[#C9A45C]/40">Fidélité</Link>
          </div>
        </section>
      </div>
    </div>
  );
}
