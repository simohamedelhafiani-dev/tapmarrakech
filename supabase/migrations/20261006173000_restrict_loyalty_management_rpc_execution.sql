-- Commercial hardening: management RPCs are authenticated-only.
-- Authorization inside each function remains the source of truth (admin/responsible checks).
revoke execute on function public.save_loyalty_program_settings(uuid, text, numeric, text, integer, text, text, boolean) from anon, public;
revoke execute on function public.create_loyalty_reward(uuid, text, text, integer, numeric, integer, integer, boolean) from anon, public;
revoke execute on function public.update_loyalty_reward(uuid, text, text, integer, numeric, integer, integer, boolean) from anon, public;
revoke execute on function public.delete_loyalty_reward(uuid) from anon, public;
revoke execute on function public.update_loyalty_reward_schedule(uuid, boolean, text, text) from anon, public;
