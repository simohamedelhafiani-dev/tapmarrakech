-- Atomically claim a limited batch and recover abandoned PROCESSING rows.
alter table public.smart_marketing_queue
  add column if not exists processing_started_at timestamptz,
  add column if not exists attempts integer not null default 0 check (attempts >= 0);

create or replace function public.claim_smart_marketing_queue(p_limit integer default 50)
returns setof public.smart_marketing_queue
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  return query
  with picked as (
    select id from public.smart_marketing_queue
    where (
      (status='PENDING' and scheduled_at <= now())
      or (status='PROCESSING' and processing_started_at < now() - interval '15 minutes' and attempts < 3)
    )
    order by scheduled_at, created_at
    limit greatest(1, least(coalesce(p_limit,50),200))
    for update skip locked
  )
  update public.smart_marketing_queue q
  set status='PROCESSING',
      processing_started_at=now(),
      attempts=q.attempts+1,
      last_error=null
  from picked
  where q.id=picked.id
  returning q.*;
end;
$$;
revoke all on function public.claim_smart_marketing_queue(integer) from public, anon, authenticated;
grant execute on function public.claim_smart_marketing_queue(integer) to service_role;
