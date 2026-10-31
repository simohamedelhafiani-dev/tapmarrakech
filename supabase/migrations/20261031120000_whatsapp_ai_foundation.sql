-- WhatsApp AI foundation: tenant-isolated connections, conversations, messages and handoffs.
-- Credentials are stored in Supabase Vault; this migration does not create or expose any provider secrets.
create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null unique references public.establishments(id) on delete cascade,
  phone_number_id text not null unique,
  waba_id text not null,
  display_phone_number text,
  business_name text,
  access_token_secret_id uuid,
  app_secret_secret_id uuid,
  verify_token_secret_id uuid,
  status text not null default 'pending' check (status in ('pending','active','paused','error','disconnected')),
  auto_reply_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint whatsapp_phone_number_id_nonempty check (length(trim(phone_number_id)) > 0),
  constraint whatsapp_waba_id_nonempty check (length(trim(waba_id)) > 0)
);

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  customer_phone text not null,
  customer_name text,
  status text not null default 'open' check (status in ('open','waiting_human','resolved','closed')),
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (connection_id, customer_phone)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  provider_message_id text,
  direction text not null check (direction in ('inbound','outbound')),
  message_type text not null default 'text',
  body text,
  delivery_status text not null default 'received' check (delivery_status in ('received','queued','sent','delivered','read','failed')),
  raw_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (provider_message_id)
);

create table if not exists public.whatsapp_consent_events (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  customer_phone text not null,
  consent_type text not null check (consent_type in ('service','marketing')),
  action text not null check (action in ('granted','revoked')),
  source text not null default 'whatsapp',
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.whatsapp_handoff_requests (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  reason text not null,
  status text not null default 'pending' check (status in ('pending','assigned','completed','cancelled')),
  assigned_to uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists whatsapp_conversations_establishment_last_message_idx
  on public.whatsapp_conversations (establishment_id, last_message_at desc);
create index if not exists whatsapp_messages_conversation_created_idx
  on public.whatsapp_messages (conversation_id, created_at);
create index if not exists whatsapp_handoff_pending_idx
  on public.whatsapp_handoff_requests (establishment_id, status, created_at desc);

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_consent_events enable row level security;
alter table public.whatsapp_handoff_requests enable row level security;

-- Deliberately no direct client policies: all access goes through authenticated Edge Functions.
-- This keeps Vault secret identifiers and message records out of direct PostgREST access.
