-- Legacy employee-code/session API is no longer used by the KELYANI scanner flow.
-- Keep the underlying tables/functions intact for now, but remove anonymous API execution
-- so the retired session mechanism is not exposed publicly.
revoke execute on function public.login_employee_with_code(uuid, text) from anon, public;
revoke execute on function public.login_employee_with_code_only(text) from anon, public;
revoke execute on function public.verify_employee_access_code(uuid, text) from anon, public;
revoke execute on function public.verify_employee_session(text) from anon, public;
revoke execute on function public.get_employee_loyalty_card_config(text) from anon, public;
revoke execute on function public.add_loyalty_stamp_by_employee(text, uuid) from anon, public;
revoke execute on function public.redeem_loyalty_discount_by_employee(text, uuid, numeric, text, text) from anon, public;
revoke execute on function public.redeem_loyalty_stamp_reward_by_employee(text, uuid) from anon, public;
revoke execute on function public.logout_employee(text) from anon, public;
