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

function toNumberOrNull(value: unknown) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée.' }, 405);

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceKey) {
      return json({ success: false, error: 'Configuration Supabase manquante.' }, 500);
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Session utilisateur manquante.' }, 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ success: false, error: 'Session utilisateur invalide ou expirée.' }, 401);
    }

    let body: {
      establishment_id?: string;
      name?: string;
      description?: string | null;
      normal_price?: number | null;
      promo_price?: number | null;
    };

    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: 'Données de promotion invalides.' }, 400);
    }

    const establishmentId = String(body.establishment_id ?? '').trim();
    const name = String(body.name ?? '').trim().slice(0, 160);
    const description = body.description ? String(body.description).trim().slice(0, 1000) : null;
    const normalPrice = toNumberOrNull(body.normal_price);
    const promoPrice = toNumberOrNull(body.promo_price);

    if (!establishmentId || !name) {
      return json({ success: false, error: 'Établissement et nom de promotion obligatoires.' }, 400);
    }

    const { data: accessible, error: accessError } = await userClient.rpc('get_my_establishments');
    if (accessError) {
      console.error('get_my_establishments failed', accessError);
      return json({ success: false, error: 'Impossible de vérifier l’accès à l’établissement.' }, 403);
    }

    const establishment = ((accessible ?? []) as Array<Record<string, unknown>>).find(
      (item) => String(item.id ?? '') === establishmentId
    );

    if (!establishment) {
      return json({ success: false, error: 'Accès à cet établissement refusé.' }, 403);
    }

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: aiSettings, error: aiSettingsError } = await serviceClient
      .from('ai_global_settings')
      .select('provider, api_key, enabled')
      .eq('id', true)
      .maybeSingle();

    if (aiSettingsError || !aiSettings) {
      return json({ success: false, error: 'Configuration IA globale introuvable.' }, 503);
    }

    const provider = String(aiSettings.provider ?? '').trim().toLowerCase();
    const apiKey = String(aiSettings.api_key ?? '').trim();

    if (aiSettings.enabled !== true || provider !== 'openai' || !apiKey) {
      return json({
        success: false,
        error: 'L’IA OpenAI doit être activée et configurée dans Admin → Configuration IA.',
      }, 503);
    }

    const { data: promptConfig, error: promptError } = await serviceClient
      .from('ai_business_types')
      .select('ai_prompt')
      .eq('name', 'Promotion IA — Image')
      .eq('active', true)
      .maybeSingle();

    if (promptError) {
      console.error('promotion prompt query failed', promptError);
      return json({ success: false, error: 'Impossible de charger le prompt de promotion.' }, 503);
    }

    const configuredPrompt = String(promptConfig?.ai_prompt ?? '').trim();
    if (!configuredPrompt) {
      return json({ success: false, error: 'Le prompt de génération des promotions n’est pas configuré par l’administrateur.' }, 503);
    }

    const establishmentName = String(establishment.name ?? 'Établissement').trim();

    const prompt = [
      configuredPrompt,
      '',
      'CONTEXTE FOURNI PAR LE RESPONSABLE :',
      `Établissement : ${establishmentName}`,
      `Promotion : ${name}`,
      description ? `Description : ${description}` : '',
      normalPrice !== null ? `Prix normal : ${normalPrice} MAD` : '',
      promoPrice !== null ? `Prix promotionnel : ${promoPrice} MAD` : '',
      '',
      'Génère un visuel promotionnel carré, propre et premium. Ne remplace pas les informations commerciales par des inventions.',
    ].filter(Boolean).join('\n');

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-5',
        input: [
          {
            role: 'user',
            content: [{ type: 'input_text', text: prompt }],
          },
        ],
        tools: [
          {
            type: 'image_generation',
            model: 'gpt-image-1',
            size: '1024x1024',
            quality: 'medium',
            output_format: 'png',
          },
        ],
        tool_choice: 'required',
      }),
    });

    const openaiPayload = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error('OpenAI promotion image error', {
        status: openaiResponse.status,
        error: openaiPayload?.error?.message ?? 'Unknown error',
      });
      return json({
        success: false,
        error: openaiPayload?.error?.message ?? 'Le moteur IA n’a pas pu générer le visuel.',
      }, 502);
    }

    const imageCall = (openaiPayload?.output ?? []).find(
      (item: any) => item?.type === 'image_generation_call' && typeof item?.result === 'string'
    );

    const imageBase64 = imageCall?.result;
    if (!imageBase64) {
      return json({ success: false, error: 'Le moteur IA a terminé sans retourner d’image.' }, 502);
    }

    const imageBytes = Uint8Array.from(
      atob(imageBase64),
      (character) => character.charCodeAt(0)
    );

    const imagePath = `${establishmentId}/${crypto.randomUUID()}.png`;

    const { error: uploadError } = await serviceClient.storage
      .from('promotion-images')
      .upload(imagePath, imageBytes, {
        contentType: 'image/png',
        cacheControl: '31536000',
        upsert: false,
      });

    if (uploadError) {
      console.error('Promotion image upload failed', uploadError);
      return json({ success: false, error: 'Impossible d’enregistrer le visuel généré.' }, 500);
    }

    const { data: publicUrlData } = serviceClient.storage
      .from('promotion-images')
      .getPublicUrl(imagePath);

    const imageUrl = publicUrlData?.publicUrl;
    if (!imageUrl) {
      await serviceClient.storage.from('promotion-images').remove([imagePath]).catch(() => undefined);
      return json({ success: false, error: 'Impossible de créer le lien public du visuel.' }, 500);
    }

    const { data: existingPromotions, error: orderError } = await userClient
      .from('promotions')
      .select('display_order')
      .eq('establishment_id', establishmentId)
      .order('display_order', { ascending: false })
      .limit(1);

    if (orderError) {
      await serviceClient.storage.from('promotion-images').remove([imagePath]).catch(() => undefined);
      return json({ success: false, error: 'Impossible de préparer la publication de la promotion.' }, 500);
    }

    const nextOrder = Number(existingPromotions?.[0]?.display_order ?? -1) + 1;

    const { data: promotion, error: insertError } = await userClient
      .from('promotions')
      .insert({
        establishment_id: establishmentId,
        name,
        description,
        image_url: imageUrl,
        normal_price: normalPrice,
        promo_price: promoPrice,
        active: true,
        display_order: nextOrder,
      })
      .select('*')
      .single();

    if (insertError) {
      await serviceClient.storage.from('promotion-images').remove([imagePath]).catch(() => undefined);
      console.error('Promotion insert failed', insertError);
      return json({ success: false, error: 'Impossible de publier la promotion.' }, 500);
    }

    return json({ success: true, promotion });
  } catch (error) {
    console.error('generate-promotion-image unexpected error', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur interne pendant la génération de la promotion.',
    }, 500);
  }
});
