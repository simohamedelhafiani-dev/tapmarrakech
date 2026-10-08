create table if not exists public.google_business_connections (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  google_account_id text,
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
  unique(establishment_id)
);
create table if not exists public.google_business_locations (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.google_business_connections(id) on delete cascade,
  google_account_id text not null,
  google_location_id text not null,
  location_name text,
  title text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(google_location_id)
);
create table if not exists public.google_business_reviews (
  id uuid primary key default gen_random_uuid(),
  location_id uuid not null references public.google_business_locations(id) on delete cascade,
  google_review_name text not null,
  reviewer_display_name text,
  reviewer_is_anonymous boolean not null default false,
  star_rating text,
  comment text,
  review_created_at timestamptz,
  review_updated_at timestamptz,
  owner_reply text,
  owner_reply_updated_at timestamptz,
  raw_payload jsonb not null default '{}'::jsonb,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(google_review_name)
);
alter table public.google_business_connections enable row level security;
alter table public.google_business_locations enable row level security;
alter table public.google_business_reviews enable row level security;
revoke all on public.google_business_connections, public.google_business_locations, public.google_business_reviews from anon, authenticated;
create index if not exists idx_gbp_locations_connection on public.google_business_locations(connection_id);
create index if not exists idx_gbp_reviews_location on public.google_business_reviews(location_id);
create index if not exists idx_gbp_reviews_updated on public.google_business_reviews(review_updated_at desc);