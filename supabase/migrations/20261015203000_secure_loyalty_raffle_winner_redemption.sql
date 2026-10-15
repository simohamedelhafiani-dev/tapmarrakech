-- Secure, establishment-scoped lookup and redemption for raffle winner claims.
-- Additive migration: existing raffle, loyalty and reward functions remain unchanged.

create or replace function public.get_public_loyalty_raffle_winner_by_code(
  p_scanner_token uuid,
  p_claim_token uuid
)
returns table(
  winner_id uuid,
  title text,
  prize_name text,
  prize_description text,
  valid_from timestamptz,
  valid_until timestamptz,
  reservation_required boolean,
  status text
)
language sql
stable
security definer
set search_path = public
as $function$
  select w.id, r.title, w.prize_name, w.prize_description,
         w.valid_from, w.valid_until, w.reservation_required, w.status
  from public.establishment_scanner_links sl
  join public.loyalty_raffle_winners w on w.claim_token = p_claim_token
  join public.loyalty_raffles r on r.id = w.raffle_id
  where sl.access_token = p_scanner_token
    and sl.establishment_id = r.establishment_id
    and w.status = 'PENDING'
    and w.valid_from <= now()
    and w.valid_until >= now()
  limit 1;
$function$;

revoke all on function public.get_public_loyalty_raffle_winner_by_code(uuid, uuid) from public;
grant execute on function public.get_public_loyalty_raffle_winner_by_code(uuid, uuid) to anon, authenticated;

create or replace function public.redeem_public_loyalty_raffle_winner_by_code(
  p_scanner_token uuid,
  p_claim_token uuid
)
returns table(prize_name text, redeemed_at timestamptz)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_establishment_id uuid;
  v_winner public.loyalty_raffle_winners%rowtype;
  v_prize_name text;
  v_redeemed_at timestamptz;
begin
  select sl.establishment_id into v_establishment_id
  from public.establishment_scanner_links sl
  where sl.access_token = p_scanner_token
  limit 1;

  if v_establishment_id is null then
    raise exception 'invalid_scanner';
  end if;

  select w.* into v_winner
  from public.loyalty_raffle_winners w
  join public.loyalty_raffles r on r.id = w.raffle_id
  where w.claim_token = p_claim_token
    and r.establishment_id = v_establishment_id
  for update of w;

  if not found then
    raise exception 'invalid_raffle_claim';
  end if;

  if v_winner.status <> 'PENDING' then
    raise exception 'reward_not_pending';
  end if;

  if v_winner.valid_from > now() then
    raise exception 'reward_not_yet_valid';
  end if;

  if v_winner.valid_until < now() then
    update public.loyalty_raffle_winners
      set status = 'EXPIRED'
      where id = v_winner.id;
    raise exception 'reward_expired';
  end if;

  update public.loyalty_raffle_winners
    set status = 'REDEEMED',
        redeemed_at = now(),
        redeemed_by = auth.uid()
    where id = v_winner.id
      and status = 'PENDING'
  returning loyalty_raffle_winners.prize_name, loyalty_raffle_winners.redeemed_at
    into v_prize_name, v_redeemed_at;

  if not found then
    raise exception 'reward_not_pending';
  end if;

  return query select v_prize_name, v_redeemed_at;
end;
$function$;

revoke all on function public.redeem_public_loyalty_raffle_winner_by_code(uuid, uuid) from public;
grant execute on function public.redeem_public_loyalty_raffle_winner_by_code(uuid, uuid) to anon, authenticated;
