-- KELYANI: rewarded reviews are Google-only and single-use per customer.
create or replace function public.claim_public_loyalty_review_bonus(
  p_access_token text,
  p_platform text
) returns table(
  success boolean,
  already_claimed boolean,
  points_awarded integer,
  points_balance integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.loyalty_customers%rowtype;
  v_claim_id uuid;
  v_reward integer := 0;
  v_new_balance integer;
begin
  if p_platform <> 'google' then
    raise exception 'invalid_review_platform';
  end if;

  select c.* into v_customer
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  where l.access_token = p_access_token
  for update of c;

  if not found then
    raise exception 'invalid_access_token';
  end if;

  select greatest(coalesce(e.review_bonus_points, 0), 0)
    into v_reward
  from public.establishments e
  where e.id = v_customer.establishment_id
    and nullif(trim(e.google_review_url), '') is not null;

  if not found then
    raise exception 'google_review_not_configured';
  end if;

  begin
    insert into public.customer_reviews_claims(
      customer_id,
      establishment_id,
      platform,
      points_awarded
    )
    values (
      v_customer.id,
      v_customer.establishment_id,
      'google',
      v_reward
    )
    returning id into v_claim_id;
  exception
    when unique_violation then
      return query
        select false, true, 0, v_customer.points_balance;
      return;
  end;

  if v_reward > 0 then
    update public.loyalty_customers as lc
    set
      points_balance = lc.points_balance + v_reward,
      total_points_earned = lc.total_points_earned + v_reward,
      updated_at = now()
    where lc.id = v_customer.id
    returning lc.points_balance into v_new_balance;

    insert into public.loyalty_transactions(
      establishment_id,
      customer_id,
      amount,
      points,
      type,
      description,
      transaction_reference
    )
    values (
      v_customer.establishment_id,
      v_customer.id,
      null,
      v_reward,
      'EARN',
      'Bonus avis Google',
      'review_bonus:google:' || v_claim_id::text
    );
  else
    v_new_balance := v_customer.points_balance;
  end if;

  return query
    select true, false, v_reward, v_new_balance;
end;
$$;

revoke execute on function public.claim_public_loyalty_review_bonus(text, text) from public;
grant execute on function public.claim_public_loyalty_review_bonus(text, text) to anon, authenticated;
