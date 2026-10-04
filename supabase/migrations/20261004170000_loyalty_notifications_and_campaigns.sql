-- Loyalty card notifications + segmented notification campaigns
-- Reproducible schema for fresh environments. Existing objects are preserved.

create table if not exists public.loyalty_card_notifications (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  customer_id uuid null references public.loyalty_customers(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 1000),
  type text not null default 'INFO' check (type in ('INFO','OFFER','REWARD','POINTS')),
  expires_at timestamptz null,
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.loyalty_card_notification_reads (
  notification_id uuid not null references public.loyalty_card_notifications(id) on delete cascade,
  customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (notification_id, customer_id)
);

create index if not exists loyalty_card_notifications_establishment_created_idx
  on public.loyalty_card_notifications(establishment_id, created_at desc);
create index if not exists loyalty_card_notifications_customer_created_idx
  on public.loyalty_card_notifications(customer_id, created_at desc);
create index if not exists loyalty_card_notifications_expires_idx
  on public.loyalty_card_notifications(expires_at);

alter table public.loyalty_card_notifications enable row level security;
alter table public.loyalty_card_notification_reads enable row level security;

revoke all on public.loyalty_card_notifications from anon, authenticated;
revoke all on public.loyalty_card_notification_reads from anon, authenticated;

create table if not exists public.loyalty_notification_campaigns (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  title text not null check (char_length(trim(title)) between 1 and 120),
  message text not null check (char_length(trim(message)) between 1 and 1000),
  type text not null default 'INFO' check (type in ('INFO','OFFER','REWARD','POINTS')),
  audience jsonb not null default '{}'::jsonb,
  expires_at timestamptz null,
  recipient_count integer not null default 0 check (recipient_count >= 0),
  status text not null default 'PUBLISHED' check (status in ('PUBLISHED','CANCELLED')),
  created_by uuid null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists loyalty_notification_campaigns_establishment_created_idx
  on public.loyalty_notification_campaigns(establishment_id, created_at desc);

alter table public.loyalty_notification_campaigns enable row level security;
revoke all on public.loyalty_notification_campaigns from anon, authenticated;

create or replace function public.create_loyalty_card_notification(
  p_establishment_id uuid,
  p_customer_id uuid,
  p_title text,
  p_message text,
  p_type text default 'INFO',
  p_expires_at timestamptz default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_id uuid;
  v_customer_establishment uuid;
begin
  if not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'not_authorized';
  end if;

  if p_customer_id is not null then
    select establishment_id into v_customer_establishment
    from public.loyalty_customers
    where id = p_customer_id;

    if v_customer_establishment is distinct from p_establishment_id then
      raise exception 'customer_establishment_mismatch';
    end if;
  end if;

  if p_type not in ('INFO','OFFER','REWARD','POINTS') then
    raise exception 'invalid_notification_type';
  end if;

  insert into public.loyalty_card_notifications(
    establishment_id, customer_id, title, message, type, expires_at, created_by
  )
  values (
    p_establishment_id, p_customer_id, trim(p_title), trim(p_message),
    p_type, p_expires_at, auth.uid()
  )
  returning id into v_id;

  return v_id;
end;
$function$;

create or replace function public.get_public_loyalty_notifications(
  p_access_token uuid,
  p_limit integer default 20
)
returns table(
  id uuid,
  title text,
  message text,
  type text,
  created_at timestamptz,
  expires_at timestamptz,
  is_read boolean
)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_customer_id uuid;
  v_establishment_id uuid;
begin
  select lc.id, lc.establishment_id
  into v_customer_id, v_establishment_id
  from public.loyalty_customers lc
  join public.loyalty_customer_links lcl on lcl.customer_id = lc.id
  where lcl.access_token = p_access_token
  limit 1;

  if v_customer_id is null then return; end if;

  return query
  select
    n.id, n.title, n.message, n.type, n.created_at, n.expires_at,
    exists (
      select 1
      from public.loyalty_card_notification_reads r
      where r.notification_id = n.id
        and r.customer_id = v_customer_id
    )
  from public.loyalty_card_notifications n
  where n.establishment_id = v_establishment_id
    and (n.customer_id is null or n.customer_id = v_customer_id)
    and (n.expires_at is null or n.expires_at > now())
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit,20),50));
end;
$function$;

create or replace function public.mark_public_loyalty_notification_read(
  p_access_token uuid,
  p_notification_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_customer_id uuid;
  v_establishment_id uuid;
begin
  select lc.id, lc.establishment_id
  into v_customer_id, v_establishment_id
  from public.loyalty_customers lc
  join public.loyalty_customer_links lcl on lcl.customer_id = lc.id
  where lcl.access_token = p_access_token
  limit 1;

  if v_customer_id is null then return false; end if;

  if not exists (
    select 1
    from public.loyalty_card_notifications n
    where n.id = p_notification_id
      and n.establishment_id = v_establishment_id
      and (n.customer_id is null or n.customer_id = v_customer_id)
  ) then
    return false;
  end if;

  insert into public.loyalty_card_notification_reads(notification_id, customer_id)
  values (p_notification_id, v_customer_id)
  on conflict(notification_id, customer_id)
  do update set read_at = now();

  return true;
end;
$function$;

create or replace function public.create_loyalty_notification_campaign(
  p_establishment_id uuid,
  p_title text,
  p_message text,
  p_type text default 'INFO',
  p_expires_at timestamptz default null,
  p_audience jsonb default '{}'::jsonb
)
returns table(campaign_id uuid, recipient_count integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_campaign_id uuid;
  v_count integer;
  v_interests text[];
  v_frequency text;
  v_min_points integer;
  v_min_visits integer;
  v_last_visit_days integer;
  v_customer_ids uuid[];
begin
  if not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'not_authorized';
  end if;

  if p_type not in ('INFO','OFFER','REWARD','POINTS') then
    raise exception 'invalid_notification_type';
  end if;

  if p_audience is null then p_audience := '{}'::jsonb; end if;
  if jsonb_typeof(p_audience) <> 'object' then raise exception 'invalid_audience'; end if;

  if p_audience ? 'interests' then
    select coalesce(array_agg(value), '{}'::text[])
    into v_interests
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_audience->'interests') = 'array'
           then p_audience->'interests'
           else '[]'::jsonb end
    ) as x(value);
  end if;

  v_frequency := nullif(trim(p_audience->>'visit_frequency'), '');
  v_min_points := greatest(0, coalesce(nullif(p_audience->>'min_points','')::integer, 0));
  v_min_visits := greatest(0, coalesce(nullif(p_audience->>'min_visits','')::integer, 0));
  v_last_visit_days := greatest(0, coalesce(nullif(p_audience->>'last_visit_days','')::integer, 0));

  if v_frequency is not null and v_frequency not in ('WEEKLY','MONTHLY','OCCASIONAL') then
    raise exception 'invalid_visit_frequency';
  end if;

  if p_audience ? 'customer_ids'
     and jsonb_typeof(p_audience->'customer_ids') = 'array' then
    select coalesce(array_agg(value::uuid), '{}'::uuid[])
    into v_customer_ids
    from jsonb_array_elements_text(p_audience->'customer_ids') as x(value);
  end if;

  insert into public.loyalty_notification_campaigns(
    establishment_id, title, message, type, audience, expires_at, created_by
  )
  values (
    p_establishment_id, trim(p_title), trim(p_message), p_type,
    p_audience, p_expires_at, auth.uid()
  )
  returning id into v_campaign_id;

  insert into public.loyalty_card_notifications(
    establishment_id, customer_id, title, message, type, expires_at, created_by
  )
  select
    lc.establishment_id, lc.id, trim(p_title), trim(p_message),
    p_type, p_expires_at, auth.uid()
  from public.loyalty_customers lc
  where lc.establishment_id = p_establishment_id
    and coalesce(lc.notification_consent, false) = true
    and (
      v_customer_ids is null
      or cardinality(v_customer_ids) = 0
      or lc.id = any(v_customer_ids)
    )
    and (
      v_interests is null
      or cardinality(v_interests) = 0
      or coalesce(lc.interests, '{}'::text[]) && v_interests
    )
    and (v_frequency is null or lc.visit_frequency = v_frequency)
    and coalesce(lc.points_balance, 0) >= v_min_points
    and coalesce(lc.visit_count, 0) >= v_min_visits
    and (
      v_last_visit_days = 0
      or (
        lc.last_visit_at is not null
        and lc.last_visit_at >= now() - make_interval(days => v_last_visit_days)
      )
    );

  get diagnostics v_count = row_count;

  update public.loyalty_notification_campaigns
  set recipient_count = v_count
  where id = v_campaign_id;

  return query select v_campaign_id, v_count;
end;
$function$;

revoke execute on function public.create_loyalty_card_notification(uuid,uuid,text,text,text,timestamptz) from public, anon;
grant execute on function public.create_loyalty_card_notification(uuid,uuid,text,text,text,timestamptz) to authenticated;
revoke execute on function public.create_loyalty_notification_campaign(uuid,text,text,text,timestamptz,jsonb) from public, anon;
grant execute on function public.create_loyalty_notification_campaign(uuid,text,text,text,timestamptz,jsonb) to authenticated;
revoke execute on function public.get_public_loyalty_notifications(uuid,integer) from public;
grant execute on function public.get_public_loyalty_notifications(uuid,integer) to anon, authenticated;
revoke execute on function public.mark_public_loyalty_notification_read(uuid,uuid) from public;
grant execute on function public.mark_public_loyalty_notification_read(uuid,uuid) to anon, authenticated;
