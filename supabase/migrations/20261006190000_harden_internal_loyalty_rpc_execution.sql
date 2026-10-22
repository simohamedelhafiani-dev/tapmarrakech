-- Pre-commercial security hardening for internal loyalty RPCs.
-- Preserve authenticated execution for application operations; public customer/card/
-- scanner RPCs are intentionally left untouched. Some historical deployments do not
-- contain every legacy overload, so only harden functions that exist at this point.
do $$
declare
  v_signature text;
  v_signatures constant text[] := array[
    'public.get_employee_login_establishments()',
    'public.get_employee_establishment_branding(uuid)',
    'public.get_loyalty_ai_generations(uuid)',
    'public.get_loyalty_card_builder_config(uuid)',
    'public.get_loyalty_card_config(uuid)',
    'public.get_loyalty_program_settings(uuid)',
    'public.get_responsible_subscription_card(uuid)',
    'public.save_loyalty_card_builder_config(uuid,jsonb,text,text,text,text,text,text,integer,boolean)',
    'public.save_loyalty_card_design(uuid,text,text,text,text,text,text,integer,jsonb,boolean)',
    'public.update_establishment_menu_design(uuid,jsonb)'
  ];
begin
  foreach v_signature in array v_signatures loop
    if to_regprocedure(v_signature) is not null then
      execute format('revoke execute on function %s from public', to_regprocedure(v_signature));
      execute format('grant execute on function %s to authenticated', to_regprocedure(v_signature));
    end if;
  end loop;
end;
$$;
