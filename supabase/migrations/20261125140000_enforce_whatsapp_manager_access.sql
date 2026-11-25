-- WhatsApp is a manager/admin capability, not a generic establishment membership capability.
-- Owners, platform admins and explicitly provisioned responsible managers are allowed.
CREATE OR REPLACE FUNCTION public.user_can_manage_whatsapp(target_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
  SELECT auth.uid() IS NOT NULL
    AND target_establishment_id IS NOT NULL
    AND (
      public.is_tapmarrakech_admin()
      OR public.user_owns_establishment(target_establishment_id)
      OR public.is_establishment_responsible(target_establishment_id)
    );
$function$;

REVOKE ALL ON FUNCTION public.user_can_manage_whatsapp(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_can_manage_whatsapp(uuid) TO authenticated, service_role;
