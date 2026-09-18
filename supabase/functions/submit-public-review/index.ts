import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const IP_LIMIT = 5;
const SESSION_LIMIT = 2;
const RATE_LIMIT_WINDOW_SECONDS = 15 * 60;
const MAX_COMMENT_LENGTH = 5000;
const MAX_NAME_LENGTH = 160;
const MAX_PHONE_LENGTH = 60;
const MAX_EMAIL_LENGTH = 254;

type ReviewType = 'positive' | 'negative';

type SubmitBody = {
  establishment_id?: unknown;
  rating?: unknown;
  type?: unknown;
  comment?: unknown;
  name?: unknown;
  phone?: unknown;
  email?: unknown;
  session_id?: unknown;
  honeypot?: unknown;
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    },
  });
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  );
}

function cleanOptionalText(
  value: unknown,
  maxLength: number
): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value !== 'string') {
    throw new Error('invalid_text');
  }

  const trimmed = value.trim();

  if (!trimmed) return null;
  if (trimmed.length > maxLength) {
    throw new Error('text_too_long');
  }

  return trimmed;
}

function getClientIp(request: Request): string {
  const cloudflareIp = request.headers.get('cf-connecting-ip')?.trim();

  if (cloudflareIp) {
    return cloudflareIp;
  }

  const forwardedFor = request.headers.get('x-forwarded-for');

  if (forwardedFor) {
    const firstIp = forwardedFor
      .split(',')
      .map((value) => value.trim())
      .find(Boolean);

    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get('x-real-ip')?.trim();

  return realIp || 'unknown';
}

async function sha256(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function consumeRateLimit(
  serviceClient: ReturnType<typeof createClient>,
  key: string,
  limit: number
) {
  const keyHash = await sha256(key);

  const { data, error } = await serviceClient.rpc(
    'consume_public_review_rate_limit',
    {
      p_key_hash: keyHash,
      p_limit: limit,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    }
  );

  if (error) {
    console.error('Public review rate-limit check failed', error);
    throw new Error('rate_limit_unavailable');
  }

  return data === true;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return json(
      { success: false, error: 'Méthode non autorisée.' },
      405
    );
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !serviceRoleKey) {
      console.error(
        'submit-public-review missing Supabase server configuration'
      );

      return json(
        {
          success: false,
          error: 'Service temporairement indisponible.',
        },
        500
      );
    }

    let body: SubmitBody;

    try {
      body = await request.json();
    } catch {
      return json(
        { success: false, error: 'Requête invalide.' },
        400
      );
    }

    const establishmentId = body.establishment_id;

    if (!isUuid(establishmentId)) {
      return json(
        { success: false, error: 'Établissement invalide.' },
        400
      );
    }

    const rating = Number(body.rating);

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      return json(
        { success: false, error: 'Note invalide.' },
        400
      );
    }

    const type = body.type;

    if (type !== 'positive' && type !== 'negative') {
      return json(
        { success: false, error: 'Type d’avis invalide.' },
        400
      );
    }

    const expectedType: ReviewType = rating >= 4 ? 'positive' : 'negative';

    if (type !== expectedType) {
      return json(
        {
          success: false,
          error:
            rating >= 4
              ? 'Les notes de 4 ou 5 étoiles sont orientées vers Google.'
              : 'Les notes de 1 à 3 étoiles sont destinées au retour privé.',
        },
        400
      );
    }

    const sessionId = body.session_id;

    if (
      typeof sessionId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        sessionId
      )
    ) {
      return json(
        { success: false, error: 'Session invalide.' },
        400
      );
    }

    if (
      typeof body.honeypot === 'string' &&
      body.honeypot.trim().length > 0
    ) {
      return json(
        { success: false, error: 'Requête invalide.' },
        400
      );
    }

    const comment = cleanOptionalText(
      body.comment,
      MAX_COMMENT_LENGTH
    );
    const name = cleanOptionalText(
      body.name,
      MAX_NAME_LENGTH
    );
    const phone = cleanOptionalText(
      body.phone,
      MAX_PHONE_LENGTH
    );
    const email = cleanOptionalText(
      body.email,
      MAX_EMAIL_LENGTH
    );

    if (type === 'negative' && !comment) {
      return json(
        { success: false, error: 'Le message est obligatoire.' },
        400
      );
    }

    if (type === 'positive' && comment) {
      return json(
        { success: false, error: 'Requête invalide.' },
        400
      );
    }

    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json(
        { success: false, error: 'Adresse e-mail invalide.' },
        400
      );
    }

    const serviceClient = createClient(
      supabaseUrl,
      serviceRoleKey,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );

    const { data: establishment, error: establishmentError } =
      await serviceClient
        .from('establishments')
        .select('id')
        .eq('id', establishmentId)
        .maybeSingle();

    if (establishmentError) {
      console.error(
        'Public review establishment lookup failed',
        establishmentError
      );

      return json(
        {
          success: false,
          error: 'Service temporairement indisponible.',
        },
        503
      );
    }

    if (!establishment) {
      return json(
        { success: false, error: 'Établissement introuvable.' },
        404
      );
    }

    const clientIp = getClientIp(request);
    const ipAllowed = await consumeRateLimit(
      serviceClient,
      `ip:${establishmentId}:${clientIp}`,
      IP_LIMIT
    );

    if (!ipAllowed) {
      return json(
        {
          success: false,
          error: 'Trop de tentatives. Veuillez réessayer plus tard.',
        },
        429
      );
    }

    const sessionAllowed = await consumeRateLimit(
      serviceClient,
      `session:${establishmentId}:${sessionId}`,
      SESSION_LIMIT
    );

    if (!sessionAllowed) {
      return json(
        {
          success: false,
          error: 'Trop de tentatives. Veuillez réessayer plus tard.',
        },
        429
      );
    }

    const { data: review, error: reviewError } =
      await serviceClient
        .from('reviews')
        .insert({
          establishment_id: establishmentId,
          rating,
          type,
          comment,
          name,
          phone,
          email,
        })
        .select('id')
        .single();

    if (reviewError) {
      console.error(
        'Public review insert failed',
        reviewError
      );

      return json(
        {
          success: false,
          error: 'Impossible d’enregistrer votre avis.',
        },
        500
      );
    }

    return json({
      success: true,
      review_id: review.id,
    });
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'invalid_text') {
        return json(
          { success: false, error: 'Donnée invalide.' },
          400
        );
      }

      if (error.message === 'text_too_long') {
        return json(
          { success: false, error: 'Donnée trop longue.' },
          400
        );
      }

      if (error.message === 'rate_limit_unavailable') {
        return json(
          {
            success: false,
            error: 'Service temporairement indisponible.',
          },
          503
        );
      }

      console.error(
        'submit-public-review unexpected error',
        error
      );
    } else {
      console.error(
        'submit-public-review unexpected error',
        error
      );
    }

    return json(
      {
        success: false,
        error: 'Erreur interne pendant l’envoi de votre avis.',
      },
      500
    );
  }
});
