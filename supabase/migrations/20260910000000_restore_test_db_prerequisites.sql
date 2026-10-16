/*
  Restore prerequisites used by existing RLS policies and database tests.

  Additive migration only:
  - does not edit historical migrations;
  - keeps the production profile role default ("responsible");
  - recreates the helper functions used by current policies;
  - creates establishment_staff with the production constraints and RLS policy shape.

  Intentionally does not recreate the production session-revocation trigger here:
  the repository migration chain does not currently define employee_sessions, so
  attaching that trigger here would make a fresh database fail during migration.
*/

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'responsible';

CREATE TABLE IF NOT EXISTS public.establishment_staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'STAFF'
    CONSTRAINT establishment_staff_role_check
    CHECK (role = ANY (ARRAY['OWNER'::text, 'MANAGER'::text, 'STAFF'::text])),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT establishment_staff_unique UNIQUE (establishment_id, user_id)
);

CREATE INDEX IF NOT EXISTS establishment_staff_establishment_idx
  ON public.establishment_staff(establishment_id);
CREATE INDEX IF NOT EXISTS establishment_staff_user_idx
  ON public.establishment_staff(user_id);

ALTER TABLE public.establishment_staff ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_owns_establishment(target_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.establishments
    WHERE id = target_establishment_id
      AND user_id = auth.uid()
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_tapmarrakech_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$function$;

CREATE OR REPLACE FUNCTION public.is_establishment_responsible(p_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.user_has_establishment_access(target_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.public_establishment_exists(p_establishment_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.establishments e
    WHERE e.id = p_establishment_id
  );
$function$;

DROP POLICY IF EXISTS establishment_staff_admin_delete ON public.establishment_staff;
CREATE POLICY establishment_staff_admin_delete
  ON public.establishment_staff FOR DELETE TO authenticated
  USING (public.is_tapmarrakech_admin());

DROP POLICY IF EXISTS establishment_staff_admin_select ON public.establishment_staff;
CREATE POLICY establishment_staff_admin_select
  ON public.establishment_staff FOR SELECT TO authenticated
  USING (public.is_tapmarrakech_admin());

DROP POLICY IF EXISTS establishment_staff_admin_update ON public.establishment_staff;
CREATE POLICY establishment_staff_admin_update
  ON public.establishment_staff FOR UPDATE TO authenticated
  USING (public.is_tapmarrakech_admin())
  WITH CHECK (public.is_tapmarrakech_admin());

DROP POLICY IF EXISTS staff_owner_delete ON public.establishment_staff;
CREATE POLICY staff_owner_delete
  ON public.establishment_staff FOR DELETE TO authenticated
  USING (public.user_owns_establishment(establishment_id));

DROP POLICY IF EXISTS staff_owner_insert ON public.establishment_staff;
CREATE POLICY staff_owner_insert
  ON public.establishment_staff FOR INSERT TO authenticated
  WITH CHECK (public.user_owns_establishment(establishment_id));

DROP POLICY IF EXISTS staff_owner_select ON public.establishment_staff;
CREATE POLICY staff_owner_select
  ON public.establishment_staff FOR SELECT TO authenticated
  USING (public.user_owns_establishment(establishment_id));

DROP POLICY IF EXISTS staff_owner_update ON public.establishment_staff;
CREATE POLICY staff_owner_update
  ON public.establishment_staff FOR UPDATE TO authenticated
  USING (public.user_owns_establishment(establishment_id))
  WITH CHECK (public.user_owns_establishment(establishment_id));

DROP POLICY IF EXISTS staff_user_select_own ON public.establishment_staff;
CREATE POLICY staff_user_select_own
  ON public.establishment_staff FOR SELECT TO authenticated
  USING (user_id = auth.uid());
