import { useEffect, useState } from 'react';
import { Gift, History, QrCode, Sparkles, Star, Ticket, Trophy, WalletCards, X } from 'lucide-react';
import QRCode from 'qrcode';
import type { ReactNode } from 'react';

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
      <div className="rounded-[24px] border border-black/6 bg-white/80 p-5 shadow-[0_10px_30px_rgba(0,0,0,.06)] backdrop-blur">
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
      <div className="rounded-[24px] border border-black/6 bg-white/80 p-5 shadow-[0_10px_30px_rgba(0,0,0,.06)] backdrop-blur">
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
      <div className="rounded-[24px] border border-black/6 bg-white/80 p-5 shadow-[0_10px_30px_rgba(0,0,0,.06)]">
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
        <div className="mt-3 flex items-center gap-4 rounded-[22px] p-4 text-white shadow-lg" style={{ background: config.primaryColor }}>
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl" style={{ background: config.secondaryColor + '35', color: config.secondaryColor }}><Gift size={23}/></div>
          <div className="min-w-0"><p className="text-[9px] uppercase tracking-[0.16em] opacity-55">Prochaine récompense</p><p className="mt-1 text-lg font-semibold">{reward}</p><p className="mt-1 text-[10px] opacity-65">{config.rewardDescription || 'Votre fidélité est récompensée.'}</p></div>
        </div>
      )}
      {config.rewards?.length ? (
        <div className="mt-3 space-y-2">
          {config.rewards.map(r => {
            const available = (config.pointsBalance ?? 0) >= r.points_required;
            return <div key={r.id} className="flex items-center justify-between gap-3 rounded-2xl border border-black/6 bg-white p-4">
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
  return <Section title="Vos avantages" eyebrow="Exclusif"><div className="mt-3 grid gap-2 sm:grid-cols-3">{config.benefits.map((b,i) => <div key={b.title + i} className="rounded-2xl border border-black/6 bg-white p-4"><Sparkles size={16} style={{color:config.secondaryColor}}/><p className="mt-3 text-xs font-semibold">{b.title}</p><p className="mt-1 text-[10px] leading-4 opacity-50">{b.description}</p></div>)}</div></Section>;
}

export function LoyaltyOffers({ config }: { config: LoyaltyExperienceConfig }) {
  if (!config.offers?.length) return null;
  return <Section title="Offres pour vous" eyebrow="Aujourd’hui"><div className="space-y-2">{config.offers.map((o,i) => <div key={o.title+i} className="rounded-2xl border border-black/6 bg-white p-4"><p className="text-[9px] font-bold uppercase tracking-[0.16em]" style={{color:config.secondaryColor}}>{o.eyebrow || 'Offre exclusive'}</p><p className="mt-1 text-sm font-semibold">{o.title}</p>{o.description && <p className="mt-1 text-[10px] leading-4 opacity-50">{o.description}</p>}</div>)}</div></Section>;
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

export function LoyaltyExperience({ config }: { config: LoyaltyExperienceConfig }) {
  const radius = config.borderRadius ?? 28;
  return (
    <div className="mx-auto w-full max-w-[430px] overflow-hidden bg-white shadow-[0_25px_80px_rgba(0,0,0,.14)]" style={{ borderRadius: radius }}>
      <div style={{ background: config.backgroundColor, color: config.textColor }}>
        <LoyaltyHeader config={config} />
        <div className="px-4 pb-6 sm:px-5">
          <LoyaltyProgress config={config} />
          <LoyaltyReward config={config} />
          <LoyaltyBenefits config={config} />
          <LoyaltyOffers config={config} />
          <LoyaltyHistory config={config} />
          <LoyaltyFooter config={config} />
          <p className="pt-5 text-center text-[8px] font-semibold uppercase tracking-[0.2em] opacity-35">by Tap Marrakech</p>
        </div>
      </div>
    </div>
  );
}
