import { Building2, RefreshCw, Star, UserPlus } from 'lucide-react';
import type { ActivityEvent, ActivityEventType } from '@/hooks/useRecentActivity';

type RecentActivityProps = {
  events: ActivityEvent[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void | Promise<void>;
};

function formatRelativeTime(createdAt: string): string {
  const timestamp = Date.parse(createdAt);

  if (Number.isNaN(timestamp)) {
    return 'Date inconnue';
  }

  const diffMs = Date.now() - timestamp;
  const diffSeconds = Math.max(0, Math.floor(diffMs / 1000));
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSeconds < 60) return "À l'instant";
  if (diffMinutes < 60) return `Il y a ${diffMinutes} min`;
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7) return `Il y a ${diffDays} j`;

  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(timestamp));
}

function getActivityIcon(type: ActivityEventType) {
  if (type === 'review') return Star;
  if (type === 'loyalty_customer') return UserPlus;
  return Building2;
}

function getActivityIconClass(type: ActivityEventType): string {
  if (type === 'review') return 'bg-gold/15 text-[#8b6a20]';
  if (type === 'loyalty_customer') return 'bg-[#C9A45C]/10 text-[#C9A45C]';
  return 'bg-ink/5 text-[#FFFFFF]/50';
}

export default function RecentActivity({
  events,
  loading,
  error,
  onRetry,
}: RecentActivityProps) {
  return (
    <section
      className="rounded-3xl border border-[#242424] bg-[#111111] p-6 shadow-soft"
      aria-labelledby="recent-activity-title"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A45C]/45">
            Activité
          </p>
          <h3 id="recent-activity-title" className="mt-1 text-lg font-semibold text-[#FFFFFF]">
            Activité récente
          </h3>
        </div>

        {!loading && !error && events.length > 0 && (
          <span className="rounded-full bg-[#C9A45C]/5 px-3 py-1.5 text-[10px] font-semibold text-[#C9A45C]">
            {events.length} activité{events.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="space-y-2" aria-label="Chargement de l'activité récente">
            {[1, 2, 3, 4, 5].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-2xl border border-[#242424] p-3"
              >
                <div className="h-10 w-10 shrink-0 animate-pulse rounded-xl bg-ink/5" />
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="h-3 w-40 animate-pulse rounded bg-ink/5" />
                  <div className="h-2.5 w-64 max-w-full animate-pulse rounded bg-ink/5" />
                </div>
                <div className="h-2.5 w-14 animate-pulse rounded bg-ink/5" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-[#242424] bg-[#111111] p-6 text-center">
            <p className="text-sm font-semibold text-[#FFFFFF]">
              Impossible de charger l'activité récente.
            </p>
            <button
              type="button"
              onClick={() => void onRetry()}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2.5 text-xs font-semibold text-[#050505] transition hover:bg-[#C9A45C]-light"
            >
              <RefreshCw size={14} />
              Réessayer
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-ink/10 bg-[#111111] p-8 text-center">
            <div className="mx-auto grid h-11 w-11 place-items-center rounded-xl bg-[#C9A45C]/5 text-[#C9A45C]">
              <RefreshCw size={18} />
            </div>
            <p className="mt-3 text-sm font-semibold text-[#FFFFFF]">
              Aucune activité récente
            </p>
            <p className="mt-1 text-xs text-[#FFFFFF]/40">
              Les nouvelles activités de votre plateforme apparaîtront ici.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {events.map((event) => {
              const Icon = getActivityIcon(event.type);

              return (
                <div
                  key={`${event.type}-${event.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-[#242424] p-3 transition hover:border-[#242424] hover:bg-[#111111]"
                >
                  <div
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${getActivityIconClass(event.type)}`}
                  >
                    <Icon size={17} strokeWidth={1.9} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold text-[#FFFFFF]">
                      {event.title}
                    </p>
                    {event.description && (
                      <p className="mt-0.5 truncate text-[11px] text-[#FFFFFF]/40">
                        {event.description}
                      </p>
                    )}
                  </div>

                  <time
                    dateTime={event.created_at}
                    className="shrink-0 text-[10px] font-medium text-[#FFFFFF]/35"
                    title={new Intl.DateTimeFormat('fr-FR', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    }).format(new Date(event.created_at))}
                  >
                    {formatRelativeTime(event.created_at)}
                  </time>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
