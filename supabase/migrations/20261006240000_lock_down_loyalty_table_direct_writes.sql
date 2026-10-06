-- Loyalty balances and transaction history must only change through audited RPCs.
-- Keep SELECT policies intact; remove direct client-side mutation privileges.
revoke insert, update, delete, truncate, references, trigger on public.loyalty_customers from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.loyalty_transactions from anon, authenticated;
revoke insert, update, delete, truncate, references, trigger on public.loyalty_discount_cards from anon, authenticated;

-- Admin access is intentionally mediated by SECURITY DEFINER RPCs as well.
-- service_role remains available for server-side maintenance.
revoke insert, update, delete, truncate, references, trigger on public.loyalty_customers from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.loyalty_transactions from authenticated;
revoke insert, update, delete, truncate, references, trigger on public.loyalty_discount_cards from authenticated;
