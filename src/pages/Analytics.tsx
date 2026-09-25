import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ExternalLink, MessageSquare, Percent, Star, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Review } from '@/lib/types';

type Establishment = {
  id: string;
  name: string;
};

export default function Analytics() {
  const { user } = useAuth();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [events, setEvents] = useState<Array<{ id: string; establishment_id: string; event_type: string; rating: number | null; created_at: string }>>([]);
  const [dashboardStats, setDashboardStats] = useState<{
    reviewsCount: number;
    averageRating: number;
    satisfactionPercent: number;
    redirectsCount: number;
    pageViewsCount: number;
    feedbacksCount: number;
    weekly: Array<{ name: string; total: number }>;
    distribution: Array<{ name: string; value: number }>;
  }>({
    reviewsCount: 0,
    averageRating: 0,
    satisfactionPercent: 0,
    redirectsCount: 0,
    pageViewsCount: 0,
    feedbacksCount: 0,
    weekly: [],
    distribution: [],
  });

  useEffect(() => {
    loadEstablishments();
  }, [user]);

  useEffect(() => {
    if (establishmentId) {
      loadAnalytics();
    } else {
      setReviews([]);
      setEvents([]);
      setDashboardStats({ reviewsCount: 0, averageRating: 0, satisfactionPercent: 0, redirectsCount: 0, pageViewsCount: 0, feedbacksCount: 0, weekly: [], distribution: [] });
    }
  }, [establishmentId]);

  async function loadEstablishments() {
    if (!user) return;

    const { data, error } = await supabase.rpc('get_my_establishments');

    if (error) {
      console.error('Erreur chargement établissements:', error);
      setEstablishments([]);
      setEstablishmentId('');
      return;
    }

    const places = (data ?? []).map(
      (establishment: { id: string; name: string }) => ({
        id: establishment.id,
        name: establishment.name,
      })
    );

    setEstablishments(places);

    if (places.length > 0) {
      setEstablishmentId(current =>
        places.some((place: Establishment) => place.id === current) ? current : places[0].id
      );
    } else {
      setEstablishmentId('');
    }
  }

  async function loadAnalytics() {
    if (!establishmentId) return;

    const { data, error } = await supabase.rpc('get_analytics_dashboard_stats', {
      p_establishment_id: establishmentId,
    });

    if (error) {
      console.error('Erreur chargement analytics:', error);
      setReviews([]);
      setEvents([]);
      setDashboardStats({ reviewsCount: 0, averageRating: 0, satisfactionPercent: 0, redirectsCount: 0, pageViewsCount: 0, feedbacksCount: 0, weekly: [], distribution: [] });
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const weeklyData = Array.isArray(row?.weekly) ? row.weekly : [];
    const distributionData = Array.isArray(row?.distribution) ? row.distribution : [];

    setDashboardStats({
      reviewsCount: Number(row?.reviews_count ?? 0),
      averageRating: Number(row?.average_rating ?? 0),
      satisfactionPercent: Number(row?.satisfaction_percent ?? 0),
      redirectsCount: Number(row?.redirects_count ?? 0),
      pageViewsCount: Number(row?.page_views_count ?? 0),
      feedbacksCount: Number(row?.feedbacks_count ?? 0),
      weekly: weeklyData.map((item: { name?: string; total?: number }) => ({ name: String(item.name ?? ''), total: Number(item.total ?? 0) })),
      distribution: distributionData.map((item: { name?: string; value?: number }) => ({ name: String(item.name ?? ''), value: Number(item.value ?? 0) })),
    });
  }

  const { averageRating, satisfactionPercent, redirectsCount, pageViewsCount, feedbacksCount, weekly, distribution } = dashboardStats;

  return (
    <div>
      <div className="mb-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gold">
          Comprendre votre audience
        </p>
        <h1 className="mt-2 font-display text-4xl text-forest">Analytics</h1>
        <p className="mt-2 text-sm text-ink/50">
          Les signaux clés de l’expérience client.
        </p>
      </div>

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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={BarChart3}
          label="Volume total"
          value={dashboardStats.reviewsCount}
          detail="notes collectées"
        />
        <Metric
          icon={Star}
          label="Note moyenne"
          value={
            dashboardStats.reviewsCount ? averageRating.toFixed(1) : '—'
          }
          detail="sur 5 étoiles"
        />
        <Metric
          icon={Percent}
          label="Satisfaction"
          value={`${satisfactionPercent}%`}
          detail="clients satisfaits"
        />
        <Metric
          icon={ExternalLink}
          label="Redirections Google"
          value={redirectsCount}
          detail={`${pageViewsCount ? Math.round((redirectsCount / pageViewsCount) * 100) : 0}% des scans`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-2xl border border-ink/5 bg-white p-6 shadow-soft">
          <h2 className="font-display text-xl text-forest">Volume d’avis</h2>
          <p className="mt-1 text-xs text-ink/45">
            Évolution sur les 8 dernières semaines
          </p>

          <div className="mt-7 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly}>
                <CartesianGrid
                  vertical={false}
                  stroke="#edf0eb"
                />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca89f', fontSize: 11 }}
                />
                <YAxis
                  allowDecimals={false}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#9ca89f', fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 12,
                    border: '1px solid #edf0eb',
                    fontSize: 12,
                  }}
                />
                <Bar
                  dataKey="total"
                  name="Avis"
                  fill="#17352a"
                  radius={[5, 5, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border border-ink/5 bg-white p-6 shadow-soft">
          <h2 className="font-display text-xl text-forest">
            Répartition des notes
          </h2>
          <p className="mt-1 text-xs text-ink/45">
            Toutes les évaluations reçues
          </p>

          <div className="mt-3 h-52">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={78}
                  paddingAngle={3}
                >
                  {distribution.map((_, i) => (
                    <Cell
                      key={i}
                      fill={
                        ['#c8a96b', '#a9b987', '#6f9581', '#4d7865', '#17352a'][i]
                      }
                    />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-2">
            {distribution.map((item, i) => (
              <div
                key={item.name}
                className="flex items-center justify-between text-xs"
              >
                <span className="flex items-center gap-2 text-ink/60">
                  <i
                    className="h-2 w-2 rounded-full"
                    style={{
                      background:
                        ['#c8a96b', '#a9b987', '#6f9581', '#4d7865', '#17352a'][i],
                    }}
                  />
                  {item.name}
                </span>
                <span className="font-semibold text-forest">
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <InfoCard
          icon={MessageSquare}
          title="Retours privés"
          value={feedbacksCount}
          detail={
            dashboardStats.reviewsCount
              ? `${Math.round((feedbacksCount / dashboardStats.reviewsCount) * 100)}% du total des notes`
              : 'En attente de données'
          }
        />
        <InfoCard
          icon={Users}
          title="Scans NFC / QR"
          value={pageViewsCount}
          detail="pages publiques consultées"
        />
        <InfoCard
          icon={ExternalLink}
          title="Taux de redirection"
          value={`${pageViewsCount ? Math.round((redirectsCount / pageViewsCount) * 100) : 0}%`}
          detail="visiteurs orientés vers Google"
        />
      </div>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Star;
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-ink/5 bg-white p-5 shadow-soft">
      <Icon size={18} className="text-gold" />
      <p className="mt-5 text-xs text-ink/45">{label}</p>
      <p className="mt-1 font-display text-3xl text-forest">{value}</p>
      <p className="mt-1 text-[11px] text-ink/40">{detail}</p>
    </div>
  );
}

function InfoCard({
  icon: Icon,
  title,
  value,
  detail,
}: {
  icon: typeof Star;
  title: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-ink/5 bg-white p-5 shadow-soft">
      <div className="grid h-11 w-11 place-items-center rounded-xl bg-[#e5eee9] text-forest">
        <Icon size={19} />
      </div>
      <div>
        <p className="text-xs text-ink/45">{title}</p>
        <p className="mt-1 font-display text-2xl text-forest">{value}</p>
        <p className="text-[11px] text-ink/40">{detail}</p>
      </div>
    </div>
  );
}