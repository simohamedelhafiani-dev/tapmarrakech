-- Remove anonymous execution from internal helper/trigger functions.
revoke execute on function public.get_loyalty_customer_link(uuid) from public,anon;
revoke execute on function public.get_loyalty_referral_stats(uuid) from public,anon;
revoke execute on function public.get_my_establishment_branding() from public,anon;
revoke execute on function public.get_responsible_loyalty_card_config(uuid) from public,anon;
revoke execute on function public.unlock_loyalty_discount_if_ready(uuid,uuid,integer,integer) from public,anon;
revoke execute on function public.ensure_establishment_scanner_link() from public,anon,authenticated;
revoke execute on function public.ensure_loyalty_customer_link() from public,anon,authenticated;
revoke execute on function public.set_loyalty_customer_creator() from public,anon,authenticated;
revoke execute on function public.normalize_loyalty_referral_config_for_program() from public,anon,authenticated;
revoke execute on function public.loyalty_points_discount_unlock_trigger() from public,anon,authenticated;
revoke execute on function public.prevent_profile_role_change() from public,anon,authenticated;
