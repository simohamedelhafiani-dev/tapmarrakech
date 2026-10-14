-- Existing loyalty notifications were generated before the notification UX was finalized.
-- Mark them as read so customers only see notifications created after this cleanup.
insert into public.loyalty_card_notification_reads (notification_id, customer_id)
select n.id, c.id
from public.loyalty_card_notifications n
join public.loyalty_customers c on c.establishment_id = n.establishment_id
where n.customer_id is null
on conflict (notification_id, customer_id) do nothing;

insert into public.loyalty_card_notification_reads (notification_id, customer_id)
select n.id, n.customer_id
from public.loyalty_card_notifications n
where n.customer_id is not null
on conflict (notification_id, customer_id) do nothing;
