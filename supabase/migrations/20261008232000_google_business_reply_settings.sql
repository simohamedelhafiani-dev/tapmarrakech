create table if not exists public.google_business_settings (
  establishment_id uuid primary key references public.establishments(id) on delete cascade,
  auto_reply_enabled boolean not null default false,
  auto_reply_language text not null default 'fr',
  auto_reply_tone text not null default 'professional_warm',
  require_approval boolean not null default false,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.google_business_settings enable row level security;
revoke all on public.google_business_settings from anon, authenticated;