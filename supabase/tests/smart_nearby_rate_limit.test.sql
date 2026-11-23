BEGIN;
SELECT plan(15);

SELECT ok(to_regclass('public.smart_nearby_rate_limits') IS NOT NULL, 'rate-limit table exists');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.smart_nearby_rate_limits'::regclass), 'rate-limit table has RLS enabled');
SELECT ok((SELECT count(*)=1 FROM pg_constraint WHERE conrelid='public.smart_nearby_rate_limits'::regclass AND contype='p'), 'customer ID is the primary key for one limiter row per customer');
SELECT ok((SELECT count(*)=1 FROM pg_constraint WHERE conrelid='public.smart_nearby_rate_limits'::regclass AND contype='f'), 'rate-limit rows cascade with customer deletion');
SELECT ok(not has_table_privilege('anon', 'public.smart_nearby_rate_limits', 'SELECT'), 'anon cannot read rate-limit state');
SELECT ok(to_regprocedure('public.smart_nearby_rate_limit(uuid,integer,integer)') IS NOT NULL, 'atomic rate-limit RPC exists');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='public.smart_nearby_rate_limit(uuid,integer,integer)'::regprocedure), 'limiter RPC is SECURITY DEFINER');
SELECT ok(pg_get_functiondef('public.smart_nearby_rate_limit(uuid,integer,integer)'::regprocedure) ILIKE '%ON CONFLICT%', 'limiter uses atomic UPSERT');
SELECT ok(has_function_privilege('service_role', 'public.smart_nearby_rate_limit(uuid,integer,integer)', 'EXECUTE'), 'service_role can execute limiter RPC');
SELECT ok(not has_function_privilege('anon', 'public.smart_nearby_rate_limit(uuid,integer,integer)', 'EXECUTE'), 'anon cannot execute limiter RPC');


SELECT ok(to_regprocedure('public.smart_nearby_notify_atomic(uuid,uuid,text,text,text)') IS NOT NULL, 'atomic nearby notification RPC exists');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='public.smart_nearby_notify_atomic(uuid,uuid,text,text,text)'::regprocedure), 'atomic nearby notification RPC is SECURITY DEFINER');
SELECT ok(pg_get_functiondef('public.smart_nearby_notify_atomic(uuid,uuid,text,text,text)'::regprocedure) ILIKE '%loyalty_card_notifications%', 'atomic RPC creates notification inside transaction');
SELECT ok(has_function_privilege('service_role', 'public.smart_nearby_notify_atomic(uuid,uuid,text,text,text)', 'EXECUTE'), 'service_role can execute atomic notification RPC');
SELECT ok(not has_function_privilege('anon', 'public.smart_nearby_notify_atomic(uuid,uuid,text,text,text)', 'EXECUTE'), 'anon cannot execute atomic notification RPC');

SELECT * FROM finish();
ROLLBACK;
