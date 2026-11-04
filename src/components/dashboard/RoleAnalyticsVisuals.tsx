import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Gift, Users, Footprints, UserRound } from 'lucide-react';
import {
  Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis, Area, AreaChart,
} from 'recharts';
import { supabase } from '@/lib/supabase';

type RoleAnalyticsVisualsProps = {
  role: 'admin' | 'responsible';
  establishmentIds?: string[];
};
type CustomerRow = {
  id: string; first_name: string | null; last_name: string | null;
  created_at: string; last_visit_at: string | null; visit_count: number | null;
  points_balance: number | null; establishment_id: string;
};
const GOLD = '#D4AF37';
const IVORY = '#F5F5F5';
const MUTED = '#A0A0A0';
const PANEL = '#1E1E1E';
const BG = '#121212';
const dateKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
const monthLabel = (date: Date) => new Intl.DateTimeFormat('fr-FR',{month:'short'}).format(date);
const tooltipStyle = { background: PANEL, border: `1px solid ${GOLD}`, borderRadius: 12, color: IVORY, fontSize: 12 };

export default function RoleAnalyticsVisuals({ role, establishmentIds = [] }: RoleAnalyticsVisualsProps) {
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [sectorRows, setSectorRows] = useState<Array<{name:string; value:number}>>([]);
  const [rewardCustomerIds, setRewardCustomerIds] = useState<string[]>([]);
  const [establishmentCount, setEstablishmentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(false);
      try {
        let ids = establishmentIds;
        if (role === 'admin') {
          const [{ data: establishments, error: establishmentsError }, { data: types, error: typesError }] = await Promise.all([
            supabase.from('establishments').select('id,ai_business_type_id,business_type,created_at'),
            supabase.from('ai_business_types').select('id,name'),
          ]);
          if (establishmentsError) throw establishmentsError;
          if (typesError) throw typesError;
          const rows = establishments ?? [];
          ids = rows.map(row => row.id);
          setEstablishmentCount(rows.length);
          const typeNames = new Map((types ?? []).map(item => [item.id, item.name]));
          const counts = new Map<string, number>();
          rows.forEach(row => {
            const name = (row.ai_business_type_id && typeNames.get(row.ai_business_type_id)) || row.business_type || 'Non renseigné';
            counts.set(name, (counts.get(name) ?? 0) + 1);
          });
          setSectorRows([...counts.entries()].map(([name,value]) => ({name,value})).sort((a,b)=>b.value-a.value));
        }
        if (!ids.length) {
          if (active) { setCustomers([]); setRewardCustomerIds([]); }
          return;
        }
        const [{ data: customerRows, error: customersError }, { data: redemptions, error: rewardsError }] = await Promise.all([
          supabase.from('loyalty_customers')
            .select('id,first_name,last_name,created_at,last_visit_at,visit_count,points_balance,establishment_id')
            .in('establishment_id', ids).order('created_at',{ascending:false}).limit(5000),
          supabase.from('loyalty_redemptions').select('customer_id').in('establishment_id',ids).limit(10000),
        ]);
        if (customersError) throw customersError;
        if (rewardsError) throw rewardsError;
        if (active) {
          setCustomers((customerRows ?? []) as CustomerRow[]);
          setRewardCustomerIds((redemptions ?? []).map(row => row.customer_id).filter(Boolean));
        }
      } catch (err) {
        console.error('Erreur visualisations dashboard:', err);
        if (active) setError(true);
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [role, establishmentIds.join('|')]);

  const registrations = useMemo(() => {
    const now = new Date();
    return Array.from({length:12},(_,index)=>{
      const month = new Date(now.getFullYear(),now.getMonth()-11+index,1);
      const key = dateKey(month);
      return { month: monthLabel(month), inscriptions: customers.filter(c=>dateKey(new Date(c.created_at))===key).length };
    });
  },[customers]);
  const currentMonth = registrations[11]?.inscriptions ?? 0;
  const previousMonth = registrations[10]?.inscriptions ?? 0;
  const growth = previousMonth ? ((currentMonth-previousMonth)/previousMonth)*100 : 0;
  const sectorsTotal = sectorRows.reduce((sum,row)=>sum+row.value,0);
  const sectorData = sectorRows.length ? sectorRows : [{name:'Aucune donnée',value:1}];
  const topCustomers = useMemo(()=>[...customers].sort((a,b)=>(b.visit_count??0)-(a.visit_count??0)).filter(c=>(c.visit_count??0)>0).slice(0,7),[customers]);
  const inactiveCustomers = useMemo(()=>{
    const now=Date.now();
    return customers.filter(c=>{
      const last = c.last_visit_at || c.created_at;
      return now-new Date(last).getTime() > 30*86400000;
    }).sort((a,b)=>new Date(a.last_visit_at||a.created_at).getTime()-new Date(b.last_visit_at||b.created_at).getTime()).slice(0,8);
  },[customers]);
  const visited = customers.filter(c=>(c.visit_count??0)>0).length;
  const rewarded = new Set(rewardCustomerIds).size;
  const funnel = [
    {label:'Inscription',value:customers.length},
    {label:'Au moins une visite',value:visited},
    {label:'Récompense utilisée',value:rewarded},
  ];
  const formatDate = (value:string) => new Intl.DateTimeFormat('fr-FR',{day:'2-digit',month:'short'}).format(new Date(value));
  const customerName = (c:CustomerRow) => [c.first_name,c.last_name].filter(Boolean).join(' ') || 'Client';
  const card = 'min-w-0 rounded-3xl border border-[#D4AF37]/25 bg-[#1E1E1E] p-4 sm:p-5';
  if (loading) return <div className="grid gap-4 lg:grid-cols-2"><div className={card+' h-72 animate-pulse'} /><div className={card+' h-72 animate-pulse'} /></div>;
  if (error) return <section className={card}><p className="text-sm text-[#A0A0A0]">Les visualisations ne sont pas disponibles pour le moment. Actualisez le tableau de bord pour réessayer.</p></section>;

  if (role === 'admin') return (
    <section className="space-y-4" aria-label="Analyse stratégique KELYANI">
      <div className="grid gap-4 sm:grid-cols-3">
        <article className={card}><p className="text-xs text-[#A0A0A0]">Établissements actifs</p><p className="mt-3 text-3xl font-semibold text-[#F5F5F5]">{establishmentCount.toLocaleString('fr-FR')}</p><p className="mt-1 text-xs text-[#A0A0A0]">Sur la plateforme</p></article>
        <article className={card}><p className="text-xs text-[#A0A0A0]">Clients fidélisés</p><p className="mt-3 text-3xl font-semibold text-[#F5F5F5]">{customers.length.toLocaleString('fr-FR')}</p><p className="mt-1 text-xs text-[#A0A0A0]">Membres enregistrés</p></article>
        <article className={card}><p className="text-xs text-[#A0A0A0]">Inscriptions ce mois</p><p className="mt-3 text-3xl font-semibold text-[#F5F5F5]">{currentMonth.toLocaleString('fr-FR')}</p><p className="mt-1 text-xs text-[#A0A0A0]">{previousMonth ? `${growth>=0?'+':''}${growth.toFixed(1)}% vs mois précédent` : 'Pas encore de comparaison mensuelle'}</p></article>
      </div>
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(280px,.8fr)]">
        <article className={card}>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#D4AF37]">Acquisition · 12 mois</p><h3 className="mt-1 text-lg font-semibold text-[#F5F5F5]">Croissance des inscriptions clients</h3>
          <div className="mt-4 h-64 w-full"><ResponsiveContainer width="100%" height="100%"><AreaChart data={registrations} margin={{top:8,right:8,left:-20,bottom:0}}><defs><linearGradient id="kelyani-admin-growth" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GOLD} stopOpacity={.35}/><stop offset="100%" stopColor={IVORY} stopOpacity={.02}/></linearGradient></defs><CartesianGrid stroke={GOLD} strokeOpacity={.15} vertical={false}/><XAxis dataKey="month" tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/><YAxis allowDecimals={false} tick={{fill:MUTED,fontSize:11}} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle}/><Area type="monotone" dataKey="inscriptions" name="Inscriptions" stroke={GOLD} strokeWidth={2.5} fill="url(#kelyani-admin-growth)" activeDot={{r:5,fill:IVORY,stroke:GOLD}}/></AreaChart></ResponsiveContainer></div>
        </article>
        <article className={card}>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#D4AF37]">Portefeuille</p><h3 className="mt-1 text-lg font-semibold text-[#F5F5F5]">Répartition sectorielle</h3>
          <div className="relative mx-auto mt-3 h-56 max-w-[280px]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={sectorData} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="82%" paddingAngle={sectorRows.length>1?3:0} stroke={BG}>{sectorData.map((row,index)=><Cell key={row.name} fill={index%2===0?GOLD:IVORY}/>)}</Pie><Tooltip contentStyle={tooltipStyle} formatter={(value)=>[Number(value).toLocaleString('fr-FR'),'Établissements']}/></PieChart></ResponsiveContainer><div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-3xl text-[#F5F5F5]">{sectorsTotal}</strong><span className="text-[10px] text-[#A0A0A0]">établissements</span></div></div>
          <div className="mt-2 space-y-2">{sectorRows.slice(0,6).map((row,index)=><div key={row.name} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2 text-[#A0A0A0]"><span className={`h-2.5 w-2.5 shrink-0 rounded-full ${index%2===0?'bg-[#D4AF37]':'bg-[#F5F5F5]'}`}/><span className="truncate">{row.name}</span></span><strong className="text-[#F5F5F5]">{row.value}</strong></div>)}</div>
        </article>
      </div>
    </section>
  );

  return (
    <section className="space-y-4" aria-label="Pilotage opérationnel fidélité">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)]">
        <article className={card}>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#D4AF37]">Engagement client</p><h3 className="mt-1 text-lg font-semibold text-[#F5F5F5]">Classement fidélité</h3><p className="mt-1 text-xs text-[#A0A0A0]">Clients classés par nombre de visites enregistrées</p>
          <div className="mt-4 h-64 w-full"><ResponsiveContainer width="100%" height="100%"><BarChart data={topCustomers.map(c=>({name:customerName(c),visites:c.visit_count??0}))} layout="vertical" margin={{top:4,right:12,left:8,bottom:4}}><CartesianGrid stroke={GOLD} strokeOpacity={.12} horizontal={false}/><XAxis type="number" allowDecimals={false} tick={{fill:MUTED,fontSize:10}} axisLine={false} tickLine={false}/><YAxis type="category" dataKey="name" width={90} tick={{fill:IVORY,fontSize:10}} axisLine={false} tickLine={false}/><Tooltip contentStyle={tooltipStyle} formatter={(value)=>[Number(value),'Visites']}/><Bar dataKey="visites" name="Visites" fill={GOLD} radius={[0,6,6,0]} maxBarSize={22}/></BarChart></ResponsiveContainer></div>
          {!topCustomers.length&&<p className="text-center text-xs text-[#A0A0A0]">Les visites apparaîtront ici dès leur premier enregistrement.</p>}
        </article>
        <article className={card}>
          <p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#D4AF37]">Parcours fidélité</p><h3 className="mt-1 text-lg font-semibold text-[#F5F5F5]">Tunnel de rétention</h3><p className="mt-1 text-xs text-[#A0A0A0]">Progression des clients entre les étapes clés</p>
          <div className="mt-6 space-y-4">{funnel.map((step,index)=>{const pct=customers.length?Math.round(step.value/customers.length*100):0;return <div key={step.label}><div className="mb-2 flex items-center justify-between gap-2"><span className="text-xs text-[#F5F5F5]">{index+1}. {step.label}</span><strong className="text-xs text-[#D4AF37]">{step.value.toLocaleString('fr-FR')} · {pct}%</strong></div><div className="h-3 overflow-hidden rounded-full bg-[#121212]"><div className="h-full rounded-full bg-[#D4AF37] transition-all" style={{width:`${pct}%`}}/></div></div>})}</div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center"><div className="rounded-xl bg-[#121212] p-2"><Users className="mx-auto text-[#D4AF37]" size={17}/><p className="mt-1 text-[10px] text-[#A0A0A0]">Inscrits</p></div><div className="rounded-xl bg-[#121212] p-2"><Footprints className="mx-auto text-[#D4AF37]" size={17}/><p className="mt-1 text-[10px] text-[#A0A0A0]">Visiteurs</p></div><div className="rounded-xl bg-[#121212] p-2"><Gift className="mx-auto text-[#D4AF37]" size={17}/><p className="mt-1 text-[10px] text-[#A0A0A0]">Récompensés</p></div></div>
        </article>
      </div>
      <article className={card}>
        <div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-semibold uppercase tracking-[.18em] text-[#D4AF37]">Action immédiate</p><h3 className="mt-1 text-lg font-semibold text-[#F5F5F5]">Clients inactifs depuis plus de 30 jours</h3><p className="mt-1 text-xs text-[#A0A0A0]">À relancer pour réactiver leur fidélité</p></div><AlertTriangle className="shrink-0 text-[#D4AF37]" size={20}/></div>
        <div className="mt-4 divide-y divide-[#D4AF37]/15">{inactiveCustomers.map(c=><div key={c.id} className="flex items-center gap-3 py-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#121212] text-[#D4AF37]"><UserRound size={16}/></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium text-[#F5F5F5]">{customerName(c)}</p><p className="text-xs text-[#A0A0A0]">Dernière activité : {formatDate(c.last_visit_at||c.created_at)}</p></div><span className="shrink-0 text-xs text-[#D4AF37]">{c.visit_count??0} visites</span></div>)}
          {!inactiveCustomers.length&&<p className="py-6 text-center text-xs text-[#A0A0A0]">Aucun client inactif de plus de 30 jours dans les données chargées.</p>}
        </div>
      </article>
    </section>
  );
}
