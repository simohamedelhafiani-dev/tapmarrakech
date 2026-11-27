BEGIN;
SELECT plan(5);

SELECT ok(
  (SELECT prosecdef FROM pg_proc WHERE oid='public.consume_public_review_rate_limit(text,integer,integer)'::regprocedure),
  'rate-limit function remains SECURITY DEFINER'
);
SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=pg_catalog, public, pg_temp']
   FROM pg_proc WHERE oid='public.consume_public_review_rate_limit(text,integer,integer)'::regprocedure),
  'rate-limit SECURITY DEFINER function pins pg_catalog and puts pg_temp last'
);
SELECT ok(
  NOT has_function_privilege('anon','public.consume_public_review_rate_limit(text,integer,integer)','EXECUTE'),
  'anon cannot execute rate-limit RPC'
);
SELECT ok(
  NOT has_function_privilege('authenticated','public.consume_public_review_rate_limit(text,integer,integer)','EXECUTE'),
  'authenticated cannot execute rate-limit RPC'
);
SELECT ok(
  has_function_privilege('service_role','public.consume_public_review_rate_limit(text,integer,integer)','EXECUTE'),
  'service_role retains rate-limit RPC execution'
);

SELECT * FROM finish();
ROLLBACK;
