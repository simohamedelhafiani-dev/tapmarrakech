-- One-time CSRF nonce transactions for WhatsApp Embedded Signup.
create table if not exists public.whatsapp_oauth_states (
  id uuid primary key default gen_random_uuid(),
  nonce_hash text not null unique,
  user_id uuid not null references auth.users(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists whatsapp_oauth_states_expiry_idx on public.whatsapp_oauth_states (expires_at);
alter table public.whatsapp_oauth_states enable row level security;
revoke all on public.whatsapp_oauth_states from anon, authenticated;
grant select, insert, update, delete on public.whatsapp_oauth_states to service_role;
