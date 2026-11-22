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
 let sent=0,skipped=0,failed=0;
 const markSkipped=async(id:string,reason:string)=>{const {error}=await admin.from('smart_marketing_queue').update({status:'SKIPPED',processing_started_at:null,processed_at:new Date().toISOString(),last_error:reason}).eq('id',id);if(error)throw error;};
 for(const q of rows??[]){
  try{
   const tmpl=templates[q.smart_id];
   if(!tmpl){await markSkipped(q.id,'No template/delivery supported yet');skipped++;continue;}
   const {data:liveConfig,error:liveConfigError}=await admin.from('smart_marketing_configs').select('enabled,config').eq('establishment_id',q.establishment_id).eq('smart_id',q.smart_id).maybeSingle();
   if(liveConfigError)throw liveConfigError;
   if(!liveConfig?.enabled){await markSkipped(q.id,'Smart disabled before dispatch');skipped++;continue;}
   const {data:c,error:ce}=await admin.from('loyalty_customers').select('id,notification_consent,marketing_consent,last_visit_at').eq('id',q.customer_id).eq('establishment_id',q.establishment_id).maybeSingle();
   if(ce)throw ce;
   if(!c||!c.notification_consent||!c.marketing_consent){
    await markSkipped(q.id,!c?'Customer not found':'Consent missing');skipped++;continue;
   }
   if(q.smart_id==='winback'){
    const delay=Math.max(1,Math.min(365,Number.parseFloat(String(liveConfig.config?.delayDays??liveConfig.config?.delay_days??liveConfig.config?.delay??30))||30));
    const lastVisit=c.last_visit_at?new Date(c.last_visit_at):null;
    if(!lastVisit||Number.isNaN(lastVisit.getTime())||Math.floor((Date.now()-lastVisit.getTime())/86400000)<delay){await markSkipped(q.id,'Customer returned or inactivity threshold no longer met');skipped++;continue;}
   }
   if(q.smart_id==='birthday'&&q.trigger_key!==`birthday:${new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca'}).format(new Date())}`){await markSkipped(q.id,'Birthday trigger date expired');skipped++;continue;}
   // Reuse the config snapshot already checked for enabled status to avoid a second read/race.
   const customMessage=resolveSmartMessage(liveConfig.config?.message,tmpl.message(q.payload??{}));
   const notificationPayload={establishment_id:q.establishment_id,customer_id:q.customer_id,smart_marketing_queue_id:q.id,title:tmpl.title,message:customMessage,type:tmpl.type};
   const {error:insertErr}=await admin.from('loyalty_card_notifications').insert(notificationPayload);
   if(insertErr){
    // A prior attempt may have created the notification before queue state was updated.
    if(insertErr.code!=='23505')throw insertErr;
    const {data:existing,error:lookupErr}=await admin.from('loyalty_card_notifications').select('id').eq('smart_marketing_queue_id',q.id).maybeSingle();
    if(lookupErr||!existing)throw insertErr;
   }
   const {error:statusErr}=await admin.from('smart_marketing_queue').update({status:'SENT',processing_started_at:null,processed_at:new Date().toISOString(),last_error:null}).eq('id',q.id);
   if(statusErr)throw statusErr;
   sent++;
  }catch(e){
   const msg=e instanceof Error?e.message:String(e);
   const retryable=(q.attempts??1)<3;
   const retryDelay=retryDelayMinutes(q.attempts??1);
   const {error:stateErr}=await admin.from('smart_marketing_queue').update({status:retryable?'PENDING':'FAILED',scheduled_at:retryable?new Date(Date.now()+retryDelay*60000).toISOString():undefined,processing_started_at:null,processed_at:retryable?null:new Date().toISOString(),last_error:msg.slice(0,500)}).eq('id',q.id);
   if(stateErr)failed++; else if(!retryable)failed++;
  }
 }
 return json({success:failed===0,claimed:rows?.length??0,created_in_app_notifications:sent,skipped,failed});
});
