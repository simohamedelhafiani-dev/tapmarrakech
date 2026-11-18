-- Trigger/event-trigger functions are invoked by PostgreSQL, not through PostgREST.
-- Remove API-role EXECUTE grants only when the function exists in this schema baseline.
-- Dynamic checks keep clean local migrations compatible with environments that do not
-- install the optional auth-profile trigger helper.
DO $$
BEGIN
  IF to_regprocedure('public.handle_new_auth_user_profile()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.handle_new_auth_user_profile() FROM PUBLIC, anon, authenticated, service_role';
  END IF;

  IF to_regprocedure('public.rls_auto_enable()') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.rls_auto_enable() FROM PUBLIC, anon, authenticated, service_role';
  END IF;
END;
$$;
