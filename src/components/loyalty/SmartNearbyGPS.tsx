import { useEffect, useState } from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SmartNearbyGPS({ accessToken }: { accessToken: string }) {
 const storageKey='kelyani-nearby-consent:'+accessToken;
 const [enabled,setEnabled]=useState(()=>{try{return localStorage.getItem(storageKey)==='yes'}catch{return false}});
 const [status,setStatus]=useState('');
 useEffect(()=>{
  if(!enabled||!accessToken)return;
  if(!('geolocation' in navigator)){setStatus('La géolocalisation n’est pas prise en charge.');return;}
  let lastSent=0,active=true,inFlight=false;
  const watch=navigator.geolocation.watchPosition(async position=>{
   if(!active||inFlight||Date.now()-lastSent<60000)return;
   inFlight=true;
   try{
   const {data,error}=await supabase.functions.invoke('smart-nearby-event',{body:{access_token:accessToken,latitude:position.coords.latitude,longitude:position.coords.longitude}});
   if(!active)return;
   if(error||data?.success===false){setStatus('Smart Nearby temporairement indisponible. Une nouvelle tentative sera effectuée au prochain relevé GPS.');return;}
   lastSent=Date.now();
   if(data?.eligible===true){
    setStatus('Vous êtes dans la zone ! Une notification a été envoyée.');
   }else if(data?.reason==='already_notified_today'){
    setStatus('Zone détectée : vous avez déjà reçu la notification aujourd’hui.');
   }else if(data?.reason==='disabled'){
    setStatus('Smart Nearby n’est pas activé pour cet établissement.');
   }else if(data?.reason==='consent_missing'){
    setStatus('Notifications ou consentement marketing désactivés sur votre carte fidélité.');
   }else if(typeof data?.distance_m==='number'){
    setStatus('Vous êtes hors de la zone de proximité. Aucun historique GPS n’est conservé.');
   }else{
    setStatus('Smart Nearby vérifie ponctuellement la proximité, sans historique GPS.');
   }
   }finally{inFlight=false;}
  },err=>{if(active)setStatus(err.code===1?'Autorisation GPS refusée.':'GPS indisponible.');},{enableHighAccuracy:false,maximumAge:60000,timeout:15000});
  return ()=>{active=false;navigator.geolocation.clearWatch(watch);};
 },[enabled,accessToken]);
 function toggle(){
  const next=!enabled;setEnabled(next);
  try{if(next)localStorage.setItem(storageKey,'yes');else localStorage.removeItem(storageKey);}catch{
   // Browser storage may be disabled; keep the consent toggle in React state for this session.
  }
  setStatus(next?'Demande d’autorisation GPS…':'Smart Nearby désactivé.');
 }
 return <section className="mt-3 rounded-2xl border border-white/10 bg-[#101010] p-4" aria-label="Smart Nearby">
  <div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><MapPin size={16}/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">Smart Nearby</p><p className="mt-1 text-xs leading-5 text-white/55">Recevez une notification quand vous vous trouvez à proximité d’un établissement participant. Le GPS est utilisé uniquement lorsque vous activez cette option.</p></div></div>
  <button type="button" onClick={toggle} className="mt-3 w-full rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300">{enabled?'Désactiver Smart Nearby':'Activer Smart Nearby'}</button>
  <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-white/40"><ShieldCheck size={12} className="mt-0.5 shrink-0"/>{status||'Votre position précise est utilisée ponctuellement pour le calcul de proximité et n’est pas conservée comme historique GPS. Désactivez à tout moment.'}</p>
 </section>;
}
