-- Account-level Google Business connections. Existing establishment-scoped connections remain valid
-- during migration; no production database is changed by committing this file.
create table if not exists public.google_business_accounts (
  id uuid primary key default gen_random_uuid(),
  google_account_id text,
  email text,
  access_token text,
  refresh_token text not null,
  token_expires_at timestamptz,
  scopes text[] not null default '{}',
  connected_by uuid references auth.users(id) on delete set null,
  status text not null default 'active' check (status in ('active','revoked','error')),
  last_sync_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(connected_by, google_account_id)
);
alter table public.google_business_accounts enable row level security;
revoke all on public.google_business_accounts from anon, authenticated;

alter table public.google_business_locations
  add column if not exists google_business_account_id uuid null
  references public.google_business_accounts(id) on delete set null;
create index if not exists google_business_locations_account_idx
  on public.google_business_locations(google_business_account_id);

-- The OAuth state supports both legacy establishment-specific flow and the new account-first flow.
alter table public.google_business_oauth_states
  alter column establishment_id drop not null;
