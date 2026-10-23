// Google Business Profile OAuth integration.
// Deployed source is kept here for reproducible branch builds.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const clientId=Deno.env.get('GOOGLE_BUSINESS_CLIENT_ID')??'';
const clientSecret=Deno.env.get('GOOGLE_BUSINESS_CLIENT_SECRET')??'';
const redirectUri=Deno.env.get('GOOGLE_BUSINESS_REDIRECT_URI')??'';
const db=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,apikey,x-client-info,x-supabase-api-version','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'Content-Type':'application/json'}});
function randomState(){const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
async function sha256(v:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function tokenExchange(body:URLSearchParams){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const d=await r.json();if(!r.ok)throw new Error(d?.error_description??'Google OAuth error');return d}
async function refreshToken(r:string){return tokenExchange(new URLSearchParams({refresh_token:r,client_id:clientId,client_secret:clientSecret,grant_type:'refresh_token'}))}
async function getGoogleAccountIds(accessToken:string){const r=await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts',{headers:{Authorization:`Bearer ${accessToken}`}});const raw=await r.text();let d:any;try{d=JSON.parse(raw)}catch{throw new Error(`Google Business Account Management a renvoyé une réponse non JSON (HTTP ${r.status}). Vérifiez que l’API Account Management est activée dans Google Cloud.`)}if(!r.ok)throw new Error(d?.error?.message??`Impossible de récupérer les comptes Google Business (HTTP ${r.status})`);return (d.accounts??[]).map((a:any)=>String(a.name??'').replace(/^accounts\//,'')).filter(Boolean)}
async function getGoogleAccountId(accessToken:string){return (await getGoogleAccountIds(accessToken))[0]??''}
async function getGoogleEmail(accessToken:string){const r=await fetch('https://www.googleapis.com/oauth2/v3/userinfo',{headers:{Authorization:`Bearer ${accessToken}`}});if(!r.ok)return null;const d=await r.json();return typeof d.email==='string'?d.email:null}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  if(!clientId||!clientSecret||!redirectUri)return json({success:false,error:'Google Business Profile OAuth n’est pas configuré côté serveur.'},503);
  const u=new URL(req.url);const action=u.searchParams.get('action')??(req.method==='GET'?'callback':'start');
  if(action==='callback'){
   const code=u.searchParams.get('code'),state=u.searchParams.get('state');
   if(!code||!state)return json({success:false,error:'Paramètres OAuth manquants.'},400);
   const stateHash=await sha256(state);
   const {data:row,error}=await db.from('google_business_oauth_states').select('state_hash,user_id,establishment_id,expires_at,used_at').eq('state_hash',stateHash).maybeSingle();
   if(error)throw error;
   if(!row||row.used_at||new Date(row.expires_at).getTime()<Date.now())return json({success:false,error:'État OAuth invalide ou expiré.'},400);
   // Consume the OAuth state atomically: only one callback can change used_at from NULL.
   // The conditional UPDATE prevents concurrent/replayed callbacks from both exchanging the code.
   const consumedAt=new Date().toISOString();
   const {data:consumed,error:consumeError}=await db.from('google_business_oauth_states')
    .update({used_at:consumedAt})
    .eq('state_hash',stateHash)
    .is('used_at',null)
    .gt('expires_at',consumedAt)
    .select('state_hash')
    .maybeSingle();
   if(consumeError)throw consumeError;
   if(!consumed)return json({success:false,error:'État OAuth déjà utilisé, invalide ou expiré.'},400);
   const t=await tokenExchange(new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'}));
   let refresh=t.refresh_token as string|undefined;
   const googleAccountIds=await getGoogleAccountIds(t.access_token);const googleAccountId=googleAccountIds[0]??'';
   if(!googleAccountId)return json({success:false,error:'Aucun compte Google Business Profile accessible.'},400);
   const googleEmail = row.establishment_id ? null : await getGoogleEmail(t.access_token);
   if (row.establishment_id) {
    if(!refresh){const {data:e}=await db.from('google_business_connections').select('refresh_token').eq('establishment_id',row.establishment_id).maybeSingle();refresh=e?.refresh_token}
    if(!refresh)return json({success:false,error:'Google n’a pas renvoyé de refresh token. Reconnectez le compte avec consentement.'},400);
    const {error:legacyError}=await db.from('google_business_connections').upsert({
     establishment_id:row.establishment_id,google_account_id:googleAccountId,access_token:t.access_token,refresh_token:refresh,
     token_expires_at:new Date(Date.now()+Number(t.expires_in??3600)*1000).toISOString(),
     scopes:String(t.scope??'').split(' ').filter(Boolean),connected_by:row.user_id,status:'active',last_error:null,updated_at:new Date().toISOString()
    },{onConflict:'establishment_id'});
    if(legacyError)throw legacyError;
   } else {
    // One Google OAuth identity may manage multiple Business Profile accounts.
    // Keep existing accounts active and create/update a row for each accessible account.
    if(!refresh){
      const {data:e,error:refreshError}=await db.from('google_business_accounts')
        .select('refresh_token').eq('connected_by',row.user_id)
        .order('updated_at',{ascending:false}).limit(1).maybeSingle();
      if(refreshError)throw refreshError;
      refresh=e?.refresh_token;
    }
    if(!refresh)return json({success:false,error:'Google n’a pas renvoyé de refresh token. Reconnectez le compte avec consentement.'},400);
    for(const accountId of googleAccountIds){
      const {error:accountError}=await db.from('google_business_accounts').upsert({
       google_account_id:accountId,email:googleEmail,access_token:t.access_token,refresh_token:refresh,
       token_expires_at:new Date(Date.now()+Number(t.expires_in??3600)*1000).toISOString(),
       scopes:String(t.scope??'').split(' ').filter(Boolean),connected_by:row.user_id,status:'active',last_error:null,updated_at:new Date().toISOString()
      },{onConflict:'connected_by,google_account_id'});
      if(accountError)throw accountError;
    }
   }
   return new Response('<html><body><script>window.close();</script><p>Google Business Profile connecté. Vous pouvez fermer cette fenêtre.</p></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  const auth=req.headers.get('Authorization');if(!auth)return json({success:false,error:'Session utilisateur manquante.'},401);
  const bearer=auth.replace(/^Bearer\s+/i,'');
  const {data:{user}}=await db.auth.getUser(bearer);if(!user)return json({success:false,error:'Session invalide.'},401);
  const {data:profile,error:profileError}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();
  if(profileError)throw profileError;
  if(profile?.role!=='admin')return json({success:false,error:'Connexion Google Business réservée à l’administrateur.'},403);
  if(action==='list_accounts'){
   const {data:accounts,error:accountsError}=await db.from('google_business_accounts')
    .select('id,google_account_id,email,status,last_sync_at,last_error,created_at,updated_at')
    .eq('connected_by',user.id).order('created_at',{ascending:false});
   if(accountsError)throw accountsError;
   return json({success:true,accounts:accounts??[]});
  }
  if(action==='start'){
   const body=await req.json();
   if(body?.action==='list_accounts'){
    const {data:accounts,error:accountsError}=await db.from('google_business_accounts')
     .select('id,google_account_id,email,status,last_sync_at,last_error,created_at,updated_at')
     .eq('connected_by',user.id).order('created_at',{ascending:false});
    if(accountsError)throw accountsError;
    return json({success:true,accounts:accounts??[]});
   }
   const accountFirst=body?.action==='start_account';
   const eid=String(body?.establishment_id??'');
   if(!accountFirst&&!eid)return json({success:false,error:'establishment_id requis.'},400);
   if(!accountFirst){const {data:access}=await db.rpc('user_has_establishment_access',{p_establishment_id:eid});if(!access)return json({success:false,error:'Accès établissement refusé.'},403);}
   const state=randomState();
   const {error:stateError}=await db.from('google_business_oauth_states').insert({state_hash:await sha256(state),user_id:user.id,establishment_id:accountFirst?null:eid,expires_at:new Date(Date.now()+600000).toISOString()});
   if(stateError)throw stateError;
   const p=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',access_type:'offline',prompt:accountFirst?'select_account consent':'consent',scope:'openid email profile https://www.googleapis.com/auth/business.manage',state});
   return json({success:true,authorization_url:`https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`});
  }
  if(action==='refresh'){
   const {data:profile,error:profileError}=await db.from('profiles').select('role').eq('id',user.id).maybeSingle();
   if(profileError)throw profileError;
   if(profile?.role!=='admin')return json({success:false,error:'Accès réservé à l’administrateur.'},403);
   const body=await req.json(),eid=String(body?.establishment_id??'');if(!eid)return json({success:false,error:'establishment_id requis.'},400);
   const {data:c,error:connectionError}=await db.from('google_business_connections').select('*').eq('establishment_id',eid).maybeSingle();
   if(connectionError)throw connectionError;
   if(!c)return json({success:false,error:'Connexion Google introuvable.'},404);
   const t=await refreshToken(c.refresh_token);const aid=await getGoogleAccountId(t.access_token);
   await db.from('google_business_connections').update({google_account_id:aid,access_token:t.access_token,token_expires_at:new Date(Date.now()+Number(t.expires_in??3600)*1000).toISOString(),status:'active',last_error:null,updated_at:new Date().toISOString()}).eq('id',c.id);
   return json({success:true,google_account_id:aid});
  }
  return json({success:false,error:'Action inconnue.'},400);
 }catch(e){console.error(e);return json({success:false,error:e instanceof Error?e.message:'Erreur serveur.'},500)}
});