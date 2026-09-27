undefined

revoke all on function public.get_dashboard_stats(uuid, integer) from public;
revoke all on function public.get_dashboard_stats(uuid, integer) from anon;
grant execute on function public.get_dashboard_stats(uuid, integer) to authenticated;
