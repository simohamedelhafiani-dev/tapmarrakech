import { useEffect, useMemo, useState } from 'react';
import { Download, Loader2, RefreshCw, Users, UserCheck, AlertTriangle, UserX, Cake, Star, QrCode, X } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';

type Customer = {
  id: string;
  first_name: string;
  last_name: string | null;
  phone: string;
  email: string | null;
  points_balance: number;
  visit_count: number;
  last_visit_at: string | null;
  birth_day: number | null;
  birth_month: number | null;
  marketing_consent: boolean;
  notification_consent: boolean;
  preferred_channel: string;
  created_at: string;
};

type SegmentId = 'all' | 'active' | 'at_risk' | 'inactive' | 'birthdays' | 'loyal';

const SEGMENTS: { id: SegmentId; label: string; hint: string; icon: typeof Users }[] = [
  { id: 'all', label: 'Tous les clients', hint: 'Base complète', icon: Users },
  { id: 'active', label: 'Actifs', hint: 'Visite dans les 30 jours', icon: UserCheck },
  { id: 'at_risk', label: 'À risque', hint: 'Dernière visite il y a 31 à 60 jours', icon: AlertTriangle },
  { id: 'inactive', label: 'Inactifs', hint: 'Aucune visite depuis plus de 60 jours', icon: UserX },
  { id: 'birthdays', label: 'Anniversaires', hint: 'Anniversaire aujourd’hui', icon: Cake },
  { id: 'loyal', label: 'Clients fidèles', hint: '5 visites ou plus, ou 500 points', icon: Star },
];

function daysSince(value: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  return '"' + text.replace(/"/g, '""') + '"';
}

export default function LoyaltyCrmSegments({ establishmentId }: { establishmentId: string }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [segment, setSegment] = useState<SegmentId>('all');
  const [query, setQuery] = useState('');
  const [recoveryQr, setRecoveryQr] = useState<{ url: string; name: string; phone: string; expiresAt: string } | null>(null);
  const [recoveryLoadingId, setRecoveryLoadingId] = useState<string | null>(null);

  const load = async () => {
    if (!establishmentId) return;
    setLoading(true);
    setError('');
    try {
      // Fetch in bounded pages so CRM counts, segments and CSV exports cover the
      // entire establishment, not only Supabase's first response page.
      const pageSize = 500;
      const allCustomers: Customer[] = [];
      for (let from = 0; ; from += pageSize) {
        const { data, error: requestError } = await supabase
          .from('loyalty_customers')
          .select('id,first_name,last_name,phone,email,points_balance,visit_count,last_visit_at,birth_day,birth_month,marketing_consent,notification_consent,preferred_channel,created_at')
          .eq('establishment_id', establishmentId)
          .order('last_visit_at', { ascending: false, nullsFirst: false })
          .order('id', { ascending: true })
          .range(from, from + pageSize - 1);
        if (requestError) throw requestError;
        const page = (data ?? []) as Customer[];
        allCustomers.push(...page);
        if (page.length < pageSize) break;
      }
      setCustomers(allCustomers);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de charger les clients.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [establishmentId]);

  const filtered = useMemo(() => {
    const now = new Date();
    const needle = query.trim().toLocaleLowerCase();
    return customers.filter(customer => {
      const lastVisit = customer.last_visit_at ? new Date(customer.last_visit_at).getTime() : Number.NaN;
      const cutoff30 = Date.now() - 30 * 86_400_000;
      const cutoff60 = Date.now() - 60 * 86_400_000;
      let inSegment = true;
      if (segment === 'active') inSegment = Number.isFinite(lastVisit) && lastVisit >= cutoff30;
      if (segment === 'at_risk') inSegment = Number.isFinite(lastVisit) && lastVisit < cutoff30 && lastVisit >= cutoff60;
      if (segment === 'inactive') inSegment = !Number.isFinite(lastVisit) || lastVisit < cutoff60;
      if (segment === 'birthdays') {
        const moroccoDate = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Casablanca' }));
        inSegment = customer.birth_day === moroccoDate.getDate() && customer.birth_month === moroccoDate.getMonth() + 1;
      }
      if (segment === 'loyal') inSegment = customer.visit_count >= 5 || customer.points_balance >= 500;
      const fullName = [customer.first_name, customer.last_name ?? ''].join(' ').toLocaleLowerCase();
      const matchesSearch = !needle || fullName.includes(needle) || customer.phone.includes(needle) || (customer.email ?? '').toLocaleLowerCase().includes(needle);
      return inSegment && matchesSearch;
    });
  }, [customers, segment, query]);

  const createRecoveryQr = async (customer: Customer) => {
    setRecoveryLoadingId(customer.id);
    try {
      const { data, error: requestError } = await supabase.rpc('create_loyalty_card_recovery_session', {
        p_customer_id: customer.id,
      });
      if (requestError) throw requestError;
      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.recovery_token) throw new Error('Aucun lien de récupération n’a été généré.');
      const url = window.location.origin + '/loyalty/recover?token=' + encodeURIComponent(String(row.recovery_token));
      const qrDataUrl = await QRCode.toDataURL(url, { width: 360, margin: 2 });
      setRecoveryQr({
        url: qrDataUrl,
        name: [customer.first_name, customer.last_name ?? ''].join(' ').trim() || 'Client',
        phone: customer.phone,
        expiresAt: String(row.expires_at ?? ''),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impossible de générer le QR de récupération.');
    } finally {
      setRecoveryLoadingId(null);
    }
  };

  const exportCsv = () => {
    const rows = [
      ['Prénom', 'Nom', 'Téléphone', 'Email', 'Points', 'Visites', 'Dernière visite', 'Jour naissance', 'Mois naissance', 'Consentement marketing', 'Consentement notifications', 'Canal préféré'],
      ...filtered.map(c => [c.first_name, c.last_name, c.phone, c.email, c.points_balance, c.visit_count, c.last_visit_at, c.birth_day, c.birth_month, c.marketing_consent, c.notification_consent, c.preferred_channel]),
    ];
    const csv = '\uFEFF' + rows.map(row => row.map(csvCell).join(';')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'kelyani-clients-' + segment + '.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const counts = useMemo(() => {
    const now = new Date();
    return {
      total: customers.length,
      active: customers.filter(c => { const t = c.last_visit_at ? new Date(c.last_visit_at).getTime() : Number.NaN; return Number.isFinite(t) && t >= Date.now() - 30 * 86_400_000; }).length,
      atRisk: customers.filter(c => { const t = c.last_visit_at ? new Date(c.last_visit_at).getTime() : Number.NaN; return Number.isFinite(t) && t < Date.now() - 30 * 86_400_000 && t >= Date.now() - 60 * 86_400_000; }).length,
      inactive: customers.filter(c => { const t = c.last_visit_at ? new Date(c.last_visit_at).getTime() : Number.NaN; return !Number.isFinite(t) || t < Date.now() - 60 * 86_400_000; }).length,
      birthdays: customers.filter(c => {
        const moroccoDate = new Date(now.toLocaleString('en-US', { timeZone: 'Africa/Casablanca' }));
        return c.birth_day === moroccoDate.getDate() && c.birth_month === moroccoDate.getMonth() + 1;
      }).length,
    };
  }, [customers]);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#C9A45C]">CRM client</p>
          <h3 className="mt-1 text-2xl font-semibold text-[#E1C27A]">Segmentation intelligente</h3>
          <p className="mt-1 max-w-2xl text-sm text-white/50">Identifiez les clients actifs, ceux à réactiver et les anniversaires à venir à partir des données de fidélité disponibles.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-3 py-2.5 text-xs font-semibold text-white/80 hover:bg-white/5 disabled:opacity-50"><RefreshCw size={14} /> Actualiser</button>
          <button type="button" onClick={exportCsv} disabled={loading || filtered.length === 0} className="inline-flex items-center gap-2 rounded-xl bg-[#D4AF37] px-3 py-2.5 text-xs font-bold text-black hover:brightness-110 disabled:opacity-40"><Download size={14} /> Exporter CSV ({filtered.length})</button>
        </div>
      </div>

      {error && <div role="alert" className="rounded-xl border border-red-400/20 bg-red-400/10 p-3 text-sm text-red-200">{error}</div>}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: 'Total clients', value: counts.total, icon: Users },
          { label: 'Actifs · 30 j', value: counts.active, icon: UserCheck },
          { label: 'À risque · 31–60 j', value: counts.atRisk, icon: AlertTriangle },
          { label: 'Inactifs · +60 j', value: counts.inactive, icon: UserX },
          { label: 'Anniversaires aujourd’hui', value: counts.birthdays, icon: Cake },
        ].map(item => { const Icon = item.icon; return (
          <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[.025] p-4">
            <div className="flex items-center justify-between gap-2 text-white/45"><span className="text-xs">{item.label}</span><Icon size={15} className="text-[#D4AF37]" /></div>
            <p className="mt-3 text-2xl font-semibold tabular-nums text-white">{loading ? '—' : item.value}</p>
          </div>
        ); })}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher un nom, téléphone ou email…" className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-sm text-white outline-none placeholder:text-white/30 focus:border-[#D4AF37]/50" />
        <div className="text-xs self-center text-white/45">{filtered.length} client(s) dans ce segment</div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {SEGMENTS.map(item => { const Icon = item.icon; const active = segment === item.id; return (
          <button key={item.id} type="button" onClick={() => setSegment(item.id)} className={'rounded-2xl border p-4 text-left transition ' + (active ? 'border-[#D4AF37]/60 bg-[#D4AF37]/[.08]' : 'border-white/10 bg-white/[.02] hover:border-white/20')}>
            <div className="flex items-center gap-2"><Icon size={16} className={active ? 'text-[#D4AF37]' : 'text-white/45'} /><span className="text-sm font-semibold text-white">{item.label}</span></div>
            <p className="mt-2 text-xs leading-5 text-white/45">{item.hint}</p>
          </button>
        ); })}
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-white/[.04] text-xs text-white/45"><tr><th className="px-4 py-3 font-medium">Client</th><th className="px-4 py-3 font-medium">Points</th><th className="px-4 py-3 font-medium">Visites</th><th className="px-4 py-3 font-medium">Dernière visite</th><th className="px-4 py-3 font-medium">Anniversaire</th><th className="px-4 py-3 font-medium">Consentements</th><th className="px-4 py-3 font-medium">Carte</th></tr></thead>
            <tbody className="divide-y divide-white/[.06]">
              {loading ? <tr><td colSpan={7} className="px-4 py-10 text-center text-white/45"><Loader2 className="mx-auto mb-2 animate-spin" size={18} />Chargement des clients…</td></tr> :
                filtered.length === 0 ? <tr><td colSpan={6} className="px-4 py-10 text-center text-white/45">Aucun client dans ce segment.</td></tr> :
                filtered.slice(0, 100).map(c => <tr key={c.id} className="hover:bg-white/[.025]">
                  <td className="px-4 py-3"><div className="font-medium text-white">{c.first_name} {c.last_name ?? ''}</div><div className="mt-1 text-xs text-white/40">{c.phone}</div></td>
                  <td className="px-4 py-3 tabular-nums text-white/80">{c.points_balance}</td>
                  <td className="px-4 py-3 tabular-nums text-white/80">{c.visit_count}</td>
                  <td className="px-4 py-3 text-xs text-white/60">{c.last_visit_at ? new Date(c.last_visit_at).toLocaleDateString('fr-FR') : 'Aucune visite enregistrée'}</td>
                  <td className="px-4 py-3 text-xs text-white/60">{c.birth_day && c.birth_month ? String(c.birth_day).padStart(2, '0') + '/' + String(c.birth_month).padStart(2, '0') : '—'}</td>
                  <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{c.marketing_consent && <span className="rounded-full bg-emerald-400/10 px-2 py-1 text-[10px] text-emerald-200">Marketing</span>}{c.notification_consent && <span className="rounded-full bg-sky-400/10 px-2 py-1 text-[10px] text-sky-200">Notifications</span>}{!c.marketing_consent && !c.notification_consent && <span className="text-xs text-white/30">Aucun</span>}</div></td>
                  <td className="px-4 py-3">
                    <button type="button" onClick={() => void createRecoveryQr(c)} disabled={recoveryLoadingId !== null} className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D4AF37]/30 px-3 py-2 text-xs font-semibold text-[#E1C27A] transition hover:bg-[#D4AF37]/10 disabled:cursor-not-allowed disabled:opacity-50">
                      {recoveryLoadingId === c.id ? <Loader2 size={13} className="animate-spin" /> : <QrCode size={13} />}
                      Récupérer
                    </button>
                  </td>
                </tr>)
              }
            </tbody>
          </table>
        </div>
        {!loading && filtered.length > 100 && <p className="border-t border-white/10 px-4 py-3 text-xs text-white/40">Affichage des 100 premiers clients. L’export CSV inclut tout le segment filtré.</p>}
      </div>
      {recoveryQr && (
        <div className="fixed inset-0 z-[100] grid place-items-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label="QR de récupération de carte">
          <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#101010] p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[.2em] text-[#D4AF37]">Carte fidélité</p>
                <h3 className="mt-1 text-xl font-semibold text-white">Récupérer la carte</h3>
                <p className="mt-1 text-sm text-white/50">{recoveryQr.name} · {recoveryQr.phone}</p>
              </div>
              <button type="button" onClick={() => setRecoveryQr(null)} aria-label="Fermer" className="rounded-lg p-2 text-white/60 hover:bg-white/10 hover:text-white"><X size={18} /></button>
            </div>
            <div className="mx-auto mt-5 w-fit rounded-2xl bg-white p-3">
              <img src={recoveryQr.url} alt="QR code de récupération de la carte fidélité" className="h-64 w-64 max-w-full" />
            </div>
            <p className="mt-4 text-center text-sm text-white/70">Scannez ce QR code pour récupérer la carte fidélité.</p>
            {recoveryQr.expiresAt && <p className="mt-1 text-center text-xs text-white/40">Lien valable jusqu’au {new Date(recoveryQr.expiresAt).toLocaleString('fr-FR')}</p>}
            <button type="button" onClick={() => window.print()} className="mt-4 w-full rounded-xl bg-[#D4AF37] px-4 py-3 text-sm font-bold text-black hover:brightness-110">Imprimer le QR code</button>
          </div>
        </div>
      )}
    </div>
  );
}
