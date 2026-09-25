import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const C={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const j=(d:unknown,s=200)=>new Response(JSON.stringify(d),{status:s,headers:{...C,'Content-Type':'application/json'}});

Deno.serve(async r=>{
  if(r.method==='OPTIONS') return new Response('ok',{headers:C});
  if(r.method!=='POST') return j({success:false,error:'Méthode non autorisée.'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL'),anon=Deno.env.get('SUPABASE_ANON_KEY'),service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'),priv=Deno.env.get('VAPID_PRIVATE_KEY');
    const subject=Deno.env.get('VAPID_SUBJECT')||'mailto:notifications@tapmarrakech.com';
    const pub='u3k1FqMnjg0lwntFbI4GQTSRuokEiGrMGM1V9lipyQg';
    if(!url||!anon||!service||!priv) return j({success:false,error:'VAPID_PRIVATE_KEY manquant dans Supabase.'},503);

    const auth=r.headers.get('Authorization');
    if(!auth?.startsWith('Bearer ')) return j({success:false,error:'Session utilisateur manquante.'},401);

    const uc=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:u,error:ue}=await uc.auth.getUser();
    if(ue||!u.user) return j({success:false,error:'Session utilisateur invalide ou expirée.'},401);

    const b=await r.json();
    const pid=String(b.promotion_id??'').trim(), eid=String(b.establishment_id??'').trim();
    if(!pid||!eid) return j({success:false,error:'Promotion et établissement obligatoires.'},400);

    const {data:es,error:ee}=await uc.rpc('get_my_establishments');
    if(ee) return j({success:false,error:'Impossible de vérifier l’accès à l’établissement.'},403);
    if(!((es??[]) as Array<Record<string,unknown>>).some(x=>String(x.id??'')===eid)) return j({success:false,error:'Accès à cet établissement refusé.'},403);

    const {data:p,error:pe}=await uc.from('promotions').select('id,name,promo_price,active').eq('id',pid).eq('establishment_id',eid).maybeSingle();
    if(pe||!p) return j({success:false,error:'Promotion introuvable ou accès refusé.'},404);
    if(!p.active) return j({success:false,error:'Cette promotion est masquée.'},400);

    const sc=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:ss,error:se}=await sc.from('loyalty_push_subscriptions').select('id,endpoint,p256dh,auth,card_url').eq('establishment_id',eid);
    if(se) return j({success:false,error:'Impossible de charger les abonnements de notification.'},500);
    if(!ss?.length) return j({success:true,sent:0,removed:0,skipped:0});

    webpush.setVapidDetails(subject,pub,priv);
    let sent=0,removed=0,skipped=0;

    for(const s of ss){
      if(!s.card_url){skipped++;continue}
      try{
        const u2=new URL(s.card_url);
        u2.searchParams.set('promotion',p.id);
        await webpush.sendNotification(
          {endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},
          JSON.stringify({
            title:'🎁 Nouvelle offre membre',
            body:p.promo_price!=null?String(p.name)+' — '+String(p.promo_price)+' MAD':String(p.name),
            icon:'/tapmarrakech-logo.svg',
            badge:'/tapmarrakech-logo.svg',
            tag:'promotion-'+p.id,
            data:{url:u2.toString(),promotionId:p.id},
          }),
          {TTL:86400,urgency:'high',topic:'promo-'+p.id}
        );
        sent++;
      }catch(e){
        const scode=Number((e as {statusCode?:number})?.statusCode??0);
        if(scode===404||scode===410){await sc.from('loyalty_push_subscriptions').delete().eq('id',s.id);removed++}
        else console.error('Push delivery failed',e);
      }
    }

    return j({success:true,sent,removed,skipped,total:ss.length});
  }catch(e){
    console.error(e);
    return j({success:false,error:e instanceof Error?e.message:'Erreur interne.'},500);
  }
});
