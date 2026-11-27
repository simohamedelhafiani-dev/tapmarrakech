-- Make the first rate-limit hit atomic when concurrent requests share a new key.
-- INSERT ... ON CONFLICT serializes contenders on the primary key; the loser
-- then locks and evaluates the row created by the winner instead of raising
-- a unique-violation error.
CREATE OR REPLACE FUNCTION public.consume_public_review_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_started_at timestamptz;
  v_request_count integer;
  v_blocked_until timestamptz;
  v_rows_inserted integer;
BEGIN
  IF p_key_hash IS NULL OR length(trim(p_key_hash)) < 32 THEN
    RAISE EXCEPTION 'invalid_rate_limit_key';
  END IF;

  IF p_limit < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'invalid_rate_limit_parameters';
  END IF;

  -- The primary-key conflict path waits for an in-flight insert of this key.
  -- Only the transaction that creates the row consumes the initial hit here.
  INSERT INTO public.public_review_rate_limits (
    key_hash,
    window_started_at,
    request_count,
    blocked_until
  )
  VALUES (
    p_key_hash,
    v_now,
    1,
    NULL
  )
  ON CONFLICT (key_hash) DO NOTHING;

  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;

  IF v_rows_inserted = 1 THEN
    RETURN true;
  END IF;

  -- A concurrent request created the row first; lock and process that row.
  SELECT
    window_started_at,
    request_count,
    blocked_until
  INTO
    v_window_started_at,
    v_request_count,
    v_blocked_until
  FROM public.public_review_rate_limits
  WHERE key_hash = p_key_hash
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'rate_limit_state_missing';
  END IF;

  IF v_blocked_until IS NOT NULL AND v_blocked_until > v_now THEN
    RETURN false;
  END IF;

  IF v_window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN
    UPDATE public.public_review_rate_limits
    SET
      window_started_at = v_now,
      request_count = 1,
      blocked_until = NULL
    WHERE key_hash = p_key_hash;

    RETURN true;
  END IF;

  IF v_request_count >= p_limit THEN
    UPDATE public.public_review_rate_limits
    SET
      blocked_until = v_now + make_interval(secs => p_window_seconds)
    WHERE key_hash = p_key_hash;

    RETURN false;
  END IF;

  UPDATE public.public_review_rate_limits
  SET
    request_count = request_count + 1
  WHERE key_hash = p_key_hash;

  RETURN true;
END;
$$;
