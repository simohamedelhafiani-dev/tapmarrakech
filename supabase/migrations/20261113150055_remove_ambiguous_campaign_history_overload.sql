-- Remove the legacy one-argument overload. The two-argument RPC keeps p_limit DEFAULT 30.
-- This prevents PostgREST PGRST203 ambiguity when clients call with p_establishment_id only.
drop function if exists public.get_loyalty_notification_campaign_history(uuid);

revoke all on function public.get_loyalty_notification_campaign_history(uuid, integer) from public, anon;
grant execute on function public.get_loyalty_notification_campaign_history(uuid, integer) to authenticated;
