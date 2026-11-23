-- Smart Marketing operational foundation: idempotent event queue and execution logs.
-- This migration deliberately does not dispatch messages. Worker/channel activation is a later certified step.
create table if not exists public.smart_marketing_queue (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
  smart_id text not null check (smart_id in ('winback','nearby','birthday','reward','vip','progress','happyhour','challenge','referral','comeback')),
  trigger_key text not null,
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  status text not null default 'PENDING' check (status in ('PENDING','PROCESSING','SENT','SKIPPED','FAILED')),
  scheduled_at timestamptz not null default now(),
  processed_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (establishment_id, customer_id, smart_id, trigger_key)
);
create index if not exists smart_marketing_queue_due_idx on public.smart_marketing_queue(status, scheduled_at) where status='PENDING';
create index if not exists smart_marketing_queue_establishment_idx on public.smart_marketing_queue(establishment_id, created_at desc);
alter table public.smart_marketing_queue enable row level security;
revoke all on public.smart_marketing_queue from anon, authenticated;
grant all on public.smart_marketing_queue to service_role;

create table if not exists public.smart_marketing_runs (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  smart_id text check (smart_id is null or smart_id in ('winback','nearby','birthday','reward','vip','progress','happyhour','challenge','referral','comeback')),
  run_type text not null default 'SCAN' check (run_type in ('SCAN','DISPATCH')),
  status text not null default 'STARTED' check (status in ('STARTED','COMPLETED','PARTIAL','FAILED')),
  scanned integer not null default 0,
  queued integer not null default 0,
  sent integer not null default 0,
  skipped integer not null default 0,
  failed integer not null default 0,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details)='object'),
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists smart_marketing_runs_establishment_created_idx on public.smart_marketing_runs(establishment_id, created_at desc);
alter table public.smart_marketing_runs enable row level security;
revoke all on public.smart_marketing_runs from anon, authenticated;
grant all on public.smart_marketing_runs to service_role;
