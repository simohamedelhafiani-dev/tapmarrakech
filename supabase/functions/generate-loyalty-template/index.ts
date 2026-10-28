import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...corsHeaders,'Content-Type':'application/json'}});

Deno.serve(async request=>{
  if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
  if(request.method!=='POST') return json({success:false,error:'Méthode non autorisée.'},405);
  try{
    const url=Deno.env.get('SUPABASE_URL'), anon=Deno.env.get('SUPABASE_ANON_KEY'), service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if(!url||!anon||!service) return json({success:false,error:'Configuration Supabase manquante.'},500);
    const auth=request.headers.get('Authorization');
    if(!auth?.startsWith('Bearer ')) return json({success:false,error:'Session utilisateur manquante.'},401);
    const userClient=createClient(url,anon,{global:{headers:{Authorization:auth}},auth:{persistSession:false,autoRefreshToken:false}});
    const {data:userData,error:userError}=await userClient.auth.getUser();
    if(userError||!userData.user) return json({success:false,error:'Session utilisateur invalide.'},401);
    const body=await request.json();
    const establishmentId=String(body.establishment_id??'').trim();
    const prompt=String(body.prompt??'').trim().slice(0,1000);
    if(!establishmentId||!prompt) return json({success:false,error:'Établissement et description obligatoires.'},400);

    const {data:places,error:accessError}=await userClient.rpc('get_my_establishments');
    if(accessError||!(places??[]).some((x:any)=>String(x.id)===establishmentId)) return json({success:false,error:'Accès à cet établissement refusé.'},403);


    // Server-side subscription enforcement for AI loyalty-card generation.
    const {data:subscriptionData,error:subscriptionError}=await userClient.rpc('get_responsible_subscription_card',{p_establishment_id:establishmentId});
    if(subscriptionError||!subscriptionData||typeof subscriptionData!=='object'||Array.isArray(subscriptionData)) return json({success:false,error:'Impossible de vérifier les droits de l’abonnement.'},403);
    const subscription=subscriptionData as Record<string,unknown>;
    const status=String(subscription.subscription_status??'').toLowerCase();
    const end=subscription.current_period_end?new Date(String(subscription.current_period_end)).getTime():null;
    const features=Array.isArray(subscription.features)?subscription.features.map((x)=>String(x).trim().toLowerCase()):[];
    const expired=end!==null&&Number.isFinite(end)&&end<=Date.now();
    if(!['active','trial'].includes(status)||expired||!features.some((x)=>['fidélité','programme fidélité'].includes(x))) return json({success:false,error:'La génération IA des cartes de fidélité n’est pas incluse dans votre abonnement actif.'},403);

    const serviceClient=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
    const {data:settings,error:settingsError}=await serviceClient.from('ai_global_settings').select('provider,api_key,enabled').eq('id',true).maybeSingle();
    if(settingsError||!settings?.enabled||String(settings.provider).toLowerCase()!=='openai'||!settings.api_key) return json({success:false,error:'L’IA OpenAI doit être activée dans Configuration IA.'},503);

    const place=(places??[]).find((x:any)=>String(x.id)===establishmentId);
    const establishmentName=String(place?.name??'Établissement');
    const imagePrompt = 'Design a completely original premium visual skin for a DIGITAL loyalty card used on a smartphone. User direction: ' + prompt + '. Landscape 1.62:1 composition. This is NOT a printed business card and NOT a front/back document. Create only the visual atmosphere, materials, textures, gradients, patterns and elegant decorative composition that will sit behind real app content. Absolutely NO text, NO letters, NO numbers, NO logo, NO brand name, NO QR code, NO barcode, NO fake customer data, NO stamps, NO placeholder boxes, NO circles intended as QR/stamp placeholders, NO UI panels, NO frames, NO buttons, NO people, NO watermark. Keep the center and lower areas clean enough for the application to overlay the real establishment logo, customer name, points and QR code. Sophisticated premium B2B/luxury aesthetic. Make it visually strong and polished on a phone screen. Do not imitate or reuse any predefined TapMarrakech template for ' + establishmentName + '.';

    const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${settings.api_key}`,'Content-Type':'application/json'},body:JSON.stringify({
      model:'gpt-5',
      input:[{role:'user',content:[{type:'input_text',text:imagePrompt}]}],
      tools:[{type:'image_generation',model:'gpt-image-1',size:'1536x1024',quality:'medium',output_format:'png'}],
      tool_choice:'required'
    })});
    const payload=await response.json();
    if(!response.ok) return json({success:false,error:payload?.error?.message??'Génération IA impossible.'},502);
    const call=(payload.output??[]).find((x:any)=>x?.type==='image_generation_call'&&typeof x.result==='string');
    if(!call?.result) return json({success:false,error:'Aucune image retournée par l’IA.'},502);

    const bytes=Uint8Array.from(atob(call.result),(c)=>c.charCodeAt(0));
    const path=`loyalty-templates/${establishmentId}/${crypto.randomUUID()}.png`;
    const {error:uploadError}=await serviceClient.storage.from('promotion-images').upload(path,bytes,{contentType:'image/png',cacheControl:'31536000',upsert:false});
    if(uploadError) return json({success:false,error:'Impossible d’enregistrer le visuel IA.'},500);

    const {data:publicData}=serviceClient.storage.from('promotion-images').getPublicUrl(path);
    const imageUrl=publicData.publicUrl;
    const generationId=crypto.randomUUID();
    const generationConfig={background_image_url:imageUrl,ai_prompt:prompt};

    const {error:generationError}=await serviceClient.from('loyalty_ai_generations').insert({
      id:generationId,
      establishment_id:establishmentId,
      image_url:imageUrl,
      prompt,
      template_id:'luxury',
      primary_color:'#173D32',
      secondary_color:'#D3A84C',
      background_color:'#F7F7F3',
      text_color:'#FFFFFF',
      button_color:'#173D32',
      design_config:generationConfig,
      created_by:userData.user.id
    });
    if(generationError) return json({success:false,error:'Visuel créé mais impossible de l’ajouter à la galerie.'},500);

    return json({
      success:true,generation_id:generationId,image_url:imageUrl,template_id:'ai',
      primary_color:'#173D32',secondary_color:'#D3A84C',background_color:'#F7F7F3',text_color:'#FFFFFF',button_color:'#173D32',
      design_config:{...generationConfig,ai_generation_id:generationId}
    });
  }catch(error){console.error(error);return json({success:false,error:error instanceof Error?error.message:'Erreur interne.'},500);}
});