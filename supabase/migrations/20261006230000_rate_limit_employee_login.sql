-- Rate-limit employee code login attempts before bcrypt verification.

create table if not exists public.employee_login_rate_limits (
  key_hash text primary key,
  window_started_at timestamptz not null default now(),
  attempt_count integer not null default 0,
  blocked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.employee_login_rate_limits enable row level security;
revoke all on public.employee_login_rate_limits from public, anon, authenticated;

create or replace function public.consume_employee_login_attempt(p_key_hash text)
returns table(allowed boolean, retry_after_seconds integer)
language plpgsql security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := now();
  v_started timestamptz;
  v_attempts integer;
  v_blocked timestamptz;
begin
  if p_key_hash is null or length(trim(p_key_hash)) < 32 then
    raise exception 'Rate limit key invalide';
  end if;

  insert into public.employee_login_rate_limits(key_hash)
  values (trim(p_key_hash))
  on conflict (key_hash) do nothing;

  select window_started_at, attempt_count, blocked_until
  into v_started, v_attempts, v_blocked
  from public.employee_login_rate_limits
  where key_hash = trim(p_key_hash)
  for update;

  if v_blocked is not null and v_blocked > v_now then
    return query select false, greatest(1, ceil(extract(epoch from (v_blocked - v_now)))::integer);
    return;
  end if;

  if v_started <= v_now - interval '10 minutes' then
    v_started := v_now;
    v_attempts := 0;
  end if;

  v_attempts := v_attempts + 1;

  if v_attempts > 8 then
    v_blocked := v_now + interval '15 minutes';
    update public.employee_login_rate_limits
    set window_started_at=v_started, attempt_count=v_attempts, blocked_until=v_blocked, updated_at=v_now
    where key_hash=trim(p_key_hash);
    return query select false, 900;
    return;
  end if;

  update public.employee_login_rate_limits
  set window_started_at=v_started, attempt_count=v_attempts, blocked_until=null, updated_at=v_now
  where key_hash=trim(p_key_hash);

  return query select true, 0;
end;
$$;

create or replace function public.clear_employee_login_rate_limit(p_key_hash text)
returns boolean
language plpgsql security definer
set search_path = public, pg_temp
as $$
begin
  if p_key_hash is null or length(trim(p_key_hash)) < 32 then return false; end if;
  delete from public.employee_login_rate_limits where key_hash=trim(p_key_hash);
  return true;
end;
$$;

revoke all on function public.consume_employee_login_attempt(text) from public, anon, authenticated;
revoke all on function public.clear_employee_login_rate_limit(text) from public, anon, authenticated;
grant execute on function public.consume_employee_login_attempt(text) to service_role;
grant execute on function public.clear_employee_login_rate_limit(text) to service_role;
