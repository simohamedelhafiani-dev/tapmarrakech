-- Atomic per-customer fixed-window limiter for Smart Nearby.
-- Stores no access token or GPS coordinates; one counter row per customer.
create table if not exists public.smart_nearby_rate_limits (
  customer_id uuid primary key references public.loyalty_customers(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count bigint not null check (request_count >= 1),
  updated_at timestamptz not null default now()
);
alter table public.smart_nearby_rate_limits enable row level security;
revoke all on public.smart_nearby_rate_limits from anon, authenticated;
grant all on public.smart_nearby_rate_limits to service_role;

create or replace function public.smart_nearby_rate_limit(
  p_customer_id uuid,
  p_limit integer default 10,
  p_window_seconds integer default 60
)
returns table(allowed boolean, request_count bigint, window_started_at timestamptz)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window_seconds integer := greatest(1, least(coalesce(p_window_seconds, 60), 3600));
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 1000));
  v_start timestamptz;
  v_count bigint;
begin
  if p_customer_id is null then
    raise exception 'Customer ID required' using errcode = '22023';
  end if;

  insert into public.smart_nearby_rate_limits as current_limit
    (customer_id, window_started_at, request_count, updated_at)
  values (p_customer_id, v_now, 1, v_now)
  on conflict (customer_id) do update set
    window_started_at = case
      when current_limit.window_started_at <= v_now - make_interval(secs => v_window_seconds) then v_now
      else current_limit.window_started_at
    end,
    request_count = case
      when current_limit.window_started_at <= v_now - make_interval(secs => v_window_seconds) then 1
      else current_limit.request_count + 1
    end,
    updated_at = v_now
  returning smart_nearby_rate_limits.window_started_at, smart_nearby_rate_limits.request_count
  into v_start, v_count;

  return query select (v_count <= v_limit), v_count, v_start;
end;
$$;

revoke all on function public.smart_nearby_rate_limit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.smart_nearby_rate_limit(uuid, integer, integer) to service_role;
