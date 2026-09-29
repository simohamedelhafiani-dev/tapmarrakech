import type { LucideIcon } from 'lucide-react';

type StatCardProps = {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconTone?: 'forest' | 'gold' | 'indigo' | 'emerald' | 'amber';
  hint?: string;
};

const iconToneClasses: Record<NonNullable<StatCardProps['iconTone']>, string> = {
  forest: 'bg-[#173D32]/8 text-[#173D32]',
  gold: 'bg-[#D3A84C]/12 text-[#A47B20]',
  indigo: 'bg-[#6366F1]/10 text-[#4F46E5]',
  emerald: 'bg-[#10B981]/10 text-[#059669]',
  amber: 'bg-[#F59E0B]/10 text-[#D97706]',
};

export default function StatCard({
  label,
  value,
  icon: Icon,
  iconTone = 'forest',
  hint,
}: StatCardProps) {
  return (
    <article
      className={[
        'group relative overflow-hidden rounded-2xl border border-[#E5E7EB]',
        'bg-white/85 p-5 shadow-[0_8px_30px_rgba(17,24,39,0.04)]',
        'backdrop-blur-xl transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-[#173D32]/15',
        'hover:shadow-[0_12px_36px_rgba(17,24,39,0.07)]',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium tracking-[-0.01em] text-[#6B7280]">
            {label}
          </p>

          <p className="mt-3 text-[30px] font-semibold leading-none tracking-[-0.035em] text-[#111827]">
            {value}
          </p>

          {hint ? (
            <p className="mt-3 text-xs font-medium text-[#6B7280]">
              {hint}
            </p>
          ) : null}
        </div>

        <div
          className={[
            'grid h-11 w-11 shrink-0 place-items-center rounded-xl',
            iconToneClasses[iconTone],
          ].join(' ')}
        >
          <Icon size={20} strokeWidth={1.9} />
        </div>
      </div>

      <div className="pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full bg-[#173D32]/[0.025] blur-2xl transition-opacity duration-200 group-hover:opacity-100" />
    </article>
  );
}
