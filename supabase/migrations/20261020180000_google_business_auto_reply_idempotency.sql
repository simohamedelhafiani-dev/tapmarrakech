-- Prevent duplicate automatic replies when Google Pub/Sub redelivers an event.
-- A nullable timestamp is claimed with a conditional UPDATE; only one concurrent
-- webhook can change NULL to a timestamp for a given review.
alter table public.google_business_reviews
  add column if not exists auto_reply_claimed_at timestamptz;

create index if not exists idx_google_business_reviews_auto_reply_claimed_at
  on public.google_business_reviews(auto_reply_claimed_at)
  where auto_reply_claimed_at is not null;
