-- Complete pending referrals after a genuine scanner loyalty action.
create or replace function public.complete_referral_after_loyalty_action()
returns trigger language plpgsql security definer set search_path to 'public'
as $$
begin
  if new.type='EARN' and new.customer_id is not null
     and (coalesce(new.amount,0)>0 or new.description='Tampon fidélité ajouté') then
    perform public.complete_pending_loyalty_referral(new.customer_id);
  end if;
  return new;
end;
$$;
drop trigger if exists trg_complete_referral_after_loyalty_action on public.loyalty_transactions;
create trigger trg_complete_referral_after_loyalty_action
after insert on public.loyalty_transactions for each row
execute function public.complete_referral_after_loyalty_action();
revoke execute on function public.complete_referral_after_loyalty_action() from public,anon,authenticated;
