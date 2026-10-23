-- Restrict dashboard stats RPC when the function exists in this schema version.
-- Some clean-install paths do not define this legacy RPC; never fail all migrations
-- solely while attempting to adjust privileges on an absent function.
DO $migration$
BEGIN
  IF to_regprocedure('public.get_dashboard_stats(uuid,integer)') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid, integer) FROM PUBLIC';
    EXECUTE 'REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid, integer) FROM anon';
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, integer) TO authenticated';
  END IF;
END
$migration$;
