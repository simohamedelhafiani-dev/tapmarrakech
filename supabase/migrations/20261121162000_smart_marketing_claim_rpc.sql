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
  -- Exhausted stale claims are terminalized so they cannot remain PROCESSING forever.
  update public.smart_marketing_queue
  set status='FAILED', processed_at=now(), processing_started_at=null,
      last_error=coalesce(last_error, 'Processing lease expired after maximum attempts')
  where status='PROCESSING'
    and processing_started_at < now() - interval '15 minutes'
    and attempts >= 3;

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

-- Allow the scanner to re-evaluate FAILED or consent/config SKIPPED events,
-- but never resurrect a task that already produced a notification. Service-role-only.
create or replace function public.requeue_failed_smart_marketing_queue(
  p_establishment_id uuid,
  p_customer_id uuid,
  p_smart_id text,
  p_trigger_key text,
  p_payload jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  queue_id uuid;
begin
  select q.id into queue_id
  from public.smart_marketing_queue q
  where q.establishment_id = p_establishment_id
    and q.customer_id = p_customer_id
    and q.smart_id = p_smart_id
    and q.trigger_key = p_trigger_key
    and q.status in ('FAILED', 'SKIPPED')
  for update;

  if queue_id is null then
    return false;
  end if;

  if exists (
    select 1 from public.loyalty_card_notifications n
    where n.smart_marketing_queue_id = queue_id
  ) then
    return false;
  end if;

  update public.smart_marketing_queue
  set status='PENDING', attempts=0, scheduled_at=now(),
      processing_started_at=null, processed_at=null, last_error=null,
      payload=coalesce(p_payload, '{}'::jsonb)
  where id=queue_id and status in ('FAILED', 'SKIPPED');

  return found;
end;
$$;
revoke all on function public.requeue_failed_smart_marketing_queue(uuid, uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.requeue_failed_smart_marketing_queue(uuid, uuid, text, text, jsonb) to service_role;
