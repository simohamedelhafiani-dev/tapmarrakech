BEGIN;
SELECT plan(8);

SELECT ok(to_regprocedure('public.set_public_loyalty_gps_consent(uuid,boolean)') IS NOT NULL, 'token-scoped GPS consent RPC exists');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='public.set_public_loyalty_gps_consent(uuid,boolean)'::regprocedure), 'GPS consent RPC is SECURITY DEFINER');
SELECT ok(pg_get_function_result('public.set_public_loyalty_gps_consent(uuid,boolean)'::regprocedure) = 'boolean', 'GPS consent RPC returns only a boolean');
SELECT ok(pg_get_functiondef('public.set_public_loyalty_gps_consent(uuid,boolean)'::regprocedure) ILIKE '%loyalty_customer_links%' AND pg_get_functiondef('public.set_public_loyalty_gps_consent(uuid,boolean)'::regprocedure) ILIKE '%access_token%', 'GPS consent is resolved from the bearer card token');
SELECT ok(has_function_privilege('anon', 'public.set_public_loyalty_gps_consent(uuid,boolean)', 'EXECUTE'), 'anonymous card holder can set their consent with the card token');
SELECT ok(has_function_privilege('authenticated', 'public.set_public_loyalty_gps_consent(uuid,boolean)', 'EXECUTE'), 'authenticated card holder can set their consent with the card token');
SELECT ok(not has_function_privilege('public', 'public.set_public_loyalty_gps_consent(uuid,boolean)', 'EXECUTE'), 'PUBLIC has no direct execute grant');
SELECT ok((SELECT column_default LIKE '%false%' FROM information_schema.columns WHERE table_schema='public' AND table_name='loyalty_customers' AND column_name='gps_consent'), 'GPS consent defaults to false');

SELECT * FROM finish();
ROLLBACK;
