-- Recovery hardening: phone/loyalty-number lookups must not return the permanent card token anonymously.
-- Re-enable only after OTP/proof-of-possession recovery is implemented.
revoke execute on function public.recover_loyalty_card(uuid,text) from public;
revoke execute on function public.get_public_loyalty_link(uuid,text,text) from public;
