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



-- Legacy public registration wrapper is no longer used; v2 is the supported enrollment path.


-- Legacy duplicate transaction-history endpoint is not used by the current public card.



-- Retired legacy RPCs may be absent from a fresh reconstruction.
DO $migration$
BEGIN
  IF to_regprocedure('public.get_public_wifi(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_public_wifi(uuid) FROM PUBLIC, anon, authenticated';
  END IF;
  IF to_regprocedure('public.register_public_loyalty_customer_for_enrollment(uuid,text,text,text,date)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.register_public_loyalty_customer_for_enrollment(uuid,text,text,text,date) FROM PUBLIC, anon, authenticated';
  END IF;
  IF to_regprocedure('public.get_public_loyalty_transactions(uuid)') IS NOT NULL THEN
    EXECUTE 'REVOKE EXECUTE ON FUNCTION public.get_public_loyalty_transactions(uuid) FROM PUBLIC, anon, authenticated';
  END IF;
END
$migration$;
