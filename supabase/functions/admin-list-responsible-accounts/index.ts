import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const url = Deno.env.get('SUPABASE_URL')!;
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const adminClient = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ success: false, error: 'Méthode non autorisée.' }, 405);
  try {
    const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return json({ success: false, error: 'Session administrateur manquante.' }, 401);
    const { data: auth, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !auth.user) return json({ success: false, error: 'Session invalide.' }, 401);
    const { data: profile, error: profileError } = await adminClient.from('profiles').select('role').eq('id', auth.user.id).maybeSingle();
    if (profileError) return json({ success: false, error: 'Vérification du rôle impossible.' }, 500);
    if (profile?.role !== 'admin') return json({ success: false, error: 'Accès administrateur requis.' }, 403);
    const { data: profiles, error } = await adminClient.from('profiles').select('id, email, name, role, created_at').in('role', ['responsible', 'employee', 'admin']).order('created_at', { ascending: false });
    if (error) return json({ success: false, error: 'Impossible de charger les comptes.' }, 500);
    const { data: assignments, error: assignmentError } = await adminClient.from('establishment_staff').select('user_id');
    if (assignmentError) return json({ success: false, error: 'Impossible de charger les affectations.' }, 500);
    return json({ success: true, profiles: profiles ?? [], assigned_user_ids: (assignments ?? []).map((row) => row.user_id) });
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : 'Erreur serveur.' }, 500);
  }
});
