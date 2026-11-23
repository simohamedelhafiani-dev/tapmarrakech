import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={ 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS' };
const json=(body:unknown,status=200,extraHeaders:Record<string,string>={})=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json',...extraHeaders}});
import { distanceMeters, validCoordinateInput, validConfiguredCoordinates, normalizeRadius } from './nearby-geo.ts';
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 if(req.method!=='POST')return json({success:false,error:'POST requis'},405);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if(!url||!key)return json({success:false,error:'Configuration serveur manquante'},503);
 const admin=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
 const body=await req.json().catch(()=>null),token=typeof body?.access_token==='string'?body.access_token:'';
 const lat=body?.latitude,lng=body?.longitude;
 if(!token||!validCoordinateInput(lat,lng))return json({success:false,error:'Position ou jeton invalide'},400);
 const {data:link,error:linkErr}=await admin.from('loyalty_customer_links').select('customer_id').eq('access_token',token).maybeSingle();
 if(linkErr||!link)return json({success:false,error:'Carte fidélité non valide'},401);
 const {data:customer,error:cErr}=await admin.from('loyalty_customers').select('id,establishment_id,notification_consent,marketing_consent').eq('id',link.customer_id).maybeSingle();
 if(cErr||!customer)return json({success:false,error:'Client introuvable'},401);
 // Atomically limit authenticated customer calls across Edge instances: 10 per 60-second window.
 // Fail closed if the limiter RPC is unavailable to avoid bypassing the protection.
 const {data:limitRows,error:limitError}=await admin.rpc('smart_nearby_rate_limit',{p_customer_id:customer.id,p_limit:10,p_window_seconds:60});
 if(limitError||!Array.isArray(limitRows)||!limitRows[0])return json({success:false,error:'Protection anti-abus indisponible'},503);
 const limit=limitRows[0];
 if(!limit.allowed){
  const started=Date.parse(String(limit.window_started_at));
  const retryAfter=Number.isFinite(started)?Math.max(1,Math.ceil((started+60000-Date.now())/1000)):60;
  return json({success:false,error:'Trop de requêtes Smart Nearby. Réessayez plus tard.',retry_after:retryAfter},429,{'Retry-After':String(retryAfter)});
 }
 if(!customer.notification_consent||!customer.marketing_consent)return json({success:true,eligible:false,reason:'consent_missing'});
 const {data:config,error:cfgErr}=await admin.from('smart_marketing_configs').select('enabled,config').eq('establishment_id',customer.establishment_id).eq('smart_id','nearby').maybeSingle();
 if(cfgErr)return json({success:false,error:'Configuration indisponible'},500);
 if(!config?.enabled)return json({success:true,eligible:false,reason:'disabled'});
 const c=config.config??{},rawLat=c.latitude??c.lat,rawLng=c.longitude??c.lng,centerLat=Number(rawLat),centerLng=Number(rawLng),radius=normalizeRadius(c.radius_m??c.radius??250);
 if(!validConfiguredCoordinates(rawLat,rawLng))return json({success:false,error:'Coordonnées établissement non configurées'},409);
 const meters=distanceMeters(lat,lng,centerLat,centerLng);
 if(meters>radius)return json({success:true,eligible:false,distance_m:Math.round(meters)});
 const zone=String(c.zone_key??'main').slice(0,40);
 const {data:event,error:eventErr}=await admin.from('smart_nearby_events').insert({customer_id:customer.id,establishment_id:customer.establishment_id,zone_key:zone}).select('id').single();
 if(eventErr?.code==='23505')return json({success:true,eligible:false,reason:'already_notified_today'});
 if(eventErr)return json({success:false,error:'Enregistrement événement impossible'},500);
 const title=String(c.title??'Vous êtes à proximité !').slice(0,120),message=String(c.message??'Passez nous voir, nous serons ravis de vous accueillir !').slice(0,1000);
 const {error:notificationErr}=await admin.from('loyalty_card_notifications').insert({establishment_id:customer.establishment_id,customer_id:customer.id,title,message,type:'OFFER'});
 if(notificationErr){await admin.from('smart_nearby_events').delete().eq('id',event.id);return json({success:false,error:'Notification non créée'},500);}
 return json({success:true,eligible:true,distance_m:Math.round(meters),notification:'in_app'});
});
