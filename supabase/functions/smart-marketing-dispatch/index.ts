import { extractBearerToken, normalizeLimit } from './smart-marketing-utils.ts';
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
 const batch=normalizeLimit((await req.json().catch(()=>({limit:50}))).limit);
 const {data:rows,error}=await admin.rpc('claim_smart_marketing_queue',{p_limit:batch});
 if(error)return json({success:false,error:'Impossible de réserver les tâches.'},500);
 let sent=0,skipped=0,failed=0;
 for(const q of rows??[]){
  try{
   const tmpl=templates[q.smart_id];
   if(!tmpl){await admin.from('smart_marketing_queue').update({status:'SKIPPED',processed_at:new Date().toISOString(),last_error:'No template/delivery supported yet'}).eq('id',q.id);skipped++;continue;}
   const {data:c,error:ce}=await admin.from('loyalty_customers').select('id,notification_consent,marketing_consent').eq('id',q.customer_id).eq('establishment_id',q.establishment_id).maybeSingle();
   if(ce||!c||!c.notification_consent|| (tmpl.type==='OFFER'&&!c.marketing_consent)){
    await admin.from('smart_marketing_queue').update({status:'SKIPPED',processed_at:new Date().toISOString(),last_error:ce?'Customer validation failed':'Consent missing'}).eq('id',q.id);skipped++;continue;
   }
   const {error:insertErr}=await admin.from('loyalty_card_notifications').insert({establishment_id:q.establishment_id,customer_id:q.customer_id,title:tmpl.title,message:tmpl.message(q.payload??{}),type:tmpl.type});
   if(insertErr)throw insertErr;
   await admin.from('smart_marketing_queue').update({status:'SENT',processed_at:new Date().toISOString(),last_error:null}).eq('id',q.id);
   sent++;
  }catch(e){
   const msg=e instanceof Error?e.message:String(e);
   await admin.from('smart_marketing_queue').update({status:'FAILED',processed_at:new Date().toISOString(),last_error:msg.slice(0,500)}).eq('id',q.id);
   failed++;
  }
 }
 return json({success:failed===0,claimed:rows?.length??0,created_in_app_notifications:sent,skipped,failed});
});
