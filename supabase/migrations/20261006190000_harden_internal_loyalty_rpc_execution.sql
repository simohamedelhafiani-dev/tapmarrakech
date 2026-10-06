-- Pre-commercial security hardening: remove anonymous execution from internal/admin loyalty RPCs.
-- Public customer/card/scanner RPCs are intentionally left untouched.
revoke execute on function public.get_employee_login_establishments() from anon;
revoke execute on function public.get_employee_establishment_branding(uuid) from anon;
revoke execute on function public.get_loyalty_ai_generations(uuid) from anon;
revoke execute on function public.get_loyalty_card_builder_config(uuid) from anon;
revoke execute on function public.get_loyalty_card_config(uuid) from anon;
revoke execute on function public.get_loyalty_program_settings(uuid) from anon;
revoke execute on function public.get_responsible_subscription_card(uuid) from anon;
revoke execute on function public.save_loyalty_card_builder_config(uuid,jsonb,text,text,text,text,text,text,integer,boolean) from anon;
revoke execute on function public.save_loyalty_card_design(uuid,text,text,text,text,text,text,integer,jsonb,boolean) from anon;
revoke execute on function public.update_establishment_menu_design(uuid,jsonb) from anon;
