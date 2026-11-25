import { extractBearerToken, normalizeLimit, resolveSmartMessage, retryDelayMinutes, parseHappyHourSchedule, resolveRewardClaimCycle } from './smart-marketing-utils.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json'}});
const templates:Record<string,{title:string;message:(p:Record<string,unknown>)=>string;type:'INFO'|'OFFER'|'REWARD'|'POINTS'}>={
  winback:{title:'On vous attend !',message:()=> 'Cela fait quelque temps que nous ne vous avons pas vu. Passez nous rendre visite, nous serons ravis de vous retrouver !',type:'OFFER'},
  birthday:{title:'Joyeux anniversaire 🎂',message:()=> 'Toute l’équipe vous souhaite un merveilleux anniversaire et espère vous accueillir très bientôt !',type:'INFO'},
  vip:{title:'Merci pour votre fidélité 👑',message:()=> 'Vous faites partie de nos clients les plus fidèles. Merci de votre confiance et à très bientôt !',type:'INFO'},
  progress:{title:'Plus qu’un petit effort !',message:(p)=> `Vous avez ${p.stamps ?? 0} tampons sur ${p.goal ?? 0}. Continuez, votre récompense approche !`,type:'POINTS'},
  reward:{title:'Votre récompense vous attend 🎁',message:(p)=> `Votre récompense${p.reward_name ? ` « ${String(p.reward_name)} »` : ''} est disponible. Passez la récupérer lors de votre prochaine visite !`,type:'REWARD'},
  happyhour:{title:'Happy Hour 🍹',message:(p)=> `Happy Hour en cours ! ${p.offer ?? 'Profitez de notre offre'}`,type:'OFFER'},
  challenge:{title:'Défi fidélité 🏆',message:(p)=> `Défi réussi : ${p.visits ?? 0} visites sur ${p.goal ?? 0}. ${p.reward ?? 'Votre récompense vous attend !'}`,type:'REWARD'},
  referral:{title:'Un parrainage en cours 🤝',message:()=> 'Merci pour votre recommandation ! Votre filleul vient de rejoindre notre programme.',type:'INFO'},
  comeback:{title:'On aimerait vous revoir ❤️',message:(p)=> `Cela fait ${p.inactive_days ?? p.step_days ?? 0} jours. Nous serions heureux de vous accueillir à nouveau !`,type:'OFFER'},
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
   const {data:c,error:ce}=await admin.from('loyalty_customers').select('id,notification_consent,marketing_consent,last_visit_at,stamps_balance,visit_count,birth_day,birth_month').eq('id',q.customer_id).eq('establishment_id',q.establishment_id).maybeSingle();
   if(ce)throw ce;
   if(!c||!c.notification_consent||!c.marketing_consent){
    await markSkipped(q.id,!c?'Customer not found':'Consent missing');skipped++;continue;
   }
   const messagePayload={...(q.payload??{})};
   if(q.smart_id==='reward'){
    const {data:settings,error:settingsError}=await admin.from('loyalty_settings').select('stamp_goal,stamp_reward_name,stamp_reward_description').eq('establishment_id',q.establishment_id).eq('program_type','STAMP').eq('enabled',true).maybeSingle();
    if(settingsError)throw settingsError;
    const goal=Math.max(1,Number(settings?.stamp_goal)||10),stamps=Number(c.stamps_balance??0);
    const {data:latestClaim,error:claimError}=await admin.from('loyalty_stamp_reward_claims')
      .select('id,status,expires_at')
      .eq('establishment_id',q.establishment_id)
      .eq('customer_id',q.customer_id)
      .order('created_at',{ascending:false})
      .order('id',{ascending:false})
      .limit(1)
      .maybeSingle();
    if(claimError)throw claimError;
    const cycle=resolveRewardClaimCycle(goal,latestClaim);
    if(!settings||stamps<goal||cycle.pendingActive||q.trigger_key!==cycle.triggerKey){await markSkipped(q.id,'Stamp reward cycle is no longer eligible');skipped++;continue;}
    messagePayload.reward_name=settings.stamp_reward_name;messagePayload.reward_description=settings.stamp_reward_description;messagePayload.stamps=stamps;messagePayload.goal=goal;
   }
   if(q.smart_id==='happyhour'){
    const schedule=String(liveConfig.config?.schedule??'').trim();
    const match=parseHappyHourSchedule(schedule);
    const now=new Date();
    const localTime=new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Casablanca',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(now);
    const weekday=Number(new Intl.DateTimeFormat('en-US',{timeZone:'Africa/Casablanca',weekday:'short'}).format(now).replace(/^(Sun|Mon|Tue|Wed|Thu|Fri|Sat)$/,m=>String(['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].indexOf(m))));
    const days=String(liveConfig.config?.days??'').split(',').map(x=>Number(x.trim())).filter(x=>Number.isInteger(x)&&x>=0&&x<=6);
    if(!match||localTime<match.start||localTime>=match.end||(days.length&&!days.includes(weekday))){await markSkipped(q.id,'Happy Hour schedule no longer active');skipped++;continue;}
   }
   if(q.smart_id==='challenge'){
    const goal=Math.max(1,Math.min(1000,Number.parseFloat(String(liveConfig.config?.goalVisits??liveConfig.config?.goal_visits??liveConfig.config?.goal??3))||3));
    if((c.visit_count??0)<goal){await markSkipped(q.id,'Challenge visit milestone no longer met');skipped++;continue;}
   }
   if(q.smart_id==='referral'){
    const referralId=String(q.payload?.referral_id??'');
    const {data:ref,error:refError}=await admin.from('loyalty_referrals').select('id,referrer_id,referee_id,status').eq('id',referralId).eq('establishment_id',q.establishment_id).maybeSingle();
    if(refError)throw refError;
    if(!ref||ref.status!=='pending'||ref.referrer_id!==q.customer_id){await markSkipped(q.id,'Referral no longer pending or customer mismatch');skipped++;continue;}
   }
   if(q.smart_id==='comeback'){
    const rawSteps=String(liveConfig.config?.steps??'30,37,45').match(/\d+/g)?.map(Number)??[30,37,45];
    const steps=[...new Set(rawSteps.filter(n=>n>=1&&n<=365))].sort((a,b)=>a-b);
    const lastVisit=c.last_visit_at?new Date(c.last_visit_at):null;
    const elapsed=lastVisit&&!Number.isNaN(lastVisit.getTime())?Math.floor((Date.now()-lastVisit.getTime())/86400000):-1;
    const step=steps.filter(n=>n<=elapsed).at(-1);
    if(!step||!lastVisit||q.trigger_key!==`comeback:${c.last_visit_at?.slice(0,10)}:${step}`){await markSkipped(q.id,'Comeback step no longer eligible');skipped++;continue;}
   }
   if(q.smart_id==='winback'){
    const delay=Math.max(1,Math.min(365,Number.parseFloat(String(liveConfig.config?.delayDays??liveConfig.config?.delay_days??liveConfig.config?.delay??30))||30));
    const lastVisit=c.last_visit_at?new Date(c.last_visit_at):null;
    if(!lastVisit||Number.isNaN(lastVisit.getTime())||Math.floor((Date.now()-lastVisit.getTime())/86400000)<delay){await markSkipped(q.id,'Customer returned or inactivity threshold no longer met');skipped++;continue;}
   }
   if(q.smart_id==='birthday'){
    const todayParts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Casablanca',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
    const today=Object.fromEntries(todayParts.map(x=>[x.type,x.value]));
    const localDate=`${today.year}-${today.month}-${today.day}`;
    if(q.trigger_key!==`birthday:${localDate}`||Number(c.birth_day)!==Number(today.day)||Number(c.birth_month)!==Number(today.month)){await markSkipped(q.id,'Birthday trigger date or customer birthday changed');skipped++;continue;}
   }
   if(q.smart_id==='vip'){
    const threshold=Math.max(1,Number.parseFloat(String(liveConfig.config?.thresholdVisits??liveConfig.config?.threshold_visits??liveConfig.config?.threshold??10))||10);
    if((c.visit_count??0)<threshold){await markSkipped(q.id,'VIP visit threshold no longer met');skipped++;continue;}
   }
   if(q.smart_id==='progress'){
    const {data:settings,error:settingsError}=await admin.from('loyalty_settings').select('stamp_goal').eq('establishment_id',q.establishment_id).maybeSingle();
    if(settingsError)throw settingsError;
    const goal=Math.max(1,Number(settings?.stamp_goal)||10);
    const percent=Math.max(1,Math.min(100,Number.parseFloat(String(liveConfig.config?.thresholdPercent??liveConfig.config?.threshold_percent??liveConfig.config?.threshold??80))||80));
    const threshold=Math.max(1,Math.ceil(goal*percent/100));
    const stamps=Number(c.stamps_balance??0);
    if(stamps<threshold||stamps>=goal){await markSkipped(q.id,'Progress threshold no longer met');skipped++;continue;}
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
