-- The public enrollment wrappers are the only intended entry points.
-- This legacy helper returns the full loyalty_customers row, so it must never be
-- directly callable through the Data API by anon/authenticated clients.
revoke execute on function public.register_public_loyalty_customer(uuid,text,text,text,date)
from public, anon, authenticated;
