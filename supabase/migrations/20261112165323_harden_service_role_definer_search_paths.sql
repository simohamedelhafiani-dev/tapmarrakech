-- Normalize the remaining service_role-only SECURITY DEFINER helpers.
-- These functions are not executable by anon/authenticated, but use the same trusted path
-- so their definer execution is protected against temporary-object shadowing as well.
ALTER FUNCTION public.claim_public_loyalty_review_bonus(text, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.complete_referral_after_loyalty_action()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.consume_public_review_rate_limit(text, integer, integer)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.ensure_establishment_scanner_link()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.ensure_loyalty_customer_link()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_loyalty_customer_tier(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_public_loyalty_transactions(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.normalize_loyalty_referral_config_for_program()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
