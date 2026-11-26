BEGIN;
SELECT plan(7);

SELECT ok(to_regprocedure('public.get_smart_marketing_reward_cycles(uuid)') IS NOT NULL, 'reward cycle lookup RPC exists');
SELECT ok((SELECT prosecdef FROM pg_proc WHERE oid='public.get_smart_marketing_reward_cycles(uuid)'::regprocedure), 'reward cycle lookup is SECURITY DEFINER');
SELECT ok(NOT has_function_privilege('anon','public.get_smart_marketing_reward_cycles(uuid)','EXECUTE'), 'anon cannot execute reward cycle lookup');
SELECT ok(NOT has_function_privilege('authenticated','public.get_smart_marketing_reward_cycles(uuid)','EXECUTE'), 'authenticated cannot execute reward cycle lookup');
SELECT ok(has_function_privilege('service_role','public.get_smart_marketing_reward_cycles(uuid)','EXECUTE'), 'service_role can execute reward cycle lookup');
SELECT ok(pg_get_functiondef('public.get_smart_marketing_reward_cycles(uuid)'::regprocedure) ILIKE '%DISTINCT ON%' AND pg_get_functiondef('public.get_smart_marketing_reward_cycles(uuid)'::regprocedure) ILIKE '%created_at DESC%', 'reward cycle lookup returns only the latest claim per customer');
SELECT ok(EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND tablename='loyalty_stamp_reward_claims' AND indexname='loyalty_stamp_reward_claims_cycle_idx'), 'latest reward claim lookup has a supporting index');

SELECT * FROM finish();
ROLLBACK;
