-- Prevent duplicate stamp reward redemptions from reusing stale claims.
-- The claim is valid only while the customer still has enough stamps.
create or replace function public.redeem_public_loyalty_stamp_reward_claim(
  p_scanner_token uuid,
  p_claim_token uuid
)
returns table(new_stamps_balance integer, reward_name text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_establishment uuid;
  v_customer uuid;
  v_goal integer;
  v_name text;
  v_current_stamps integer;
  v_new integer;
begin
  select establishment_id
  into v_establishment
  from public.establishment_scanner_links
  where access_token = p_scanner_token
  limit 1;

  if v_establishment is null then
    raise exception 'Scanner invalide';
  end if;

  select customer_id, reward_name, stamps_required
  into v_customer, v_name, v_goal
  from public.loyalty_stamp_reward_claims
  where claim_token = p_claim_token
    and establishment_id = v_establishment
    and status = 'PENDING'
    and expires_at > now()
  for update;

  if v_customer is null then
    raise exception 'QR cadeau invalide, expiré ou déjà utilisé';
  end if;

  select stamps_balance
  into v_current_stamps
  from public.loyalty_customers
  where id = v_customer
    and establishment_id = v_establishment
  for update;

  if v_current_stamps is null then
    raise exception 'Client introuvable';
  end if;

  if v_current_stamps < v_goal then
    raise exception 'Solde de tampons insuffisant pour cette récompense';
  end if;

  update public.loyalty_customers
  set stamps_balance = 0,
      updated_at = now()
  where id = v_customer
    and establishment_id = v_establishment
  returning stamps_balance into v_new;

  update public.loyalty_stamp_reward_claims
  set status = 'REDEEMED', redeemed_at = now()
  where claim_token = p_claim_token;

  insert into public.loyalty_transactions(
    establishment_id, customer_id, employee_id, amount, points, type, description
  )
  values (
    v_establishment, v_customer, NULL, NULL, 0, 'REDEEM',
    'QR cadeau à tampons réclamé — ' || coalesce(v_name, 'Cadeau fidélité')
  );

  return query select v_new, v_name;
end;
$function$;

revoke execute on function public.redeem_public_loyalty_stamp_reward_claim(uuid,uuid) from public, anon;
grant execute on function public.redeem_public_loyalty_stamp_reward_claim(uuid,uuid) to anon, authenticated;
