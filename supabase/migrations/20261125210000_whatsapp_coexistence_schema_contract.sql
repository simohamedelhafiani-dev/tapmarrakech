-- Complete the database contract required by the WhatsApp coexistence flow.
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS token_expires_at timestamptz;

CREATE OR REPLACE FUNCTION public.user_can_manage_whatsapp(target_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'pg_temp'
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND target_establishment_id IS NOT NULL
    AND (
      public.is_tapmarrakech_admin()
      OR public.user_owns_establishment(target_establishment_id)
      OR public.is_establishment_responsible(target_establishment_id)
    );
$function$;

REVOKE ALL ON FUNCTION public.user_can_manage_whatsapp(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_manage_whatsapp(uuid) TO authenticated, service_role;
