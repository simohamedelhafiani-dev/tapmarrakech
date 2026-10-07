import { useEffect, useState } from 'react';
import { Crown, Save, Ticket, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';

type Props={establishmentId:string};
type Tier={id:string;tier_key:'STANDARD'|'BRONZE'|'SILVER'|'GOLD'|'PLATINUM';name:string;sort_order:number;min_total_points:number;min_rewards_redeemed:number;qualification_mode:'OR'|'AND';ticket_multiplier:number;active:boolean};
const order=['STANDARD','BRONZE','SILVER','GOLD','PLATINUM'] as const;
const labels:Record<string,string>={STANDARD:'Standard',BRONZE:'Bronze',SILVER:'Silver',GOLD:'Gold',PLATINUM:'Platinum'};
const icons:Record<string,string>={STANDARD:'⚪',BRONZE:'🥉',SILVER:'🥈',GOLD:'🥇',PLATINUM:'💎'};
const input='h-11 w-full rounded-xl border border-[#242424]/10 bg-[#111] px-3 text-xs text-[#E1C27A] outline-none focus:border-[#C9A45C]/50';
export default function LoyaltyTierStudio({establishmentId}:Props){
 const [tiers,setTiers]=useState<Tier[]>([]); const [loading,setLoading]=useState(true); const [saving,setSaving]=useState<string|null>(null); const [message,setMessage]=useState('');
 const load=async()=>{setLoading(true);const {data,error}=await supabase.rpc('get_loyalty_tiers',{p_establishment_id:establishmentId});if(error)setMessage(error.message);else setTiers((data||[]) as Tier[]);setLoading(false)};
 useEffect(()=>{void load()},[establishmentId]);
 const update=async(t:Tier)=>{setSaving(t.id);setMessage('');const {error}=await supabase.rpc('update_loyalty_tier',{p_tier_id:t.id,p_name:t.name,p_min_points:t.min_total_points,p_min_rewards:t.min_rewards_redeemed,p_mode:t.qualification_mode,p_ticket_multiplier:t.ticket_multiplier,p_active:t.active});setSaving(null);if(error)setMessage(error.message);else setMessage('Niveau enregistré.');};
 const patch=(id:string,key:string,value:unknown)=>setTiers(ts=>ts.map(t=>t.id===id?{...t,[key]:value}:t));
 return <div className="space-y-5">
  <div className="rounded-3xl border border-[#242424]/10 bg-[#111] p-5">
   <div className="flex items-start gap-3"><div className="grid h-11 w-11 place-items-center rounded-2xl bg-[#C9A45C]/10 text-[#C9A45C]"><Crown size={18}/></div><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-[#C9A45C]">Niveaux KELYANI</p><h2 className="mt-1 text-lg font-semibold text-[#E1C27A]">Classification automatique des clients</h2><p className="mt-1 max-w-2xl text-[11px] leading-5 text-white/40">Le niveau est calculé automatiquement selon les points cumulés et les récompenses réellement récupérées. Le client ne peut pas modifier son niveau.</p></div></div>
   <div className="mt-5 space-y-3">{loading?<p className="text-xs text-white/35">Chargement...</p>:tiers.sort((a,b)=>a.sort_order-b.sort_order).map(t=><div key={t.id} className="rounded-2xl border border-[#242424]/10 bg-[#0b0b0b] p-4">
    <div className="grid gap-4 lg:grid-cols-[180px_1fr_1fr_120px_100px_auto] lg:items-end">
     <div><p className="text-xs font-semibold text-[#E1C27A]">{icons[t.tier_key]} {labels[t.tier_key]}</p><p className="mt-1 text-[9px] uppercase tracking-[.12em] text-white/25">{t.tier_key}</p></div>
     <label><span className="mb-1 block text-[9px] uppercase tracking-[.12em] text-white/30">Points cumulés</span><input className={input} type="number" min="0" value={t.min_total_points} onChange={e=>patch(t.id,'min_total_points',Math.max(0,Number(e.target.value)||0))}/></label>
     <label><span className="mb-1 block text-[9px] uppercase tracking-[.12em] text-white/30">Récompenses récupérées</span><input className={input} type="number" min="0" value={t.min_rewards_redeemed} onChange={e=>patch(t.id,'min_rewards_redeemed',Math.max(0,Number(e.target.value)||0))}/></label>
     <label><span className="mb-1 block text-[9px] uppercase tracking-[.12em] text-white/30">Condition</span><select className={input} value={t.qualification_mode} onChange={e=>patch(t.id,'qualification_mode',e.target.value)}><option value="OR">L'un ou l'autre</option><option value="AND">Les deux</option></select></label>
     <label><span className="mb-1 block text-[9px] uppercase tracking-[.12em] text-white/30">Tickets tombola</span><input className={input} type="number" min="1" max="100" value={t.ticket_multiplier} onChange={e=>patch(t.id,'ticket_multiplier',Math.max(1,Math.min(100,Number(e.target.value)||1)))}/></label>
     <button type="button" onClick={()=>void update(t)} disabled={saving===t.id} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#C9A45C] px-4 text-[10px] font-bold text-[#080808] disabled:opacity-50"><Save size={14}/>{saving===t.id?'...':'Enregistrer'}</button>
    </div>
   </div>)}</div>
   <div className="mt-4 rounded-2xl border border-[#C9A45C]/15 bg-[#C9A45C]/5 p-4 text-[10px] leading-5 text-white/45"><span className="font-semibold text-[#E1C27A]">Exemple :</span> un client Gold peut avoir 1 500 points <b>ou</b> 5 récompenses récupérées. S'il est éligible à une tombola avec tickets par niveau, il reçoit automatiquement 5 chances contre 1 pour un Standard.</div>
  </div>
  {message&&<div className="rounded-2xl border border-[#C9A45C]/15 bg-[#C9A45C]/5 px-4 py-3 text-xs text-[#E1C27A]">{message}</div>}
 </div>
}