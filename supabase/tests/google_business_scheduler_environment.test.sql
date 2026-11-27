-- Run after the environment-safe scheduler migration has been applied.
BEGIN;
SELECT plan(1);

DO $test$
DECLARE
  v_command text;
  v_active boolean;
BEGIN
  SELECT command, active
  INTO v_command, v_active
  FROM cron.job
  WHERE jobname = 'kelyani-google-review-sync'
  ORDER BY jobid DESC
  LIMIT 1;

  IF v_command IS NULL THEN
    RAISE EXCEPTION 'Google Business scheduler job is missing';
  END IF;

  IF v_command ILIKE '%tehhhdtfbonneqbyvlwx%'
     OR v_command ILIKE '%https://%.supabase.co/functions/v1/google-business-sync-access-test%' THEN
    RAISE EXCEPTION 'Scheduler command contains a hardcoded Supabase project URL';
  END IF;

  IF v_command NOT ILIKE '%kelyani_supabase_url%'
     OR v_command NOT ILIKE '%kelyani_cron_secret%' THEN
    RAISE EXCEPTION 'Scheduler command does not resolve this environment endpoint and secret from Vault';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'kelyani_supabase_url'
  ) AND v_active THEN
    RAISE EXCEPTION 'Scheduler must remain disabled when the environment URL secret is absent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM vault.decrypted_secrets
    WHERE name = 'kelyani_cron_secret'
  ) AND v_active THEN
    RAISE EXCEPTION 'Scheduler must remain disabled when the cron secret is absent';
  END IF;
END
$test$;

SELECT pass('Google Business scheduler resolves its endpoint from Vault and stays disabled without secrets');

SELECT * FROM finish();
ROLLBACK;
