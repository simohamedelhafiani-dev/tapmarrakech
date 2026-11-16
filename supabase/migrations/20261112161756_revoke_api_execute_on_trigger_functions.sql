-- Trigger/event-trigger functions are invoked by PostgreSQL, not through PostgREST.
-- Remove API-role EXECUTE grants while preserving the owning postgres role.
REVOKE ALL ON FUNCTION public.handle_new_auth_user_profile()
  FROM PUBLIC, anon, authenticated, service_role;

REVOKE ALL ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated, service_role;
