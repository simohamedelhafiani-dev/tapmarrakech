-- Smart Nearby geofence event deduplication (branch PR154, staging migration separately applied).
create table if not exists public.smart_nearby_events (
 id uuid primary key default gen_random_uuid(),
 establishment_id uuid not null references public.establishments(id) on delete cascade,
 customer_id uuid not null references public.loyalty_customers(id) on delete cascade,
 zone_key text not null,
 detected_at timestamptz not null default now(),
 event_day date not null default (timezone('Africa/Casablanca', now()))::date,
 created_at timestamptz not null default now(),
 unique(customer_id, establishment_id, zone_key, event_day)
);
create index if not exists smart_nearby_events_establishment_detected_idx on public.smart_nearby_events(establishment_id, detected_at desc);
alter table public.smart_nearby_events enable row level security;
revoke all on public.smart_nearby_events from anon, authenticated;
