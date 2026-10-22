-- Restore core access helpers and staff membership table for clean database replay.
-- Definitions mirror the live project semantics; this migration is branch-only until reviewed.

CREATE TABLE IF NOT EXISTS public.establishment_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'STAFF' CHECK (role IN ('OWNER', 'MANAGER', 'STAFF')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT establishment_staff_unique UNIQUE (establishment_id, user_id)
);

CREATE OR REPLACE FUNCTION public.is_tapmarrakech_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.user_has_establishment_access(target_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    public.is_tapmarrakech_admin()
    OR EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = target_establishment_id
        AND e.user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1
      FROM public.establishment_staff es
      WHERE es.establishment_id = target_establishment_id
        AND es.user_id = auth.uid()
        AND es.active = true
    );
$function$;

CREATE OR REPLACE FUNCTION public.is_establishment_responsible(p_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.establishment_staff s
      JOIN public.profiles p ON p.id = s.user_id
      WHERE s.establishment_id = p_establishment_id
        AND s.user_id = auth.uid()
        AND s.active = true
        AND s.role = 'MANAGER'
        AND p.role = 'responsible'
    );
$function$;


CREATE OR REPLACE FUNCTION public.user_owns_establishment(target_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = target_establishment_id
      AND e.user_id = auth.uid()
  );
$function$;

REVOKE ALL ON FUNCTION public.user_owns_establishment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.user_owns_establishment(uuid) TO authenticated, service_role;
REVOKE ALL ON FUNCTION public.is_tapmarrakech_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.user_has_establishment_access(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_establishment_responsible(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_tapmarrakech_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.user_has_establishment_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_establishment_responsible(uuid) TO authenticated, service_role;
