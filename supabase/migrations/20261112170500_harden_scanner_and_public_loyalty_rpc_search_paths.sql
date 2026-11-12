-- Harden remaining anon-callable SECURITY DEFINER RPCs that used search_path=public.
-- Keep trusted application and extension schemas, and force pg_temp to the end.
ALTER FUNCTION public.add_loyalty_points_by_scanner(uuid, uuid, numeric, text, text)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.add_loyalty_stamp_by_scanner(uuid, uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_loyalty_card(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_loyalty_customer_tier(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_loyalty_discount_status(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_loyalty_enrollment_context(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_loyalty_notifications(uuid, integer)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_loyalty_program_context(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_loyalty_raffle_winner_by_code(uuid, uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_loyalty_raffle_winners(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_loyalty_raffles(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_referral_code(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_scanner_context(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.get_public_scanner_settings(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.public_establishment_exists(uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.redeem_public_loyalty_raffle_winner_by_code(uuid, uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.redeem_public_loyalty_stamp_reward_claim(uuid, uuid)
  SET search_path = pg_catalog, public, extensions, pg_temp;
ALTER FUNCTION public.search_public_scanner_customers(uuid, text)
  SET search_path = pg_catalog, public, extensions, pg_temp;
