begin;

select plan(6);

select is(
  (select count(*)::integer
   from cron.job
   where jobname = 'kelyani-google-review-sync'
     and active = true
     and schedule = '* * * * *'),
  1,
  'exactly one active Google Business sync job runs each minute and enforces cadence in SQL'
);

select ok(
  position('google_business_account_id' in (
    select command from cron.job where jobname = 'kelyani-google-review-sync' and active = true
  )) > 0,
  'scheduler invokes account-level Google Business sync'
);

select ok(
  position('sync_interval_minutes' in (
    select command from cron.job where jobname = 'kelyani-google-review-sync' and active = true
  )) > 0,
  'scheduler respects per-establishment sync intervals for legacy and mapped account locations'
);

select ok(
  position('not exists (' in lower((
    select command from cron.job where jobname = 'kelyani-google-review-sync' and active = true
  ))) > 0
  and position('a.google_account_id = c.google_account_id' in lower((
    select command from cron.job where jobname = 'kelyani-google-review-sync' and active = true
  ))) > 0,
  'legacy synchronization is skipped when the same Google account has an active central connection'
);

select ok(
  position('kelyani_cron_secret' in (
    select command from cron.job where jobname = 'kelyani-google-review-sync' and active = true
  )) > 0,
  'scheduler supplies the configured shared secret to the Edge Function'
);

select ok(
  position('auto_reply_enabled' in (
    select command from cron.job where jobname = 'kelyani-google-review-sync' and active = true
  )) = 0,
  'review synchronization does not depend on whether AI auto-replies are enabled'
);

select * from finish();
rollback;
