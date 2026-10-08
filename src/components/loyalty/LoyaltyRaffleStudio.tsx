import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Ban, CalendarDays, CheckCircle2, Clock3, Gift, Plus, Ticket, Trophy, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props = { establishmentId: string };

type Raffle = {
  id: string;
  title: string;
  description: string | null;
  prize_name: string;
  prize_description: string | null;
  starts_at: string;
  draw_at: string;
  winners_count: number;
  participation_mode: string;
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
  minimum_tier_key: 'STANDARD'|'BRONZE'|'SILVER'|'GOLD'|'PLATINUM';
  ticket_multiplier_mode: 'TIER'|'ONE';
};

type Winner = {
  id: string;
  customer_id: string;
  rank: number;
  prize_name: string;
  valid_from: string;
  valid_until: string;
  status: 'PENDING' | 'REDEEMED' | 'EXPIRED';
  customer?: { first_name: string; last_name: string | null; phone: string } | null;
};

const inputClass = 'h-12 w-full rounded-xl border border-[#242424]/10 bg-[#111111] px-4 text-sm font-medium text-[#E1C27A] outline-none focus:border-[#C9A45C]/50 focus:ring-2 focus:ring-[#C9A45C]/10 placeholder:text-[#FFFFFF]/25';
const labelClass = 'mb-2 block text-[10px] font-semibold uppercase tracking-[.12em] text-[#FFFFFF]/40';

function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

function statusLabel(status: Raffle['status']) {
  return status === 'SCHEDULED' ? 'Programmée' : status === 'DRAWN' ? 'Tirée' : status === 'CANCELLED' ? 'Annulée' : 'Brouillon';
}

export default function LoyaltyRaffleStudio({ establishmentId }: Props) {
  const [raffles, setRaffles] = useState<Raffle[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [winners, setWinners] = useState<Winner[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const tomorrow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(20, 0, 0, 0);
    return localInputValue(d);
  }, []);

  const defaultDay = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, []);

  const [form, setForm] = useState({
    title: '',
    description: '',
    prizeName: '',
    prizeDescription: '',
    drawAt: tomorrow,
    winnersCount: 1,
    minimumTier: 'STANDARD' as Raffle['minimum_tier_key'],
    ticketMode: 'TIER' as Raffle['ticket_multiplier_mode'],
    validityMode: 'DATE_RANGE' as Raffle['reward_validity_mode'],
    validDay: defaultDay,
    validFrom: defaultDay + 'T09:00',
    validUntil: defaultDay + 'T23:00',
    validDays: 7,
    reservationRequired: false,
    singleUse: true,
    nonCumulative: true,
  });

  const load = async () => {
    if (!establishmentId) return;
    setLoading(true);
    const { data, error } = await supabase.rpc('get_loyalty_raffles', { p_establishment_id: establishmentId });
    if (error) {
      setMessage(error.message);
    } else {
      setRaffles((data ?? []) as Raffle[]);
    }
    setLoading(false);
  };

  const loadWinners = async (raffleId: string) => {
    setSelectedId(raffleId);
    const { data, error } = await supabase
      .from('loyalty_raffle_winners')
      .select('id,customer_id,rank,prize_name,valid_from,valid_until,status,customer:loyalty_customers(first_name,last_name,phone)')
      .eq('raffle_id', raffleId)
      .order('rank');
    if (error) setMessage(error.message);
    else setWinners((data ?? []) as unknown as Winner[]);
  };

  useEffect(() => { void load(); }, [establishmentId]);

  const resetForm = () => {
    setForm(current => ({ ...current, title: '', description: '', prizeName: '', prizeDescription: '' }));
  };

  const buildValidity = () => {
    if (form.validityMode === 'ONE_DAY') {
      const start = new Date(form.validDay + 'T00:00');
      const end = new Date(form.validDay + 'T23:59');
      return { from: start.toISOString(), until: end.toISOString(), days: null };
    }
    if (form.validityMode === 'DATE_RANGE') {
      const from = new Date(form.validFrom);
      const until = new Date(form.validUntil);
      return { from: from.toISOString(), until: until.toISOString(), days: null };
    }
    return { from: new Date(form.drawAt).toISOString(), until: new Date(new Date(form.drawAt).getTime() + form.validDays * 86400000).toISOString(), days: form.validDays };
  };

  const createRaffle = async () => {
    if (!form.title.trim() || !form.prizeName.trim()) {
      setMessage('Renseignez le nom de la tombola et le cadeau.');
      return;
    }
    const drawAt = new Date(form.drawAt);
    if (Number.isNaN(drawAt.getTime()) || drawAt.getTime() <= Date.now()) {
      setMessage('La date du tirage doit être dans le futur.');
      return;
    }
    const validity = buildValidity();
    if (new Date(validity.until).getTime() <= new Date(validity.from).getTime()) {
      setMessage('La période de validité du cadeau est invalide.');
      return;
    }

    setSaving(true);
    setMessage('');
    const { error } = await supabase.rpc('create_loyalty_raffle', {
      p_establishment_id: establishmentId,
      p_title: form.title.trim(),
      p_description: form.description.trim() || null,
      p_prize_name: form.prizeName.trim(),
      p_prize_description: form.prizeDescription.trim() || null,
      p_starts_at: new Date().toISOString(),
      p_draw_at: drawAt.toISOString(),
      p_winners_count: Math.max(1, Math.min(100, Math.floor(form.winnersCount))),
      p_minimum_tier_key: form.minimumTier,
      p_ticket_multiplier_mode: form.ticketMode,
      p_reward_validity_mode: form.validityMode,
      p_reward_valid_from: validity.from,
      p_reward_valid_until: validity.until,
      p_reward_valid_days: validity.days,
      p_reservation_required: form.reservationRequired,
      p_single_use: form.singleUse,
      p_non_cumulative: form.nonCumulative,
    });
    setSaving(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage('Tombola programmée. Le tirage sera effectué automatiquement.');
    resetForm();
    await load();
  };

  const cancelRaffle = async (raffleId: string) => {
    const { error } = await supabase.rpc('cancel_loyalty_raffle', { p_raffle_id: raffleId });
    if (error) setMessage(error.message);
    else {
      setMessage('Tombola annulée.');
      await load();
    }
  };

  const redeemWinner = async (winnerId: string) => {
    const { error } = await supabase.rpc('redeem_loyalty_raffle_winner', { p_winner_id: winnerId });
    if (error) setMessage(error.message);
    else {
      setMessage('Récompense marquée comme utilisée.');
      if (selectedId) await loadWinners(selectedId);
      await load();
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-3">
        <Metric icon={<Ticket size={16} />} label="Tombolas" value={raffles.length} />
        <Metric icon={<Clock3 size={16} />} label="Programmées" value={raffles.filter(r => r.status === 'SCHEDULED').length} />
        <Metric icon={<Trophy size={16} />} label="Gagnants" value={raffles.reduce((sum, r) => sum + Number(r.winner_count || 0), 0)} />
      </div>

      <section className="rounded-3xl border border-[#242424]/10 bg-[#111111] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#C9A45C]">Nouvelle tombola</p>
            <h2 className="mt-1 text-lg font-semibold text-[#E1C27A]">Créer une expérience gagnante</h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-5 text-[#FFFFFF]/40">KELYANI sélectionnera automatiquement les gagnants à la date prévue et leur enverra une notification directement sur leur carte.</p>
          </div>
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[#C9A45C]/10 text-[#C9A45C]"><Gift size={17} /></div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <Field label="Nom de la tombola"><input className={inputClass} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="Grande Tombola Octobre" /></Field>
          <Field label="Récompense"><input className={inputClass} value={form.prizeName} onChange={e => setForm({ ...form, prizeName: e.target.value })} placeholder="Dîner pour 2 personnes" /></Field>
          <Field label="Date et heure du tirage"><input type="datetime-local" className={inputClass} value={form.drawAt} onChange={e => setForm({ ...form, drawAt: e.target.value })} /></Field>
          <Field label="Nombre de gagnants"><input type="number" min="1" max="100" className={inputClass} value={form.winnersCount} onChange={e => setForm({ ...form, winnersCount: Math.max(1, Math.min(100, Number(e.target.value) || 1)) })} /></Field>
          <div className="md:col-span-2"><Field label="Description"><textarea className={inputClass + ' h-24 resize-none py-3'} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Tous les clients inscrits au programme fidélité participent automatiquement." /></Field></div>
          <Field label="Description du cadeau"><input className={inputClass} value={form.prizeDescription} onChange={e => setForm({ ...form, prizeDescription: e.target.value })} placeholder="Un dîner pour deux, menu au choix..." /></Field>
          <Field label="Niveau minimum">
            <select className={inputClass} value={form.minimumTier} onChange={e=>setForm({...form,minimumTier:e.target.value as Raffle['minimum_tier_key']})}>
              <option value="STANDARD">⚪ Standard — tous les clients</option><option value="BRONZE">🥉 Bronze+</option><option value="SILVER">🥈 Silver+</option><option value="GOLD">🥇 Gold+</option><option value="PLATINUM">💎 Platinum uniquement</option>
            </select>
          </Field>
          <Field label="Chances de tirage">
            <select className={inputClass} value={form.ticketMode} onChange={e=>setForm({...form,ticketMode:e.target.value as Raffle['ticket_multiplier_mode']})}>
              <option value="TIER">Selon le niveau du client</option><option value="ONE">1 chance par client</option>
            </select>
          </Field>
        </div>

        <div className="mt-5 rounded-2xl border border-[#C9A45C]/15 bg-[#C9A45C]/5 p-4">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#E1C27A]"><CalendarDays size={15} /> Validité du cadeau</div>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {[
              ['ONE_DAY', 'Une journée'],
              ['DATE_RANGE', 'Une période'],
              ['DAYS_AFTER_DRAW', 'X jours après le tirage'],
            ].map(([value, label]) => (
              <button key={value} type="button" onClick={() => setForm({ ...form, validityMode: value as Raffle['reward_validity_mode'] })} className={`rounded-xl border px-3 py-3 text-left text-xs font-semibold transition ${form.validityMode === value ? 'border-[#C9A45C]/50 bg-[#C9A45C]/10 text-[#E1C27A]' : 'border-[#242424]/10 text-[#FFFFFF]/40 hover:border-[#C9A45C]/25'}`}>
                {label}
              </button>
            ))}
          </div>

          {form.validityMode === 'ONE_DAY' && <div className="mt-3 max-w-sm"><Field label="Jour d'utilisation"><input type="date" className={inputClass} value={form.validDay} onChange={e => setForm({ ...form, validDay: e.target.value })} /></Field></div>}
          {form.validityMode === 'DATE_RANGE' && <div className="mt-3 grid gap-3 md:grid-cols-2"><Field label="Valable à partir de"><input type="datetime-local" className={inputClass} value={form.validFrom} onChange={e => setForm({ ...form, validFrom: e.target.value })} /></Field><Field label="Valable jusqu'au"><input type="datetime-local" className={inputClass} value={form.validUntil} onChange={e => setForm({ ...form, validUntil: e.target.value })} /></Field></div>}
          {form.validityMode === 'DAYS_AFTER_DRAW' && <div className="mt-3 max-w-sm"><Field label="Nombre de jours"><input type="number" min="1" max="365" className={inputClass} value={form.validDays} onChange={e => setForm({ ...form, validDays: Math.max(1, Math.min(365, Number(e.target.value) || 1)) })} /></Field></div>}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <Toggle label="Réservation obligatoire" checked={form.reservationRequired} onChange={value => setForm({ ...form, reservationRequired: value })} />
          <Toggle label="Utilisable une seule fois" checked={form.singleUse} onChange={value => setForm({ ...form, singleUse: value })} />
          <Toggle label="Non cumulable" checked={form.nonCumulative} onChange={value => setForm({ ...form, nonCumulative: value })} />
        </div>

        <div className="mt-5 flex justify-end">
          <button type="button" onClick={() => void createRaffle()} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-5 py-3 text-xs font-bold text-[#050505] disabled:opacity-50">
            <Plus size={15} /> {saving ? 'Programmation...' : 'Programmer la tombola'}
          </button>
        </div>
      </section>

      <section className="rounded-3xl border border-[#242424]/10 bg-[#111111] p-5">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#C9A45C]">Historique</p><h2 className="mt-1 text-lg font-semibold text-[#E1C27A]">Vos tombolas</h2></div>
          {loading && <span className="text-[10px] text-[#FFFFFF]/35">Chargement...</span>}
        </div>
        <div className="mt-4 space-y-2">
          {!loading && raffles.length === 0 && <div className="rounded-2xl border border-dashed border-[#242424]/10 px-5 py-10 text-center text-xs text-[#FFFFFF]/35">Aucune tombola programmée.</div>}
          {raffles.map(raffle => (
            <div key={raffle.id} className="rounded-2xl border border-[#242424]/10 bg-[#0b0b0b] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-[#E1C27A]">{raffle.title}</p>
                    <span className="rounded-full bg-[#C9A45C]/10 px-2 py-1 text-[8px] font-bold uppercase tracking-[.12em] text-[#C9A45C]">{statusLabel(raffle.status)}</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#FFFFFF]/40">🎁 {raffle.prize_name} · 🎟️ {raffle.participant_count} · {raffle.minimum_tier_key} minimum · chances par niveau participants · 🏆 {raffle.winner_count}/{raffle.winners_count} gagnant(s)</p>
                  <p className="mt-1 text-[10px] text-[#FFFFFF]/30">Tirage : {formatDate(raffle.draw_at)}</p>
                </div>
                <div className="flex items-center gap-2">
                  {(raffle.status === 'DRAWN') && <button type="button" onClick={() => void loadWinners(raffle.id)} className="rounded-xl border border-[#C9A45C]/20 px-3 py-2 text-[10px] font-semibold text-[#E1C27A]">Voir les gagnants</button>}
                  {raffle.status === 'SCHEDULED' && <button type="button" onClick={() => void cancelRaffle(raffle.id)} className="rounded-xl border border-red-500/20 px-3 py-2 text-[10px] font-semibold text-red-300"><Ban size={13} /></button>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {selectedId && (
        <section className="rounded-3xl border border-[#C9A45C]/15 bg-[#111111] p-5">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#C9A45C]">Résultat</p><h2 className="mt-1 text-lg font-semibold text-[#E1C27A]">Gagnants de la tombola</h2></div>
            <button type="button" onClick={() => { setSelectedId(null); setWinners([]); }} className="rounded-xl p-2 text-[#FFFFFF]/30 hover:text-white"><X size={17} /></button>
          </div>
          <div className="mt-4 space-y-2">
            {winners.length === 0 && <p className="rounded-2xl bg-[#0b0b0b] p-5 text-center text-xs text-[#FFFFFF]/35">Aucun gagnant disponible.</p>}
            {winners.map(winner => (
              <div key={winner.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-[#242424]/10 bg-[#0b0b0b] p-4">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#C9A45C]/10 text-[#C9A45C]"><Trophy size={17} /></div>
                <div className="min-w-[160px] flex-1">
                  <p className="text-xs font-semibold text-[#E1C27A]">#{winner.rank} · {winner.customer ? [winner.customer.first_name, winner.customer.last_name].filter(Boolean).join(' ') : 'Client'}</p>
                  <p className="mt-1 text-[10px] text-[#FFFFFF]/35">{winner.customer?.phone || '—'} · valable jusqu'au {formatDate(winner.valid_until)}</p>
                </div>
                {winner.status === 'PENDING' ? <button type="button" onClick={() => void redeemWinner(winner.id)} className="inline-flex items-center gap-2 rounded-xl bg-[#C9A45C] px-3 py-2 text-[10px] font-bold text-[#050505]"><CheckCircle2 size={13} /> Marquer utilisé</button> : <span className={`rounded-full px-2.5 py-1 text-[8px] font-bold uppercase tracking-[.12em] ${winner.status === 'REDEEMED' ? 'bg-emerald-500/10 text-emerald-300' : 'bg-red-500/10 text-red-300'}`}>{winner.status === 'REDEEMED' ? 'Utilisé' : 'Expiré'}</span>}
              </div>
            ))}
          </div>
        </section>
      )}

      {message && <div className="flex items-center justify-between gap-3 rounded-2xl border border-[#C9A45C]/15 bg-[#C9A45C]/5 px-4 py-3 text-xs text-[#E1C27A]"><span>{message}</span><button type="button" onClick={() => setMessage('')}><X size={14} /></button></div>}
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div><label className={labelClass}>{label}</label>{children}</div>;
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <button type="button" onClick={() => onChange(!checked)} className={`flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-3 text-left ${checked ? 'border-[#C9A45C]/35 bg-[#C9A45C]/5' : 'border-[#242424]/10 bg-[#111111]'}`}>
    <span className="text-[10px] font-semibold text-[#E1C27A]">{label}</span>
    <span className={`h-5 w-9 rounded-full p-0.5 transition ${checked ? 'bg-[#C9A45C]' : 'bg-[#242424]'}`}><span className={`block h-4 w-4 rounded-full bg-white transition ${checked ? 'translate-x-4' : ''}`} /></span>
  </button>;
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return <div className="rounded-2xl border border-[#242424]/10 bg-[#111111] p-4"><div className="flex items-center gap-2 text-[#C9A45C]">{icon}<span className="text-[9px] font-bold uppercase tracking-[.16em] text-[#FFFFFF]/35">{label}</span></div><p className="mt-2 text-2xl font-semibold text-[#E1C27A]">{value}</p></div>;
}
