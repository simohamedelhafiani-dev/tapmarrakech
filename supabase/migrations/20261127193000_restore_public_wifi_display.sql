-- The public establishment page shows the venue Wi-Fi when the establishment
-- has an active Wi-Fi entry (owner-controlled via establishment_wifi.active).
-- A previous hardening pass revoked this RPC as "unused"; it is used by
-- PublicReview.tsx, so restore anonymous execution.
DO $migration$
BEGIN
  IF to_regprocedure('public.get_public_wifi(uuid)') IS NOT NULL THEN
    EXECUTE 'ALTER FUNCTION public.get_public_wifi(uuid) SET search_path = pg_catalog, public, pg_temp';
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_public_wifi(uuid) FROM PUBLIC';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_public_wifi(uuid) TO anon, authenticated, service_role';
  END IF;
END
$migration$;

NOTIFY pgrst, 'reload schema';
