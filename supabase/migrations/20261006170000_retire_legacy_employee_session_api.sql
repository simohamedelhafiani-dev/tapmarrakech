-- Restrict legacy employee-code/session RPCs from anonymous/public clients.
-- The current employee-login Edge Function still calls login_employee_with_code_only(text)
-- with a service-role client, so retain that server-side execution path explicitly.
do $$
declare
  v_signature text;
  v_signatures constant text[] := array[
    'public.login_employee_with_code(uuid,text)',
    'public.login_employee_with_code_only(text)',
    'public.verify_employee_access_code(uuid,text)',
    'public.verify_employee_session(text)',
    'public.get_employee_loyalty_card_config(text)',
    'public.add_loyalty_stamp_by_employee(text,uuid)',
    'public.redeem_loyalty_discount_by_employee(text,uuid,numeric,text,text)',
    'public.redeem_loyalty_stamp_reward_by_employee(text,uuid)',
    'public.logout_employee(text)'
  ];
begin
  foreach v_signature in array v_signatures loop
    if to_regprocedure(v_signature) is not null then
      execute format('revoke execute on function %s from anon, public', to_regprocedure(v_signature));
    end if;
  end loop;

  if to_regprocedure('public.login_employee_with_code_only(text)') is not null then
    grant execute on function public.login_employee_with_code_only(text) to service_role;
  end if;
end;
$$;
