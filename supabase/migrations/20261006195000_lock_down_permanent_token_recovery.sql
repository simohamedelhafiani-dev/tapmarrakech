-- Recovery hardening for legacy phone/loyalty-number lookup RPCs.
-- The current app uses the consent/proof-based consume_loyalty_card_recovery flow.
-- Restrict the legacy entry points if present; never create or expose them here.
do $$
begin
  if to_regprocedure('public.recover_loyalty_card(uuid,text)') is not null then
    revoke execute on function public.recover_loyalty_card(uuid,text) from public, anon;
  end if;
  if to_regprocedure('public.get_public_loyalty_link(uuid,text,text)') is not null then
    revoke execute on function public.get_public_loyalty_link(uuid,text,text) from public, anon;
  end if;
end;
$$;
