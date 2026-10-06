create table if not exists public.loyalty_card_recovery_sessions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
  recovery_token uuid not null unique default gen_random_uuid(),
  expires_at timestamptz not null default (now() + interval '5 minutes'),
  consumed_at timestamptz,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);

alter table public.loyalty_card_recovery_sessions enable row level security;
revoke all on public.loyalty_card_recovery_sessions from anon, authenticated;

create or replace function public.create_loyalty_card_recovery_session(p_customer_id uuid)
returns table(recovery_token uuid, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
declare
  v_establishment_id uuid;
  v_token uuid;
  v_expires timestamptz;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;

  select c.establishment_id into v_establishment_id
  from public.loyalty_customers c where c.id = p_customer_id;

  if v_establishment_id is null then raise exception 'Customer not found'; end if;
  if not public.user_has_establishment_access(v_establishment_id) then raise exception 'Access denied'; end if;

  update public.loyalty_card_recovery_sessions
  set consumed_at = now()
  where customer_id = p_customer_id and consumed_at is null and expires_at > now();

  insert into public.loyalty_card_recovery_sessions(establishment_id, customer_id, expires_at, created_by)
  values (v_establishment_id, p_customer_id, now() + interval '5 minutes', auth.uid())
  returning loyalty_card_recovery_sessions.recovery_token, loyalty_card_recovery_sessions.expires_at
  into v_token, v_expires;

  return query select v_token, v_expires;
end;
$$;

revoke all on function public.create_loyalty_card_recovery_session(uuid) from public, anon;
grant execute on function public.create_loyalty_card_recovery_session(uuid) to authenticated;

create or replace function public.consume_loyalty_card_recovery(p_recovery_token uuid)
returns table(access_token uuid, first_name text)
language plpgsql security definer set search_path = public
as $$
declare
  v_customer_id uuid;
  v_access_token uuid;
  v_first_name text;
begin
  select s.customer_id, c.first_name into v_customer_id, v_first_name
  from public.loyalty_card_recovery_sessions s
  join public.loyalty_customers c on c.id = s.customer_id
  where s.recovery_token = p_recovery_token and s.consumed_at is null and s.expires_at > now()
  for update of s;

  if v_customer_id is null then raise exception 'Recovery link expired or already used'; end if;

  update public.loyalty_card_recovery_sessions
  set consumed_at = now()
  where recovery_token = p_recovery_token and consumed_at is null;

  update public.loyalty_customer_links
  set access_token = gen_random_uuid()
  where customer_id = v_customer_id
  returning loyalty_customer_links.access_token into v_access_token;

  if v_access_token is null then
    insert into public.loyalty_customer_links(customer_id)
    values (v_customer_id)
    returning loyalty_customer_links.access_token into v_access_token;
  end if;

  return query select v_access_token, v_first_name;
end;
$$;

revoke all on function public.consume_loyalty_card_recovery(uuid) from public;
grant execute on function public.consume_loyalty_card_recovery(uuid) to anon, authenticated;