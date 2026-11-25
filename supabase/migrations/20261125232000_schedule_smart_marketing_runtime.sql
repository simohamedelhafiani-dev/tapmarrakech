-- Schedule Smart Marketing scanner and dispatcher through pg_cron + pg_net.
-- The jobs remain disabled until this Supabase project has its own URL and
-- high-entropy cron secret in Vault. The same secret must be provisioned as
-- the SMART_MARKETING_CRON_SECRET Edge Function secret.
CREATE EXTENSION IF NOT EXISTS pg_net;

DO $migration$
DECLARE
  v_project_url text;
  v_cron_secret text;
  v_ready boolean;
  v_scan_job_id bigint;
  v_dispatch_job_id bigint;
  v_duplicate_job_id bigint;
  v_scan_command text := $scan$
    SELECT net.http_post(
      url := (
        SELECT rtrim(decrypted_secret, '/')
        FROM vault.decrypted_secrets
        WHERE name = 'kelyani_supabase_url'
        LIMIT 1
      ) || '/functions/v1/smart-marketing-scan',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'smart_marketing_cron_secret'
          LIMIT 1
        )
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $scan$;
  v_dispatch_command text := $dispatch$
    SELECT net.http_post(
      url := (
        SELECT rtrim(decrypted_secret, '/')
        FROM vault.decrypted_secrets
        WHERE name = 'kelyani_supabase_url'
        LIMIT 1
      ) || '/functions/v1/smart-marketing-dispatch',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (
          SELECT decrypted_secret
          FROM vault.decrypted_secrets
          WHERE name = 'smart_marketing_cron_secret'
          LIMIT 1
        )
      ),
      body := '{"limit":50}'::jsonb,
      timeout_milliseconds := 30000
    );
  $dispatch$;
BEGIN
  SELECT decrypted_secret INTO v_project_url
  FROM vault.decrypted_secrets
  WHERE name = 'kelyani_supabase_url'
  LIMIT 1;

  SELECT decrypted_secret INTO v_cron_secret
  FROM vault.decrypted_secrets
  WHERE name = 'smart_marketing_cron_secret'
  LIMIT 1;

  v_ready := v_project_url ~ '^https://[a-z0-9-]+\.supabase\.co/?$'
    AND v_cron_secret IS NOT NULL
    AND length(v_cron_secret) >= 32;

  SELECT max(jobid) INTO v_scan_job_id
  FROM cron.job
  WHERE jobname = 'kelyani-smart-marketing-scan';

  IF v_scan_job_id IS NULL THEN
    v_scan_job_id := cron.schedule('kelyani-smart-marketing-scan', '*/5 * * * *', v_scan_command);
  ELSE
    PERFORM cron.alter_job(v_scan_job_id, schedule := '*/5 * * * *', command := v_scan_command);
  END IF;
  PERFORM cron.alter_job(v_scan_job_id, active := v_ready);

  SELECT max(jobid) INTO v_dispatch_job_id
  FROM cron.job
  WHERE jobname = 'kelyani-smart-marketing-dispatch';

  IF v_dispatch_job_id IS NULL THEN
    v_dispatch_job_id := cron.schedule('kelyani-smart-marketing-dispatch', '* * * * *', v_dispatch_command);
  ELSE
    PERFORM cron.alter_job(v_dispatch_job_id, schedule := '* * * * *', command := v_dispatch_command);
  END IF;
  PERFORM cron.alter_job(v_dispatch_job_id, active := v_ready);

  FOR v_duplicate_job_id IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('kelyani-smart-marketing-scan','kelyani-smart-marketing-dispatch')
      AND jobid NOT IN (v_scan_job_id,v_dispatch_job_id)
  LOOP
    PERFORM cron.unschedule(v_duplicate_job_id);
  END LOOP;
END
$migration$;
