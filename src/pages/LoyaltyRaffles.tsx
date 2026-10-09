import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Check,
  ChevronDown,
  Crown,
  Gift,
  Layers3,
  Plus,
  Save,
  Ticket,
  Trophy,
  X,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Establishment = { id: string; name: string };

type Tier = {
  id: string;
  tier_key: 'STANDARD' | 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  name: string;
  sort_order: number;
  min_total_points: number;
  min_rewards_redeemed: number;
  qualification_mode: 'OR' | 'AND';
  ticket_multiplier: number;
  active: boolean;
};

type Raffle = {
  id: string;
  title: string;
  description: string | null;
  prize_name: string;
  prize_description: string | null;
  starts_at: string;
  draw_at: string;
  winners_count: number;
  reward_validity_mode: 'ONE_DAY' | 'DATE_RANGE' | 'DAYS_AFTER_DRAW';
  reward_valid_from: string | null;
  reward_valid_until: string | null;
  reward_valid_days: number | null;
  reservation_required: boolean;
  single_use: boolean;
  non_cumulative: boolean;
  status: 'DRAFT' | 'SCHEDULED' | 'DRAWN' | 'CANCELLED';
  drawn_at: string | null;
  participant_count: number;
  winner_count: number;
  minimum_tier_key: Tier['tier_key'];
  ticket_multiplier_mode: 'TIER' | 'ONE';
};

const tierMeta: Record<Tier['tier_key'], { label: string; icon: typeof Crown }> = {
  STANDARD: { label: 'Standard', icon: Layers3 },
  BRONZE: { label: 'Bronze', icon: Ticket },
  SILVER: { label: 'Silver', icon: Trophy },
  GOLD: { label: 'Gold', icon: Crown },
  PLATINUM: { label: 'Platinum', icon: Crown },
};

function toLocalInput(value: Date) {
  const offset = value.getTimezoneOffset();
  return new Date(value.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.14em] text-[#F5F5DC]/40">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputClass =
  'w-full rounded-xl border border-[#2A2A2A] bg-[#0B0B0B] px-3.5 py-3 text-sm text-white outline-none transition focus:border-[#C9A45C]/70';
const selectClass = inputClass;

export default function LoyaltyRaffles() {
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [establishmentId, setEstablishmentId] = useState('');
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [tab, setTab] = useState<'raffles' | 'tiers'>('raffles');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedRaffle, setExpandedRaffle] = useState<string | null>(null);

  const now = useMemo(() => new Date(), []);
  const defaultStart = useMemo(() => toLocalInput(new Date(now.getTime() + 5 * 60_000)), [now]);
  const defaultDraw = useMemo(() => toLocalInput(new Date(now.getTime() + 24 * 60 * 60_000)), [now]);

  const [form, setForm] = useState({
    title: '',
    description: '',
    prizeName: '',
    prizeDescription: '',
    startsAt: defaultStart,
    drawAt: defaultDraw,
    winnersCount: 1,
    minimumTier: 'STANDARD' as Tier['tier_key'],
    ticketMode: 'TIER' as 'TIER' | 'ONE',
    validityMode: 'DAYS_AFTER_DRAW' as Raffle['reward_validity_mode'],
    validFrom: '',
    validUntil: '',
    validDays: 7,
    reservationRequired: false,
    singleUse: true,
    nonCumulative: true,
  });

  useEffect(() => {
    void loadEstablishments();
  }, []);

  useEffect(() => {
    if (establishmentId) void loadData();
  }, [establishmentId]);

  async function loadEstablishments() {
    setLoading(true);
    const { data, error } = await supabase.rpc('get_my_establishments');
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const rows = (data ?? []) as Establishment[];
    setEstablishments(rows);
    setEstablishmentId((current) => current || rows[0]?.id || '');
    if (!rows.length) setLoading(false);
  }

  async function loadData() {
    setLoading(true);
    const [{ data: tierData, error: tierError }, { data: raffleData, error: raffleError }] =
      await Promise.all([
        supabase.rpc('get_loyalty_tiers', { p_establishment_id: establishmentId }),
        supabase.rpc('get_loyalty_raffles', { p_establishment_id: establishmentId }),
      ]);

    if (tierError) console.error('Erreur niveaux fidélité:', tierError);
    if (raffleError) console.error('Erreur tombolas:', raffleError);

    setTiers((tierData ?? []) as Tier[]);
    setRaffles((raffleData ?? []) as Raffle[]);
    setLoading(false);
  }

  function resetForm() {
    setForm({
      title: '',
      description: '',
      prizeName: '',
      prizeDescription: '',
      startsAt: defaultStart,
      drawAt: defaultDraw,
      winnersCount: 1,
      minimumTier: 'STANDARD',
      ticketMode: 'TIER',
      validityMode: 'DAYS_AFTER_DRAW',
      validFrom: '',
      validUntil: '',
      validDays: 7,
      reservationRequired: false,
      singleUse: true,
      nonCumulative: true,
    });
  }

  async function createRaffle() {
    if (!establishmentId) return;
    if (!form.title.trim() || !form.prizeName.trim()) {
      alert('Le titre et le lot sont obligatoires.');
      return;
    }

    const startsAt = new Date(form.startsAt);
    const drawAt = new Date(form.drawAt);

    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(drawAt.getTime()) || drawAt <= startsAt) {
      alert('La date du tirage doit être postérieure au début de la tombola.');
      return;
    }

    let validFrom: string | null = null;
    let validUntil: string | null = null;

    if (form.validityMode === 'DATE_RANGE' || form.validityMode === 'ONE_DAY') {
      const from = new Date(form.validFrom);
      const until = new Date(form.validUntil);

      if (Number.isNaN(from.getTime()) || Number.isNaN(until.getTime()) || until < from) {
        alert('La période de validité de la récompense est invalide.');
        return;
      }

      validFrom = from.toISOString();
      validUntil = until.toISOString();
    }

    setSaving(true);
    const { error } = await supabase.rpc('create_loyalty_raffle', {
      p_establishment_id: establishmentId,
      p_title: form.title.trim(),
      p_description: form.description.trim() || null,
      p_prize_name: form.prizeName.trim(),
      p_prize_description: form.prizeDescription.trim() || null,
      p_starts_at: startsAt.toISOString(),
      p_draw_at: drawAt.toISOString(),
      p_winners_count: Math.min(100, Math.max(1, Number(form.winnersCount))),
      p_reward_validity_mode: form.validityMode,
      p_reward_valid_from: validFrom,
      p_reward_valid_until: validUntil,
      p_reward_valid_days: form.validityMode === 'DAYS_AFTER_DRAW' ? Math.min(365, Math.max(1, Number(form.validDays))) : null,
      p_reservation_required: form.reservationRequired,
      p_single_use: form.singleUse,
      p_non_cumulative: form.nonCumulative,
      p_minimum_tier_key: form.minimumTier,
      p_ticket_multiplier_mode: form.ticketMode,
    });
    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }

    setShowCreate(false);
    resetForm();
    await loadData();
  }

  async function cancelRaffle(id: string) {
    if (!window.confirm('Annuler cette tombola ?')) return;
    const { error } = await supabase.rpc('cancel_loyalty_raffle', { p_raffle_id: id });
    if (error) {
      alert(error.message);
      return;
    }
    await loadData();
  }

  async function saveTier(tier: Tier) {
    setSaving(true);
    const { error } = await supabase.rpc('update_loyalty_tier', {
      p_tier_id: tier.id,
      p_name: tier.name.trim(),
      p_min_points: Math.max(0, Number(tier.min_total_points)),
      p_min_rewards: Math.max(0, Number(tier.min_rewards_redeemed)),
      p_mode: tier.qualification_mode,
      p_ticket_multiplier: Math.min(100, Math.max(1, Number(tier.ticket_multiplier))),
      p_active: tier.active,
    });
    setSaving(false);

    if (error) {
      alert(error.message);
      return;
    }
    await loadData();
  }

  function updateTier(id: string, patch: Partial<Tier>) {
    setTiers((current) => current.map((tier) => (tier.id === id ? { ...tier, ...patch } : tier)));
  }

  if (loading && !establishments.length) {
    return <div className="min-h-[420px] animate-pulse rounded-3xl bg-[#111111]" />;
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-[#C9A45C]">KELYANI · Fidélité</p>
          <h1 className="mt-2 font-display text-4xl text-white">Tombola & niveaux</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[#F5F5DC]/45">
            Classez automatiquement vos clients selon leur fidélité et donnez aux meilleurs profils davantage de chances de gagner.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {establishments.length > 1 && (
            <select value={establishmentId} onChange={(e) => setEstablishmentId(e.target.value)} className="rounded-xl border border-[#2A2A2A] bg-[#111111] px-3 py-2.5 text-xs text-white outline-none">
              {establishments.map((establishment) => <option key={establishment.id} value={establishment.id}>{establishment.name}</option>)}
            </select>
          )}
          <button type="button" onClick={() => { resetForm(); setShowCreate(true); }} className="inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-4 py-2.5 text-xs font-semibold text-[#050505] transition hover:bg-[#E1C27A]">
            <Plus size={15} /> Nouvelle tombola
          </button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#F5F5DC]/35">Niveaux actifs</p>
          <p className="mt-2 text-3xl font-semibold text-white">{tiers.filter((tier) => tier.active).length}</p>
          <p className="mt-1 text-xs text-[#F5F5DC]/40">Standard → Platinum</p>
        </div>
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#F5F5DC]/35">Tombolas</p>
          <p className="mt-2 text-3xl font-semibold text-white">{raffles.length}</p>
          <p className="mt-1 text-xs text-[#F5F5DC]/40">{raffles.filter((raffle) => raffle.status === 'SCHEDULED').length} programmée(s)</p>
        </div>
        <div className="rounded-2xl border border-[#242424] bg-[#111111] p-5">
          <p className="text-[10px] uppercase tracking-[0.16em] text-[#F5F5DC]/35">Principe</p>
          <p className="mt-2 text-3xl font-semibold text-[#E1C27A]">×{Math.max(1, ...tiers.map((tier) => Number(tier.ticket_multiplier) || 1))}</p>
          <p className="mt-1 text-xs text-[#F5F5DC]/40">maximum de tickets selon le niveau</p>
        </div>
      </div>

      <div className="flex gap-1 rounded-2xl border border-[#242424] bg-[#0B0B0B] p-1">
        <button type="button" onClick={() => setTab('raffles')} className={`flex-1 rounded-xl px-4 py-3 text-xs font-semibold transition ${tab === 'raffles' ? 'bg-[#191919] text-[#E1C27A]' : 'text-[#F5F5DC]/40 hover:text-white'}`}>
          <Ticket className="mr-2 inline" size={15} /> Tombolas
        </button>
        <button type="button" onClick={() => setTab('tiers')} className={`flex-1 rounded-xl px-4 py-3 text-xs font-semibold transition ${tab === 'tiers' ? 'bg-[#191919] text-[#E1C27A]' : 'text-[#F5F5DC]/40 hover:text-white'}`}>
          <Crown className="mr-2 inline" size={15} /> Niveaux clients
        </button>
      </div>

      {tab === 'tiers' ? (
        <section className="rounded-3xl border border-[#242424] bg-[#111111] p-5 md:p-7">
          <div className="mb-6 flex flex-col justify-between gap-3 md:flex-row md:items-end">
            <div>
              <h2 className="text-xl font-semibold text-white">Classification automatique</h2>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-[#F5F5DC]/40">
                Un client atteint un niveau lorsque ses points cumulés <strong className="text-[#F5F5DC]/60">ou</strong> ses récompenses récupérées atteignent le seuil. Le niveau le plus élevé atteint est retenu.
              </p>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {tiers.map((tier) => {
              const MetaIcon = tierMeta[tier.tier_key]?.icon ?? Ticket;
              return (
                <div key={tier.id} className="rounded-2xl border border-[#242424] bg-[#0B0B0B] p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#C9A45C]/10 text-[#E1C27A]"><MetaIcon size={19} /></div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.15em] text-[#C9A45C]">{tier.tier_key}</p>
                        <input value={tier.name} onChange={(e) => updateTier(tier.id, { name: e.target.value })} className="mt-1 bg-transparent text-lg font-semibold text-white outline-none" />
                      </div>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] text-[#F5F5DC]/45">
                      <input type="checkbox" checked={tier.active} onChange={(e) => updateTier(tier.id, { active: e.target.checked })} />
                      Actif
                    </label>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Field label="Points cumulés minimum"><input type="number" min="0" value={tier.min_total_points} onChange={(e) => updateTier(tier.id, { min_total_points: Number(e.target.value) })} className={inputClass} /></Field>
                    <Field label="Récompenses récupérées"><input type="number" min="0" value={tier.min_rewards_redeemed} onChange={(e) => updateTier(tier.id, { min_rewards_redeemed: Number(e.target.value) })} className={inputClass} /></Field>
                    <Field label="Mode de qualification"><select value={tier.qualification_mode} onChange={(e) => updateTier(tier.id, { qualification_mode: e.target.value as Tier['qualification_mode'] })} className={selectClass}><option value="OR">L'un ou l'autre</option><option value="AND">Les deux</option></select></Field>
                    <Field label="Tickets tombola"><input type="number" min="1" max="100" value={tier.ticket_multiplier} onChange={(e) => updateTier(tier.id, { ticket_multiplier: Number(e.target.value) })} className={inputClass} /></Field>
                  </div>

                  <button type="button" disabled={saving} onClick={() => void saveTier(tier)} className="mt-4 inline-flex items-center gap-2 rounded-xl border border-[#C9A45C]/30 px-3 py-2 text-xs font-semibold text-[#E1C27A] hover:bg-[#C9A45C]/10 disabled:opacity-40">
                    <Save size={14} /> Enregistrer
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : (
        <section className="space-y-4">
          {raffles.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-[#2A2A2A] bg-[#111111] px-6 py-16 text-center">
              <Trophy size={30} className="mx-auto text-[#C9A45C]/50" />
              <h2 className="mt-4 text-lg font-semibold text-white">Aucune tombola</h2>
              <p className="mt-1 text-xs text-[#F5F5DC]/40">Créez votre première tombola fidélité.</p>
            </div>
          ) : raffles.map((raffle) => (
            <div key={raffle.id} className="overflow-hidden rounded-3xl border border-[#242424] bg-[#111111]">
              <button type="button" onClick={() => setExpandedRaffle(expandedRaffle === raffle.id ? null : raffle.id)} className="flex w-full items-center justify-between gap-4 p-5 text-left md:p-6">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#C9A45C]/10 text-[#E1C27A]"><Gift size={20} /></div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="truncate text-base font-semibold text-white">{raffle.title}</h2>
                      <span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${raffle.status === 'SCHEDULED' ? 'bg-[#C9A45C]/10 text-[#E1C27A]' : raffle.status === 'DRAWN' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-white/5 text-white/40'}`}>{raffle.status}</span>
                    </div>
                    <p className="mt-1 text-xs text-[#F5F5DC]/45">Lot : {raffle.prize_name} · Tirage : {formatDate(raffle.draw_at)}</p>
                  </div>
                </div>
                <ChevronDown size={18} className={`shrink-0 text-white/30 transition ${expandedRaffle === raffle.id ? 'rotate-180' : ''}`} />
              </button>

              {expandedRaffle === raffle.id && (
                <div className="border-t border-[#242424] p-5 md:p-6">
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-2xl bg-[#0B0B0B] p-4"><p className="text-[9px] uppercase tracking-[0.15em] text-white/30">Participants</p><p className="mt-1 text-2xl font-semibold text-white">{raffle.participant_count}</p></div>
                    <div className="rounded-2xl bg-[#0B0B0B] p-4"><p className="text-[9px] uppercase tracking-[0.15em] text-white/30">Gagnants</p><p className="mt-1 text-2xl font-semibold text-white">{raffle.winner_count}/{raffle.winners_count}</p></div>
                    <div className="rounded-2xl bg-[#0B0B0B] p-4"><p className="text-[9px] uppercase tracking-[0.15em] text-white/30">Niveau minimum</p><p className="mt-1 text-sm font-semibold text-[#E1C27A]">{tierMeta[raffle.minimum_tier_key]?.label ?? raffle.minimum_tier_key}</p></div>
                    <div className="rounded-2xl bg-[#0B0B0B] p-4"><p className="text-[9px] uppercase tracking-[0.15em] text-white/30">Tickets</p><p className="mt-1 text-sm font-semibold text-[#E1C27A]">{raffle.ticket_multiplier_mode === 'TIER' ? 'Selon le niveau' : '1 par client'}</p></div>
                  </div>
                  {raffle.description && <p className="mt-5 text-sm leading-6 text-white/55">{raffle.description}</p>}
                  <div className="mt-5 flex flex-wrap gap-2 text-[10px] text-white/40">
                    <span className="rounded-full border border-[#242424] px-3 py-1.5">Lot : {raffle.prize_name}</span>
                    {raffle.reservation_required && <span className="rounded-full border border-[#242424] px-3 py-1.5">Réservation obligatoire</span>}
                    {raffle.single_use && <span className="rounded-full border border-[#242424] px-3 py-1.5">Utilisable une fois</span>}
                    {raffle.non_cumulative && <span className="rounded-full border border-[#242424] px-3 py-1.5">Non cumulable</span>}
                  </div>
                  {raffle.status === 'SCHEDULED' && (
                    <button type="button" onClick={() => void cancelRaffle(raffle.id)} className="mt-5 inline-flex items-center gap-2 rounded-xl border border-red-500/20 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10">
                      <X size={14} /> Annuler la tombola
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-[#2A2A2A] bg-[#111111] p-6 shadow-[0_30px_100px_rgba(0,0,0,.7)] md:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#C9A45C]">KELYANI</p>
                <h2 className="mt-1 text-xl font-semibold text-white">Créer une tombola</h2>
                <p className="mt-1 text-xs text-white/40">La sélection est faite automatiquement au moment du tirage.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} className="grid h-9 w-9 place-items-center rounded-full border border-[#2A2A2A] text-white/50 hover:text-white"><X size={16} /></button>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Field label="Titre"><input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Tombola de fidélité — Octobre" className={inputClass} /></Field>
              <Field label="Lot"><input value={form.prizeName} onChange={(e) => setForm({ ...form, prizeName: e.target.value })} placeholder="Dîner offert pour 2" className={inputClass} /></Field>
              <Field label="Description"><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} className={inputClass} /></Field>
              <Field label="Description du lot"><textarea value={form.prizeDescription} onChange={(e) => setForm({ ...form, prizeDescription: e.target.value })} rows={3} className={inputClass} /></Field>
              <Field label="Début"><input type="datetime-local" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} className={inputClass} /></Field>
              <Field label="Tirage"><input type="datetime-local" value={form.drawAt} onChange={(e) => setForm({ ...form, drawAt: e.target.value })} className={inputClass} /></Field>
              <Field label="Nombre de gagnants"><input type="number" min="1" max="100" value={form.winnersCount} onChange={(e) => setForm({ ...form, winnersCount: Number(e.target.value) })} className={inputClass} /></Field>
              <Field label="Niveau minimum"><select value={form.minimumTier} onChange={(e) => setForm({ ...form, minimumTier: e.target.value as Tier['tier_key'] })} className={selectClass}>{tiers.filter((tier) => tier.active).map((tier) => <option key={tier.tier_key} value={tier.tier_key}>{tier.name}</option>)}</select></Field>
              <Field label="Chances"><select value={form.ticketMode} onChange={(e) => setForm({ ...form, ticketMode: e.target.value as 'TIER' | 'ONE' })} className={selectClass}><option value="TIER">Selon le niveau du client</option><option value="ONE">1 chance par client</option></select></Field>
              <Field label="Validité de la récompense"><select value={form.validityMode} onChange={(e) => setForm({ ...form, validityMode: e.target.value as Raffle['reward_validity_mode'] })} className={selectClass}><option value="DAYS_AFTER_DRAW">X jours après le tirage</option><option value="DATE_RANGE">Période personnalisée</option><option value="ONE_DAY">Un jour</option></select></Field>

              {form.validityMode === 'DAYS_AFTER_DRAW' ? (
                <Field label="Nombre de jours"><input type="number" min="1" max="365" value={form.validDays} onChange={(e) => setForm({ ...form, validDays: Number(e.target.value) })} className={inputClass} /></Field>
              ) : (
                <>
                  <Field label="Valable à partir du"><input type="datetime-local" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} className={inputClass} /></Field>
                  <Field label="Valable jusqu'au"><input type="datetime-local" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className={inputClass} /></Field>
                </>
              )}
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                ['reservationRequired', 'Réservation obligatoire', form.reservationRequired],
                ['singleUse', 'Utilisable une fois', form.singleUse],
                ['nonCumulative', 'Non cumulable', form.nonCumulative],
              ].map(([key, label, checked]) => (
                <label key={String(key)} className="flex cursor-pointer items-center gap-3 rounded-2xl border border-[#242424] bg-[#0B0B0B] p-4 text-xs text-white/60">
                  <input type="checkbox" checked={Boolean(checked)} onChange={(e) => setForm({ ...form, [String(key)]: e.target.checked } as typeof form)} />
                  {label}
                </label>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-xl border border-[#2A2A2A] px-4 py-2.5 text-xs font-semibold text-white/60 hover:text-white">Annuler</button>
              <button type="button" disabled={saving} onClick={() => void createRaffle()} className="inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-5 py-2.5 text-xs font-semibold text-[#050505] disabled:opacity-40"><Check size={14} /> {saving ? 'Création...' : 'Programmer la tombola'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
