REVOKE EXECUTE
ON FUNCTION public.get_public_loyalty_raffle_winners(uuid)
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.get_public_loyalty_raffle_winners(uuid)
TO anon, authenticated;
