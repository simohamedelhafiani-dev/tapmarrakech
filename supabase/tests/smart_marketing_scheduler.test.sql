BEGIN;
SELECT plan(8);

SELECT ok(EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net'), 'pg_net extension is installed');

SELECT ok(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kelyani-smart-marketing-scan'), 'Smart Marketing scan cron job exists');
SELECT ok(EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'kelyani-smart-marketing-dispatch'), 'Smart Marketing dispatch cron job exists');

SELECT ok(
  (SELECT command ILIKE '%kelyani_supabase_url%' AND command ILIKE '%smart_marketing_cron_secret%'
   FROM cron.job WHERE jobname = 'kelyani-smart-marketing-scan'),
  'scan job resolves its project URL and bearer secret from Vault'
);
SELECT ok(
  (SELECT command ILIKE '%kelyani_supabase_url%' AND command ILIKE '%smart_marketing_cron_secret%'
   FROM cron.job WHERE jobname = 'kelyani-smart-marketing-dispatch'),
  'dispatch job resolves its project URL and bearer secret from Vault'
);
SELECT ok(
  NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname IN ('kelyani-smart-marketing-scan','kelyani-smart-marketing-dispatch')
      AND (command ILIKE '%tehhhdtfbonneqbyvlwx%' OR command ILIKE '%https://%.supabase.co/functions/%')
  ),
  'scheduler commands contain no hardcoded project URL'
);
SELECT ok(
  NOT EXISTS (SELECT 1 FROM vault.decrypted_secrets WHERE name = 'smart_marketing_cron_secret')
  AND NOT EXISTS (
    SELECT 1 FROM cron.job
    WHERE jobname IN ('kelyani-smart-marketing-scan','kelyani-smart-marketing-dispatch')
      AND active
  ),
  'jobs remain inactive when the project cron secret is not provisioned'
);
SELECT is(
  (SELECT count(*)::integer FROM cron.job WHERE jobname IN ('kelyani-smart-marketing-scan','kelyani-smart-marketing-dispatch')),
  2,
  'exactly two Smart Marketing scheduler jobs exist'
);

SELECT * FROM finish();
ROLLBACK;
