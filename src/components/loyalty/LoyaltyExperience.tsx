import { useEffect, useState } from 'react';
import { Gift, History, QrCode, Sparkles, Star, Ticket, Trophy, WalletCards, X } from 'lucide-react';
import QRCode from 'qrcode';
import type { CSSProperties, ReactNode } from 'react';

export type LoyaltyExperienceType = 'STAMP' | 'POINTS' | 'DISCOUNT' | 'TIER' | 'REWARD' | 'CASHBACK' | 'CHALLENGE' | 'COLLECTION';

export type LoyaltyExperienceReward = {
  id: string;
  name: string;
  description?: string | null;
  points_required: number;
  reward_type?: string | null;
  discount_percent?: number | null;
  discount_max_amount?: number | null;
};

export type LoyaltyExperienceHistory = {
  id: string;
  title: string;
  date: string;
  points?: number;
  amount?: number | null;
};

export type LoyaltyExperienceConfig = {
  type: LoyaltyExperienceType;
  businessType?: string | null;
  establishmentName: string;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  primaryColor: string;
  secondaryColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius?: number;
  customerName?: string;
  pointsBalance?: number;
  pointsGoal?: number;
  visits?: number;
  visitGoal?: number;
  rewardName?: string | null;
  rewardDescription?: string | null;
  discountPercent?: number | null;
  discountExpiresAt?: string | null;
  cashbackBalance?: number;
  currentTier?: string | null;
  tiers?: { name: string; min: number; benefit: string }[];
  progressLabel?: string | null;
  benefits?: { title: string; description?: string; icon?: string }[];
  offers?: { title: string; description?: string; eyebrow?: string }[];
  rewards?: LoyaltyExperienceReward[];
  history?: LoyaltyExperienceHistory[];
  qrValue?: string | null;
  intro?: string | null;
  templateId?: string | null;
  published?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const percent = max > 0 ? clamp((value / max) * 100, 0, 100) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/8">
      <div className="h-full rounded-full transition-all duration-700 ease-out" style={{ width: percent + '%', background: color }} />
    </div>
  );
}

function Section({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <section className="mt-5">
      {eyebrow && <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-45">{eyebrow}</p>}
      <h2 className="mt-1 text-base font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

export function LoyaltyHeader({ config }: { config: LoyaltyExperienceConfig }) {
  return (
    <div className="relative overflow-hidden px-5 pb-5 pt-5 sm:px-6">
      {config.coverImageUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `linear-gradient(180deg, ${config.primaryColor}25 0%, ${config.primaryColor}e8 90%), url("${config.coverImageUrl}")` }}
        />
      )}
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt="" className="h-14 w-14 shrink-0 rounded-2xl bg-white object-contain p-1.5 shadow-lg" />
            ) : (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl border border-white/20 bg-white/10 text-sm font-bold">
                {config.establishmentName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{config.establishmentName}</p>
              <p className="mt-1 text-[9px] uppercase tracking-[0.2em] opacity-60">Programme fidélité</p>
            </div>
          </div>
          <div className="rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-[0.14em]">
            <Sparkles size={11} className="mr-1 inline" /> Privilégié
          </div>
        </div>

        <div className="mt-7">
          <p className="text-[10px] uppercase tracking-[0.22em] opacity-55">Bonjour</p>
          <p className="mt-1 text-2xl font-bold tracking-tight sm:text-[28px]">{config.customerName || 'Client'}</p>
          {config.intro && <p className="mt-2 max-w-[310px] text-xs leading-5 opacity-70">{config.intro}</p>}
        </div>
      </div>
    </div>
  );
}

export function LoyaltyProgress({ config }: { config: LoyaltyExperienceConfig }) {
  if (config.type === 'STAMP' || config.type === 'CHALLENGE' || config.type === 'COLLECTION') {
    const current = config.visits ?? 0;
    const goal = Math.max(1, config.visitGoal ?? 8);
    const remaining = Math.max(0, goal - current);
    const label = config.type === 'CHALLENGE' ? 'Progression du défi' : config.type === 'COLLECTION' ? 'Collection' : 'Vos visites';
    return (
      <div className="rounded-[24px] border border-black/6 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,.10)] backdrop-blur-xl">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-45">{label}</p><p className="mt-1 text-3xl font-bold tracking-tight">{current}<span className="text-base opacity-35"> / {goal}</span></p></div>
          <span className="rounded-full px-3 py-1.5 text-[10px] font-semibold" style={{ color: config.primaryColor, background: config.secondaryColor + '22' }}>{remaining > 0 ? `Encore ${remaining}` : 'Objectif atteint'}</span>
        </div>
        <div className="mt-4"><ProgressBar value={current} max={goal} color={config.secondaryColor} /></div>
        <p className="mt-3 text-xs opacity-55">{config.progressLabel || (remaining > 0 ? `Encore ${remaining} visites avant votre récompense` : 'Votre récompense est disponible')}</p>
      </div>
    );
  }

  if (config.type === 'POINTS' || config.type === 'REWARD') {
    const points = config.pointsBalance ?? 0;
    const goal = Math.max(points, config.pointsGoal ?? 1000);
    const remaining = Math.max(0, goal - points);
    return (
      <div className="rounded-[24px] border border-black/6 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,.10)] backdrop-blur-xl">
        <div className="flex items-end justify-between">
          <div><p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-45">Votre solde</p><p className="mt-1 text-4xl font-bold tracking-tight">{points.toLocaleString('fr-FR')} <span className="text-sm font-semibold opacity-45">pts</span></p></div>
          <div className="rounded-2xl p-3" style={{ background: config.secondaryColor + '22', color: config.primaryColor }}><Trophy size={20}/></div>
        </div>
        <div className="mt-5"><ProgressBar value={points} max={goal} color={config.secondaryColor} /></div>
        <p className="mt-3 text-xs opacity-55">{remaining > 0 ? `${remaining.toLocaleString('fr-FR')} points avant la prochaine récompense` : 'Récompense disponible maintenant'}</p>
      </div>
    );
  }

  if (config.type === 'DISCOUNT') {
    return (
      <div className="rounded-[24px] p-5 text-white shadow-[0_14px_35px_rgba(0,0,0,.12)]" style={{ background: config.primaryColor }}>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">Avantage fidélité</p>
        <div className="mt-1 flex items-end justify-between gap-4"><p className="text-5xl font-bold tracking-tight">-{config.discountPercent ?? 10}%</p><Ticket size={32} style={{ color: config.secondaryColor }}/></div>
        <p className="mt-2 text-xs opacity-70">{config.discountExpiresAt ? `Valable jusqu’au ${new Date(config.discountExpiresAt).toLocaleDateString('fr-FR')}` : 'Votre avantage est disponible'}</p>
      </div>
    );
  }

  if (config.type === 'CASHBACK') {
    return (
      <div className="rounded-[24px] p-5 text-white shadow-[0_14px_35px_rgba(0,0,0,.12)]" style={{ background: config.primaryColor }}>
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-55">Solde fidélité</p>
        <p className="mt-1 text-5xl font-bold tracking-tight">{(config.cashbackBalance ?? 0).toLocaleString('fr-FR')} <span className="text-lg">{'DH'}</span></p>
        <p className="mt-2 text-xs opacity-65">Disponible sur vos prochains achats</p>
      </div>
    );
  }

  if (config.type === 'TIER') {
    const tiers = config.tiers ?? [];
    return (
      <div className="rounded-[24px] border border-black/6 bg-white/10 p-5 shadow-[0_10px_30px_rgba(0,0,0,.10)] backdrop-blur-xl">
        <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.2em] opacity-45">Votre niveau</p><p className="mt-1 text-2xl font-bold">{config.currentTier || 'Membre'}</p></div><Star size={24} fill={config.secondaryColor} style={{ color: config.secondaryColor }}/></div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          {(tiers.length ? tiers : [{name:'Bronze',min:0,benefit:'Avantages essentiels'},{name:'Silver',min:251,benefit:'Avantages renforcés'},{name:'Gold',min:501,benefit:'Avantages premium'}]).map(t => (
            <div key={t.name} className="rounded-2xl border p-3 text-center" style={{ borderColor: t.name === config.currentTier ? config.secondaryColor : 'rgba(0,0,0,.06)', background: t.name === config.currentTier ? config.secondaryColor + '16' : 'transparent' }}>
              <p className="text-[9px] font-bold uppercase tracking-wider">{t.name}</p><p className="mt-1 text-[9px] opacity-50">{t.min}+ pts</p><p className="mt-2 text-[10px] font-medium leading-4 opacity-70">{t.benefit}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return null;
}

export function LoyaltyReward({ config }: { config: LoyaltyExperienceConfig }) {
  const reward = config.rewardName;
  if (!reward && !(config.rewards?.length)) return null;
  return (
    <Section title={config.rewards?.length ? 'Récompenses disponibles' : 'Votre prochaine récompense'} eyebrow="À débloquer">
      {reward && (
        <div className="mt-3 flex items-center gap-4 rounded-[22px] border border-white/15 bg-white/10 p-4 text-white shadow-lg backdrop-blur-xl" style={{ background: config.primaryColor }}>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: config.secondaryColor + '35', color: config.secondaryColor }}><Gift size={23}/></div>
          <div className="min-w-0"><p className="text-[9px] uppercase tracking-[0.16em] opacity-55">Prochaine récompense</p><p className="mt-1 text-lg font-semibold">{reward}</p><p className="mt-1 text-[10px] opacity-65">{config.rewardDescription || 'Votre fidélité est récompensée.'}</p></div>
        </div>
      )}
      {config.rewards?.length ? (
        <div className="mt-3 space-y-2">
          {config.rewards.map(r => {
            const available = (config.pointsBalance ?? 0) >= r.points_required;
            return <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
              <div className="min-w-0"><p className="text-sm font-semibold">{r.name}</p><p className="mt-1 text-[10px] opacity-50">{r.description || `${r.points_required} points`}</p></div>
              <span className="shrink-0 rounded-full px-2.5 py-1 text-[9px] font-bold" style={{ color: available ? config.primaryColor : 'rgba(0,0,0,.45)', background: available ? config.secondaryColor + '30' : 'rgba(0,0,0,.05)' }}>{available ? 'Disponible' : `${r.points_required} pts`}</span>
            </div>;
          })}
        </div>
      ) : null}
    </Section>
  );
}

export function LoyaltyBenefits({ config }: { config: LoyaltyExperienceConfig }) {
  if (!config.benefits?.length) return null;
  return <Section title="Vos avantages" eyebrow="Exclusif"><div className="mt-3 grid gap-2 sm:grid-cols-3">{config.benefits.map((b,i) => <div key={b.title + i} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"><Sparkles size={16} style={{color:config.secondaryColor}}/><p className="mt-3 text-xs font-semibold">{b.title}</p><p className="mt-1 text-[10px] leading-4 opacity-50">{b.description}</p></div>)}</div></Section>;
}

export function LoyaltyOffers({ config }: { config: LoyaltyExperienceConfig }) {
  if (!config.offers?.length) return null;
  return <Section title="Offres pour vous" eyebrow="Aujourd’hui"><div className="space-y-2">{config.offers.map((o,i) => <div key={o.title+i} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"><p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{color:config.secondaryColor}}>{o.eyebrow || 'Offre exclusive'}</p><p className="mt-1 text-sm font-semibold">{o.title}</p>{o.description && <p className="mt-1 text-[10px] leading-4 opacity-50">{o.description}</p>}</div>)}</div></Section>;
}

export function LoyaltyHistory({ config }: { config: LoyaltyExperienceConfig }) {
  if (!config.history?.length) return null;
  return <Section title="Votre activité" eyebrow="Historique"><div className="mt-3 space-y-2">{config.history.slice(0,5).map(h => <div key={h.id} className="flex items-center justify-between rounded-2xl bg-white p-3.5"><div className="flex min-w-0 items-center gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl" style={{background:config.secondaryColor+'20',color:config.primaryColor}}><History size={15}/></div><div className="min-w-0"><p className="truncate text-xs font-medium">{h.title}</p><p className="mt-0.5 text-[10px] opacity-45">{h.date}</p></div></div><span className="ml-3 shrink-0 text-[10px] font-bold" style={{color:h.points && h.points < 0 ? '#b42318' : config.primaryColor}}>{h.points ? (h.points > 0 ? '+' : '') + h.points + ' pts' : 'Visite'}</span></div>)}</div></Section>;
}

export function LoyaltyFooter({ config }: { config: LoyaltyExperienceConfig }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState('');

  useEffect(() => {
    if (!open || !config.qrValue) return;
    void QRCode.toDataURL(config.qrValue, { width: 360, margin: 1 }).then(setQr).catch(() => setQr(''));
  }, [open, config.qrValue]);

  return <>
    <div className="mt-5 grid grid-cols-2 gap-2">
      <button type="button" onClick={() => setOpen(true)} className="flex items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-[10px] font-semibold shadow-sm"><QrCode size={15}/> Présenter ma carte</button>
      <button type="button" onClick={() => window.alert('Utilisez le menu de votre navigateur pour ajouter cette carte à votre écran d’accueil.')} className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-[10px] font-semibold text-white shadow-sm" style={{background:config.primaryColor}}><WalletCards size={15}/> Ajouter au téléphone</button>
    </div>
    {open && <div className="fixed inset-0 z-50 grid place-items-end bg-black/45 p-3 sm:place-items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="w-full max-w-sm rounded-[28px] bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[0.18em] text-ink/40">Présenter ma carte</p><h3 className="mt-1 text-lg font-semibold text-ink">Scannez ce QR code</h3></div><button type="button" onClick={() => setOpen(false)} className="rounded-full bg-ink/5 p-2"><X size={16}/></button></div>
        <div className="mt-5 grid place-items-center rounded-3xl bg-[#f7f7f3] p-5">{qr ? <img src={qr} alt="QR code de fidélité" className="h-64 w-64 rounded-2xl bg-white p-3" /> : <div className="h-64 w-64 animate-pulse rounded-2xl bg-black/5" />}</div>
        <p className="mt-4 text-center text-xs text-ink/45">Présentez votre écran au personnel pour enregistrer votre visite ou votre achat.</p>
      </div>
    </div>}
  </>;
}

function normalizeBusinessType(value?: string | null) {
  const v = (value || '').toLowerCase();
  if (v.includes('restaurant') || v.includes('restauration')) return 'restaurant';
  if (v.includes('cafe') || v.includes('café') || v.includes('coffee')) return 'cafe';
  if (v.includes('spa') || v.includes('bien-être') || v.includes('wellness')) return 'spa';
  if (v.includes('coiff') || v.includes('hair') || v.includes('barber')) return 'hairdresser';
  if (v.includes('hotel') || v.includes('hôtel') || v.includes('riad')) return 'hotel';
  if (v.includes('boutique') || v.includes('retail') || v.includes('shop')) return 'boutique';
  if (v.includes('gym') || v.includes('fitness') || v.includes('sport')) return 'gym';
  if (v.includes('boulanger') || v.includes('bakery') || v.includes('patisserie') || v.includes('pâtisserie')) return 'bakery';
  if (v.includes('voyage') || v.includes('travel') || v.includes('agence')) return 'travel';
  return 'default';
}

function SectorHero({ config, sector }: { config: LoyaltyExperienceConfig; sector: string }) {
  const labels: Record<string, string> = {
    restaurant: 'Table privilégiée',
    cafe: 'Club café',
    spa: 'Wellness member',
    hairdresser: 'Beauty member',
    hotel: 'Guest privilege',
    boutique: 'Private member',
    gym: 'Performance club',
    bakery: 'Club gourmand',
    travel: 'Travel member',
    default: 'Programme fidélité',
  };
  const label = labels[sector] || labels.default;

  if (sector === 'restaurant') {
    return (
      <div className="relative min-h-[250px] overflow-hidden text-white">
        {config.coverImageUrl ? <img src={config.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0" style={{ background: config.primaryColor }} />}
        <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${config.primaryColor}22 0%, ${config.primaryColor}f2 100%)` }} />
        <div className="relative flex min-h-[250px] flex-col justify-between p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              {config.logoUrl ? <img src={config.logoUrl} alt="" className="h-12 w-12 rounded-2xl bg-white object-contain p-1.5 shadow-xl" /> : <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 text-sm font-bold">{config.establishmentName.slice(0,2).toUpperCase()}</div>}
              <div><p className="text-sm font-semibold">{config.establishmentName}</p><p className="mt-1 text-[9px] uppercase tracking-[.2em] opacity-65">{label}</p></div>
            </div>
            <span className="rounded-full border border-white/20 bg-black/15 px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wider backdrop-blur"><Sparkles size={10} className="mr-1 inline" /> Gold</span>
          </div>
          <div>
            <p className="text-[9px] uppercase tracking-[.25em] opacity-60">Bonsoir, {config.customerName || 'Client'}</p>
            <h1 className="mt-1 max-w-[310px] text-3xl font-bold tracking-[-.04em]">Encore quelques visites.</h1>
            <p className="mt-2 max-w-[290px] text-xs leading-5 opacity-70">{config.intro || 'Votre fidélité mérite une vraie expérience.'}</p>
          </div>
        </div>
      </div>
    );
  }

  if (sector === 'cafe' || sector === 'bakery') {
    return (
      <div className="relative overflow-hidden p-5 sm:p-6" style={{ background: config.primaryColor, color: '#fff' }}>
        <div className="absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-15" style={{ background: config.secondaryColor }} />
        <div className="relative flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            {config.logoUrl ? <img src={config.logoUrl} alt="" className="h-11 w-11 rounded-xl bg-white object-contain p-1.5" /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-xs font-bold">{config.establishmentName.slice(0,2).toUpperCase()}</div>}
            <div className="min-w-0"><p className="truncate text-sm font-semibold">{config.establishmentName}</p><p className="mt-1 text-[9px] uppercase tracking-[.2em] opacity-55">{sector === 'cafe' ? 'Coffee club' : 'Club gourmand'}</p></div>
          </div>
          <span className="rounded-full bg-white/10 px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider">Member</span>
        </div>
        <div className="relative mt-8 flex items-end justify-between">
          <div><p className="text-[9px] uppercase tracking-[.2em] opacity-50">Bonjour</p><p className="mt-1 text-2xl font-bold">{config.customerName || 'Client'}</p></div>
          <div className="rounded-full px-3 py-1.5 text-[9px] font-bold" style={{ background: config.secondaryColor, color: config.primaryColor }}>Prochain cadeau</div>
        </div>
      </div>
    );
  }

  if (sector === 'spa' || sector === 'hairdresser') {
    return (
      <div className="relative min-h-[215px] overflow-hidden p-5 sm:p-6" style={{ color: '#fff' }}>
        {config.coverImageUrl ? <img src={config.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})` }} />}
        <div className="absolute inset-0 bg-black/25" />
        <div className="relative flex min-h-[180px] flex-col justify-between">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">{config.logoUrl && <img src={config.logoUrl} alt="" className="h-11 w-11 rounded-full bg-white object-contain p-1.5" />}<div><p className="text-sm font-semibold">{config.establishmentName}</p><p className="text-[9px] uppercase tracking-[.2em] opacity-60">{sector === 'spa' ? 'Wellness' : 'Beauty'}</p></div></div>
            <Star size={19} fill={config.secondaryColor} style={{ color: config.secondaryColor }} />
          </div>
          <div><p className="text-[9px] uppercase tracking-[.22em] opacity-60">Votre statut</p><p className="mt-1 text-3xl font-light tracking-[-.03em]">{config.currentTier || 'Signature'}</p><p className="mt-1 text-xs opacity-70">{config.customerName || 'Client'} · membre privilégié</p></div>
        </div>
      </div>
    );
  }

  if (sector === 'hotel' || sector === 'travel') {
    return (
      <div className="relative overflow-hidden p-5 sm:p-6" style={{ background: config.primaryColor, color: '#fff' }}>
        {config.coverImageUrl && <img src={config.coverImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />}
        <div className="absolute inset-0 bg-gradient-to-b from-black/5 to-black/25" />
        <div className="relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">{config.logoUrl ? <img src={config.logoUrl} alt="" className="h-11 w-11 rounded-xl bg-white object-contain p-1.5" /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-xs font-bold">{config.establishmentName.slice(0,2).toUpperCase()}</div>}<div><p className="text-sm font-semibold">{config.establishmentName}</p><p className="text-[9px] uppercase tracking-[.2em] opacity-55">{sector === 'hotel' ? 'Guest club' : 'Travel club'}</p></div></div>
            <span className="text-[9px] font-bold uppercase tracking-[.18em]" style={{ color: config.secondaryColor }}>{config.currentTier || 'Gold'}</span>
          </div>
          <div className="mt-12"><p className="text-[9px] uppercase tracking-[.22em] opacity-50">Bienvenue, {config.customerName || 'Client'}</p><p className="mt-1 text-3xl font-semibold tracking-[-.03em]">{config.rewardName || 'Vos privilèges vous attendent'}</p></div>
        </div>
      </div>
    );
  }

  return <LoyaltyHeader config={config} />;
}

function SectorProgress({ config, sector }: { config: LoyaltyExperienceConfig; sector: string }) {
  if (sector === 'cafe' || sector === 'bakery') {
    const current = config.visits ?? 0;
    const goal = Math.max(1, config.visitGoal ?? 8);
    const percent = clamp((current / goal) * 100, 0, 100);
    return <div className="relative -mt-7 mx-4 rounded-[26px] bg-white p-5 shadow-[0_16px_40px_rgba(0,0,0,.10)]">
      <div className="flex items-center justify-between"><div><p className="text-[9px] font-bold uppercase tracking-[.2em] text-black/40">Progression</p><p className="mt-1 text-4xl font-bold tracking-tight" style={{ color: config.primaryColor }}>{current}<span className="text-base text-black/25"> / {goal}</span></p></div><div className="grid h-14 w-14 place-items-center rounded-full border-4" style={{ borderColor: config.secondaryColor, background: `conic-gradient(${config.secondaryColor} ${percent}%, #eee ${percent}%)` }}><div className="grid h-9 w-9 place-items-center rounded-full bg-white text-[9px] font-bold">{Math.round(percent)}%</div></div></div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/7"><div className="h-full rounded-full transition-all duration-700" style={{ width: percent + '%', background: config.secondaryColor }} /></div>
      <p className="mt-3 text-[10px] text-black/45">{config.progressLabel || `Encore ${Math.max(0, goal-current)} visites avant votre cadeau.`}</p>
    </div>;
  }

  if (sector === 'spa' || sector === 'hairdresser') {
    const points = config.pointsBalance ?? 0;
    const goal = Math.max(points, config.pointsGoal ?? 1000);
    const percent = clamp((points / goal) * 100, 0, 100);
    return <div className="px-5 pt-5">
      <div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[.2em] opacity-40">Évolution</p><p className="mt-1 text-3xl font-semibold">{points.toLocaleString('fr-FR')} <span className="text-sm opacity-40">pts</span></p></div><div className="text-right"><p className="text-[9px] uppercase tracking-[.2em] opacity-40">Prochain niveau</p><p className="mt-1 text-sm font-semibold">{Math.max(0, goal-points).toLocaleString('fr-FR')} pts</p></div></div><div className="mt-4 h-1 overflow-hidden rounded-full bg-black/8"><div className="h-full rounded-full transition-all duration-700" style={{ width: percent + '%', background: config.secondaryColor }} /></div>
    </div>;
  }

  if (sector === 'hotel' || sector === 'travel') {
    const points = config.pointsBalance ?? 0;
    return <div className="mx-4 -mt-6 rounded-[24px] border border-white/10 bg-white p-5 shadow-[0_18px_45px_rgba(0,0,0,.12)]"><div className="grid grid-cols-2 gap-4"><div><p className="text-[9px] uppercase tracking-[.18em] text-black/35">{sector === 'hotel' ? 'Points séjour' : 'Points voyage'}</p><p className="mt-1 text-3xl font-semibold" style={{ color: config.primaryColor }}>{points.toLocaleString('fr-FR')}</p></div><div className="border-l border-black/8 pl-4"><p className="text-[9px] uppercase tracking-[.18em] text-black/35">Statut</p><p className="mt-1 text-xl font-semibold">{config.currentTier || 'Gold'}</p></div></div></div>;
  }

  return <div className="px-4"><LoyaltyProgress config={config} /></div>;
}

function SectorExtras({ config, sector }: { config: LoyaltyExperienceConfig; sector: string }) {
  if (sector === 'restaurant') {
    return <div className="mt-5 grid grid-cols-2 gap-2">{config.benefits?.slice(0,4).map((b,i) => <div key={b.title+i} className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md"><p className="text-[9px] uppercase tracking-[.15em] opacity-35">Privilège {i+1}</p><p className="mt-2 text-xs font-semibold">{b.title}</p><p className="mt-1 text-[10px] leading-4 opacity-45">{b.description}</p></div>)}</div>;
  }
  if (sector === 'hotel') return <div className="mt-5 rounded-[22px] p-5 text-white" style={{ background: config.primaryColor }}><p className="text-[9px] uppercase tracking-[.2em] opacity-50">Vos privilèges</p><div className="mt-3 flex flex-wrap gap-2">{(config.benefits || []).slice(0,4).map(b => <span key={b.title} className="rounded-full bg-white/10 px-3 py-2 text-[10px]">{b.title}</span>)}</div></div>;
  if (sector === 'gym') return <div className="mt-5 rounded-[22px] bg-black p-5 text-white"><div className="flex items-center justify-between"><div><p className="text-[9px] uppercase tracking-[.2em] opacity-45">Challenge</p><p className="mt-1 text-xl font-bold">Votre prochaine session</p></div><Trophy size={22} style={{color:config.secondaryColor}} /></div><p className="mt-3 text-xs opacity-55">{config.progressLabel || 'Continuez votre progression pour débloquer votre prochain badge.'}</p></div>;
  return null;
}



function PremiumWalletTemplate({ config }: { config: LoyaltyExperienceConfig }) {
  const [qr, setQr] = useState('');
  const template = config.templateId || 'obsidian';
  const points = config.pointsBalance ?? 0;
  const goal = Math.max(points, config.pointsGoal ?? 1000);
  const visits = config.visits ?? 0;
  const visitGoal = Math.max(1, config.visitGoal ?? 10);
  const progress = clamp(
    config.type === 'STAMP' || config.type === 'CHALLENGE' || config.type === 'COLLECTION'
      ? (visits / visitGoal) * 100
      : (points / goal) * 100,
    0,
    100,
  );
  const image = config.coverImageUrl;
  const establishment = config.establishmentName;
  const member = config.customerName || 'Membre privilégié';
  const title = config.rewardName || (config.type === 'STAMP' ? 'Encore quelques visites.' : 'Vos privilèges vous attendent.');
  const subtitle = config.intro || 'Vos privilèges, toujours avec vous.';
  const benefits = (config.benefits || []).slice(0, 3);
  const offers = (config.offers || []).slice(0, 1);

  useEffect(() => {
    if (!config.qrValue) return;
    void QRCode.toDataURL(config.qrValue, {
      width: 420,
      margin: 1,
      color: { dark: '#111111', light: '#ffffff' },
    }).then(setQr).catch(() => setQr(''));
  }, [config.qrValue]);

  const qrBlock = qr ? (
    <div className="rounded-[16px] bg-white p-2 shadow-xl">
      <img src={qr} alt="QR fidélité" className="h-full w-full rounded-[9px]" />
    </div>
  ) : (
    <div className="grid h-full w-full place-items-center rounded-[16px] border border-white/20 bg-white/10 text-[8px] uppercase tracking-[0.16em] text-white/60">QR</div>
  );

  const background = image ? (
    <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: 'url("' + image + '")' }} />
  ) : (
    <div className="absolute inset-0" style={{ background: config.primaryColor }} />
  );

  if (template === 'editorial') {
    return (
      <div className="relative mx-auto aspect-[0.72/1] w-full max-w-[430px] overflow-hidden text-[#17130f] shadow-[0_30px_90px_rgba(0,0,0,.28)]" style={{ borderRadius: config.borderRadius ?? 30 }}>
        {background}
        <div className="absolute inset-0 bg-gradient-to-b from-[#fff9ed]/20 via-[#f8f0e3]/10 to-[#f7efe2]/88" />
        <div className="relative z-10 flex h-full flex-col p-7 sm:p-8">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {config.logoUrl ? <img src={config.logoUrl} alt="" className="h-11 w-11 rounded-xl bg-white/85 object-contain p-1.5 shadow" /> : <div className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white/45 text-[10px] font-semibold">{establishment.slice(0,2).toUpperCase()}</div>}
              <div><p className="font-serif text-xl tracking-[-.03em]">{establishment}</p><p className="mt-1 text-[8px] uppercase tracking-[.3em] opacity-50">PRIVATE MEMBERSHIP</p></div>
            </div>
            <span className="rounded-full border border-black/15 bg-white/25 px-3 py-1.5 text-[8px] uppercase tracking-[.2em] backdrop-blur-md">Gold</span>
          </div>
          <div className="mt-auto">
            <p className="text-[9px] uppercase tracking-[.25em] opacity-50">Bonjour, {member}</p>
            <h1 className="mt-2 max-w-[320px] font-serif text-[40px] leading-[.94] tracking-[-.05em]">{title}</h1>
            <p className="mt-3 max-w-[280px] text-[10px] leading-5 opacity-65">{subtitle}</p>
            <div className="mt-6 rounded-[22px] border border-white/45 bg-white/30 p-4 shadow-lg backdrop-blur-xl">
              <div className="flex items-end justify-between"><div><p className="text-[8px] uppercase tracking-[.2em] opacity-50">Votre solde</p><p className="mt-1 text-2xl font-semibold">{config.type === 'STAMP' ? visits + ' / ' + visitGoal : points.toLocaleString('fr-FR') + ' pts'}</p></div><p className="font-serif text-lg">→</p></div>
              <div className="mt-3 h-1 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full" style={{ width: progress + '%', background: config.primaryColor }} /></div>
            </div>
            {benefits.length > 0 && <div className="mt-5"><p className="text-[8px] font-bold uppercase tracking-[.2em] opacity-45">Vos avantages exclusifs</p><div className="mt-2 grid grid-cols-3 gap-2">{benefits.map((b,i) => <div key={b.title+i} className="rounded-[16px] border border-white/45 bg-white/25 p-3 backdrop-blur-xl"><p className="text-[10px] font-semibold">{b.title}</p><p className="mt-1 line-clamp-2 text-[8px] leading-3.5 opacity-55">{b.description}</p></div>)}</div></div>}
            {offers.length > 0 && <div className="mt-4 rounded-[18px] border border-white/45 bg-white/25 p-4 backdrop-blur-xl"><p className="text-[8px] uppercase tracking-[.18em] opacity-45">{offers[0].eyebrow || 'Offre du moment'}</p><p className="mt-1 text-lg font-semibold">{offers[0].title}</p>{offers[0].description && <p className="mt-1 text-[9px] opacity-55">{offers[0].description}</p>}</div>}
          </div>
        </div>
      </div>
    );
  }

  if (template === 'glass') {
    return (
      <div className="relative mx-auto aspect-[0.72/1] w-full max-w-[430px] overflow-hidden text-white shadow-[0_30px_90px_rgba(0,0,0,.35)]" style={{ borderRadius: config.borderRadius ?? 30 }}>
        {background}<div className="absolute inset-0 bg-gradient-to-b from-black/25 via-black/10 to-black/72" /><div className="absolute inset-0 bg-[radial-gradient(circle_at_85%_15%,rgba(255,255,255,.18),transparent_28%)]" />
        <div className="relative z-10 flex h-full flex-col p-6 sm:p-7">
          <div className="flex items-start justify-between"><div className="flex items-center gap-3">{config.logoUrl ? <img src={config.logoUrl} alt="" className="h-11 w-11 rounded-full border border-white/40 bg-white object-contain p-1.5 shadow" /> : <div className="grid h-11 w-11 place-items-center rounded-full border border-white/35 bg-white/15 text-[10px] font-bold">{establishment.slice(0,2).toUpperCase()}</div>}<div><p className="text-sm font-semibold">{establishment}</p><p className="mt-1 text-[8px] uppercase tracking-[.25em] text-white/60">WELLNESS MEMBERSHIP</p></div></div><span className="text-[9px] uppercase tracking-[.2em] text-white/70">VIP</span></div>
          <div className="mt-auto"><p className="text-[9px] uppercase tracking-[.24em] text-white/55">Bonjour, {member}</p><p className="mt-2 max-w-[320px] text-[38px] font-light leading-[.98] tracking-[-.045em]">{title}</p><p className="mt-3 max-w-[285px] text-[10px] leading-5 text-white/70">{subtitle}</p>
            <div className="mt-6 rounded-[24px] border border-white/25 bg-white/[0.12] p-5 shadow-2xl backdrop-blur-2xl"><div className="flex items-end justify-between"><div><p className="text-[8px] uppercase tracking-[.2em] text-white/55">Votre solde</p><p className="mt-1 text-3xl font-semibold">{config.type === 'STAMP' ? visits + ' / ' + visitGoal : points.toLocaleString('fr-FR') + ' pts'}</p></div><div className="text-right"><p className="text-[8px] uppercase tracking-[.2em] text-white/55">Niveau</p><p className="mt-1 text-sm font-semibold">{config.currentTier || 'Gold'}</p></div></div><div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20"><div className="h-full rounded-full bg-white" style={{ width: progress + '%' }} /></div></div>
            {benefits.length > 0 && <div className="mt-5"><p className="text-[8px] font-bold uppercase tracking-[.2em] text-white/55">Vos avantages exclusifs</p><div className="mt-2 grid grid-cols-3 gap-2">{benefits.map((b,i)=><div key={b.title+i} className="rounded-[16px] border border-white/20 bg-white/[0.12] p-3 backdrop-blur-xl"><p className="text-[10px] font-semibold">{b.title}</p><p className="mt-1 line-clamp-2 text-[8px] leading-3.5 text-white/60">{b.description}</p></div>)}</div></div>}
            <div className="mt-5 flex items-end justify-between"><div><p className="text-[8px] uppercase tracking-[.2em] text-white/45">Membre</p><p className="mt-1 text-sm">{member}</p></div><div className="h-[70px] w-[70px]">{qrBlock}</div></div>
          </div>
        </div>
      </div>
    );
  }

  if (template === 'titanium') {
    return (
      <div className="relative mx-auto aspect-[0.72/1] w-full max-w-[430px] overflow-hidden bg-black text-white shadow-[0_30px_90px_rgba(0,0,0,.45)]" style={{ borderRadius: config.borderRadius ?? 26 }}>
        {background}<div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/20 to-black/90" /><div className="absolute inset-0 opacity-30" style={{ background: 'linear-gradient(135deg,transparent 0%,rgba(255,255,255,.15) 45%,transparent 47%,transparent 100%)' }} />
        <div className="relative z-10 flex h-full flex-col p-6 sm:p-7"><div className="flex items-start justify-between"><div><p className="text-[21px] font-semibold tracking-[.18em]">{establishment.toUpperCase()}</p><p className="mt-1 text-[8px] uppercase tracking-[.4em]" style={{ color: config.secondaryColor }}>BLACK MEMBER</p></div><div className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 bg-black/35 text-[9px]" style={{ color: config.secondaryColor }}>TM</div></div>
          <div className="mt-auto"><p className="text-[9px] uppercase tracking-[.3em] text-white/45">GOOD FOOD. BETTER PEOPLE.</p><p className="mt-2 max-w-[300px] text-[31px] font-semibold leading-[.98] tracking-[-.04em]">{title}</p>
            <div className="mt-6 rounded-[20px] border border-white/15 bg-black/45 p-4 backdrop-blur-md"><div className="flex justify-between"><div><p className="text-[8px] uppercase tracking-[.2em] text-white/40">Solde</p><p className="mt-1 text-3xl font-semibold">{config.type === 'STAMP' ? visits + '/' + visitGoal : points.toLocaleString('fr-FR')}</p></div><div className="text-right"><p className="text-[8px] uppercase tracking-[.2em] text-white/40">Prochaine récompense</p><p className="mt-1 max-w-[120px] text-[10px]" style={{ color: config.secondaryColor }}>{config.rewardName || 'Votre récompense'}</p></div></div><div className="mt-4 h-px bg-white/15"><div className="h-px" style={{ width: progress + '%', background: config.secondaryColor }} /></div></div>
            {benefits.length > 0 && <div className="mt-5"><p className="text-[8px] uppercase tracking-[.2em] text-white/45">Vos avantages</p><div className="mt-2 grid grid-cols-3 gap-2">{benefits.map((b,i)=><div key={b.title+i} className="rounded-[15px] border border-white/15 bg-black/30 p-3 backdrop-blur-md"><p className="text-[10px] font-semibold">{b.title}</p><p className="mt-1 line-clamp-2 text-[8px] leading-3.5 text-white/50">{b.description}</p></div>)}</div></div>}
            <div className="mt-5 flex items-end justify-between"><p className="text-[8px] uppercase tracking-[.28em] text-white/45">{member}</p><div className="h-[68px] w-[68px]">{qrBlock}</div></div>
          </div>
        </div>
      </div>
    );
  }

  if (template === 'hospitality') {
    return (
      <div className="relative mx-auto aspect-[0.72/1] w-full max-w-[430px] overflow-hidden text-white shadow-[0_30px_90px_rgba(0,0,0,.3)]" style={{ borderRadius: config.borderRadius ?? 30 }}>
        {background}<div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/10 to-black/78" />
        <div className="relative z-10 flex h-full flex-col p-6 sm:p-7"><div className="flex items-center justify-between"><div className="flex items-center gap-3">{config.logoUrl ? <img src={config.logoUrl} alt="" className="h-11 w-11 rounded-xl bg-white object-contain p-1.5" /> : <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/10 text-xs font-bold">{establishment.slice(0,2).toUpperCase()}</div>}<div><p className="font-serif text-xl">{establishment}</p><p className="mt-1 text-[8px] uppercase tracking-[.32em] text-white/65">HOSPITALITY CLUB</p></div></div><span className="rounded-full border border-white/25 bg-black/15 px-3 py-1.5 text-[8px] uppercase tracking-[.2em] backdrop-blur">Gold</span></div>
          <div className="mt-auto"><p className="text-[9px] uppercase tracking-[.22em] text-white/55">Bonsoir, {member}</p><p className="mt-2 font-serif text-[38px] leading-[.95] tracking-[-.04em]">{title}</p><p className="mt-3 max-w-[280px] text-[10px] leading-5 text-white/70">{subtitle}</p>
            <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[22px] border border-white/20 bg-white/15"><div className="bg-black/20 p-4 backdrop-blur-md"><p className="text-[8px] uppercase tracking-[.18em] text-white/45">Solde</p><p className="mt-1 text-2xl font-semibold">{config.type === 'STAMP' ? visits + '/' + visitGoal : points.toLocaleString('fr-FR')}</p></div><div className="bg-black/20 p-4 backdrop-blur-md"><p className="text-[8px] uppercase tracking-[.18em] text-white/45">Statut</p><p className="mt-1 text-2xl font-semibold">{config.currentTier || 'Gold'}</p></div></div>
            {benefits.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2">{benefits.map((b,i)=><div key={b.title+i} className="rounded-[15px] border border-white/20 bg-white/[0.12] p-3 backdrop-blur-md"><p className="text-[10px] font-semibold">{b.title}</p><p className="mt-1 line-clamp-2 text-[8px] leading-3.5 text-white/55">{b.description}</p></div>)}</div>}
            <div className="mt-5 flex items-end justify-between"><div><p className="text-[8px] uppercase tracking-[.2em] text-white/45">Membre</p><p className="mt-1 text-sm">{member}</p></div><div className="h-[68px] w-[68px]">{qrBlock}</div></div>
          </div>
        </div>
      </div>
    );
  }

  if (template === 'apple-wallet') {
    return (
      <div className="relative mx-auto aspect-[0.72/1] w-full max-w-[430px] overflow-hidden text-[#1b1a18] shadow-[0_30px_90px_rgba(0,0,0,.22)]" style={{ borderRadius: config.borderRadius ?? 28 }}>
        {background}<div className="absolute inset-0 bg-gradient-to-b from-white/35 via-white/50 to-[#f4f0e8]/88" />
        <div className="relative z-10 flex h-full flex-col p-7"><div className="flex items-start justify-between"><div className="flex items-center gap-3">{config.logoUrl ? <img src={config.logoUrl} alt="" className="h-11 w-11 rounded-xl bg-white/80 object-contain p-1.5 shadow" /> : <div className="grid h-11 w-11 place-items-center rounded-xl border border-black/10 bg-white/50 text-[10px] font-bold">{establishment.slice(0,2).toUpperCase()}</div>}<div><p className="text-sm font-semibold">{establishment}</p><p className="mt-1 text-[8px] uppercase tracking-[.24em] opacity-45">PREMIUM MEMBER</p></div></div><p className="text-[9px] uppercase tracking-[.2em] opacity-45">PRIVILEGE</p></div>
          <div className="mt-auto"><p className="text-[9px] uppercase tracking-[.22em] opacity-45">Bonjour, {member}</p><p className="mt-2 font-serif text-[38px] leading-[.95] tracking-[-.045em]">{title}</p><p className="mt-3 max-w-[280px] text-[10px] leading-5 opacity-60">{subtitle}</p>
            <div className="mt-6 border-t border-black/10 pt-4"><div className="flex justify-between text-[8px] uppercase tracking-[.18em] opacity-45"><span>Votre fidélité</span><span>{Math.round(progress)}%</span></div><div className="mt-3 h-1 overflow-hidden rounded-full bg-black/10"><div className="h-full rounded-full" style={{ width: progress + '%', background: config.primaryColor }} /></div></div>
            {benefits.length > 0 && <div className="mt-5"><p className="text-[8px] font-bold uppercase tracking-[.2em] opacity-45">Vos avantages exclusifs</p><div className="mt-2 grid grid-cols-3 gap-2">{benefits.map((b,i)=><div key={b.title+i} className="rounded-[15px] border border-black/10 bg-white/35 p-3 backdrop-blur-md"><p className="text-[10px] font-semibold">{b.title}</p><p className="mt-1 line-clamp-2 text-[8px] leading-3.5 opacity-55">{b.description}</p></div>)}</div></div>}
            <div className="mt-5 flex items-end justify-between"><div><p className="text-[8px] uppercase tracking-[.2em] opacity-45">Membre</p><p className="mt-1 text-sm font-medium">{member}</p></div><div className="h-[68px] w-[68px]">{qrBlock}</div></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto aspect-[0.72/1] w-full max-w-[430px] overflow-hidden text-white shadow-[0_30px_90px_rgba(0,0,0,.45)]" style={{ borderRadius: config.borderRadius ?? 30 }}>
      {background}
      <div className="absolute inset-0 bg-gradient-to-b from-black/52 via-black/12 to-black/88" />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 78% 12%, ' + config.secondaryColor + '55, transparent 25%)' }} />
      <div className="relative z-10 flex h-full flex-col p-5 sm:p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {config.logoUrl ? <img src={config.logoUrl} alt="" className="h-12 w-12 rounded-2xl border border-white/35 bg-white object-contain p-1.5 shadow-xl" /> : <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/30 bg-white/15 text-[10px] font-bold">{establishment.slice(0,2).toUpperCase()}</div>}
            <div><p className="text-sm font-semibold">{establishment}</p><p className="mt-1 text-[8px] uppercase tracking-[.28em] text-white/55">TABLE PRIVILÉGIÉE</p></div>
          </div>
          <span className="rounded-full border border-white/25 bg-black/20 px-3 py-1.5 text-[8px] font-bold uppercase tracking-[.16em] backdrop-blur-md">✦ GOLD</span>
        </div>
        <div className="mt-7"><p className="text-[9px] font-bold uppercase tracking-[.28em] text-white/60">Bonsoir, {member}</p><h1 className="mt-2 max-w-[330px] font-serif text-[39px] leading-[.92] tracking-[-.05em] sm:text-[44px]">{title}</h1><p className="mt-3 max-w-[300px] text-[10px] leading-5 text-white/70">{subtitle}</p></div>
        <div className="mt-6 rounded-[22px] border border-white/40 bg-white/[0.16] p-4 shadow-2xl backdrop-blur-2xl">
          <div className="flex items-end justify-between"><div><p className="text-[8px] uppercase tracking-[.2em] text-white/60">Votre solde</p><p className="mt-1 text-3xl font-semibold">{config.type === 'STAMP' ? visits + ' / ' + visitGoal : points.toLocaleString('fr-FR') + ' pts'}</p></div><div className="text-right"><p className="text-[8px] uppercase tracking-[.18em] text-white/55">Prochaine récompense</p><p className="mt-1 text-[11px] font-semibold">{config.rewardName || 'Cadeau fidélité'}</p></div></div>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-black/25"><div className="h-full rounded-full" style={{ width: progress + '%', background: config.secondaryColor }} /></div>
        </div>
        {benefits.length > 0 && <div className="mt-5"><div className="flex items-center justify-between"><p className="text-[9px] font-bold uppercase tracking-[.22em] text-white/70">Vos avantages exclusifs</p><span className="text-[8px] text-white/45">Voir tout</span></div><div className="mt-2 grid grid-cols-3 gap-2">{benefits.map((b,i)=><div key={b.title+i} className="rounded-[17px] border border-white/25 bg-white/[0.13] p-3 backdrop-blur-xl"><div className="mb-2 text-[13px]" style={{ color: config.secondaryColor }}>✦</div><p className="text-[10px] font-semibold leading-4">{b.title}</p><p className="mt-1 line-clamp-2 text-[8px] leading-3.5 text-white/55">{b.description}</p></div>)}</div></div>}
        {offers.length > 0 && <div className="mt-4 rounded-[19px] border border-white/25 bg-black/20 p-4 backdrop-blur-xl"><div className="flex items-center justify-between"><div><p className="text-[8px] uppercase tracking-[.18em] text-white/45">{offers[0].eyebrow || 'Offre du moment'}</p><p className="mt-1 text-base font-semibold">{offers[0].title}</p>{offers[0].description && <p className="mt-1 text-[9px] text-white/55">{offers[0].description}</p>}</div><span className="text-xl text-white/75">›</span></div></div>}
        <div className="mt-auto flex items-end justify-between pt-5"><div><p className="text-[8px] uppercase tracking-[.2em] text-white/45">Membre</p><p className="mt-1 text-sm">{member}</p><p className="mt-1 text-[8px] uppercase tracking-[.14em] text-white/40">Scannez pour profiter de vos avantages</p></div><div className="h-[66px] w-[66px]">{qrBlock}</div></div>
      </div>
    </div>
  );
}

export function LoyaltyExperience({ config }: { config: LoyaltyExperienceConfig }) {
  const premiumIds = new Set(['obsidian', 'editorial', 'glass', 'titanium', 'hospitality', 'apple-wallet', 'luxury', 'minimal', 'elegant', 'modern', 'bold', 'classic', 'wallet-premium']);
  if (premiumIds.has(config.templateId || '')) return <PremiumWalletTemplate config={config} />;

  const radius = config.borderRadius ?? 28;
  const sector = normalizeBusinessType(config.businessType);
  const compact = sector === 'cafe' || sector === 'bakery';

  return (
    <div className="relative mx-auto w-full max-w-[430px] overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,.14)]" style={{ borderRadius: radius }}>
      {config.coverImageUrl ? (
        <>
          <div className="pointer-events-none absolute inset-0 z-0 bg-cover bg-center" style={{ backgroundImage: 'url("' + config.coverImageUrl + '")', backgroundPosition: 'center', backgroundSize: 'cover', backgroundRepeat: 'no-repeat' }} />
          <div className="pointer-events-none absolute inset-0 z-0" style={{ background: 'linear-gradient(180deg, ' + config.primaryColor + '99 0%, ' + config.primaryColor + '55 38%, ' + config.backgroundColor + 'e8 72%, ' + config.backgroundColor + 'f5 100%)' }} />
        </>
      ) : <div className="pointer-events-none absolute inset-0 z-0" style={{ background: config.backgroundColor }} />}
      <div className="relative z-10 min-h-full" style={{ color: config.textColor }}>
        <SectorHero config={{ ...config, coverImageUrl: null }} sector={sector} />
        <SectorProgress config={config} sector={sector} />
        <div className={compact ? 'px-4 pb-6 pt-1 sm:px-5' : 'px-4 pb-6 pt-5 sm:px-5'}>
          <LoyaltyReward config={config} /><SectorExtras config={config} sector={sector} /><LoyaltyBenefits config={config} /><LoyaltyOffers config={config} /><LoyaltyHistory config={config} /><LoyaltyFooter config={config} />
          <p className="pt-5 text-center text-[8px] font-semibold uppercase tracking-[0.2em] opacity-35">by Tap Marrakech</p>
        </div>
      </div>
    </div>
  );
}
