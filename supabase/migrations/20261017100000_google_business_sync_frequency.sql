-- Per-establishment Google Business sync cadence.
-- The existing Google sync cron is evaluated every minute, but each establishment
-- is only called when its configured interval has elapsed. The loyalty raffle cron
-- is intentionally untouched.
alter table public.google_business_settings
  add column if not exists sync_interval_minutes integer not null default 10;

alter table public.google_business_settings
  drop constraint if exists google_business_settings_sync_interval_minutes_check;

alter table public.google_business_settings
  add constraint google_business_settings_sync_interval_minutes_check
  check (sync_interval_minutes in (5, 10, 15, 30, 60));

do $$
declare
  google_job_id bigint;
begin
  select jobid into google_job_id
  from cron.job
  where jobname = 'kelyani-google-review-sync'
  order by jobid desc
  limit 1;

  if google_job_id is not null then
    perform cron.alter_job(
      google_job_id,
      schedule := '* * * * *',
      command := $job$
        select net.http_post(
          url := 'https://tehhhdtfbonneqbyvlwx.supabase.co/functions/v1/google-business-sync-access-test',
          body := jsonb_build_object('establishment_id', s.establishment_id),
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'x-kelyani-cron-secret',
            (select decrypted_secret from vault.decrypted_secrets where name = 'kelyani_cron_secret')
          ),
          timeout_milliseconds := 10000
        )
        from public.google_business_settings s
        join public.google_business_connections c
          on c.establishment_id = s.establishment_id
        where c.status = 'active'
          and (
            c.last_sync_at is null
            or c.last_sync_at <= now() - make_interval(mins => coalesce(s.sync_interval_minutes, 10))
          );
      $job$
    );
  end if;
end
$$;
