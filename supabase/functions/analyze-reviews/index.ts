import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type ReviewRow = {
  id: string;
  establishment_id: string;
  rating: number;
  comment: string | null;
  status: string;
  created_at: string;
};

type EstablishmentRow = {
  id: string;
  name: string;
  ai_business_type_id: string | null;
};

type Analysis = {
  summary: string;
  sentiment: string;
  satisfaction_score: number;
  strengths: string[];
  weaknesses: string[];
  recurring_issues: {
    topic: string;
    frequency: string;
    priority: string;
    explanation: string;
  }[];
  recommendations: {
    priority: string;
    action: string;
    reason: string;
  }[];
  actions_prioritaires: {
    priority: string;
    action: string;
    reason: string;
    impact: string;
  }[];
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeRating(value: unknown) {
  const rating = Number(value);
  return Number.isFinite(rating) && rating >= 1 && rating <= 5 ? rating : 0;
}

function buildStatistics(reviews: ReviewRow[]) {
  const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };

  for (const review of reviews) {
    const rating = normalizeRating(review.rating);
    if (rating) distribution[String(rating) as keyof typeof distribution] += 1;
  }

  const total = reviews.length;
  const average = total
    ? reviews.reduce((sum, review) => sum + normalizeRating(review.rating), 0) / total
    : 0;

  return {
    total_reviews: total,
    average_rating: Number(average.toFixed(2)),
    positive_reviews: reviews.filter((review) => normalizeRating(review.rating) >= 4).length,
    negative_reviews: reviews.filter((review) => normalizeRating(review.rating) <= 3).length,
    rating_distribution: distribution,
  };
}

function extractOutputText(payload: any): string {
  if (typeof payload?.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text;
  }

  const chunks: string[] = [];
  for (const item of payload?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === 'string') chunks.push(content.text);
    }
  }
  return chunks.join('').trim();
}

const analysisSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    sentiment: { type: 'string' },
    satisfaction_score: { type: 'number', minimum: 0, maximum: 100 },
    strengths: {
      type: 'array',
      items: { type: 'string' },
    },
    weaknesses: {
      type: 'array',
      items: { type: 'string' },
    },
    recurring_issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          topic: { type: 'string' },
          frequency: { type: 'string' },
          priority: { type: 'string' },
          explanation: { type: 'string' },
        },
        required: ['topic', 'frequency', 'priority', 'explanation'],
      },
    },
    recommendations: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          priority: { type: 'string' },
          action: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['priority', 'action', 'reason'],
      },
    },
    actions_prioritaires: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          priority: { type: 'string' },
          action: { type: 'string' },
          reason: { type: 'string' },
          impact: { type: 'string' },
        },
        required: ['priority', 'action', 'reason', 'impact'],
      },
    },
  },
  required: [
    'summary',
    'sentiment',
    'satisfaction_score',
    'strengths',
    'weaknesses',
    'recurring_issues',
    'recommendations',
    'actions_prioritaires',
  ],
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json({ success: false, error: 'Méthode non autorisée.' }, 405);
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    const openaiModel = Deno.env.get('OPENAI_MODEL') || 'gpt-5.6-luna';

    if (!supabaseUrl || !supabaseAnonKey) {
      return json({
        success: false,
        error: 'Configuration Supabase manquante sur la fonction analyze-reviews.',
      }, 500);
    }

    if (!openaiApiKey) {
      return json({
        success: false,
        error: 'OPENAI_API_KEY n’est pas configurée dans les secrets Supabase.',
      }, 500);
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization?.startsWith('Bearer ')) {
      return json({ success: false, error: 'Session utilisateur manquante.' }, 401);
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authorization,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) {
      return json({ success: false, error: 'Session utilisateur invalide ou expirée.' }, 401);
    }

    let body: { establishment_id?: string } = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const requestedEstablishmentId = body.establishment_id?.trim() || null;

    const { data: establishments, error: establishmentError } = await userClient
      .from('establishments')
      .select('id, name, ai_business_type_id')
      .order('created_at', { ascending: false });

    if (establishmentError) {
      console.error('establishments query failed', establishmentError);
      return json({
        success: false,
        error: `Impossible de récupérer les établissements accessibles : ${establishmentError.message}`,
      }, 403);
    }

    const accessibleEstablishments = (establishments ?? []) as EstablishmentRow[];

    if (!accessibleEstablishments.length) {
      return json({
        success: false,
        error: 'Aucun établissement accessible pour cet utilisateur.',
      }, 403);
    }

    const allowedIds = new Set(accessibleEstablishments.map((item) => item.id));

    if (requestedEstablishmentId && !allowedIds.has(requestedEstablishmentId)) {
      return json({
        success: false,
        error: 'Vous n’êtes pas autorisé à analyser cet établissement.',
      }, 403);
    }

    const targetIds = requestedEstablishmentId
      ? [requestedEstablishmentId]
      : accessibleEstablishments.map((item) => item.id);

    const { data: reviews, error: reviewsError } = await userClient
      .from('reviews')
      .select('id, establishment_id, rating, comment, status, created_at')
      .in('establishment_id', targetIds)
      .order('created_at', { ascending: false })
      .limit(500);

    if (reviewsError) {
      console.error('reviews query failed', reviewsError);
      return json({
        success: false,
        error: `Impossible de récupérer les avis : ${reviewsError.message}`,
      }, 403);
    }

    const reviewRows = (reviews ?? []) as ReviewRow[];

    if (!reviewRows.length) {
      return json({
        success: false,
        error: 'Aucun avis disponible pour lancer l’analyse.',
      }, 400);
    }

    const statistics = buildStatistics(reviewRows);

    const selectedEstablishments = accessibleEstablishments.filter((item) =>
      targetIds.includes(item.id)
    );

    let businessTypes: Record<string, { name: string; description: string | null; ai_prompt: string | null }> = {};

    const businessTypeIds = [...new Set(
      selectedEstablishments
        .map((item) => item.ai_business_type_id)
        .filter((value): value is string => Boolean(value))
    )];

    if (businessTypeIds.length) {
      const { data: typeRows, error: typeError } = await userClient
        .from('ai_business_types')
        .select('id, name, description, ai_prompt')
        .in('id', businessTypeIds);

      if (!typeError) {
        businessTypes = Object.fromEntries(
          (typeRows ?? []).map((item: any) => [
            item.id,
            {
              name: item.name,
              description: item.description ?? null,
              ai_prompt: item.ai_prompt ?? null,
            },
          ])
        );
      }
    }

    const establishmentContext = selectedEstablishments.map((item) => ({
      id: item.id,
      name: item.name,
      business_type: item.ai_business_type_id
        ? businessTypes[item.ai_business_type_id]?.name ?? null
        : null,
      business_context: item.ai_business_type_id
        ? businessTypes[item.ai_business_type_id]?.description ?? null
        : null,
      ai_guidance: item.ai_business_type_id
        ? businessTypes[item.ai_business_type_id]?.ai_prompt ?? null
        : null,
    }));

    const sanitizedReviews = reviewRows.map((review) => ({
      rating: normalizeRating(review.rating),
      comment: (review.comment ?? '').slice(0, 1200),
      status: review.status,
      created_at: review.created_at,
      establishment_id: review.establishment_id,
    }));

    const systemPrompt = [
      'Tu es l’analyste réputation de TapMarrakech.',
      'Analyse uniquement les données fournies. Ne fabrique aucun fait, chiffre ou problème.',
      'Les avis peuvent être en français, arabe, darija ou anglais : comprends leur langue et réponds en français professionnel.',
      'Ne révèle aucune donnée personnelle et ne cite jamais les identifiants techniques.',
      'La satisfaction_score doit être une estimation de 0 à 100 fondée principalement sur les notes et le contenu des avis.',
      'Identifie les thèmes réellement récurrents. Si un thème n’est pas suffisamment présent, ne le présente pas comme récurrent.',
      'Les priorités doivent être explicites : Critique, Haute, Moyenne ou Faible.',
      'Les recommandations doivent être concrètes, réalisables par un commerce et directement liées aux avis.',
      'Retourne exactement la structure JSON demandée.',
    ].join(' ');

    const userPrompt = JSON.stringify({
      establishments: establishmentContext,
      statistics,
      reviews: sanitizedReviews,
    });

    const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: openaiModel,
        input: [
          {
            role: 'system',
            content: [
              {
                type: 'input_text',
                text: systemPrompt,
              },
            ],
          },
          {
            role: 'user',
            content: [
              {
                type: 'input_text',
                text: userPrompt,
              },
            ],
          },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: 'tapmarrakech_review_analysis',
            strict: true,
            schema: analysisSchema,
          },
        },
        max_output_tokens: 4000,
      }),
    });

    const openaiPayload = await openaiResponse.json();

    if (!openaiResponse.ok) {
      console.error('OpenAI API error', {
        status: openaiResponse.status,
        error: openaiPayload?.error?.message ?? 'Unknown error',
      });

      return json({
        success: false,
        error: `Le moteur IA a refusé la requête : ${openaiPayload?.error?.message ?? 'erreur OpenAI'}`,
      }, 502);
    }

    const outputText = extractOutputText(openaiPayload);

    if (!outputText) {
      return json({
        success: false,
        error: 'Le moteur IA a retourné une réponse vide.',
      }, 502);
    }

    let analysis: Analysis;
    try {
      analysis = JSON.parse(outputText) as Analysis;
    } catch (parseError) {
      console.error('Invalid AI JSON', parseError, outputText.slice(0, 500));
      return json({
        success: false,
        error: 'Le moteur IA a retourné un format inexploitable.',
      }, 502);
    }

    if (
      typeof analysis.summary !== 'string' ||
      typeof analysis.sentiment !== 'string' ||
      !Array.isArray(analysis.strengths) ||
      !Array.isArray(analysis.weaknesses) ||
      !Array.isArray(analysis.recurring_issues) ||
      !Array.isArray(analysis.recommendations) ||
      !Array.isArray(analysis.actions_prioritaires)
    ) {
      return json({
        success: false,
        error: 'La structure de l’analyse IA est invalide.',
      }, 502);
    }

    return json({
      success: true,
      statistics,
      analysis,
    });
  } catch (error) {
    console.error('analyze-reviews unexpected error', error);

    return json({
      success: false,
      error: error instanceof Error
        ? error.message
        : 'Erreur interne pendant l’analyse des avis.',
    }, 500);
  }
});
