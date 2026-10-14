-- Commercial hardening: loyalty management RPCs are not public APIs.
-- Keep authenticated execution; the functions themselves enforce admin/responsible authorization.
revoke execute on function public.save_loyalty_program_settings(uuid, text, integer, text, text, numeric, integer, numeric, text, boolean, integer) from anon, public;
revoke execute on function public.create_loyalty_reward(uuid, text, text, integer, text, numeric, numeric) from anon, public;
revoke execute on function public.update_loyalty_reward(uuid, text, text, integer, text, numeric, numeric, boolean) from anon, public;
revoke execute on function public.delete_loyalty_reward(uuid) from anon, public;
revoke execute on function public.update_loyalty_reward_schedule(uuid, text[]) from anon, public;
