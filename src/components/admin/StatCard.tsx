import { TrendingDown, TrendingUp } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconTone?: 'indigo' | 'emerald' | 'amber';
  trend?: number;
  trendLabel?: string;
  hint?: string;
};

const iconToneClasses: Record<NonNullable<StatCardProps['iconTone']>, string> = {
  indigo: 'bg-[#6366F1]/10 text-[#4F46E5]',
  emerald: 'bg-[#10B981]/10 text-[#059669]',
  amber: 'bg-[#F59E0B]/10 text-[#D97706]',
};

function TrendIndicator({ value, label }: { value: number; label?: string }) {
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;

  return (
    <div className={['mt-3 inline-flex items-center gap-1.5 text-xs font-semibold', positive ? 'text-[#059669]' : 'text-[#DC2626]'].join(' ')}>
      <Icon size={14} strokeWidth={2.1} />
      <span>{positive ? '+' : ''}{value.toFixed(0)}%{label ? ` ${label}` : ' vs période précédente'}</span>
    </div>
  );
}

export default function StatCard({ label, value, icon: Icon, iconTone = 'indigo', trend, trendLabel, hint }: StatCardProps) {
  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[#E5E7EB] bg-white/90 p-6 shadow-[0_18px_45px_rgba(17,24,39,0.055),0_3px_10px_rgba(17,24,39,0.045)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-[#173D32]/15 hover:shadow-[0_24px_55px_rgba(17,24,39,0.075),0_5px_14px_rgba(17,24,39,0.055)]">
      <div className="flex items-start justify-between gap-5">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-[-0.01em] text-[#6B7280]">{label}</p>
          <p className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.035em] text-[#111827]">{value}</p>
          {typeof trend === 'number' ? <TrendIndicator value={trend} label={trendLabel} /> : hint ? <p className="mt-3 text-xs font-medium text-[#6B7280]">{hint}</p> : null}
        </div>
        <div className={['grid h-11 w-11 shrink-0 place-items-center rounded-xl', iconToneClasses[iconTone]].join(' ')}>
          <Icon size={20} strokeWidth={1.9} />
        </div>
      </div>
      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#173D32]/[0.025] blur-2xl transition-opacity duration-200 group-hover:opacity-100" />
    </article>
  );
}