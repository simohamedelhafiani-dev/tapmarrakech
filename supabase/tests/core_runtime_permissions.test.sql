BEGIN;
SELECT plan(18);

SELECT ok(has_table_privilege('anon', 'public.loyalty_rewards', 'SELECT'), 'anon can select public active rewards');
SELECT ok(has_table_privilege('authenticated', 'public.loyalty_rewards', 'SELECT'), 'authenticated can select rewards subject to RLS');
SELECT ok(has_table_privilege('authenticated', 'public.loyalty_rewards', 'INSERT'), 'authenticated insert is constrained by RLS');
SELECT ok(has_table_privilege('authenticated', 'public.loyalty_rewards', 'UPDATE'), 'authenticated update is constrained by RLS');
SELECT ok(has_table_privilege('authenticated', 'public.loyalty_rewards', 'DELETE'), 'authenticated delete is constrained by RLS');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.loyalty_rewards'::regclass), 'loyalty_rewards RLS is enabled');

SELECT ok((SELECT count(*)=1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_rewards' AND policyname='loyalty_rewards_access'), 'establishment access SELECT policy exists');
SELECT ok((SELECT count(*)=1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_rewards' AND policyname='loyalty_rewards_admin_all'), 'admin ALL policy exists');
SELECT ok((SELECT count(*)=1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_rewards' AND policyname='loyalty_rewards_owner_delete'), 'owner DELETE policy exists');
SELECT ok((SELECT count(*)=1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_rewards' AND policyname='loyalty_rewards_owner_insert'), 'owner INSERT policy exists');
SELECT ok((SELECT count(*)=1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_rewards' AND policyname='loyalty_rewards_owner_update'), 'owner UPDATE policy exists');
SELECT ok((SELECT count(*)=1 FROM pg_policies WHERE schemaname='public' AND tablename='loyalty_rewards' AND policyname='loyalty_rewards_public_active_select'), 'public active-only SELECT policy exists');

SELECT ok(pg_get_function_result('public.get_dashboard_stats(uuid, integer)'::regprocedure) LIKE '%points_balance_total numeric%', 'dashboard points balance output is numeric');
SELECT ok(pg_get_function_result('public.get_dashboard_stats(uuid, integer)'::regprocedure) LIKE '%points_earned_total numeric%', 'dashboard points earned output is numeric');
SELECT ok(pg_get_function_result('public.get_dashboard_stats(uuid, integer)'::regprocedure) LIKE '%points_redeemed_total numeric%', 'dashboard points redeemed output is numeric');
SELECT ok(pg_get_function_result('public.get_dashboard_stats(uuid, integer)'::regprocedure) LIKE '%points_redeemed_on_period numeric%', 'dashboard period points output is numeric');
SELECT ok(has_function_privilege('authenticated', 'public.get_dashboard_stats(uuid, integer)', 'EXECUTE'), 'authenticated can execute dashboard stats');
SELECT ok(not has_function_privilege('anon', 'public.get_dashboard_stats(uuid, integer)', 'EXECUTE'), 'anon cannot execute dashboard stats');

SELECT * FROM finish();
ROLLBACK;
