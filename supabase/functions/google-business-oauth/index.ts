// Google Business Profile OAuth integration.
// Deployed source is kept here for reproducible branch builds.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl=Deno.env.get('SUPABASE_URL')!;
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const clientId=Deno.env.get('GOOGLE_BUSINESS_CLIENT_ID')??'';
const clientSecret=Deno.env.get('GOOGLE_BUSINESS_CLIENT_SECRET')??'';
const redirectUri=Deno.env.get('GOOGLE_BUSINESS_REDIRECT_URI')??'';
const db=createClient(supabaseUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization,content-type,apikey','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...cors,'Content-Type':'application/json'}});
function randomState(){const b=crypto.getRandomValues(new Uint8Array(32));return btoa(String.fromCharCode(...b)).replaceAll('+','-').replaceAll('/','_').replaceAll('=','')}
async function sha256(v:string){const h=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(v));return Array.from(new Uint8Array(h)).map(b=>b.toString(16).padStart(2,'0')).join('')}
async function tokenExchange(body:URLSearchParams){const r=await fetch('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});const d=await r.json();if(!r.ok)throw new Error(d?.error_description??'Google OAuth error');return d}
async function refreshToken(r:string){return tokenExchange(new URLSearchParams({refresh_token:r,client_id:clientId,client_secret:clientSecret,grant_type:'refresh_token'}))}
async function getGoogleAccountId(accessToken:string){const r=await fetch('https://mybusiness.googleapis.com/v4/accounts',{headers:{Authorization:`Bearer ${accessToken}`}});const d=await r.json();if(!r.ok)throw new Error(d?.error?.message??'Impossible de récupérer les comptes Google Business');const first=(d.accounts??[])[0];return first?.name?String(first.name).replace(/^accounts\//,''):''}

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
   if(error||!row||row.used_at||new Date(row.expires_at).getTime()<Date.now())return json({success:false,error:'État OAuth invalide ou expiré.'},400);
   await db.from('google_business_oauth_states').update({used_at:new Date().toISOString()}).eq('state_hash',stateHash);
   const t=await tokenExchange(new URLSearchParams({code,client_id:clientId,client_secret:clientSecret,redirect_uri:redirectUri,grant_type:'authorization_code'}));
   let refresh=t.refresh_token as string|undefined;
   if(!refresh){const {data:e}=await db.from('google_business_connections').select('refresh_token').eq('establishment_id',row.establishment_id).maybeSingle();refresh=e?.refresh_token}
   if(!refresh)return json({success:false,error:'Google n’a pas renvoyé de refresh token. Reconnectez le compte avec consentement.'},400);
   const googleAccountId=await getGoogleAccountId(t.access_token);
   if(!googleAccountId)return json({success:false,error:'Aucun compte Google Business Profile accessible.'},400);
   await db.from('google_business_connections').upsert({
    establishment_id:row.establishment_id,google_account_id:googleAccountId,access_token:t.access_token,refresh_token:refresh,
    token_expires_at:new Date(Date.now()+Number(t.expires_in??3600)*1000).toISOString(),
    scopes:String(t.scope??'').split(' ').filter(Boolean),connected_by:row.user_id,status:'active',last_error:null,updated_at:new Date().toISOString()
   },{onConflict:'establishment_id'});
   return new Response('<html><body><script>window.close();</script><p>Google Business Profile connecté. Vous pouvez fermer cette fenêtre.</p></body></html>',{headers:{'Content-Type':'text/html; charset=utf-8'}});
  }
  const auth=req.headers.get('Authorization');if(!auth)return json({success:false,error:'Session utilisateur manquante.'},401);
  const bearer=auth.replace(/^Bearer\s+/i,'');
  const {data:{user}}=await db.auth.getUser(bearer);if(!user)return json({success:false,error:'Session invalide.'},401);
  if(action==='start'){
   const body=await req.json(),eid=String(body?.establishment_id??'');if(!eid)return json({success:false,error:'establishment_id requis.'},400);
   const {data:access}=await db.rpc('user_has_establishment_access',{p_establishment_id:eid});if(!access)return json({success:false,error:'Accès établissement refusé.'},403);
   const state=randomState();await db.from('google_business_oauth_states').insert({state_hash:await sha256(state),user_id:user.id,establishment_id:eid,expires_at:new Date(Date.now()+600000).toISOString()});
   const p=new URLSearchParams({client_id:clientId,redirect_uri:redirectUri,response_type:'code',access_type:'offline',prompt:'consent',scope:'https://www.googleapis.com/auth/business.manage',state});
   return json({success:true,authorization_url:`https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`});
  }
  if(action==='refresh'){
   const body=await req.json(),eid=String(body?.establishment_id??'');if(!eid)return json({success:false,error:'establishment_id requis.'},400);
   const {data:c}=await db.from('google_business_connections').select('*').eq('establishment_id',eid).maybeSingle();if(!c)return json({success:false,error:'Connexion Google introuvable.'},404);
   const t=await refreshToken(c.refresh_token);const aid=await getGoogleAccountId(t.access_token);
   await db.from('google_business_connections').update({google_account_id:aid,access_token:t.access_token,token_expires_at:new Date(Date.now()+Number(t.expires_in??3600)*1000).toISOString(),status:'active',last_error:null,updated_at:new Date().toISOString()}).eq('id',c.id);
   return json({success:true,google_account_id:aid});
  }
  return json({success:false,error:'Action inconnue.'},400);
 }catch(e){console.error(e);return json({success:false,error:e instanceof Error?e.message:'Erreur serveur.'},500)}
});