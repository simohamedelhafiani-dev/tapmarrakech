// Google Business Profile AI reply integration.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const url=Deno.env.get('SUPABASE_URL')!,key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
const cid=Deno.env.get('GOOGLE_BUSINESS_CLIENT_ID')??'',secret=Deno.env.get('GOOGLE_BUSINESS_CLIENT_SECRET')??'';
const cors={'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'authorization, apikey, x-client-info, content-type, x-supabase-api-version'};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:cors});
async function refresh(r:string){const b=new URLSearchParams({refresh_token:r,client_id:cid,client_secret:secret,grant_type:'refresh_token'});const x=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:b});const d=await x.json();if(!x.ok)throw new Error(d?.error_description??'Token refresh failed');return d}
async function gen(comment:string,rating:string,lang:string,tone:string){
 const {data:settings,error:settingsError}=await db.from('ai_global_settings').select('provider,model,api_key,enabled,temperature,max_output_tokens,system_instructions').eq('id',true).maybeSingle();
 if(settingsError)throw settingsError;
 const provider=String(settings?.provider??'').trim().toLowerCase(),model=String(settings?.model??'').trim(),apiKey=String(settings?.api_key??'').trim();
 const temperature=Number(settings?.temperature),maxOutputTokens=Number(settings?.max_output_tokens);
 const systemInstructions=String(settings?.system_instructions??'').trim();
 if(settings?.enabled!==true||provider!=='openai'||!model||!apiKey)throw new Error('La configuration IA globale est désactivée ou incomplète. Vérifiez Admin → Configuration IA.');
 if(!Number.isFinite(temperature)||temperature<0||temperature>2)throw new Error('La température IA globale doit être comprise entre 0 et 2.');
 if(!Number.isInteger(maxOutputTokens)||maxOutputTokens<256||maxOutputTokens>128000)throw new Error('Le nombre de tokens IA global doit être compris entre 256 et 128000.');
 const prompt=`Rédige une réponse courte à un avis Google. Langue: ${lang||'français'}. Ton: ${tone||'professionnel et chaleureux'}. Note: ${rating}. Avis: ${comment}. Ne mentionne jamais une récompense, un point, une promotion ou une contrepartie. N'invente aucun fait. Maximum 70 mots.`;
 const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${apiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model,input:[{role:'system',content:[{type:'input_text',text:[ 'Tu rédiges des réponses Google factuelles, courtes, polies et sans promesse commerciale.',systemInstructions].filter(Boolean).join(' ')}]},{role:'user',content:[{type:'input_text',text:prompt}]}],max_output_tokens:maxOutputTokens,temperature})});
 const data=await response.json();
 if(!response.ok)throw new Error(data?.error?.message??'Erreur de génération IA.');
 const fromOutput=Array.isArray(data?.output)?data.output.flatMap((item:any)=>Array.isArray(item?.content)?item.content.map((part:any)=>part?.text??''):[]).join('\n').trim():'';
 const reply=String(data?.output_text??fromOutput).trim();
 if(!reply)throw new Error('OpenAI n’a renvoyé aucun texte. Aucun brouillon n’a été enregistré.');
 return reply;
}
async function getReview(reviewId:string){
 const {data:review,error}=await db.from('google_business_reviews').select('*, google_business_locations!inner(connection_id,google_account_id,google_location_id,mapped_establishment_id)').eq('id',reviewId).maybeSingle();
 if(error)throw error;if(!review)throw new Error('Avis introuvable');
 if(!review.google_business_locations?.mapped_establishment_id)throw new Error('Cette fiche Google n’est pas associée à un établissement KELYANI. Associez-la avant de générer ou publier une réponse.');
 const {data:c,error:connectionError}=await db.from('google_business_connections').select('*').eq('id',review.google_business_locations.connection_id).maybeSingle();
 if(connectionError)throw connectionError;if(!c)throw new Error('Connexion Google introuvable');
 const {data:s,error:settingError}=await db.from('google_business_settings').select('*').eq('establishment_id',review.google_business_locations.mapped_establishment_id).maybeSingle();
 if(settingError)throw settingError;
 return {review,c,s};
}
async function getToken(c:any){
 let token=c.access_token;
 if(!token||!c.token_expires_at||new Date(c.token_expires_at).getTime()<Date.now()+120000){
  const t=await refresh(c.refresh_token);token=t.access_token;
  const {error}=await db.from('google_business_connections').update({access_token:token,token_expires_at:new Date(Date.now()+Number(t.expires_in??3600)*1000).toISOString(),updated_at:new Date().toISOString()}).eq('id',c.id);
  if(error)throw error;
 }
 return token;
}
async function generateDraft(reviewId:string){
 const {review,s}=await getReview(reviewId);
 if(!review.comment)return {success:false,error:'Cet avis ne contient pas de commentaire.'};
 const reply=await gen(review.comment,String(review.star_rating??''),s?.auto_reply_language??'fr',s?.auto_reply_tone??'professional_warm');
 const status=s?.require_approval ? 'pending_approval' : 'ready_to_publish';
 const {error}=await db.from('google_business_reviews').update({reply_draft:reply,reply_status:status,reply_error:null,reply_generated_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',reviewId);
 if(error)throw error;
 return {success:true,reply,status};
}
async function publishDraft(reviewId:string, replyOverride?:string){
 const {review,c}=await getReview(reviewId);
 const reply=String(replyOverride??review.reply_draft??'').trim();
 if(!reply)throw new Error('Aucun brouillon à publier. Générez une réponse ou enregistrez un brouillon.');
 if(replyOverride!==undefined){const {error:draftError}=await db.from('google_business_reviews').update({reply_draft:reply,reply_status:'ready_to_publish',reply_error:null,updated_at:new Date().toISOString()}).eq('id',reviewId);if(draftError)throw draftError;}
 const aid=String(review.google_business_locations.google_account_id||c.google_account_id||'');
 const gid=String(review.google_business_locations.google_location_id||'');
 const rid=String(review.google_review_name).split('/').pop()||'';
 if(!aid||!gid||!rid)throw new Error('Mapping Google incomplet');
 const markFailed=async(message:string)=>{
  const {error}=await db.from('google_business_reviews').update({reply_status:'failed',reply_error:message,updated_at:new Date().toISOString()}).eq('id',reviewId);
  if(error)console.error('Unable to persist Google reply failure status',error);
 };
 let token:string;
 try{token=await getToken(c)}catch(error){
  const message=error instanceof Error?error.message:'Impossible de renouveler le jeton Google.';
  await markFailed(message);
  throw error;
 }
 const endpoint=`https://mybusiness.googleapis.com/v4/accounts/${aid}/locations/${gid}/reviews/${encodeURIComponent(rid)}/reply`;
 let response:Response;
 try{
  response=await fetch(endpoint,{method:'PUT',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify({comment:reply})});
 }catch(error){
  const message='Résultat de publication Google indéterminé après une erreur réseau. Vérifiez l’avis Google avant de réessayer.';
  await markFailed(message);
  throw new Error(message);
 }
 const raw=await response.text();let data:any={};try{data=JSON.parse(raw)}catch{}
 if(!response.ok){const message=String(data?.error?.message||raw.slice(0,300)||'Google reply failed');await markFailed(message);throw new Error(message)}
 const now=new Date().toISOString();
 const {error}=await db.from('google_business_reviews').update({owner_reply:reply,owner_reply_updated_at:now,reply_published_at:now,reply_status:'published',reply_error:null,last_synced_at:now,raw_payload:data,updated_at:now}).eq('id',reviewId);
 if(error)throw error;
 return {success:true,reply,status:'published'};
}
export async function publishReply(reviewId:string){return publishDraft(reviewId)}
Deno.serve(async req=>{
 try{
  if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
  if(req.method!=='POST')return json({success:false,error:'Méthode non autorisée'},405);
  const auth=req.headers.get('Authorization');if(!auth)return json({success:false,error:'Session manquante'},401);
  const bearer=auth.replace(/^Bearer\s+/i,'');const {data:{user}}=await db.auth.getUser(bearer);if(!user)return json({success:false,error:'Session invalide'},401);
  const {data:profile,error:profileError}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(profileError)throw profileError;if(profile?.role!=='admin')return json({success:false,error:'Accès réservé à l’administrateur'},403);
  const body=await req.json();const id=String(body?.review_id??'');const action=String(body?.action??'generate');
  if(!id)return json({success:false,error:'review_id requis'},400);
  if(action==='generate')return json(await generateDraft(id));
  if(action==='publish')return json(await publishDraft(id,body?.reply===undefined?undefined:String(body.reply)));
  if(action==='save'){
   await getReview(id);
   const reply=String(body?.reply??'').trim();if(!reply)return json({success:false,error:'Le brouillon ne peut pas être vide.'},400);
   const {error}=await db.from('google_business_reviews').update({reply_draft:reply,reply_status:'ready_to_publish',reply_error:null,updated_at:new Date().toISOString()}).eq('id',id);
   if(error)throw error;return json({success:true,status:'ready_to_publish'});
  }
  return json({success:false,error:'Action inconnue'},400);
 }catch(e){console.error(e);return json({success:false,error:e instanceof Error?e.message:'Erreur serveur'},500)}
});
