-- The public enrollment wrappers are the only intended entry points.
-- This legacy helper returns the full loyalty_customers row, so if a deployment
-- still has it, it must never be callable through the Data API by client roles.
-- Current enrollment uses register_public_loyalty_customer_for_enrollment_v2 and
-- register_public_loyalty_customer_with_referral instead.
do $$
begin
  if to_regprocedure('public.register_public_loyalty_customer(uuid,text,text,text,date)') is not null then
    revoke execute on function public.register_public_loyalty_customer(uuid,text,text,text,date)
      from public, anon, authenticated;
  end if;
end;
$$;
