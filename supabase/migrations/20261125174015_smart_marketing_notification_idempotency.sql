-- Idempotency key linking notifications to their originating Smart Marketing queue task.
alter table public.loyalty_card_notifications
  add column if not exists smart_marketing_queue_id uuid
  references public.smart_marketing_queue(id) on delete set null;
create unique index if not exists loyalty_card_notifications_smart_queue_unique
  on public.loyalty_card_notifications(smart_marketing_queue_id)
  where smart_marketing_queue_id is not null;
