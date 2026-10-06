-- These dashboard/subscription RPCs require an authenticated user.
-- Their SQL definitions already enforce the relevant account/establishment authorization.
revoke execute on function public.get_my_establishments() from anon, public;
revoke execute on function public.get_my_subscription_features() from anon, public;
revoke execute on function public.get_my_subscription_for_establishment(uuid) from anon, public;
revoke execute on function public.get_admin_analytics_dashboard_stats(uuid, integer) from anon, public;
revoke execute on function public.get_analytics_dashboard_stats(uuid) from anon, public;
revoke execute on function public.get_dashboard_program_stats(uuid, integer) from anon, public;
revoke execute on function public.get_loyalty_dashboard_stats(uuid) from anon, public;
