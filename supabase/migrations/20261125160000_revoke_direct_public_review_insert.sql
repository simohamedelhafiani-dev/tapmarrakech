-- Public reviews must only be created by the validated, rate-limited
-- submit-public-review Edge Function. Direct Data API inserts bypass its
-- validation and per-IP/session rate limits.
--
-- Revoke table-level grants from both API roles and PUBLIC. Also revoke any
-- explicit column-level INSERT grants: PostgreSQL column grants can survive a
-- table-level REVOKE and would otherwise leave a narrow direct-insert path.
REVOKE INSERT ON TABLE public.reviews FROM PUBLIC, anon, authenticated;

DO $revoke_review_column_inserts$
DECLARE
  v_column record;
BEGIN
  FOR v_column IN
    SELECT DISTINCT column_name
    FROM information_schema.column_privileges
    WHERE table_schema = 'public'
      AND table_name = 'reviews'
      AND grantee IN ('PUBLIC', 'anon', 'authenticated')
      AND privilege_type = 'INSERT'
  LOOP
    EXECUTE pg_catalog.format(
      'REVOKE INSERT (%I) ON TABLE public.reviews FROM PUBLIC, anon, authenticated',
      v_column.column_name
    );
  END LOOP;
END;
$revoke_review_column_inserts$;

-- Defense in depth: remove the legacy public insert policy as well.
DROP POLICY IF EXISTS reviews_public_insert ON public.reviews;
