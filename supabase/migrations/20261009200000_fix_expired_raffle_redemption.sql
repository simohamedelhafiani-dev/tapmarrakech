-- Persist expired raffle rewards instead of raising an exception that rolls back the update.
-- The RPC returns a small status value so the client can distinguish expiry from redemption.
drop function if exists public.redeem_loyalty_raffle_winner(uuid);

create function public.redeem_loyalty_raffle_winner(p_winner_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est uuid;
  v_until timestamptz;
  v_status text;
begin
  select r.establishment_id, w.valid_until, w.status
    into v_est, v_until, v_status
  from public.loyalty_raffle_winners w
  join public.loyalty_raffles r on r.id = w.raffle_id
  where w.id = p_winner_id
  for update of w;

  if v_est is null
     or not (public.is_tapmarrakech_admin()
             or public.is_establishment_responsible(v_est)) then
    raise exception 'not_authorized';
  end if;

  if v_status is distinct from 'PENDING' then
    raise exception 'reward_not_pending';
  end if;

  if v_until < now() then
    update public.loyalty_raffle_winners
    set status = 'EXPIRED'
    where id = p_winner_id and status = 'PENDING';
    return 'EXPIRED';
  end if;

  update public.loyalty_raffle_winners
  set status = 'REDEEMED',
      redeemed_at = now(),
      redeemed_by = auth.uid()
  where id = p_winner_id and status = 'PENDING';

  if not found then
    raise exception 'reward_not_pending';
  end if;

  return 'REDEEMED';
end;
$$;

revoke all on function public.redeem_loyalty_raffle_winner(uuid) from public;
grant execute on function public.redeem_loyalty_raffle_winner(uuid) to authenticated;
