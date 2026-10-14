import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const corsHeaders = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), {status,headers:{...corsHeaders,'Content-Type':'application/json'}}); }
function extractOutputText(payload: any): string {
 if(typeof payload?.output_text==='string') return payload.output_text.trim();
 const chunks:string[]=[]; for(const item of payload?.output??[]) for(const content of item?.content??[]) if(typeof content?.text==='string') chunks.push(content.text); else if(typeof content?.text?.value==='string') chunks.push(content.text.value);
 return chunks.join('').trim();
}
const schema={type:'object',additionalProperties:false,properties:{background:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},surface:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},text:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'},accent:{type:'string',pattern:'^#[0-9A-Fa-f]{6}$'}},required:['background','surface','text','accent']};
Deno.serve(async request=>{
 if(request.method==='OPTIONS') return new Response('ok',{headers:corsHeaders});
 if(request.method!=='POST') return json({success:false,error:'Méthode non autorisée.'},405);
 try {
  const url=Deno.env.get('SUPABASE_URL'), anon=Deno.env.get('SUPABASE_ANON_KEY'), service=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if(!url||!anon||!service) return json({success:false,error:'Configuration Supabase manquante.'},500);
  const authorization=request.headers.get('Authorization'); if(!authorization?.startsWith('Bearer ')) return json({success:false,error:'Session utilisateur manquante.'},401);
  const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data:userData,error:userError}=await userClient.auth.getUser(); if(userError||!userData.user) return json({success:false,error:'Session utilisateur invalide ou expirée.'},401);
  const body=await request.json(), id=String(body?.establishment_id??'').trim(); if(!id) return json({success:false,error:'Établissement manquant.'},400);
  const {data:est,error:accessError}=await userClient.from('establishments').select('id,name,description,business_type,logo_url').eq('id',id).maybeSingle();
  if(accessError||!est) return json({success:false,error:'Accès à cet établissement refusé.'},403);
  if(!est.logo_url) return json({success:false,error:'Ajoute un logo à ton établissement avant de générer la palette.'},400);
  const admin=createClient(url,service,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:settings,error:settingsError}=await admin.from('ai_global_settings').select('provider,model,api_key,enabled,system_instructions').eq('id',true).maybeSingle();
  if(settingsError||!settings) return json({success:false,error:'Configuration IA globale introuvable.'},503);
  const provider=String(settings.provider??'').trim().toLowerCase(), model=String(settings.model??'').trim(), key=String(settings.api_key??'').trim();
  if(settings.enabled!==true||provider!=='openai'||!model||!key) return json({success:false,error:'Active et configure OpenAI dans Admin → Configuration IA.'},503);
  const response=await fetch('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify({
   model,
   input:[
    {role:'system',content:[{type:'input_text',text:['Tu es directeur artistique spécialisé en identité de marque et design de menus mobiles. Analyse le logo fourni et crée une palette cohérente avec la marque et le template existant. background = fond global, surface = cartes et panneaux, text = texte très lisible, accent = couleur de marque pour prix et éléments importants. Reprends les couleurs dominantes du logo et dérive des tons élégants. Le contraste doit être fort et le texte lisible sur background et surface. Ne change jamais la structure du template. Retourne uniquement quatre couleurs hexadécimales #RRGGBB.',String(settings.system_instructions??'').trim()].filter(Boolean).join(' ')}]},
    {role:'user',content:[{type:'input_text',text:JSON.stringify({establishment:{name:est.name,business_type:est.business_type??null,description:est.description??null}})},{type:'input_image',image_url:est.logo_url,detail:'high'}]}
   ],
   text:{format:{type:'json_schema',name:'establishment_brand_palette',strict:true,schema}},max_output_tokens:500
  })});
  const payload=await response.json(); if(!response.ok){console.error('OpenAI brand palette error',payload);return json({success:false,error:payload?.error?.message??'L’IA n’a pas pu analyser le logo.'},502);}
  const output=extractOutputText(payload); if(!output) return json({success:false,error:'L’IA a retourné une réponse vide.'},502);
  let colors:any; try{colors=JSON.parse(output);}catch{return json({success:false,error:'La palette IA est invalide.'},502);}
  for(const key of ['background','surface','text','accent']) if(typeof colors[key]!=='string'||!/^#[0-9a-fA-F]{6}$/.test(colors[key])) return json({success:false,error:'La palette IA contient une couleur invalide.'},502);
  return json({success:true,colors});
 }catch(error){console.error('generate-brand-palette unexpected error',error);return json({success:false,error:error instanceof Error?error.message:'Erreur interne lors de la génération.'},500);}
});
