-- Bound the server-side window so stale keys can be safely collected.
-- Current Edge Function callers use 900 seconds; one day is a generous ceiling.
CREATE OR REPLACE FUNCTION public.consume_public_review_rate_limit(
  p_key_hash text, p_limit integer, p_window_seconds integer
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
  IF p_limit IS NULL OR p_window_seconds IS NULL
     OR p_limit < 1 OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'invalid_rate_limit_parameters';
  END IF;

  INSERT INTO public.public_review_rate_limits
    (key_hash, window_started_at, request_count, blocked_until)
  VALUES (p_key_hash, v_now, 1, NULL)
  ON CONFLICT (key_hash) DO NOTHING;
  GET DIAGNOSTICS v_rows_inserted = ROW_COUNT;
  IF v_rows_inserted = 1 THEN RETURN true; END IF;

  SELECT window_started_at, request_count, blocked_until
  INTO v_window_started_at, v_request_count, v_blocked_until
  FROM public.public_review_rate_limits
  WHERE key_hash = p_key_hash
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'rate_limit_state_missing'; END IF;

  IF v_blocked_until IS NOT NULL AND v_blocked_until > v_now THEN
    RETURN false;
  END IF;
  IF v_window_started_at + make_interval(secs => p_window_seconds) <= v_now THEN
    UPDATE public.public_review_rate_limits
    SET window_started_at = v_now, request_count = 1, blocked_until = NULL
    WHERE key_hash = p_key_hash;
    RETURN true;
  END IF;
  IF v_request_count >= p_limit THEN
    UPDATE public.public_review_rate_limits
    SET blocked_until = v_now + make_interval(secs => p_window_seconds)
    WHERE key_hash = p_key_hash;
    RETURN false;
  END IF;
  UPDATE public.public_review_rate_limits
  SET request_count = request_count + 1
  WHERE key_hash = p_key_hash;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.consume_public_review_rate_limit(text, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_public_review_rate_limit(text, integer, integer)
  TO service_role;

-- Retain keys for at least 48 hours. The 24-hour maximum window above makes
-- this deletion safe; blocked keys are retained until their block has expired.
CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $migration$
DECLARE
  v_job_id bigint;
  v_command text := $job$
    DELETE FROM public.public_review_rate_limits
    WHERE window_started_at < now() - interval '2 days'
      AND (blocked_until IS NULL OR blocked_until <= now());
  $job$;
BEGIN
  SELECT max(jobid)
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'kelyani-cleanup-public-review-rate-limits';

  IF v_job_id IS NULL THEN
    PERFORM cron.schedule(
      'kelyani-cleanup-public-review-rate-limits',
      '17 3 * * *',
      v_command
    );
  ELSE
    PERFORM cron.alter_job(
      v_job_id,
      schedule := '17 3 * * *',
      command := v_command,
      active := true
    );
  END IF;

  FOR v_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'kelyani-cleanup-public-review-rate-limits'
      AND active = false
  LOOP
    PERFORM cron.alter_job(v_job_id, active := true);
  END LOOP;
END
$migration$;
