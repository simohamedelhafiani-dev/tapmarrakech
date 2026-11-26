-- Pin the SECURITY DEFINER rate-limit RPC search_path and keep pg_temp last.
-- This is a forward-only hardening of the already-applied rate-limit function.
ALTER FUNCTION public.consume_public_review_rate_limit(text, integer, integer)
  SET search_path = pg_catalog, public, pg_temp;
