import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Session administrateur manquante.' }, 401);
    const token = authHeader.replace(/^Bearer\\s+/i, '');
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) return json({ success: false, error: 'Session invalide.' }, 401);

    const { data: actor, error: actorError } = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (actorError) return json({ success: false, error: 'Vérification administrateur impossible.' }, 500);
    if (actor?.role !== 'admin') return json({ success: false, error: 'Accès administrateur requis.' }, 403);

    const body = await req.json();
    const action = String(body.action ?? '');

    if (action === 'list') {
      const [{ data: profiles, error: profilesError }, { data: staff, error: staffError }] = await Promise.all([
        adminClient.from('profiles').select('id, name, email, created_at').eq('role', 'responsible').order('created_at', { ascending: false }),
        adminClient.from('establishment_staff').select('user_id').eq('role', 'MANAGER').eq('active', true),
      ]);
      if (profilesError || staffError) return json({ success: false, error: 'Impossible de charger les comptes responsables.', details: profilesError?.message ?? staffError?.message }, 500);
      const assigned = new Set((staff ?? []).map((row) => row.user_id));
      return json({ success: true, responsibles: (profiles ?? []).filter((profile) => !assigned.has(profile.id)) });
    }

    if (action === 'assign') {
      const userId = String(body.user_id ?? '').trim();
      const establishmentId = String(body.establishment_id ?? '').trim();
      if (!userId || !establishmentId) return json({ success: false, error: 'Compte et établissement obligatoires.' }, 400);

      const [{ data: target, error: targetError }, { data: establishment, error: establishmentError }] = await Promise.all([
        adminClient.from('profiles').select('id, role').eq('id', userId).maybeSingle(),
        adminClient.from('establishments').select('id').eq('id', establishmentId).maybeSingle(),
      ]);
      if (targetError || !target) return json({ success: false, error: 'Compte responsable introuvable.' }, 404);
      if (target.role !== 'responsible') return json({ success: false, error: 'Seuls les comptes responsables peuvent être attribués.' }, 400);
      if (establishmentError || !establishment) return json({ success: false, error: 'Établissement introuvable.' }, 404);

      const { data: existing, error: existingError } = await adminClient.from('establishment_staff').select('id, establishment_id, active').eq('user_id', userId).eq('role', 'MANAGER').maybeSingle();
      if (existingError) return json({ success: false, error: 'Vérification du rattachement impossible.' }, 500);
      if (existing) {
        if (existing.establishment_id === establishmentId && existing.active) return json({ success: true, alreadyAssigned: true });
        const { error: updateError } = await adminClient.from('establishment_staff').update({ establishment_id: establishmentId, active: true }).eq('id', existing.id);
        if (updateError) return json({ success: false, error: 'Impossible de réactiver ou déplacer ce responsable.', details: updateError.message }, 500);
      } else {
        const { error: insertError } = await adminClient.from('establishment_staff').insert({ establishment_id: establishmentId, user_id: userId, role: 'MANAGER', active: true });
        if (insertError) return json({ success: false, error: 'Impossible d’attribuer le responsable.', details: insertError.message }, 500);
      }
      return json({ success: true });
    }

    return json({ success: false, error: 'Action inconnue.' }, 400);
  } catch (error) {
    console.error('admin-manage-responsibles:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Erreur serveur.' }, 500);
  }
});
