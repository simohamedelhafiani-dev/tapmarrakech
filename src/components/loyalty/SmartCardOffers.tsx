import { useEffect, useState } from 'react';
import { Cake, Clock3, Crown, Flame, Tag } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Promotion = {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  normal_price: number | null;
  promo_price: number | null;
  start_at: string | null;
  end_at: string | null;
};

type SmartOffers = {
  promotions?: Promotion[];
  happy_hour?: { start: string; end: string; days: number[]; offer: string | null; message: string | null; active_now: boolean };
  birthday?: { is_today: boolean; offer: string | null; message: string | null };
  vip?: { is_vip: boolean; threshold: number; visits: number; benefit: string | null; message: string | null };
  progress?: { near: boolean; stamps: number; goal: number; remaining: number; message: string | null };
};

const DAY_NAMES = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.'];

function validity(promotion: Promotion) {
  const fmt = (value: string) => new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  if (promotion.end_at) {
    const days = Math.ceil((new Date(promotion.end_at).getTime() - Date.now()) / 86400000);
    if (days <= 1) return 'Dernier jour';
    if (days <= 7) return `Plus que ${days} jours · jusqu’au ${fmt(promotion.end_at)}`;
    return `Valable jusqu’au ${fmt(promotion.end_at)}`;
  }
  return 'Offre en cours';
}

/**
 * Smart Marketing on the customer's card: current promotions with their validity, Happy Hour
 * during its slot, birthday gift, VIP status and progress encouragement. Display only.
 */
export default function SmartCardOffers({ accessToken }: { accessToken: string }) {
  const [offers, setOffers] = useState<SmartOffers | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    const load = async () => {
      const { data, error } = await supabase.rpc('get_public_loyalty_smart_offers', { p_access_token: accessToken });
      if (!active || error) return;
      setOffers((data ?? null) as SmartOffers | null);
    };
    void load();
    // Happy Hour switches on and off with the clock: refresh every few minutes.
    const timer = window.setInterval(() => { void load(); }, 5 * 60 * 1000);
    return () => { active = false; window.clearInterval(timer); };
  }, [accessToken]);

  if (!offers) return null;
  const promotions = offers.promotions ?? [];
  const highlights: { key: string; icon: typeof Cake; tone: string; title: string; text: string }[] = [];

  if (offers.birthday) {
    highlights.push({
      key: 'birthday',
      icon: Cake,
      tone: '#F472B6',
      title: offers.birthday.is_today ? 'Joyeux anniversaire ! 🎂' : 'C’est votre mois d’anniversaire 🎂',
      text: [offers.birthday.offer, offers.birthday.message].filter(Boolean).join(' · ') || 'Une attention vous attend lors de votre prochaine visite.',
    });
  }
  if (offers.happy_hour?.active_now) {
    highlights.push({
      key: 'happyhour',
      icon: Clock3,
      tone: '#F59E0B',
      title: `Happy Hour en cours · jusqu’à ${offers.happy_hour.end}`,
      text: offers.happy_hour.offer || offers.happy_hour.message || 'Profitez de votre avantage pendant ce créneau.',
    });
  }
  if (offers.vip?.is_vip) {
    highlights.push({
      key: 'vip',
      icon: Crown,
      tone: '#E8C57E',
      title: 'Vous êtes client VIP 👑',
      text: offers.vip.benefit || offers.vip.message || 'Merci pour votre fidélité, profitez de vos avantages exclusifs.',
    });
  }
  if (offers.progress?.near) {
    highlights.push({
      key: 'progress',
      icon: Flame,
      tone: '#10B981',
      title: offers.progress.remaining === 1 ? 'Plus qu’un tampon avant votre cadeau !' : `Plus que ${offers.progress.remaining} tampons avant votre cadeau`,
      text: offers.progress.message || 'Encore un petit effort, votre récompense approche.',
    });
  }

  const upcomingHappyHour = offers.happy_hour && !offers.happy_hour.active_now ? offers.happy_hour : null;
  if (!highlights.length && !promotions.length && !upcomingHappyHour) return null;

  return (
    <section className="mt-4 w-full max-w-[400px] space-y-3">
      {highlights.map(item => {
        const Icon = item.icon;
        return (
          <div key={item.key} className="flex items-start gap-3 rounded-2xl border bg-[#111111] p-4 shadow-lg" style={{ borderColor: `${item.tone}55` }}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl" style={{ background: `${item.tone}1F`, color: item.tone }}>
              <Icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{item.title}</p>
              <p className="mt-0.5 text-xs leading-5 text-white/55">{item.text}</p>
            </div>
          </div>
        );
      })}

      {promotions.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-[#111111] p-4 shadow-lg">
          <div className="mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#10B981]" />
            <p className="text-sm font-semibold text-white">Offres du moment</p>
          </div>
          <div className="space-y-3">
            {promotions.map(promotion => (
              <div key={promotion.id} className="flex gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-2.5">
                {promotion.image_url && <img src={promotion.image_url} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" loading="lazy" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-white">{promotion.name}</p>
                  {promotion.description && <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-white/50">{promotion.description}</p>}
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                    {promotion.promo_price != null && <span className="text-sm font-bold text-[#10B981]">{promotion.promo_price} MAD</span>}
                    {promotion.normal_price != null && <span className="text-[11px] text-white/35 line-through">{promotion.normal_price} MAD</span>}
                    <span className="text-[10px] font-medium text-white/45">{validity(promotion)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {upcomingHappyHour && (
        <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-[#111111] px-4 py-3">
          <Clock3 className="h-4 w-4 shrink-0 text-[#F59E0B]" />
          <p className="text-xs text-white/60">
            Happy Hour {upcomingHappyHour.days.length ? upcomingHappyHour.days.map(day => DAY_NAMES[day]).join(', ') + ' ' : 'tous les jours '}
            de {upcomingHappyHour.start} à {upcomingHappyHour.end}{upcomingHappyHour.offer ? ` · ${upcomingHappyHour.offer}` : ''}
          </p>
        </div>
      )}
    </section>
  );
}
