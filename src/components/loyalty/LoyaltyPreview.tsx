import { useMemo } from 'react';
import { ChevronRight, Gift, ShieldCheck, Sparkles } from 'lucide-react';
import { LoyaltyCardVisual } from '@/components/LoyaltyCardVisual';
import type {
  LoyaltyCardDesign,
  LoyaltyCustomer,
  LoyaltyReward,
  LoyaltySettings,
} from '@/hooks/useLoyaltyManager';

type Props = {
  settings: LoyaltySettings;
  rewards: LoyaltyReward[];
  customers: LoyaltyCustomer[];
  design: LoyaltyCardDesign | null;
};

export default function LoyaltyPreview({ settings, rewards, customers, design }: Props) {
  const customer = customers[0] ?? {
    id: 'preview',
    establishment_id: '',
    phone: '',
    first_name: 'Mohamed',
    last_name: 'Client',
    points_balance: 320,
    total_points_earned: 620,
    total_points_redeemed: 300,
    visit_count: 7,
    last_visit_at: null,
    created_at: new Date().toISOString(),
  };

  const activeRewards = useMemo(
    () => rewards.filter(reward => reward.active).sort((a, b) => a.points_required - b.points_required),
    [rewards],
  );

  const nextReward = activeRewards.find(reward => reward.points_required > customer.points_balance) ?? activeRewards[0] ?? null;
  const target = nextReward?.points_required ?? Math.max(100, settings.points_per_currency * 100);
  const points = Math.max(0, customer.points_balance);
  const progress = target > 0 ? Math.min(100, Math.round((points / target) * 100)) : 0;
  const remaining = Math.max(0, target - points);

  const visualDesign = design ?? {
    template_id: 'restaurant-elegant',
    primary_color: '#173D32',
    secondary_color: '#D3A84C',
    background_color: '#F7F7F3',
    text_color: '#FFFFFF',
    button_color: '#173D32',
    border_radius: 28,
    design_config: {},
    published: false,
  };

  const config = {
    ...(visualDesign.design_config ?? {}),
    front_title: 'CARTE FIDÉLITÉ',
    front_subtitle: 'Votre fidélité est récompensée.',
    show_points: true,
    show_qr: false,
    loyaltyType: settings.program_type,
    card_mode: settings.program_type === 'STAMP' ? 'STAMP' : 'QR',
  };

  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'Client';

  return (
    <div className="space-y-4">
      <div className="mx-auto w-full max-w-[330px] rounded-[2.5rem] border-[7px] border-[#171b1a] bg-[#171b1a] p-1.5 shadow-2xl">
        <div className="overflow-hidden rounded-[2rem] bg-white">
          <div className="relative flex items-center justify-center border-b border-black/5 bg-white px-4 py-3">
            <div className="absolute left-3 h-2 w-2 rounded-full bg-[#171b1a]" />
            <div className="h-1.5 w-16 rounded-full bg-black/10" />
            <div className="absolute right-3 h-4 w-4 rounded-full border border-black/10" />
          </div>

          <div className="bg-white p-3">
            <LoyaltyCardVisual
              design={{
                primary_color: visualDesign.primary_color,
                secondary_color: visualDesign.secondary_color,
                background_color: visualDesign.background_color,
                text_color: visualDesign.text_color,
                border_radius: visualDesign.border_radius,
                config,
              }}
              card={{
                establishmentName: 'Votre établissement',
                customerName,
                points,
                stampsBalance: Math.min(customer.visit_count, settings.stamp_goal),
                stampGoal: settings.stamp_goal,
                stampRewardName: settings.stamp_reward_name,
                phone: customer.phone,
                loyaltyNumber: customer.loyalty_number ?? undefined,
                cardUrl: '',
              }}
              compact
              side="front"
              programType={settings.program_type === 'STAMP' ? 'STAMP' : 'POINTS'}
            />
          </div>

          <div className="border-t border-black/5 bg-white px-4 pb-4 pt-3">
            <div className="flex items-center justify-between text-[9px] text-black/35">
              <span>Carte digitale</span>
              <span>{settings.enabled ? 'Active' : 'Inactive'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-ink/5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-gold">Solde simulé</p>
            <p className="mt-1 text-2xl font-bold text-forest">{points.toLocaleString('fr-FR')} pts</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#f4ead3] text-gold">
            <Sparkles size={17} />
          </div>
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] font-semibold text-forest">
              {nextReward ? nextReward.name : 'Prochaine récompense'}
            </p>
            <span className="text-[9px] font-semibold text-ink/35">{target} pts</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-ink/8">
            <div className="h-full rounded-full transition-all duration-300" style={{ width: `${progress}%`, background: visualDesign.secondary_color }} />
          </div>
          <div className="mt-2 flex items-center justify-between text-[9px] text-ink/35">
            <span>{progress}% atteint</span>
            <span>{remaining ? `${remaining} pts restants` : 'Récompense atteinte'}</span>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-ink/6 bg-white p-4">
        <div className="flex items-center gap-2">
          <div className="grid h-8 w-8 place-items-center rounded-xl bg-forest text-white">
            <ShieldCheck size={14} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-ink/35">Client</p>
            <p className="truncate text-xs font-semibold text-forest">{customerName}</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-[#f7f7f3] p-3">
            <p className="text-[9px] text-ink/35">Statut</p>
            <p className="mt-1 text-xs font-semibold text-forest">{settings.enabled ? 'Actif' : 'Inactif'}</p>
          </div>
          <div className="rounded-xl bg-[#f7f7f3] p-3">
            <p className="text-[9px] text-ink/35">Visites</p>
            <p className="mt-1 text-xs font-semibold text-forest">{customer.visit_count}</p>
          </div>
        </div>
      </div>

      {nextReward && (
        <div className="flex items-center gap-3 rounded-2xl border border-gold/20 bg-[#fdf9ef] p-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f4ead3] text-gold">
            <Gift size={15} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-forest">{nextReward.name}</p>
            <p className="mt-0.5 truncate text-[9px] text-ink/40">{nextReward.description || 'Continuez à cumuler des points.'}</p>
          </div>
          <ChevronRight size={14} className="shrink-0 text-gold" />
        </div>
      )}
    </div>
  );
}
