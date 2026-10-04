-- The public enrollment endpoint is the only anonymous entry point.
-- Keep the lower-level customer-returning function private to prevent direct
-- anonymous access to a full loyalty customer record.
revoke execute on function public.register_public_loyalty_customer_v2(uuid,text,text,text,date,text,text[],boolean,boolean,text,text) from public, anon, authenticated;
