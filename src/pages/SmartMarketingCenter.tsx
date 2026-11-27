import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Bell, Gift, Heart, MapPin, Cake, Crown, Flame, Zap, Trophy, Users, Megaphone, Settings2, Sparkles, ArrowUpRight, X, Save } from 'lucide-react';

type Smart = { id: string; name: string; tagline: string; description: string; trigger: string; icon: typeof Heart; color: string; defaults: Record<string,string>; };
const SMARTS: Smart[] = [
 {id:'winback',name:'Smart Winback',tagline:'Réactivez les clients qui s’éloignent',description:'Repère les clients inactifs et déclenche une relance adaptée.',trigger:'Après une période sans visite',icon:Heart,color:'#686D76',defaults:{delay:'30 jours',offer:'Aucune offre',channel:'Notification in-app KELYANI',message:'Tu nous manques ! Reviens nous voir, une petite surprise t’attend.'}},
 {id:'nearby',name:'Smart Nearby',tagline:'Invitez les clients à proximité',description:'Propose une visite quand un client se trouve près de votre établissement.',trigger:'Entrée dans une zone de proximité',icon:MapPin,color:'#686D76',defaults:{latitude:'',longitude:'',radius_m:'250',zone_key:'main',target:'Tous les clients éligibles',channel:'Notification in-app',message:'Tu es tout près de nous ! Passe nous voir aujourd’hui.'}},
 {id:'birthday',name:'Smart Birthday',tagline:'Célébrez automatiquement chaque anniversaire',description:'Envoie un message et un avantage facultatif le jour spécial du client.',trigger:'Date d’anniversaire',icon:Cake,color:'#686D76',defaults:{offer:'Cadeau à définir',expiry:'7 jours',channel:'Notification in-app KELYANI',message:'Joyeux anniversaire 🎂 Un cadeau t’attend chez nous !'}},
 {id:'reward',name:'Smart Reward',tagline:'Annoncez les récompenses débloquées',description:'Annonce une récompense dès que le seuil de tampons est atteint.',trigger:'Seuil de tampons atteint',icon:Gift,color:'#686D76',defaults:{reminder:'Dès que la récompense est débloquée',channel:'Notification in-app KELYANI',message:'Bravo ! Ta récompense est disponible. Passe la récupérer lors de ta prochaine visite.'}},
 {id:'vip',name:'Smart VIP',tagline:'Reconnaissez vos meilleurs clients',description:'Détecte les clients fidèles, leur attribue un segment VIP et propose des avantages.',trigger:'Seuil de visites ou dépenses atteint',icon:Crown,color:'#686D76',defaults:{threshold:'10 visites',benefit:'Avantage VIP',channel:'Notification in-app KELYANI',message:'Bienvenue dans notre cercle VIP 👑 Profite de tes avantages exclusifs.'}},
 {id:'progress',name:'Smart Progress',tagline:'Encouragez les clients proches du cadeau',description:'Envoie un encouragement lorsque le client approche de sa récompense.',trigger:'80 % du parcours fidélité complété',icon:Flame,color:'#686D76',defaults:{threshold:'80 %',channel:'Notification in-app KELYANI',message:'Tu es tout proche de ton cadeau 🔥 Encore un petit effort !'}},
 {id:'happyhour',name:'Smart Happy Hour',tagline:'Remplissez vos heures creuses',description:'Programmez une offre sur des créneaux précis et ciblez vos clients.',trigger:'Horaire défini par le commerçant',icon:Zap,color:'#686D76',defaults:{schedule:'À définir',offer:'Offre à définir',channel:'Notification in-app KELYANI',message:'Happy Hour ! Profite de ton avantage pendant ce créneau.'}},
 {id:'challenge',name:'Smart Challenge',tagline:'Transformez les visites en jeu',description:'Annonce un palier lorsque le nombre total de visites configuré est atteint.',trigger:'Seuil total de visites atteint',icon:Trophy,color:'#686D76',defaults:{goal:'3 visites cumulées',reward:'Récompense à définir',channel:'Notification in-app KELYANI',message:'Défi fidélité 🏆 Tu as atteint ton objectif de visites. Profite de ta récompense !'}},
 {id:'referral',name:'Smart Referral',tagline:'Développez votre clientèle par recommandation',description:'Informe le parrain lorsqu’un filleul a rejoint le programme et que le parrainage est en attente.',trigger:'Création d’un parrainage en attente',icon:Users,color:'#686D76',defaults:{reward:'Récompense parrain + filleul',channel:'Lien de parrainage partageable',message:'Merci pour ton invitation ! Ton filleul vient de rejoindre le programme. Son parrainage est en attente.'}},
 {id:'comeback',name:'Smart Comeback',tagline:'Reconquête progressive des clients perdus',description:'Lance une séquence de relance et l’arrête dès que le client revient.',trigger:'Inactivité prolongée détectée',icon:Megaphone,color:'#686D76',defaults:{steps:'J+30, J+37, J+45',channel:'Notification in-app KELYANI',message:'Cela fait longtemps ! Nous aimerions te revoir. Profite de ton avantage de retour.'}},
];
const SMART_IDS = SMARTS.map((smart) => smart.id);
const OPERATIONAL_SMART_IDS = new Set(['winback','nearby','birthday','vip','progress','reward','happyhour','challenge','referral','comeback']);
type SmartConfigRow = { establishment_id: string; smart_id: string; enabled: boolean; config: Record<string, unknown> };
export default function SmartMarketingCenter({ establishmentId }: { establishmentId: string }) {
 const [reloadKey,setReloadKey]=useState(0);
  const [enabled,setEnabled]=useState<Record<string,boolean>>({});
 const [configs,setConfigs]=useState<Record<string,Record<string,string>>>({});
 const [selected,setSelected]=useState<Smart|null>(null);
 const [draft,setDraft]=useState<Record<string,string>>({});
 const [saved,setSaved]=useState(false);
 const [loading,setLoading]=useState(true);
 const [saving,setSaving]=useState(false);
 const [geoBusy,setGeoBusy]=useState(false);
 const [geoError,setGeoError]=useState('');
 const [error,setError]=useState<string|null>(null);
 const [writeError,setWriteError]=useState<string|null>(null);
 const establishmentRef=useRef<string|null>(null);
 useEffect(()=>{
   let active=true;
   const load=async(id:string|null)=>{
     if(!active)return;
     establishmentRef.current=id;
     setLoading(true);setError(null);setWriteError(null);setSaved(false);setSelected(null);setEnabled({});setConfigs({});
     if(!id){setLoading(false);setError('Aucun établissement sélectionné. Sélectionnez un établissement puis réessayez.');return;}
     try{
       const {data,error:queryError}=await supabase.from('smart_marketing_configs').select('establishment_id,smart_id,enabled,config').eq('establishment_id',id);
       if(queryError)throw queryError;
       const nextEnabled:Record<string,boolean>={};const nextConfigs:Record<string,Record<string,string>>={};
       for(const smart of SMARTS){nextEnabled[smart.id]=false;nextConfigs[smart.id]={...smart.defaults};}
       for(const row of (data??[]) as SmartConfigRow[]){
         if(row.establishment_id!==id||!SMART_IDS.includes(row.smart_id))continue;
         nextEnabled[row.smart_id]=Boolean(row.enabled);
         const defaults=SMARTS.find(s=>s.id===row.smart_id)?.defaults??{};
         const safeConfig=row.config&&typeof row.config==='object'&&!Array.isArray(row.config)?row.config:{};
         nextConfigs[row.smart_id]={...defaults,...Object.fromEntries(Object.entries(safeConfig).filter((entry):entry is [string,string]=>typeof entry[1]==='string'))};
       }
       if(active){setEnabled(nextEnabled);setConfigs(nextConfigs);}
     }catch(err){if(active)setError(err instanceof Error?err.message:'Erreur lors du chargement des Smart.');}
     finally{if(active)setLoading(false);}
   };
   void load(establishmentId);
   return()=>{active=false;};
 },[establishmentId,reloadKey]);
 const activeCount=SMARTS.filter(s=>OPERATIONAL_SMART_IDS.has(s.id)&&enabled[s.id]).length;
 const openSettings=(smart:Smart)=>{setSelected(smart);setDraft(configs[smart.id]??smart.defaults);setSaved(false);setWriteError(null);setGeoError('');};
 const captureEstablishmentGPS=()=>{
  if(!navigator.geolocation){setGeoError('La géolocalisation n’est pas disponible sur cet appareil.');return;}
  setGeoBusy(true);setGeoError('');
  navigator.geolocation.getCurrentPosition(position=>{setDraft(previous=>({...previous,latitude:String(position.coords.latitude),longitude:String(position.coords.longitude)}));setGeoBusy(false);},error=>{setGeoBusy(false);setGeoError(error.code===1?'Autorisation GPS refusée. Autorisez la localisation dans votre navigateur.':'Impossible de récupérer la position. Réessayez sur place.');},{enableHighAccuracy:true,timeout:15000,maximumAge:0});
 };
 const saveRow=async(id:string,enabledValue:boolean,configValue:Record<string,string>)=>{
   if(!establishmentId){setWriteError('Établissement manquant : impossible de sauvegarder.');return false;}
   const targetEstablishmentId=establishmentId;
   setSaving(true);setWriteError(null);setSaved(false);
   try{
     const {error:saveError}=await supabase.from('smart_marketing_configs').upsert({establishment_id:targetEstablishmentId,smart_id:id,enabled:enabledValue,config:configValue},{onConflict:'establishment_id,smart_id'});
     if(saveError)throw saveError;
     if(establishmentRef.current!==targetEstablishmentId)return false;
     setSaved(true);return true;
   }catch(err){if(establishmentRef.current===targetEstablishmentId)setWriteError(err instanceof Error?err.message:'Échec de sauvegarde Supabase.');return false;}
   finally{setSaving(false);}
 };
 const toggle=async(id:string)=>{const nextValue=!enabled[id];const currentConfig=configs[id]??SMARTS.find(s=>s.id===id)?.defaults??{};if(id==='nearby'&&nextValue){const lat=Number(currentConfig.latitude),lng=Number(currentConfig.longitude),radius=Number(currentConfig.radius_m);if(currentConfig.latitude?.trim()===''||currentConfig.longitude?.trim()===''||!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat>90||lng < -180||lng>180||!Number.isFinite(radius)||radius<50||radius>2000){setWriteError('Configurez d’abord latitude, longitude et rayon (50–2 000 m) dans Smart Nearby.');return;}}const ok=await saveRow(id,nextValue,currentConfig);if(ok)setEnabled(previous=>({...previous,[id]:nextValue}));};
 const saveConfig=async()=>{if(!selected)return;if(selected.id==='nearby'){const lat=Number(draft.latitude),lng=Number(draft.longitude),radius=Number(draft.radius_m);if(draft.latitude.trim()===''||draft.longitude.trim()===''||!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -90||lat>90||lng < -180||lng>180||!Number.isFinite(radius)||radius<50||radius>2000){setWriteError('Smart Nearby : coordonnées GPS valides requises et rayon entre 50 et 2 000 mètres.');return;}}const ok=await saveRow(selected.id,enabled[selected.id]??false,draft);if(ok)setConfigs(previous=>({...previous,[selected.id]:draft}));};
 return <div className="space-y-6">
  {error&&<div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-300">Chargement impossible : {error}<button type="button" className="ml-3 underline" onClick={()=>setReloadKey(value=>value+1)}>Réessayer</button></div>}
  {writeError&&<div role="alert" className="rounded-xl border border-red-500/30 bg-red-950/30 px-4 py-3 text-xs text-red-300">Sauvegarde impossible : {writeError}</div>}
  {loading&&<div className="rounded-xl border border-white/10 bg-[#111] px-4 py-3 text-xs text-white/45">Chargement des Smart depuis Supabase…</div>}
  <section className="rounded-[28px] border border-white/[.08] bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,.15),transparent_55%),linear-gradient(145deg,#141414,#070707)] p-5 sm:p-7">
   <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[.2em] text-white">KELYANI AUTOMATIONS</p><h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Smart Marketing Center</h1><p className="mt-2 max-w-xl text-sm leading-6 text-white/50">Vos automatisations fidélité. Activez les Smart dont vous avez besoin et KELYANI s’occupe des déclencheurs.</p></div><div className="rounded-2xl border border-[#3B82F6]/20 bg-[#686D76]/10 px-4 py-3"><p className="text-[10px] uppercase tracking-wider text-white/40">Smart actives</p><p className="mt-1 text-2xl font-semibold text-[#3B82F6]">{activeCount}<span className="text-sm text-white/35"> / 10</span></p></div></div>
   <div className="mt-5 flex items-center gap-2 rounded-xl border border-white/[.06] bg-black/30 px-3 py-2 text-[11px] text-white/45"><Sparkles size={14} className="text-white"/> Automatisez vos campagnes sans avoir à les gérer chaque jour.</div>
  </section>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
   {SMARTS.map(s=>{const Icon=s.icon;const isOn=!!enabled[s.id];const operational=OPERATIONAL_SMART_IDS.has(s.id);const displayOn=operational&&isOn;return <article key={s.id} className={`rounded-2xl border p-4 transition-all ${displayOn?'border-[#3B82F6]/35 bg-[#111111]':'border-white/[.07] bg-[#0C0C0C]'}`}>
    <div className="flex items-start justify-between gap-3"><div className="grid h-11 w-11 place-items-center rounded-xl bg-white/[.04]" style={{color:s.color}}><Icon size={20}/></div><button type="button" role="switch" aria-checked={displayOn} aria-label={`Activer ${s.name}`} onClick={()=>void toggle(s.id)} disabled={!operational||loading||saving||!!error} className={`relative h-6 w-11 rounded-full transition disabled:cursor-not-allowed disabled:opacity-50 ${displayOn?'bg-[#686D76]':'bg-[#343434]'}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition ${displayOn?'left-6':'left-1'}`}/></button></div>
    <h2 className="mt-4 text-sm font-semibold text-white">{s.name}</h2><p className="mt-1 text-xs text-white/45">{s.tagline}</p><p className="mt-3 min-h-10 text-[11px] leading-5 text-white/35">{s.description}</p>
    <div className="mt-4 flex items-center gap-1.5 text-[10px] text-white/35"><Bell size={12}/>{s.trigger}</div>
    <div className="mt-4 flex items-center justify-between border-t border-white/[.06] pt-3"><span className={`text-[10px] font-medium ${displayOn?'text-white':'text-white/25'}`}>{operational?(isOn?'Active':'Inactive'):'Disponible prochainement'}</span><button type="button" onClick={()=>openSettings(s)} disabled={!operational||loading||saving||!!error} className="inline-flex items-center gap-1.5 text-[10px] font-semibold text-white hover:text-white disabled:cursor-not-allowed disabled:opacity-40"><Settings2 size={13}/> Configurer <ArrowUpRight size={12}/></button></div>
   </article>})}
  </div>
  <p className="text-[10px] leading-5 text-white/30">Les paramètres sont enregistrés dans Supabase pour cet établissement. 10 Smart sont prises en charge sur cette branche. Les notifications Smart Marketing sont actuellement délivrées dans l’application KELYANI ; le Push et WhatsApp ne sont pas encore assurés par ce dispatcher. Smart Nearby nécessite les coordonnées GPS de l’établissement (latitude/longitude) et l’activation volontaire du GPS côté client.</p>
  {selected&&<div className="fixed inset-0 z-[100] grid place-items-center bg-black/75 p-3 backdrop-blur-sm" onClick={()=>setSelected(null)}><div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-white/[.1] bg-[#111111] p-5 shadow-2xl" onClick={e=>e.stopPropagation()}>
   <div className="flex items-start justify-between gap-3"><div><p className="text-[9px] font-bold uppercase tracking-[.18em] text-white">Paramètres automation</p><h2 className="mt-1 text-lg font-semibold text-white">{selected.name}</h2></div><button onClick={()=>setSelected(null)} className="grid h-9 w-9 place-items-center rounded-full border border-white/10 text-white/60"><X size={16}/></button></div>
   <p className="mt-2 text-xs leading-5 text-white/45">{selected.description}</p>
   <div className="mt-5 space-y-4">{selected.id==='nearby'&&<section className="rounded-2xl border border-[#3B82F6]/20 bg-[#686D76]/10 p-4"><h3 className="text-sm font-semibold text-white">📍 Point GPS de l’établissement</h3><p className="mt-1 text-xs leading-5 text-white/45">Ce point est la référence de cet établissement pour calculer la proximité des clients. Configurez-le sur place, idéalement à l’entrée.</p><button type="button" onClick={captureEstablishmentGPS} disabled={geoBusy} className="mt-3 w-full rounded-xl border border-[#3B82F6]/30 bg-[#686D76]/20 px-3 py-2.5 text-xs font-semibold text-[#3B82F6] disabled:opacity-50">{geoBusy?'Localisation en cours…':'Utiliser ma position actuelle pour définir le point GPS'}</button>{geoError&&<p className="mt-2 text-xs text-red-300" role="alert">{geoError}</p>}<div className="mt-3 grid grid-cols-2 gap-2"><label className="block"><span className="mb-1 block text-[10px] text-white/45">Latitude</span><input inputMode="decimal" value={draft.latitude??''} onChange={e=>setDraft({...draft,latitude:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"/></label><label className="block"><span className="mb-1 block text-[10px] text-white/45">Longitude</span><input inputMode="decimal" value={draft.longitude??''} onChange={e=>setDraft({...draft,longitude:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white"/></label></div></section>}{Object.entries(draft).filter(([key])=>selected.id!=='nearby'||!['latitude','longitude'].includes(key)).map(([key,value])=><label key={key} className="block"><span className="mb-1.5 block text-[10px] font-semibold capitalize text-white/50">{key.replace(/([A-Z])/g,' $1')}</span>{key==='message'?<textarea rows={3} value={value} onChange={e=>setDraft({...draft,[key]:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/40 p-3 text-sm text-white outline-none focus:border-[#3B82F6]/60"/>:<input value={value} onChange={e=>setDraft({...draft,[key]:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-[#3B82F6]/60"/>}</label>)}</div>
   <div className="mt-5 flex gap-2"><button onClick={()=>{setSelected(null);setSaved(false)}} className="flex-1 rounded-xl border border-white/10 px-4 py-3 text-xs font-semibold text-white/55">Annuler</button><button type="button" onClick={()=>void saveConfig()} disabled={loading||saving||!!error} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#686D76] px-4 py-3 text-xs font-semibold text-[#3B82F6] disabled:cursor-not-allowed disabled:opacity-50"><Save size={14}/> {saving?'Enregistrement…':'Enregistrer'}</button></div>{saved&&<p className="mt-3 text-center text-xs text-white">Configuration sauvegardée dans Supabase.</p>}
  </div></div>}
 </div>;
}
