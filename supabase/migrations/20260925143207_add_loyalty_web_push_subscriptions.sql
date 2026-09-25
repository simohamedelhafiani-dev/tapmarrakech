create table if not exists public.loyalty_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loyalty_push_subscriptions_customer_idx on public.loyalty_push_subscriptions(customer_id);
create index if not exists loyalty_push_subscriptions_establishment_idx on public.loyalty_push_subscriptions(establishment_id);
alter table public.loyalty_push_subscriptions enable row level security;
revoke all on public.loyalty_push_subscriptions from anon, authenticated;

create or replace function public.register_loyalty_push_subscription(
  p_access_token uuid,
  p_subscription jsonb
) returns jsonb
language plpgsql security definer set search_path = public
as $function$
declare
  v_customer_id uuid;
  v_establishment_id uuid;
  v_endpoint text;
  v_p256dh text;
  v_auth text;
  v_user_agent text;
  v_id uuid;
begin
  if p_access_token is null or p_subscription is null then raise exception 'invalid_push_subscription_request'; end if;
  v_endpoint := nullif(trim(p_subscription->>'endpoint'), '');
  v_p256dh := nullif(trim(p_subscription->'keys'->>'p256dh'), '');
  v_auth := nullif(trim(p_subscription->'keys'->>'auth'), '');
  v_user_agent := nullif(trim(current_setting('request.headers', true)::jsonb->>'user-agent'), '');
  if v_endpoint is null or v_p256dh is null or v_auth is null then raise exception 'invalid_push_subscription'; end if;

  select c.id, c.establishment_id into v_customer_id, v_establishment_id
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  where l.access_token = p_access_token limit 1;

  if v_customer_id is null then raise exception 'invalid_loyalty_card'; end if;

  insert into public.loyalty_push_subscriptions(customer_id,establishment_id,endpoint,p256dh,auth,user_agent,last_seen_at,updated_at)
  values(v_customer_id,v_establishment_id,v_endpoint,v_p256dh,v_auth,v_user_agent,now(),now())
  on conflict(endpoint) do update set
    customer_id=excluded.customer_id, establishment_id=excluded.establishment_id, p256dh=excluded.p256dh,
    auth=excluded.auth, user_agent=excluded.user_agent, last_seen_at=now(), updated_at=now()
  returning id into v_id;

  return jsonb_build_object('success',true,'subscription_id',v_id);
end;
$function$;

revoke all on function public.register_loyalty_push_subscription(uuid, jsonb) from public;
grant execute on function public.register_loyalty_push_subscription(uuid, jsonb) to anon, authenticated;