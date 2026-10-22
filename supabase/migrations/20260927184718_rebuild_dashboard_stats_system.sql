-- Restrict dashboard stats RPC to authenticated users.
REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid, integer) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, integer) TO authenticated;
