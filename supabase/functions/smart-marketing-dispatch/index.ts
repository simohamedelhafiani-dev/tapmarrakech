import { extractBearerToken, normalizeLimit, resolveSmartMessage, retryDelayMinutes } from './smart-marketing-utils.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const templates:Record<string,{title:string;message:(p:Record<string,unknown>)=>string;type:'INFO'|'OFFER'|'REWARD'|'POINTS'}>={
  winback:{title:'On vous attend !',message:()=> 'Cela fait quelque temps que nous ne vous avons pas vu. Passez nous rendre visite, nous serons ravis de vous retrouver !',type:'OFFER'},
  birthday:{title:'Joyeux anniversaire 🎂',message:()=> 'Toute l’équipe vous souhaite un merveilleux anniversaire et espère vous accueillir très bientôt !',type:'INFO'},
  vip:{title:'Merci pour votre fidélité 👑',message:()=> 'Vous faites partie de nos clients les plus fidèles. Merci de votre confiance et à très bientôt !',type:'INFO'},
  progress:{title:'Plus qu’un petit effort !',message:(p)=> `Vous avez ${p.stamps ?? 0} tampons sur ${p.goal ?? 0}. Continuez, votre récompense approche !`,type:'POINTS'},
};
Deno.serve(async(req)=>{
 if(req.method!=='POST')return json({success:false,error:'POST requis.'},405);
 const secret=Deno.env.get('SMART_MARKETING_CRON_SECRET');
 const token=extractBearerToken(req.headers.get('Authorization'));
 if(!secret||token!==secret)return json({success:false,error:'Non autorisé.'},401);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return json({success:false,error:'Configuration Supabase absente.'},503);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const requestBody=await req.json().catch(()=>({limit:50}));
 const requestedLimit=requestBody&&typeof requestBody==='object'&&!Array.isArray(requestBody)?(requestBody as Record<string,unknown>).limit:50;
 const batch=normalizeLimit(requestedLimit);
 const {data:rows,error}=await admin.rpc('claim_smart_marketing_queue',{p_limit:batch});
 if(error)return json({success:false,error:'Impossible de réserver les tâches.'},500);
 let sent=0,skipped=0,failed=0,retried=0,lease_lost=0;
 const markSkipped=async(q:{id:string;processing_started_at:string|null},reason:string)=>{const {data,error}=await admin.from('smart_marketing_queue').update({status:'SKIPPED',processing_started_at:null,processed_at:new Date().toISOString(),last_error:reason}).eq('id',q.id).eq('status','PROCESSING').eq('processing_started_at',q.processing_started_at).select('id').maybeSingle();if(error)throw error;return Boolean(data?.id);};
 for(const q of rows??[]){
  try{
   const tmpl=templates[q.smart_id];
   if(!tmpl){if(await markSkipped(q,'No template/delivery supported yet'))skipped++;else lease_lost++;continue;}
   const {data:liveConfig,error:liveConfigError}=await admin.from('smart_marketing_configs').select('enabled,config').eq('establishment_id',q.establishment_id).eq('smart_id',q.smart_id).maybeSingle();
   if(liveConfigError)throw liveConfigError;
   if(!liveConfig?.enabled){if(await markSkipped(q,'Smart disabled before dispatch'))skipped++;else lease_lost++;continue;}
   const {data:c,error:ce}=await admin.from('loyalty_customers').select('id,notification_consent,marketing_consent,last_visit_at,stamps_balance,visit_count,birth_day,birth_month').eq('id',q.customer_id).eq('establishment_id',q.establishment_id).maybeSingle();
   if(ce)throw ce;
   if(!c||!c.notification_consent||!c.marketing_consent){
    if(await markSkipped(q,!c?'Customer not found':'Consent missing'))skipped++;else lease_lost++;continue;
   }
   if(q.smart_id==='winback'){
    const delay=Math.max(1,Math.min(365,Number.parseFloat(String(liveConfig.config?.delayDays??liveConfig.config?.delay_days??liveConfig.config?.delay??30))||30));
    const lastVisit=c.last_visit_at?new Date(c.last_visit_at):null;
    if(!lastVisit||Number.isNaN(lastVisit.getTime())||Math.floor((Date.now()-lastVisit.getTime())/86400000)<delay){if(await markSkipped(q,'Customer returned or inactivity threshold no longer met'))skipped++;else lease_lost++;continue;}
   }
   if(q.smart_id==='birthday'){
    const todayParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const today=Object.fromEntries(todayParts.map(x=>[x.type,x.value]));
    const localDate=`${today.year}-${today.month}-${today.day}`;
    if(q.trigger_key!==`birthday:${localDate}`||Number(c.birth_day)!==Number(today.day)||Number(c.birth_month)!==Number(today.month)){if(await markSkipped(q,'Birthday trigger date or customer birthday changed'))skipped++;else lease_lost++;continue;}
   }
   if(q.smart_id==='vip'){
    const threshold=Math.max(1,Number.parseFloat(String(liveConfig.config?.thresholdVisits??liveConfig.config?.threshold_visits??liveConfig.config?.threshold??10))||10);
    if((c.visit_count??0)<threshold){if(await markSkipped(q,'VIP visit threshold no longer met'))skipped++;else lease_lost++;continue;}
   }
   const messagePayload={...(q.payload??{})};
   if(q.smart_id==='progress'){
    const {data:settings,error:settingsError}=await admin.from('loyalty_settings').select('stamp_goal').eq('establishment_id',q.establishment_id).maybeSingle();
    if(settingsError)throw settingsError;
    const goal=Math.max(1,Number(settings?.stamp_goal)||10);
    const percent=Math.max(1,Math.min(100,Number.parseFloat(String(liveConfig.config?.thresholdPercent??liveConfig.config?.threshold_percent??liveConfig.config?.threshold??80))||80));
    const threshold=Math.max(1,Math.ceil(goal*percent/100));
    const stamps=Number(c.stamps_balance??0);
    if(stamps<threshold||stamps>=goal){if(await markSkipped(q,'Progress threshold no longer met'))skipped++;else lease_lost++;continue;}
    messagePayload.stamps=stamps; messagePayload.goal=goal; messagePayload.percent=Math.round(stamps/goal*100);
   }
   // Reuse the config snapshot already checked for enabled status to avoid a second read/race.
   const customMessage=resolveSmartMessage(liveConfig.config?.message,tmpl.message(messagePayload));
   const notificationPayload={establishment_id:q.establishment_id,customer_id:q.customer_id,smart_marketing_queue_id:q.id,title:tmpl.title,message:customMessage,type:tmpl.type};
   const {error:insertErr}=await admin.from('loyalty_card_notifications').insert(notificationPayload);
   if(insertErr){
    // A prior attempt may have created the notification before queue state was updated.
    if(insertErr.code!=='23505')throw insertErr;
    const {data:existing,error:lookupErr}=await admin.from('loyalty_card_notifications').select('id').eq('smart_marketing_queue_id',q.id).maybeSingle();
    if(lookupErr||!existing)throw insertErr;
   }
   const {data:statusData,error:statusErr}=await admin.from('smart_marketing_queue').update({status:'SENT',processing_started_at:null,processed_at:new Date().toISOString(),last_error:null}).eq('id',q.id).eq('status','PROCESSING').eq('processing_started_at',q.processing_started_at);
   if(statusErr)throw statusErr;
   sent++;
  }catch(e){
   const msg=e instanceof Error?e.message:String(e);
   const retryable=(q.attempts??1)<3;
   const retryDelay=retryDelayMinutes(q.attempts??1);
   const {data:stateData,error:stateErr}=await admin.from('smart_marketing_queue').update({status:retryable?'PENDING':'FAILED',scheduled_at:retryable?new Date(Date.now()+retryDelay*60000).toISOString():undefined,processing_started_at:null,processed_at:retryable?null:new Date().toISOString(),last_error:msg.slice(0,500)}).eq('id',q.id).eq('status','PROCESSING').eq('processing_started_at',q.processing_started_at);
   if(stateErr)failed++; else if(stateData?.id){if(retryable)retried++;else failed++;}else lease_lost++;
  }
 }
 return json({success:failed===0&&lease_lost===0,claimed:rows?.length??0,created_in_app_notifications:sent,skipped,failed,retried,lease_lost});
});
