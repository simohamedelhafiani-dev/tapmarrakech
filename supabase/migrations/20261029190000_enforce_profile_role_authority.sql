-- KELYANI: make profile roles authoritative at the database layer.
-- New public signups always receive the least-privileged role.
-- Only a trusted service-role request or an existing admin may assign/change roles.

BEGIN;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'responsible';

-- Keep the safe role as the default even if the column already existed.
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'responsible';

-- Repair only missing roles; do not rewrite any existing non-null role.
UPDATE public.profiles
SET role = 'responsible'
WHERE role IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN role SET NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_profile_role_authority()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $function$
DECLARE
  v_jwt_role text;
  v_actor_is_admin boolean := false;
BEGIN
  v_jwt_role := COALESCE(auth.jwt() ->> 'role', '');

  -- Accept only known roles. The service role or an existing admin may assign employee roles.
  IF NEW.role IS NULL OR NEW.role::text NOT IN ('admin', 'responsible', 'employee') THEN
    RAISE EXCEPTION 'Invalid profile role'
      USING ERRCODE = '42501';
  END IF;

  -- Service-role JWTs are trusted server-side operations; never expose the
  -- service-role key to browser code.
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF auth.uid() IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id = auth.uid()
        AND p.role::text = 'admin'
    )
    INTO v_actor_is_admin;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Ordinary signup can create only a responsible profile.
    IF NEW.role::text <> 'responsible' AND NOT v_actor_is_admin THEN
      RAISE EXCEPTION 'Only an administrator or trusted system may assign a privileged role'
        USING ERRCODE = '42501';
    END IF;
  ELSIF NEW.role IS DISTINCT FROM OLD.role AND NOT v_actor_is_admin THEN
    -- Includes self-promotion through direct REST updates or upserts.
    RAISE EXCEPTION 'Only an administrator or trusted system may change a profile role'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.enforce_profile_role_authority()
  FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS enforce_profile_role_authority_insert ON public.profiles;
DROP TRIGGER IF EXISTS enforce_profile_role_authority_update ON public.profiles;
DROP TRIGGER IF EXISTS enforce_profile_role_authority ON public.profiles;

CREATE TRIGGER enforce_profile_role_authority_insert
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role_authority();

CREATE TRIGGER enforce_profile_role_authority_update
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_profile_role_authority();

COMMIT;
