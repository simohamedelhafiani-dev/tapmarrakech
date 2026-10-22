-- Remove anonymous/public execution from internal helpers while preserving
-- authenticated RPCs used by the current app. Trigger functions are separately
-- restricted from direct client invocation; PostgreSQL still invokes them from triggers.
do $$
declare
  v_signature text;
  v_client_helpers constant text[] := array[
    'public.get_loyalty_customer_link(uuid)',
    'public.get_loyalty_referral_stats(uuid)',
    'public.get_my_establishment_branding()',
    'public.get_responsible_loyalty_card_config(uuid)',
    'public.unlock_loyalty_discount_if_ready(uuid,uuid,integer,integer)'
  ];
  v_trigger_functions constant text[] := array[
    'public.ensure_establishment_scanner_link()',
    'public.ensure_loyalty_customer_link()',
    'public.set_loyalty_customer_creator()',
    'public.normalize_loyalty_referral_config_for_program()',
    'public.loyalty_points_discount_unlock_trigger()',
    'public.prevent_profile_role_change()'
  ];
begin
  foreach v_signature in array v_client_helpers loop
    if to_regprocedure(v_signature) is not null then
      execute format('revoke execute on function %s from public, anon', to_regprocedure(v_signature));
    end if;
  end loop;

  foreach v_signature in array v_trigger_functions loop
    if to_regprocedure(v_signature) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', to_regprocedure(v_signature));
    end if;
  end loop;
end;
$$;
