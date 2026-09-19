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
      if (typeof content?.text === 'string') {
        chunks.push(content.text);
      } else if (typeof content?.text?.value === 'string') {
        chunks.push(content.text.value);
      }
    }
  }

  return chunks.join('').trim();
}

function parseMenuJson(outputText: string): any {
  const cleaned = outputText
    .replace(new RegExp('^\\u0060\\u0060\\u0060(?:json)?\\s*', 'i'), '')
    .replace(new RegExp('\\s*\\u0060\\u0060\\u0060

const menuSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                description: { type: ['string', 'null'] },
                price: { type: 'number', minimum: 0 },
              },
              required: ['name', 'description', 'price'],
            },
          },
        },
        required: ['name', 'description', 'items'],
      },
    },
  },
  required: ['categories'],
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

    const form = await request.formData();
    const file = form.get('file');
    const establishmentId = String(form.get('establishment_id') ?? '').trim();

    if (!(file instanceof File)) return json({ success: false, error: 'Aucun fichier de menu reçu.' }, 400);
    if (!establishmentId) return json({ success: false, error: 'Établissement manquant.' }, 400);
    if (file.size > 20 * 1024 * 1024) return json({ success: false, error: 'Le fichier ne doit pas dépasser 20 Mo.' }, 400);

    const { data: accessible, error: accessError } = await userClient
      .from('establishments')
      .select('id, name')
      .eq('id', establishmentId)
      .maybeSingle();

    if (accessError || !accessible) return json({ success: false, error: 'Accès à cet établissement refusé.' }, 403);

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: aiSettings, error: aiSettingsError } = await serviceClient
      .from('ai_global_settings')
      .select('provider, model, api_key, enabled, temperature, max_output_tokens, system_instructions')
      .eq('id', true)
      .maybeSingle();

    if (aiSettingsError || !aiSettings) return json({ success: false, error: 'Configuration IA globale introuvable.' }, 503);

    const provider = String(aiSettings.provider ?? '').trim().toLowerCase();
    const model = String(aiSettings.model ?? '').trim();
    const apiKey = String(aiSettings.api_key ?? '').trim();
    if (aiSettings.enabled !== true || provider !== 'openai' || !model || !apiKey) {
      return json({ success: false, error: 'L’IA OpenAI doit être activée et configurée dans Admin → Configuration IA.' }, 503);
    }

    const uploadForm = new FormData();
    uploadForm.append('purpose', 'user_data');
    uploadForm.append('file', file, file.name);

    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadForm,
    });
    const uploadPayload = await uploadResponse.json();
    if (!uploadResponse.ok || !uploadPayload?.id) {
      console.error('OpenAI file upload error', uploadPayload);
      return json({ success: false, error: uploadPayload?.error?.message ?? 'Impossible d’envoyer le fichier au moteur IA.' }, 502);
    }

    const fileId = uploadPayload.id;

    try {
      const { data: menuPromptConfig } = await serviceClient
        .from('ai_business_types')
        .select('ai_prompt')
        .eq('name', 'Menu IA — Extraction')
        .eq('active', true)
        .maybeSingle();

      const configuredMenuPrompt = String(menuPromptConfig?.ai_prompt ?? '').trim();

      const systemPrompt = [
        configuredMenuPrompt,
        'Tu es l’assistant d’import de menus de TapMarrakech.',
        'Analyse le document fourni, qui peut être un PDF ou une image contenant un menu de restaurant, café, hôtel, spa ou commerce.',
        'Extrais uniquement ce qui est réellement visible dans le document. Ne fabrique jamais de produit, prix ou ingrédient.',
        'Regroupe les produits dans les catégories visibles. Si aucune catégorie claire n’existe, crée des catégories neutres uniquement à partir de la structure du document.',
        'Conserve les noms et descriptions aussi fidèlement que possible, en corrigeant uniquement les erreurs OCR évidentes.',
        'Les prix doivent être des nombres sans devise. Si un produit n’a pas de prix visible, utilise 0.',
        'Les descriptions peuvent contenir les ingrédients ou composants du produit lorsqu’ils sont présents.',
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
              content: [
                { type: 'input_text', text: `Établissement : ${accessible.name}. Analyse ce menu et prépare un brouillon structuré.` },
                { type: 'input_file', file_id: fileId },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'tapmarrakech_menu_import',
              strict: true,
              schema: menuSchema,
            },
          },
          max_output_tokens: Math.min(
            Math.max(Number(aiSettings.max_output_tokens) || 12000, 2000),
            30000
          ),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        console.error('OpenAI menu import error', payload);
        return json({ success: false, error: payload?.error?.message ?? 'Le moteur IA n’a pas pu analyser le menu.' }, 502);
      }

      const outputText = extractOutputText(payload);
      if (!outputText) return json({ success: false, error: 'Le moteur IA a retourné une réponse vide.' }, 502);

      let menu: any;

      try {
        menu = parseMenuJson(outputText);
      } catch (error) {
        console.error('OpenAI returned invalid menu JSON', {
          parseError: error instanceof Error ? error.message : String(error),
          outputPreview: outputText.slice(0, 2000),
        });

        return json({
          success: false,
          error: 'Le moteur IA a bien répondu, mais son résultat n’est pas dans un format JSON exploitable.',
        }, 502);
      }

      if (!Array.isArray(menu?.categories)) return json({ success: false, error: 'Aucune structure de menu détectée.' }, 422);

      menu.categories = menu.categories
        .filter((category: any) => String(category?.name ?? '').trim())
        .map((category: any) => ({
          name: String(category.name).trim(),
          description: category.description ? String(category.description).trim() : null,
          items: Array.isArray(category.items)
            ? category.items
                .filter((item: any) => String(item?.name ?? '').trim())
                .map((item: any) => ({
                  name: String(item.name).trim(),
                  description: item.description ? String(item.description).trim() : null,
                  price: Number.isFinite(Number(item.price)) && Number(item.price) >= 0 ? Number(item.price) : 0,
                }))
            : [],
        }));

      return json({ success: true, menu });
    } finally {
      await fetch(`https://api.openai.com/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      }).catch(() => undefined);
    }
  } catch (error) {
    console.error('import-menu unexpected error', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Erreur interne pendant l’import du menu.' }, 500);
  }
});
, 'i'), '')
    .trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    const firstBrace = cleaned.indexOf('{');
    const lastBrace = cleaned.lastIndexOf('}');

    if (firstBrace >= 0 && lastBrace > firstBrace) {
      return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }

    throw new Error('Le moteur IA n’a pas retourné un JSON valide.');
  }
}

const menuSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    categories: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          items: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                name: { type: 'string' },
                description: { type: ['string', 'null'] },
                price: { type: 'number', minimum: 0 },
              },
              required: ['name', 'description', 'price'],
            },
          },
        },
        required: ['name', 'description', 'items'],
      },
    },
  },
  required: ['categories'],
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

    const form = await request.formData();
    const file = form.get('file');
    const establishmentId = String(form.get('establishment_id') ?? '').trim();

    if (!(file instanceof File)) return json({ success: false, error: 'Aucun fichier de menu reçu.' }, 400);
    if (!establishmentId) return json({ success: false, error: 'Établissement manquant.' }, 400);
    if (file.size > 20 * 1024 * 1024) return json({ success: false, error: 'Le fichier ne doit pas dépasser 20 Mo.' }, 400);

    const { data: accessible, error: accessError } = await userClient
      .from('establishments')
      .select('id, name')
      .eq('id', establishmentId)
      .maybeSingle();

    if (accessError || !accessible) return json({ success: false, error: 'Accès à cet établissement refusé.' }, 403);

    const serviceClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: aiSettings, error: aiSettingsError } = await serviceClient
      .from('ai_global_settings')
      .select('provider, model, api_key, enabled, temperature, max_output_tokens, system_instructions')
      .eq('id', true)
      .maybeSingle();

    if (aiSettingsError || !aiSettings) return json({ success: false, error: 'Configuration IA globale introuvable.' }, 503);

    const provider = String(aiSettings.provider ?? '').trim().toLowerCase();
    const model = String(aiSettings.model ?? '').trim();
    const apiKey = String(aiSettings.api_key ?? '').trim();
    if (aiSettings.enabled !== true || provider !== 'openai' || !model || !apiKey) {
      return json({ success: false, error: 'L’IA OpenAI doit être activée et configurée dans Admin → Configuration IA.' }, 503);
    }

    const uploadForm = new FormData();
    uploadForm.append('purpose', 'user_data');
    uploadForm.append('file', file, file.name);

    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}` },
      body: uploadForm,
    });
    const uploadPayload = await uploadResponse.json();
    if (!uploadResponse.ok || !uploadPayload?.id) {
      console.error('OpenAI file upload error', uploadPayload);
      return json({ success: false, error: uploadPayload?.error?.message ?? 'Impossible d’envoyer le fichier au moteur IA.' }, 502);
    }

    const fileId = uploadPayload.id;

    try {
      const { data: menuPromptConfig } = await serviceClient
        .from('ai_business_types')
        .select('ai_prompt')
        .eq('name', 'Menu IA — Extraction')
        .eq('active', true)
        .maybeSingle();

      const configuredMenuPrompt = String(menuPromptConfig?.ai_prompt ?? '').trim();

      const systemPrompt = [
        configuredMenuPrompt,
        'Tu es l’assistant d’import de menus de TapMarrakech.',
        'Analyse le document fourni, qui peut être un PDF ou une image contenant un menu de restaurant, café, hôtel, spa ou commerce.',
        'Extrais uniquement ce qui est réellement visible dans le document. Ne fabrique jamais de produit, prix ou ingrédient.',
        'Regroupe les produits dans les catégories visibles. Si aucune catégorie claire n’existe, crée des catégories neutres uniquement à partir de la structure du document.',
        'Conserve les noms et descriptions aussi fidèlement que possible, en corrigeant uniquement les erreurs OCR évidentes.',
        'Les prix doivent être des nombres sans devise. Si un produit n’a pas de prix visible, utilise 0.',
        'Les descriptions peuvent contenir les ingrédients ou composants du produit lorsqu’ils sont présents.',
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
              content: [
                { type: 'input_text', text: `Établissement : ${accessible.name}. Analyse ce menu et prépare un brouillon structuré.` },
                { type: 'input_file', file_id: fileId },
              ],
            },
          ],
          text: {
            format: {
              type: 'json_schema',
              name: 'tapmarrakech_menu_import',
              strict: true,
              schema: menuSchema,
            },
          },
          max_output_tokens: Math.min(Math.max(Number(aiSettings.max_output_tokens) || 12000, 2000), 30000),
          temperature: Math.min(Math.max(Number(aiSettings.temperature) || 0.1, 0), 1),
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        console.error('OpenAI menu import error', payload);
        return json({ success: false, error: payload?.error?.message ?? 'Le moteur IA n’a pas pu analyser le menu.' }, 502);
      }

      const outputText = extractOutputText(payload);
      if (!outputText) return json({ success: false, error: 'Le moteur IA a retourné une réponse vide.' }, 502);

      let menu: any;
      try {
        menu = JSON.parse(outputText);
      } catch {
        return json({ success: false, error: 'Le résultat IA est inexploitable.' }, 502);
      }

      if (!Array.isArray(menu?.categories)) return json({ success: false, error: 'Aucune structure de menu détectée.' }, 422);

      menu.categories = menu.categories
        .filter((category: any) => String(category?.name ?? '').trim())
        .map((category: any) => ({
          name: String(category.name).trim(),
          description: category.description ? String(category.description).trim() : null,
          items: Array.isArray(category.items)
            ? category.items
                .filter((item: any) => String(item?.name ?? '').trim())
                .map((item: any) => ({
                  name: String(item.name).trim(),
                  description: item.description ? String(item.description).trim() : null,
                  price: Number.isFinite(Number(item.price)) && Number(item.price) >= 0 ? Number(item.price) : 0,
                }))
            : [],
        }));

      return json({ success: true, menu });
    } finally {
      await fetch(`https://api.openai.com/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${apiKey}` },
      }).catch(() => undefined);
    }
  } catch (error) {
    console.error('import-menu unexpected error', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Erreur interne pendant l’import du menu.' }, 500);
  }
});
