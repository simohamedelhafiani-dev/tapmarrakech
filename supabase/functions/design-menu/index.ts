import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string') return payload.output_text.trim();

  const chunks: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
      else if (typeof content?.text?.value === 'string') chunks.push(content.text.value);
    }
  }
  return chunks.join('').trim();
}

const designSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    style: {
      type: 'string',
      enum: ['editorial', 'immersive', 'minimal', 'luxury'],
    },
    hero: {
      type: 'object',
      additionalProperties: false,
      properties: {
        eyebrow: { type: ['string', 'null'] },
        title: { type: 'string' },
        subtitle: { type: ['string', 'null'] },
      },
      required: ['eyebrow', 'title', 'subtitle'],
    },
    intro: {
      type: 'object',
      additionalProperties: false,
      properties: {
        title: { type: ['string', 'null'] },
        text: { type: ['string', 'null'] },
      },
      required: ['title', 'text'],
    },
    sections: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: {
            type: 'string',
            enum: ['category'],
          },
          category_id: { type: 'string' },
          title: { type: 'string' },
          subtitle: { type: ['string', 'null'] },
          layout: {
            type: 'string',
            enum: ['feature', 'grid', 'list'],
          },
          item_ids: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['type', 'category_id', 'title', 'subtitle', 'layout', 'item_ids'],
      },
    },
  },
  required: ['style', 'hero', 'intro', 'sections'],
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ success: false, error: 'Configuration Supabase manquante.' }, 500);

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) return json({ success: false, error: 'Session utilisateur manquante.' }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ success: false, error: 'Session utilisateur invalide ou expirée.' }, 401);

    const body = await request.json();
    const establishmentId = String(body?.establishment_id ?? '').trim();
    const menu = body?.menu;

    if (!establishmentId || !menu || !Array.isArray(menu.categories)) {
      return json({ success: false, error: 'Données du menu manquantes.' }, 400);
    }

    const { data: establishment, error: accessError } = await userClient
      .from('establishments')
      .select('id,name,description,business_type,logo_url')
      .eq('id', establishmentId)
      .maybeSingle();

    if (accessError || !establishment) return json({ success: false, error: 'Accès à cet établissement refusé.' }, 403);

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: aiSettings, error: aiSettingsError } = await serviceClient
      .from('ai_global_settings')
      .select('provider,model,api_key,enabled,max_output_tokens,system_instructions')
      .eq('id', true)
      .maybeSingle();

    if (aiSettingsError || !aiSettings) return json({ success: false, error: 'Configuration IA globale introuvable.' }, 503);

    const provider = String(aiSettings.provider ?? '').trim().toLowerCase();
    const model = String(aiSettings.model ?? '').trim();
    const apiKey = String(aiSettings.api_key ?? '').trim();

    if (aiSettings.enabled !== true || provider !== 'openai' || !model || !apiKey) {
      return json({ success: false, error: 'L’IA OpenAI doit être activée et configurée dans Admin → Configuration IA.' }, 503);
    }

    const { data: promptConfig } = await serviceClient
      .from('ai_business_types')
      .select('ai_prompt')
      .eq('name', 'Menu IA — Design Premium')
      .eq('active', true)
      .maybeSingle();

    const configuredPrompt = String(promptConfig?.ai_prompt ?? '').trim();

    const compactMenu = {
      categories: menu.categories.map((category: any) => ({
        id: category.id,
        name: category.name,
        description: category.description ?? null,
        items: Array.isArray(category.items)
          ? category.items.map((item: any) => ({
              id: item.id,
              name: item.name,
              description: item.description ?? null,
              price: item.price,
              image_url: item.image_url ?? null,
            }))
          : [],
      })),
    };

    const systemPrompt = [
      configuredPrompt,
      'Tu construis maintenant la direction de présentation du menu digital.',
      'Ne modifie pas les données produits et n’invente jamais de produit, prix, ingrédient, allergène ou photo.',
      `Le mode photo sélectionné est : ${body?.photo_mode === 'without_photos' ? 'sans photos' : 'avec photos'}.`,
      'Utilise uniquement les catégories et produits fournis.',
      'Choisis une direction visuelle adaptée au contexte disponible.',
      'RÈGLE ABSOLUE SUR LES CATÉGORIES : tu dois respecter exactement les catégories fournies par l’établissement.',
      'Ne fusionne jamais deux catégories. Ne divise jamais une catégorie en sous-catégories. Ne renomme pas les catégories source.',
      'Crée exactement UNE section de type category pour CHAQUE catégorie source, dans le MÊME ORDRE que le menu fourni.',
      'Chaque section doit utiliser exactement le category_id de sa catégorie source.',
      'Chaque section doit contenir TOUS les item_ids de sa catégorie source, dans le même ordre, sans en supprimer, déplacer ou dupliquer.',
      'N’ajoute aucune section featured, signature ou catégorie supplémentaire : les catégories source sont la structure officielle du menu.',
      'Si une catégorie contient beaucoup de produits, adapte uniquement le layout (list ou grid) sans découper la catégorie.',
      'Ne crée pas de section vide.',
      'Mode photo demandé : respecte strictement le choix photo_mode fourni. Avec photos = utilise uniquement les photos réellement présentes. Sans photos = conçois un menu sans aucun emplacement ou composant photo.',
      'Le frontend s’occupe du style visuel : tu fournis uniquement la hiérarchie, les textes éditoriaux et la structure.',
      'Réponds uniquement avec le JSON demandé.',
      String(aiSettings.system_instructions ?? '').trim(),
    ].filter(Boolean).join(' ');

    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'system',
            content: [{ type: 'input_text', text: systemPrompt }],
          },
          {
            role: 'user',
            content: [{
              type: 'input_text',
              text: JSON.stringify({
                establishment: {
                  name: establishment.name,
                  business_type: establishment.business_type ?? null,
                  description: establishment.description ?? null,
                  logo_url: establishment.logo_url ?? null,
                },
                menu: compactMenu,
                photo_mode: body?.photo_mode === 'without_photos' ? 'without_photos' : 'with_photos',
              }),
            }],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'tapmarrakech_premium_menu_design',
            strict: true,
            schema: designSchema,
          },
        },
        max_output_tokens: Math.min(Math.max(Number(aiSettings.max_output_tokens) || 6000, 3000), 12000),
      }),
    });

    const payload = await response.json();

    if (!response.ok) {
      console.error('OpenAI premium menu design error', payload);
      return json({
        success: false,
        error: payload?.error?.message ?? 'Le moteur IA n’a pas pu créer le design du menu.',
      }, 502);
    }

    const outputText = extractOutputText(payload);
    if (!outputText) return json({ success: false, error: 'Le moteur IA a retourné une réponse vide.' }, 502);

    let design: any;
    try {
      design = JSON.parse(outputText);
    } catch (error) {
      console.error('OpenAI returned invalid premium menu design', {
        parseError: error instanceof Error ? error.message : String(error),
        outputPreview: outputText.slice(0, 2000),
      });
      return json({ success: false, error: 'Le design IA retourné n’est pas exploitable.' }, 502);
    }

    return json({ success: true, design });
  } catch (error) {
    console.error('design-menu unexpected error', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne pendant la génération du design.',
    }, 500);
  }
});
