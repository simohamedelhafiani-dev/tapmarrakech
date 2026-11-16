-- Pin privileged public loyalty RPCs to trusted schemas and place pg_temp last.
-- public is not writable by anon/authenticated; application relations remain schema-qualified
-- inside the functions, while enrollment/referral helpers intentionally resolve in public.

ALTER FUNCTION public.consume_loyalty_card_recovery(uuid)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.create_public_loyalty_stamp_reward_claim(uuid)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.get_public_loyalty_stamp_reward_claim(uuid)
  SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.register_public_loyalty_customer_for_enrollment_v2(
  uuid, text, text, text, date, text, text[], boolean, boolean, text, text
) SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.register_public_loyalty_customer_for_enrollment_v3(
  uuid, text, text, text, date, text, text[], boolean, boolean, text, text
) SET search_path = pg_catalog, public, pg_temp;

ALTER FUNCTION public.register_public_loyalty_customer_with_referral(
  text, text, text, text, date
) SET search_path = pg_catalog, public, pg_temp;
