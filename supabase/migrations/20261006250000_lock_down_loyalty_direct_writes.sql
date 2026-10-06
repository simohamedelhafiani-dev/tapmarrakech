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


-- Legacy public Wi-Fi endpoint exposed the establishment password; no current app route uses it.
revoke execute on function public.get_public_wifi(uuid) from public, anon, authenticated;


-- Legacy public registration wrapper is no longer used; v2 is the supported enrollment path.
revoke execute on function public.register_public_loyalty_customer_for_enrollment(uuid, text, text, text, date) from public, anon, authenticated;

-- Legacy duplicate transaction-history endpoint is not used by the current public card.
revoke execute on function public.get_public_loyalty_transactions(uuid) from public, anon, authenticated;
