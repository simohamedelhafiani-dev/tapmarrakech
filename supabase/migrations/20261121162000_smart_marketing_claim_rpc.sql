-- Atomically claim a limited batch to prevent concurrent workers duplicating queue work.
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
    where status='PENDING' and scheduled_at <= now()
    order by scheduled_at, created_at
    for update skip locked
    limit greatest(1, least(coalesce(p_limit,50),200))
  )
  update public.smart_marketing_queue q
  set status='PROCESSING'
  from picked
  where q.id=picked.id
  returning q.*;
end;
$$;
revoke all on function public.claim_smart_marketing_queue(integer) from public, anon, authenticated;
grant execute on function public.claim_smart_marketing_queue(integer) to service_role;
