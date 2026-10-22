-- These dashboard/subscription RPCs require an authenticated user.
-- Revoke anonymous/public execution only when the exact function signature
-- exists in this schema. Missing legacy RPCs are not created by this migration;
-- any future definition must declare its own grants explicitly.
do $$
declare
  v_signature text;
  v_signatures constant text[] := array[
    'public.get_my_establishments()',
    'public.get_my_subscription_features()',
    'public.get_my_subscription_for_establishment(uuid)',
    'public.get_admin_analytics_dashboard_stats(uuid,integer)',
    'public.get_analytics_dashboard_stats(uuid)',
    'public.get_dashboard_program_stats(uuid,integer)',
    'public.get_loyalty_dashboard_stats(uuid)'
  ];
begin
  foreach v_signature in array v_signatures loop
    if to_regprocedure(v_signature) is not null then
      execute format('revoke execute on function %s from anon, public', to_regprocedure(v_signature));
    end if;
  end loop;
end;
$$;
