-- Public reviews must be submitted through the rate-limited Edge Function,
-- which uses the service role after validating and throttling each request.
-- Direct Data API inserts would bypass those protections.
REVOKE INSERT ON TABLE public.reviews FROM PUBLIC, anon, authenticated;

-- Remove the now-unneeded direct insert policy as defense in depth.
DROP POLICY IF EXISTS reviews_public_insert ON public.reviews;
