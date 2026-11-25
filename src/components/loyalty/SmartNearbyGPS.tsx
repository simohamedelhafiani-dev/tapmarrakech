import { useEffect, useState } from 'react';
import { MapPin, ShieldCheck } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function SmartNearbyGPS({ accessToken }: { accessToken: string }) {
 const [enabled,setEnabled]=useState(false);
 const [status,setStatus]=useState('');
 const [consentBusy,setConsentBusy]=useState(true);

 useEffect(()=>{
  let active=true;
  setEnabled(false);
  setConsentBusy(true);
  if(!accessToken){setConsentBusy(false);return ()=>{active=false;};}
  void (async()=>{
   try{
    const {data,error}=await supabase.rpc('get_public_loyalty_gps_consent',{p_access_token:accessToken});
    if(!active)return;
    if(error){setStatus('Impossible de vérifier le consentement GPS enregistré. Smart Nearby reste désactivé.');return;}
    setEnabled(data===true);
   }catch{
    if(active)setStatus('Impossible de vérifier le consentement GPS enregistré. Smart Nearby reste désactivé.');
   }finally{
    if(active)setConsentBusy(false);
   }
  })();
  return ()=>{active=false;};
 },[accessToken]);

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
    }else if(data?.reason==='gps_consent_missing'){
     setEnabled(false);
     setStatus('Le consentement GPS doit être activé pour utiliser Smart Nearby.');
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

 async function toggle(){
  if(consentBusy)return;
  const next=!enabled;
  setConsentBusy(true);
  if(!next){
   // Stop location collection immediately; server revocation follows.
   setEnabled(false);
   try{
    const {data,error}=await supabase.rpc('set_public_loyalty_gps_consent',{p_access_token:accessToken,p_enabled:false});
    if(error||data!==true)throw error??new Error('Révocation non confirmée');
    setStatus('Consentement GPS révoqué. Smart Nearby est désactivé.');
   }catch{
    setStatus('GPS arrêté sur cet appareil, mais la révocation serveur n’a pas été confirmée. Réessayez.');
   }finally{setConsentBusy(false);}
   return;
  }
  try{
   const {data,error}=await supabase.rpc('set_public_loyalty_gps_consent',{p_access_token:accessToken,p_enabled:true});
   if(error||data!==true)throw error??new Error('Activation non confirmée');
   setEnabled(true);
   setStatus('Consentement GPS enregistré. Autorisez la localisation de votre navigateur si demandé.');
  }catch{
   setEnabled(false);
   setStatus('Impossible d’enregistrer votre consentement GPS. Smart Nearby reste désactivé.');
  }finally{setConsentBusy(false);}
 }

 return <section className="mt-3 rounded-2xl border border-white/10 bg-[#101010] p-4" aria-label="Smart Nearby">
  <div className="flex items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-blue-500/10 text-blue-400"><MapPin size={16}/></div><div className="min-w-0 flex-1"><p className="text-sm font-semibold text-white">Smart Nearby</p><p className="mt-1 text-xs leading-5 text-white/55">Recevez une notification quand vous vous trouvez à proximité d’un établissement participant. Le consentement GPS est distinct des consentements marketing et notifications.</p></div></div>
  <button type="button" onClick={toggle} disabled={consentBusy||!accessToken} className="mt-3 w-full rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-xs font-semibold text-blue-300 disabled:opacity-50">{consentBusy?'Vérification du consentement…':enabled?'Désactiver Smart Nearby':'Activer Smart Nearby'}</button>
  <p className="mt-2 flex items-start gap-1.5 text-[10px] leading-4 text-white/40"><ShieldCheck size={12} className="mt-0.5 shrink-0"/>{status||'Votre position précise est utilisée ponctuellement pour le calcul de proximité et n’est pas conservée comme historique GPS. Vous pouvez révoquer votre consentement à tout moment.'}</p>
 </section>;
}
