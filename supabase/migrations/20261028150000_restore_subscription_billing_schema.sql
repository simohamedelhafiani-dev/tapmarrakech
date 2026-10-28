-- Restore subscription/billing schema in staging environments.
-- Idempotent: safe to run when some billing objects already exist.
create table if not exists public.subscription_plans (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  price_mad numeric not null default 0 check (price_mad >= 0),
  interval text not null default 'month' check (interval in ('month','year')),
  active boolean not null default true,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  features jsonb not null default '[]'::jsonb
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null unique references public.establishments(id) on delete cascade,
  plan_id uuid not null references public.subscription_plans(id),
  status text not null default 'trial' check (status in ('trial','active','past_due','unpaid','canceled')),
  started_at timestamptz default now(),
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  trial_days integer not null default 0 check (trial_days between 0 and 365)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount_mad numeric not null default 0 check (amount_mad >= 0),
  status text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  reference text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  number text unique,
  amount_mad numeric not null default 0 check (amount_mad >= 0),
  status text not null default 'pending' check (status in ('draft','pending','paid','overdue','void')),
  due_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.subscription_plans enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.invoices enable row level security;

drop policy if exists subscription_plans_admin_select on public.subscription_plans;
create policy subscription_plans_admin_select on public.subscription_plans for select to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists subscription_plans_admin_write on public.subscription_plans;
create policy subscription_plans_admin_write on public.subscription_plans for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists subscriptions_admin_all on public.subscriptions;
create policy subscriptions_admin_all on public.subscriptions for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists payments_admin_all on public.payments;
create policy payments_admin_all on public.payments for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));
drop policy if exists invoices_admin_all on public.invoices;
create policy invoices_admin_all on public.invoices for all to authenticated
using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

insert into public.subscription_plans (name, price_mad, interval, active, description, features)
values
('Basic',299,'month',true,'Pack essentiel', '["Page publique","Avis & réputation","Contact"]'::jsonb),
('Premium',499,'month',true,'Pack croissance', '["Page publique","Avis & réputation","Fidélité","Menu","Promotions","Analytics"]'::jsonb),
('Enterprise',799,'month',true,'Pack complet', '["Page publique","Avis & réputation","Fidélité","Menu","Promotions","Analytics","Assistant IA","Gestion avancée"]'::jsonb)
on conflict (name) do update set price_mad=excluded.price_mad, interval=excluded.interval, active=excluded.active, description=excluded.description, features=excluded.features, updated_at=now();

create or replace function public.get_responsible_subscription_card(p_establishment_id uuid)
returns jsonb language sql stable security definer set search_path = public, auth
as $$
  select jsonb_build_object(
    'establishment_id', s.establishment_id,
    'subscription_status', s.status,
    'plan_id', p.id,
    'plan_name', p.name,
    'features', p.features,
    'plan_price_mad', p.price_mad,
    'plan_interval', p.interval,
    'current_period_end', s.current_period_end,
    'trial_days', s.trial_days
  )
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.establishment_id = p_establishment_id
    and (
      exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
      or exists (select 1 from public.establishment_staff es where es.establishment_id = s.establishment_id and es.user_id = auth.uid() and es.active = true)
    )
  limit 1
$$;

create or replace function public.get_my_subscription_for_establishment(p_establishment_id uuid)
returns table (
  establishment_id uuid, subscription_status text, plan_id uuid, plan_name text, features jsonb,
  plan_price_mad numeric, plan_interval text, current_period_end timestamptz, trial_days integer
)
language sql stable security definer set search_path = public, auth
as $$
  select s.establishment_id, s.status, p.id, p.name, p.features, p.price_mad, p.interval, s.current_period_end, s.trial_days
  from public.subscriptions s
  join public.subscription_plans p on p.id = s.plan_id
  where s.establishment_id = p_establishment_id
    and (
      exists (select 1 from public.profiles pr where pr.id = auth.uid() and pr.role = 'admin')
      or exists (select 1 from public.establishment_staff es where es.establishment_id = s.establishment_id and es.user_id = auth.uid() and es.active = true)
    )
  limit 1
$$;

revoke all on function public.get_responsible_subscription_card(uuid) from public, anon;
grant execute on function public.get_responsible_subscription_card(uuid) to authenticated;
revoke all on function public.get_my_subscription_for_establishment(uuid) from public, anon;
grant execute on function public.get_my_subscription_for_establishment(uuid) to authenticated;
