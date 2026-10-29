-- Persist generated Google review replies and their publication lifecycle.
alter table public.google_business_reviews
  add column if not exists reply_draft text,
  add column if not exists reply_status text,
  add column if not exists reply_error text,
  add column if not exists reply_published_at timestamptz,
  add column if not exists reply_generated_at timestamptz;

comment on column public.google_business_reviews.reply_draft is
  'AI-generated or manually edited draft; publishing is always a separate explicit action.';
comment on column public.google_business_reviews.reply_status is
  'Reply workflow status: pending_approval, ready_to_publish, published, or failed.';
