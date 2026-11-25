-- Ensure the stored cron command is environment-safe even when the job
-- remains disabled because this environment has not provisioned its Vault keys.
DO $migration$
DECLARE
  v_base_url text;
  v_cron_secret text;
  v_job_id bigint;
  v_was_active boolean;
  v_duplicate_job_id bigint;
  v_command text := $job$
    SELECT net.http_post(
      url := (
        SELECT rtrim(decrypted_secret, '/')
        FROM vault.decrypted_secrets
        WHERE name = 'kelyani_supabase_url'
        LIMIT 1
      ) || '/functions/v1/google-business-sync-access-test',
      body := jsonb_build_object('establishment_id', s.establishment_id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-kelyani-cron-secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'kelyani_cron_secret' LIMIT 1)
      ),
      timeout_milliseconds := 30000
    )
    FROM public.google_business_settings s
    JOIN public.google_business_connections c
      ON c.establishment_id = s.establishment_id
    WHERE c.status = 'active'
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
      url := (
        SELECT rtrim(decrypted_secret, '/')
        FROM vault.decrypted_secrets
        WHERE name = 'kelyani_supabase_url'
        LIMIT 1
      ) || '/functions/v1/google-business-sync-access-test',
      body := jsonb_build_object('google_business_account_id', a.id),
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-kelyani-cron-secret',
        (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'kelyani_cron_secret' LIMIT 1)
      ),
      timeout_milliseconds := 30000
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
  SELECT decrypted_secret INTO v_base_url
  FROM vault.decrypted_secrets
  WHERE name = 'kelyani_supabase_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'kelyani_cron_secret'
  LIMIT 1;

  SELECT max(jobid), coalesce(bool_or(active), false)
    INTO v_job_id, v_was_active
  FROM cron.job
  WHERE jobname = 'kelyani-google-review-sync';

  IF v_job_id IS NULL THEN
    v_job_id := cron.schedule('kelyani-google-review-sync', '* * * * *', v_command);
    v_was_active := true;
  END IF;

  IF v_base_url IS NULL
     OR v_base_url !~ '^https://[a-z0-9-]+\.supabase\.co/?$'
     OR v_cron_secret IS NULL
     OR length(v_cron_secret) < 16 THEN
    PERFORM cron.alter_job(v_job_id, command := v_command, active := false);
  ELSE
    -- Preserve an operator-disabled job; only update its command.
    PERFORM cron.alter_job(v_job_id, command := v_command, active := v_was_active);
  END IF;

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
