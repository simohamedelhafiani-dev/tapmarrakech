-- Prevent authenticated/anonymous clients from bypassing audited loyalty RPCs.
-- Read access remains controlled by RLS/policies where intentionally exposed.
-- Business mutations must go through SECURITY DEFINER RPCs.

revoke insert, update, delete, truncate, references, trigger
on public.loyalty_customers from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.loyalty_transactions from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.loyalty_redemptions from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.loyalty_discount_cards from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.loyalty_employee_rewards from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.loyalty_birthday_rewards from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.loyalty_card_notifications from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
on public.loyalty_notification_campaigns from anon, authenticated;
