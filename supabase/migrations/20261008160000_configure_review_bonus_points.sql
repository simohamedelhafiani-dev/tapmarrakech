-- KELYANI: make review bonus points establishment-configurable

alter table public.establishments
  add column if not exists review_bonus_points integer not null default 0;

alter table public.establishments
  drop constraint if exists establishments_review_bonus_points_check;

alter table public.establishments
  add constraint establishments_review_bonus_points_check
  check (review_bonus_points >= 0);

drop function if exists public.get_public_loyalty_engagement_context(uuid);

create function public.get_public_loyalty_engagement_context(p_access_token uuid)
returns table(
  customer_id uuid,
  establishment_id uuid,
  customer_name text,
  google_review_url text,
  tripadvisor_review_url text,
  review_bonus_points integer,
  whatsapp_number text,
  google_claimed boolean,
  tripadvisor_claimed boolean,
  feedback_submitted boolean
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select
    c.id,
    c.establishment_id,
    trim(concat_ws(' ', c.first_name, c.last_name)),
    e.google_review_url,
    e.tripadvisor_review_url,
    greatest(coalesce(e.review_bonus_points, 0), 0),
    e.whatsapp_number,
    exists(select 1 from public.customer_reviews_claims r where r.customer_id = c.id and r.platform = 'google'),
    exists(select 1 from public.customer_reviews_claims r where r.customer_id = c.id and r.platform = 'tripadvisor'),
    exists(select 1 from public.satisfaction_feedback f where f.customer_id = c.id)
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  join public.establishments e on e.id = c.establishment_id
  where l.access_token = p_access_token
  limit 1;
$$;

create or replace function public.claim_public_loyalty_review_bonus(
  p_access_token uuid,
  p_platform text
)
returns table(success boolean, already_claimed boolean, points_awarded integer, points_balance integer)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_customer public.loyalty_customers%rowtype;
  v_claim_id uuid;
  v_reward integer := 0;
  v_new_balance integer;
begin
  if p_platform not in ('google', 'tripadvisor') then
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
    and (
      (p_platform = 'google' and nullif(trim(e.google_review_url), '') is not null)
      or (p_platform = 'tripadvisor' and nullif(trim(e.tripadvisor_review_url), '') is not null)
    );

  if not found then
    raise exception 'review_platform_not_configured';
  end if;

  begin
    insert into public.customer_reviews_claims(customer_id, establishment_id, platform, points_awarded)
    values(v_customer.id, v_customer.establishment_id, p_platform, v_reward)
    returning id into v_claim_id;
  exception when unique_violation then
    return query select false, true, 0, v_customer.points_balance;
    return;
  end;

  if v_reward > 0 then
    update public.loyalty_customers as lc
    set points_balance = lc.points_balance + v_reward,
        total_points_earned = lc.total_points_earned + v_reward,
        updated_at = now()
    where lc.id = v_customer.id
    returning lc.points_balance into v_new_balance;

    insert into public.loyalty_transactions(
      establishment_id, customer_id, amount, points, type, description, transaction_reference
    )
    values(
      v_customer.establishment_id,
      v_customer.id,
      null,
      v_reward,
      'EARN',
      case when p_platform = 'google' then 'Bonus avis Google' else 'Bonus avis TripAdvisor' end,
      'review_bonus:' || p_platform || ':' || v_claim_id::text
    );
  else
    v_new_balance := v_customer.points_balance;
  end if;

  return query select true, false, v_reward, v_new_balance;
end;
$$;

revoke all on function public.get_public_loyalty_engagement_context(uuid) from public, anon, authenticated;
grant execute on function public.get_public_loyalty_engagement_context(uuid) to anon, authenticated;

revoke all on function public.claim_public_loyalty_review_bonus(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_public_loyalty_review_bonus(uuid, text) to anon, authenticated;
