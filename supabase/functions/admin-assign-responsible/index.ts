import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminClient = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Session administrateur manquante.' }, 401);

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: authData, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !authData.user) return json({ success: false, error: 'Session invalide.' }, 401);

    const { data: adminProfile, error: adminError } = await adminClient
      .from('profiles')
      .select('role')
      .eq('id', authData.user.id)
      .maybeSingle();

    if (adminError) return json({ success: false, error: 'Impossible de vérifier les droits administrateur.' }, 500);
    if (adminProfile?.role !== 'admin') return json({ success: false, error: 'Accès administrateur requis.' }, 403);

    const body = await req.json();
    const userId = typeof body.user_id === 'string' ? body.user_id.trim() : '';
    const establishmentId = typeof body.establishment_id === 'string' ? body.establishment_id.trim() : '';
    if (!userId || !establishmentId) {
      return json({ success: false, error: 'Compte responsable et établissement obligatoires.' }, 400);
    }

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .maybeSingle();
    if (profileError) return json({ success: false, error: 'Erreur lors de la lecture du compte.' }, 500);
    if (!profile || profile.role !== 'responsible') {
      return json({ success: false, error: 'Le compte sélectionné n’est pas un compte responsable valide.' }, 400);
    }

    const { data: establishment, error: establishmentError } = await adminClient
      .from('establishments')
      .select('id, name')
      .eq('id', establishmentId)
      .maybeSingle();
    if (establishmentError) return json({ success: false, error: 'Erreur lors de la vérification de l’établissement.' }, 500);
    if (!establishment) return json({ success: false, error: 'Établissement introuvable.' }, 404);

    const { data: existingAssignments, error: assignmentReadError } = await adminClient
      .from('establishment_staff')
      .select('id, establishment_id, active')
      .eq('user_id', userId);
    if (assignmentReadError) return json({ success: false, error: 'Impossible de vérifier les affectations existantes.' }, 500);

    if ((existingAssignments ?? []).length > 0) {
      const current = existingAssignments![0];
      if (current.establishment_id === establishmentId && current.active) {
        return json({ success: true, already_assigned: true, establishment: establishment.name });
      }
      return json({
        success: false,
        error: 'Ce responsable est déjà rattaché à un établissement. Modifiez son affectation existante plutôt que de créer un doublon.',
      }, 409);
    }

    const { error: insertError } = await adminClient.from('establishment_staff').insert({
      establishment_id: establishmentId,
      user_id: userId,
      role: 'MANAGER',
      active: true,
    });

    if (insertError) {
      console.error('Échec affectation responsable:', insertError);
      return json({ success: false, error: 'L’affectation n’a pas pu être enregistrée.', details: insertError.message }, 400);
    }

    return json({ success: true, already_assigned: false, establishment: establishment.name });
  } catch (error) {
    console.error('ERREUR INATTENDUE admin-assign-responsible:', error);
    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Erreur serveur.',
    }, 500);
  }
});
