-- Forward-only reconciliation for the production Google Business sync job.
-- The older sync-frequency migration may already be behind the deployed migration
-- history, so this migration repairs the live job without requiring that old migration
-- to be replayed. It preserves both legacy establishment connections and central
-- Google account connections, and guarantees a single active scheduler job.

ALTER TABLE public.google_business_settings
  ADD COLUMN IF NOT EXISTS sync_interval_minutes integer NOT NULL DEFAULT 10;

UPDATE public.google_business_settings
SET sync_interval_minutes = 10
WHERE sync_interval_minutes IS NULL
   OR sync_interval_minutes NOT IN (5, 10, 15, 30, 60);

ALTER TABLE public.google_business_settings
  ALTER COLUMN sync_interval_minutes SET DEFAULT 10,
  ALTER COLUMN sync_interval_minutes SET NOT NULL;

ALTER TABLE public.google_business_settings
  DROP CONSTRAINT IF EXISTS google_business_settings_sync_interval_minutes_check;

ALTER TABLE public.google_business_settings
  ADD CONSTRAINT google_business_settings_sync_interval_minutes_check
  CHECK (sync_interval_minutes IN (5, 10, 15, 30, 60));

DO $migration$
DECLARE
  v_job_id bigint;
  v_duplicate_job_id bigint;
  v_command text := $job$
    SELECT net.http_post(
      url := 'https://tehhhdtfbonneqbyvlwx.supabase.co/functions/v1/google-business-sync-access-test',
      body := jsonb_build_object('establishment_id', s.establishment_id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-kelyani-cron-secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'kelyani_cron_secret')
      ),
      timeout_milliseconds := 10000
    )
    FROM public.google_business_settings s
    JOIN public.google_business_connections c
      ON c.establishment_id = s.establishment_id
    WHERE c.status = 'active'
      -- Prefer the central OAuth connection when it represents the same Google account.
      -- This prevents legacy rows and the account row from racing to update the same locations.
      AND NOT EXISTS (
        SELECT 1
        FROM public.google_business_accounts a
        WHERE a.status = 'active'
          AND a.google_account_id IS NOT NULL
          AND a.google_account_id = c.google_account_id
      )
      AND (
        c.last_sync_at IS NULL
        OR c.last_sync_at <= now() - make_interval(mins => coalesce(s.sync_interval_minutes, 10))
      )
    UNION ALL
    SELECT net.http_post(
      url := 'https://tehhhdtfbonneqbyvlwx.supabase.co/functions/v1/google-business-sync-access-test',
      body := jsonb_build_object('google_business_account_id', a.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-kelyani-cron-secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'kelyani_cron_secret')
      ),
      timeout_milliseconds := 10000
    )
    FROM public.google_business_accounts a
    WHERE a.status = 'active'
      AND (
        a.last_sync_at IS NULL
        OR a.last_sync_at <= now() - make_interval(mins => coalesce((
          SELECT min(s.sync_interval_minutes)
          FROM public.google_business_locations l
          JOIN public.google_business_settings s
            ON s.establishment_id = l.mapped_establishment_id
          WHERE l.google_business_account_id = a.id
            AND l.mapped_establishment_id IS NOT NULL
        ), 10))
      );
  $job$;
BEGIN
  SELECT max(jobid)
  INTO v_job_id
  FROM cron.job
  WHERE jobname = 'kelyani-google-review-sync';

  IF v_job_id IS NULL THEN
    v_job_id := cron.schedule(
      'kelyani-google-review-sync',
      '* * * * *',
      v_command
    );
  ELSE
    PERFORM cron.alter_job(
      v_job_id,
      schedule := '* * * * *',
      command := v_command,
      active := true
    );
  END IF;

  -- If manual setup created duplicate jobs, keep only the one just reconciled.
  FOR v_duplicate_job_id IN
    SELECT jobid
    FROM cron.job
    WHERE jobname = 'kelyani-google-review-sync'
      AND jobid <> v_job_id
  LOOP
    PERFORM cron.unschedule(v_duplicate_job_id);
  END LOOP;
END
$migration$;
