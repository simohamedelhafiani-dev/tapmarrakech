DO $test$
DECLARE
  v_scan_command text;
  v_dispatch_command text;
  v_scan_active boolean;
  v_dispatch_active boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    RAISE EXCEPTION 'pg_net extension is not installed';
  END IF;

  SELECT command, active INTO v_scan_command, v_scan_active
  FROM cron.job WHERE jobname = 'kelyani-smart-marketing-scan';
  IF v_scan_command IS NULL THEN
    RAISE EXCEPTION 'Smart Marketing scan cron job is missing';
  END IF;

  SELECT command, active INTO v_dispatch_command, v_dispatch_active
  FROM cron.job WHERE jobname = 'kelyani-smart-marketing-dispatch';
  IF v_dispatch_command IS NULL THEN
    RAISE EXCEPTION 'Smart Marketing dispatch cron job is missing';
  END IF;

  IF v_scan_command ILIKE '%tehhhdtfbonneqbyvlwx%'
     OR v_dispatch_command ILIKE '%tehhhdtfbonneqbyvlwx%'
     OR v_scan_command ILIKE '%https://%.supabase.co/functions/%'
     OR v_dispatch_command ILIKE '%https://%.supabase.co/functions/%' THEN
    RAISE EXCEPTION 'Smart Marketing scheduler contains a hardcoded project URL';
  END IF;

  IF v_scan_command NOT ILIKE '%kelyani_supabase_url%'
     OR v_dispatch_command NOT ILIKE '%kelyani_supabase_url%'
     OR v_scan_command NOT ILIKE '%smart_marketing_cron_secret%'
     OR v_dispatch_command NOT ILIKE '%smart_marketing_cron_secret%' THEN
    RAISE EXCEPTION 'Smart Marketing scheduler is not resolving URL and secret from Vault';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'smart_marketing_cron_secret')
     AND (v_scan_active OR v_dispatch_active) THEN
    RAISE EXCEPTION 'Smart Marketing jobs must remain inactive without the Vault cron secret';
  END IF;

  IF (SELECT count(*) FROM cron.job WHERE jobname IN ('kelyani-smart-marketing-scan','kelyani-smart-marketing-dispatch')) <> 2 THEN
    RAISE EXCEPTION 'Duplicate or missing Smart Marketing cron jobs';
  END IF;
END
$test$;
