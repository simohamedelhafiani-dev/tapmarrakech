import { useEffect, useMemo, useState } from 'react';
import { BarChart3, ExternalLink, MessageSquare, Percent, Star, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { DataLoadError } from '@/components/DataLoadError';
import { supabase } from '@/lib/supabase';
import type { AnalyticsEvent, Review } from '@/lib/types';

type Establishment = {
  id: string;
  name: string;
};

export default function Analytics() {
  const { user } = useAuth();

  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);

  useEffect(() => {
    loadEstablishments();
  }, [user]);

  useEffect(() => {
    if (establishmentId) {
      loadAnalytics();
    } else {
      setReviews([]);
      setEvents([]);
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

    const [r, e] = await Promise.all([
      supabase
        .from('reviews')
        .select('*')
        .eq('establishment_id', establishmentId),
      supabase
        .from('analytics_events')
        .select('*')
        .eq('establishment_id', establishmentId),
    ]);

    if (r.error) {
      console.error('Erreur chargement avis:', r.error);
    }

    if (e.error) {
      console.error('Erreur chargement analytics:', e.error);
    }

    setReviews((r.data as Review[]) ?? []);
    setEvents((e.data as AnalyticsEvent[]) ?? []);
  }

  const positive = reviews.filter(r => r.rating >= 4).length;
  const satisfaction = reviews.length
    ? Math.round((positive / reviews.length) * 100)
    : 0;

  const distribution = [5, 4, 3, 2, 1].map(n => ({
    name: `⭐ ${n}`,
    value: reviews.filter(r => r.rating === n).length,
  }));

  const weekly = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => {
        const end = new Date();
        end.setDate(end.getDate() - (7 - i) * 7);

        const start = new Date(end);
        start.setDate(end.getDate() - 7);

        const rows = reviews.filter(r => {
          const d = new Date(r.created_at);
          return d >= start && d <= end;
        });

        return { name: `S${i + 1}`, total: rows.length };
      }),
    [reviews]
  );

  const redirects = events.filter(
    e => e.event_type === 'google_redirect'
  ).length;

  const pageViews = events.filter(
    e => e.event_type === 'page_view'
  ).length;

  const feedbacks = reviews.filter(r => r.rating <= 3).length;

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
          value={reviews.length}
          detail="notes collectées"
        />
        <Metric
          icon={Star}
          label="Note moyenne"
          value={
            reviews.length
              ? (
                  reviews.reduce((a, r) => a + r.rating, 0) / reviews.length
                ).toFixed(1)
              : '—'
          }
          detail="sur 5 étoiles"
        />
        <Metric
          icon={Percent}
          label="Satisfaction"
          value={`${satisfaction}%`}
          detail="clients satisfaits"
        />
        <Metric
          icon={ExternalLink}
          label="Redirections Google"
          value={redirects}
          detail={`${pageViews ? Math.round((redirects / pageViews) * 100) : 0}% des scans`}
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
          value={feedbacks}
          detail={
            reviews.length
              ? `${Math.round((feedbacks / reviews.length) * 100)}% du total des notes`
              : 'En attente de données'
          }
        />
        <InfoCard
          icon={Users}
          title="Scans NFC / QR"
          value={pageViews}
          detail="pages publiques consultées"
        />
        <InfoCard
          icon={ExternalLink}
          title="Taux de redirection"
          value={`${pageViews ? Math.round((redirects / pageViews) * 100) : 0}%`}
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