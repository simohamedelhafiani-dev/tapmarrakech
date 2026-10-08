create table if not exists public.google_business_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.google_business_oauth_states enable row level security;
revoke all on public.google_business_oauth_states from anon, authenticated;
create index if not exists idx_gbp_oauth_states_expiry on public.google_business_oauth_states(expires_at);