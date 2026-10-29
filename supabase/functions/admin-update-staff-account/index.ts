import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée.' }, 405);

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ success: false, error: 'Session administrateur manquante.' }, 401);

    const token = authHeader.replace(/^Bearer\s+/i, '');
    const { data: { user }, error: userError } = await adminClient.auth.getUser(token);
    if (userError || !user) return json({ success: false, error: 'Session invalide.' }, 401);

    const { data: profile, error: profileError } = await adminClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profileError) return json({ success: false, error: 'Impossible de vérifier le profil administrateur.', details: profileError.message }, 500);
    if (profile?.role !== 'admin') return json({ success: false, error: 'Accès administrateur requis.' }, 403);

    const body = await req.json();
    const staffId = String(body.staff_id ?? '').trim();
    const establishmentId = String(body.establishment_id ?? '').trim();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const active = Boolean(body.active);

    if (!staffId || !establishmentId || !name) return json({ success: false, error: 'Nom, établissement et identifiant du compte sont obligatoires.' }, 400);

    const { data: staff, error: staffError } = await adminClient.from('establishment_staff').select('id, user_id, role').eq('id', staffId).maybeSingle();
    if (staffError || !staff) return json({ success: false, error: 'Compte équipe introuvable.' }, 404);
    if (!staff.user_id || !['MANAGER', 'STAFF'].includes(staff.role)) return json({ success: false, error: 'Ce compte ne peut pas être modifié depuis cette interface.' }, 400);

    const { data: establishment, error: establishmentError } = await adminClient.from('establishments').select('id').eq('id', establishmentId).maybeSingle();
    if (establishmentError || !establishment) return json({ success: false, error: 'Établissement introuvable.' }, 404);

    if (staff.role === 'MANAGER' && !email) return json({ success: false, error: 'Email du responsable obligatoire.' }, 400);
    if (password.trim() && password.trim().length < 6) return json({ success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' }, 400);

    const { data: existingAuth, error: existingAuthError } = await adminClient.auth.admin.getUserById(staff.user_id);
    if (existingAuthError || !existingAuth?.user) return json({ success: false, error: 'Compte de connexion introuvable.' }, 404);

    const authUpdate: { email?: string; password?: string; email_confirm?: boolean } = {};
    const currentEmail = (existingAuth.user.email ?? '').trim().toLowerCase();
    if (email && email !== currentEmail) { authUpdate.email = email; authUpdate.email_confirm = true; }
    if (password.trim()) authUpdate.password = password.trim();

    if (Object.keys(authUpdate).length > 0) {
      const { error: authUpdateError } = await adminClient.auth.admin.updateUserById(staff.user_id, authUpdate);
      if (authUpdateError) return json({ success: false, error: `Impossible de modifier le compte de connexion : ${authUpdateError.message}` }, 400);
    }

    const profileUpdate: { name: string; email?: string } = { name };
    if (email) profileUpdate.email = email;
    const { error: profileUpdateError } = await adminClient.from('profiles').update(profileUpdate).eq('id', staff.user_id);
    if (profileUpdateError) return json({ success: false, error: `Impossible de modifier le profil : ${profileUpdateError.message}` }, 400);

    const { error: staffUpdateError } = await adminClient.from('establishment_staff').update({ establishment_id: establishmentId, active }).eq('id', staffId);
    if (staffUpdateError) return json({ success: false, error: `Impossible de modifier le rattachement : ${staffUpdateError.message}` }, 400);

    return json({ success: true });
  } catch (error) {
    console.error('ERREUR INATTENDUE admin-update-staff-account:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Erreur serveur.' }, 500);
  }
});