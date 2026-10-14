-- KELYANI: restrict direct table mutations.
-- Preserve authenticated SELECT access used by the RLS-protected raffle Studio.
-- SECURITY DEFINER RPCs remain responsible for raffle operations.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.loyalty_raffles
FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.loyalty_raffle_entries
FROM anon, authenticated;

REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
ON TABLE public.loyalty_raffle_winners
FROM anon, authenticated;

-- Do not alter loyalty_customer_links privileges yet:
-- verify all database-function dependencies before changing them.
