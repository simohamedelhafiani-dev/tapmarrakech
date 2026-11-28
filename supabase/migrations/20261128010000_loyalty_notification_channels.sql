-- One notification space for every loyalty channel: the KELYANI web card (bell + Web Push),
-- Google Wallet and Apple Wallet. Channels are switched on per establishment by a KELYANI
-- admin, within what the establishment's pack includes (Wallet channels = Enterprise).

create table if not exists public.loyalty_notification_channels (
  establishment_id uuid primary key references public.establishments(id) on delete cascade,
  kelyani_card boolean not null default true,
  google_wallet boolean not null default false,
  apple_wallet boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.loyalty_notification_channels enable row level security;
-- No direct table access: reads and writes go through the functions below.
revoke all on public.loyalty_notification_channels from anon, authenticated;

create or replace function public.loyalty_wallet_channels_included(p_establishment_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
  select exists (
    select 1
    from public.subscriptions s
    join public.subscription_plans p on p.id = s.plan_id
    where s.establishment_id = p_establishment_id
      and s.status in ('trial', 'active')
      and (s.current_period_end is null or s.current_period_end > now())
      and lower(trim(p.name)) = 'enterprise'
  );
$$;

revoke all on function public.loyalty_wallet_channels_included(uuid) from public, anon, authenticated;

create or replace function public.get_loyalty_notification_channels(p_establishment_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'pg_temp'
as $$
declare
  v_row public.loyalty_notification_channels;
  v_included boolean;
  v_plan text;
begin
  if not (
    public.is_tapmarrakech_admin()
    or exists (
      select 1 from public.establishment_staff es
      where es.establishment_id = p_establishment_id and es.user_id = auth.uid() and es.active = true
    )
  ) then
    raise exception 'Accès refusé.' using errcode = '42501';
  end if;

  select * into v_row from public.loyalty_notification_channels where establishment_id = p_establishment_id;
  v_included := public.loyalty_wallet_channels_included(p_establishment_id);
  select p.name into v_plan
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.establishment_id = p_establishment_id
    and s.status in ('trial', 'active')
    and (s.current_period_end is null or s.current_period_end > now())
  order by s.created_at desc
  limit 1;

  return jsonb_build_object(
    'kelyani_card', coalesce(v_row.kelyani_card, true),
    'google_wallet', coalesce(v_row.google_wallet, false) and v_included,
    'apple_wallet', coalesce(v_row.apple_wallet, false) and v_included,
    'wallet_included', v_included,
    'plan_name', v_plan,
    'updated_at', v_row.updated_at
  );
end;
$$;

revoke all on function public.get_loyalty_notification_channels(uuid) from public, anon;
grant execute on function public.get_loyalty_notification_channels(uuid) to authenticated;

create or replace function public.set_loyalty_notification_channels(
  p_establishment_id uuid,
  p_kelyani_card boolean,
  p_google_wallet boolean,
  p_apple_wallet boolean
)
returns jsonb
language plpgsql
security definer
set search_path to 'pg_catalog', 'public', 'auth', 'pg_temp'
as $$
begin
  if not public.is_tapmarrakech_admin() then
    raise exception 'Seul un administrateur KELYANI peut activer les canaux.' using errcode = '42501';
  end if;
  if (coalesce(p_google_wallet, false) or coalesce(p_apple_wallet, false))
     and not public.loyalty_wallet_channels_included(p_establishment_id) then
    raise exception 'Les canaux Wallet sont inclus uniquement dans le pack Enterprise.' using errcode = '22023';
  end if;

  insert into public.loyalty_notification_channels as c
    (establishment_id, kelyani_card, google_wallet, apple_wallet, updated_at, updated_by)
  values
    (p_establishment_id, coalesce(p_kelyani_card, true), coalesce(p_google_wallet, false), coalesce(p_apple_wallet, false), now(), auth.uid())
  on conflict (establishment_id) do update set
    kelyani_card = excluded.kelyani_card,
    google_wallet = excluded.google_wallet,
    apple_wallet = excluded.apple_wallet,
    updated_at = now(),
    updated_by = auth.uid();

  return public.get_loyalty_notification_channels(p_establishment_id);
end;
$$;

revoke all on function public.set_loyalty_notification_channels(uuid, boolean, boolean, boolean) from public, anon;
grant execute on function public.set_loyalty_notification_channels(uuid, boolean, boolean, boolean) to authenticated;

-- Smart Marketing dispatch (service role) reads the channels before mirroring to Google Wallet.
grant execute on function public.loyalty_wallet_channels_included(uuid) to service_role;
grant select on public.loyalty_notification_channels to service_role;
