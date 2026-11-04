-- Idempotency claim used by scheduled sync and Pub/Sub to prevent duplicate Google replies.
-- Safe to apply to environments where this column/index already exist.
alter table public.google_business_reviews
  add column if not exists auto_reply_claimed_at timestamptz;

create index if not exists idx_google_business_reviews_auto_reply_claimed_at
  on public.google_business_reviews(auto_reply_claimed_at)
  where auto_reply_claimed_at is not null;
