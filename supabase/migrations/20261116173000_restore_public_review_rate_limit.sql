-- Restore the service-only public-review rate limiter on Production.
-- The app Edge Function calls this RPC, but it is absent from the live Production schema.
CREATE TABLE IF NOT EXISTS public.public_review_rate_limits (
  key_hash text PRIMARY KEY,
  window_started_at timestamptz NOT NULL DEFAULT pg_catalog.now(),
  request_count integer NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  blocked_until timestamptz
);

CREATE INDEX IF NOT EXISTS public_review_rate_limits_blocked_until_idx
  ON public.public_review_rate_limits(blocked_until);

ALTER TABLE public.public_review_rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.public_review_rate_limits FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_public_review_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_now timestamptz := pg_catalog.now();
  v_window_started_at timestamptz;
  v_request_count integer;
  v_blocked_until timestamptz;
BEGIN
  IF p_key_hash IS NULL OR pg_catalog.length(pg_catalog.btrim(p_key_hash)) < 32 THEN
    RAISE EXCEPTION 'invalid_rate_limit_key';
  END IF;

  IF p_limit IS NULL OR p_window_seconds IS NULL
     OR p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid_rate_limit_parameters';
  END IF;

  SELECT window_started_at, request_count, blocked_until
  INTO v_window_started_at, v_request_count, v_blocked_until
  FROM public.public_review_rate_limits
  WHERE key_hash = p_key_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.public_review_rate_limits (
      key_hash, window_started_at, request_count, blocked_until
    )
    VALUES (p_key_hash, v_now, 1, NULL);
    RETURN true;
  END IF;

  IF v_blocked_until IS NOT NULL AND v_blocked_until > v_now THEN
    RETURN false;
  END IF;

  IF v_window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= v_now THEN
    UPDATE public.public_review_rate_limits
    SET window_started_at = v_now, request_count = 1, blocked_until = NULL
    WHERE key_hash = p_key_hash;
    RETURN true;
  END IF;

  IF v_request_count >= p_limit THEN
    UPDATE public.public_review_rate_limits
    SET blocked_until = v_now + pg_catalog.make_interval(secs => p_window_seconds)
    WHERE key_hash = p_key_hash;
    RETURN false;
  END IF;

  UPDATE public.public_review_rate_limits
  SET request_count = request_count + 1
  WHERE key_hash = p_key_hash;

  RETURN true;
END;
$function$;

REVOKE ALL ON FUNCTION public.consume_public_review_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_review_rate_limit(text, integer, integer)
  TO service_role;

