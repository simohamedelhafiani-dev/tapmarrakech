alter table public.google_business_reviews
  add column if not exists reply_draft text,
  add column if not exists reply_status text not null default 'none'
    check (reply_status in ('none','pending_approval','ready_to_publish','published','failed')),
  add column if not exists reply_error text,
  add column if not exists reply_generated_at timestamptz,
  add column if not exists reply_published_at timestamptz;

update public.google_business_reviews
set reply_status = 'published',
    reply_published_at = coalesce(owner_reply_updated_at, updated_at)
where nullif(trim(owner_reply), '') is not null
  and reply_status = 'none';

create index if not exists idx_google_business_reviews_reply_status
  on public.google_business_reviews(reply_status);
