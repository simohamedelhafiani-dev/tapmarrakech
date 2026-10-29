import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const url=Deno.env.get('SUPABASE_URL')!, key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const db=createClient(url,key,{auth:{autoRefreshToken:false,persistSession:false}});
const cid=Deno.env.get('GOOGLE_BUSINESS_CLIENT_ID')??'', secret=Deno.env.get('GOOGLE_BUSINESS_CLIENT_SECRET')??'';
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{'Content-Type':'application/json','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type'}});
async function isAdmin(userId:string){const {data}=await db.from('profiles').select('role').eq('id',userId).maybeSingle();return data?.role==='admin'}
async function refresh(r:string){const b=new URLSearchParams({refresh_token:r,client_id:cid,client_secret:secret,grant_type:'refresh_token'});const x=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:b});const d=await x.json();if(!x.ok)throw new Error(d?.error_description??'Token refresh failed');return d}

async function api(path:string,token:string){const r=await fetch('https://mybusiness.googleapis.com/v4/'+path,{headers:{Authorization:`Bearer ${token}`}});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message??'Google Business Profile API error');return d}
Deno.serve(async req=>{if(req.method==='OPTIONS')return new Response('ok',{headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST,OPTIONS'}});try{
 const auth=req.headers.get('Authorization');if(!auth)return json({success:false,error:'Session manquante'},401);
 const {data:{user}}=await db.auth.getUser(auth.replace(/^Bearer\s+/i,''));if(!user)return json({success:false,error:'Session invalide'},401);
 if(!(await isAdmin(user.id)))return json({success:false,error:'Accès réservé à l’administrateur'},403);
 
 const body=await req.json();const eid=String(body?.establishment_id??'');if(!eid)return json({success:false,error:'establishment_id requis'},400);
 // Admin role was already checked above. Do not call user_has_establishment_access with the service-role client: auth.uid() is NULL there and it incorrectly denies the sync.
 const {data:c}=await db.from('google_business_connections').select('*').eq('establishment_id',eid).maybeSingle();if(!c)return json({success:false,error:'Google Business Profile non connecté'},404);
 let token=c.access_token;
 if(!token || !c.token_expires_at || new Date(c.token_expires_at).getTime()<Date.now()+120000){const t=await refresh(c.refresh_token);token=t.access_token;await db.from('google_business_connections').update({access_token:token,token_expires_at:new Date(Date.now()+Number(t.expires_in??3600)*1000).toISOString(),updated_at:new Date().toISOString(),status:'active',last_error:null}).eq('id',c.id);}
 const accounts=await api('accounts',token);
 let locations=0,reviews=0;
 for(const a of accounts.accounts??[]){const aid=String(a.name??'').replace(/^accounts\//,'');const locs=await api(`accounts/${aid}/locations?pageSize=100`,token);
  for(const l of locs.locations??[]){const gid=String(l.name??'').replace(/^locations\//,'');const {data:row}=await db.from('google_business_locations').upsert({connection_id:c.id,google_account_id:aid,google_location_id:gid,location_name:l.name,title:l.title??null,metadata:l,updated_at:new Date().toISOString()},{onConflict:'google_location_id'}).select('id').single();if(!row)continue;locations++;
   const rv=await api(`accounts/${aid}/locations/${gid}/reviews?pageSize=50`,token);
   for(const r of rv.reviews??[]){await db.from('google_business_reviews').upsert({location_id:row.id,google_review_name:r.name,reviewer_display_name:r.reviewer?.displayName??null,reviewer_is_anonymous:!!r.reviewer?.isAnonymous,star_rating:r.starRating??null,comment:r.comment??null,review_created_at:r.createTime??null,review_updated_at:r.updateTime??null,owner_reply:r.reviewReply?.comment??null,owner_reply_updated_at:r.reviewReply?.updateTime??null,raw_payload:r,last_synced_at:new Date().toISOString(),updated_at:new Date().toISOString()},{onConflict:'google_review_name'});reviews++;}
  }
 }
 await db.from('google_business_connections').update({last_sync_at:new Date().toISOString(),status:'active',last_error:null,updated_at:new Date().toISOString()}).eq('id',c.id);
 return json({success:true,locations,reviews});
}catch(e){console.error(e);return json({success:false,error:e instanceof Error?e.message:'Erreur serveur'},500)}});