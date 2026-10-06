-- Pre-commercial security hardening: remove anonymous/public execution from internal loyalty RPCs.
-- Public customer/card/scanner RPCs are intentionally left untouched.
revoke execute on function public.get_employee_login_establishments() from public;
grant execute on function public.get_employee_login_establishments() to authenticated;
revoke execute on function public.get_employee_establishment_branding(uuid) from public;
grant execute on function public.get_employee_establishment_branding(uuid) to authenticated;
revoke execute on function public.get_loyalty_ai_generations(uuid) from public;
grant execute on function public.get_loyalty_ai_generations(uuid) to authenticated;
revoke execute on function public.get_loyalty_card_builder_config(uuid) from public;
grant execute on function public.get_loyalty_card_builder_config(uuid) to authenticated;
revoke execute on function public.get_loyalty_card_config(uuid) from public;
grant execute on function public.get_loyalty_card_config(uuid) to authenticated;
revoke execute on function public.get_loyalty_program_settings(uuid) from public;
grant execute on function public.get_loyalty_program_settings(uuid) to authenticated;
revoke execute on function public.get_responsible_subscription_card(uuid) from public;
grant execute on function public.get_responsible_subscription_card(uuid) to authenticated;
revoke execute on function public.save_loyalty_card_builder_config(uuid,jsonb,text,text,text,text,text,text,integer,boolean) from public;
grant execute on function public.save_loyalty_card_builder_config(uuid,jsonb,text,text,text,text,text,text,integer,boolean) to authenticated;
revoke execute on function public.save_loyalty_card_design(uuid,text,text,text,text,text,text,integer,jsonb,boolean) from public;
grant execute on function public.save_loyalty_card_design(uuid,text,text,text,text,text,text,integer,jsonb,boolean) to authenticated;
revoke execute on function public.update_establishment_menu_design(uuid,jsonb) from public;
grant execute on function public.update_establishment_menu_design(uuid,jsonb) to authenticated;
