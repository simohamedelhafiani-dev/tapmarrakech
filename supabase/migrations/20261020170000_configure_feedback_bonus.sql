-- Configure the points awarded for the private satisfaction questionnaire.
-- This migration is committed to the feature branch only; do not apply to production without review.

alter table public.establishments
  add column if not exists feedback_bonus_points integer not null default 10;

alter table public.establishments
  drop constraint if exists establishments_feedback_bonus_points_check;

alter table public.establishments
  add constraint establishments_feedback_bonus_points_check
  check (feedback_bonus_points >= 0 and feedback_bonus_points <= 10000);

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
  feedback_submitted boolean,
  feedback_bonus_points integer
)
language sql stable security definer set search_path = pg_catalog, public, pg_temp
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
    exists(select 1 from public.satisfaction_feedback f where f.customer_id = c.id),
    greatest(coalesce(e.feedback_bonus_points, 10), 0)
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  join public.establishments e on e.id = c.establishment_id
  where l.access_token = p_access_token
  limit 1;
$$;

create or replace function public.submit_public_loyalty_feedback(
  p_access_token uuid,
  p_rating integer,
  p_comment text default null
)
returns table(success boolean, points_awarded integer, points_balance integer)
language plpgsql security definer set search_path = pg_catalog, public, pg_temp
as $$
declare
  v_customer public.loyalty_customers%rowtype;
  v_reward integer := 0;
  v_comment text := nullif(trim(coalesce(p_comment, '')), '');
  v_feedback_id uuid;
begin
  if p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_feedback_rating';
  end if;
  if length(coalesce(v_comment, '')) > 2000 then
    raise exception 'feedback_too_long';
  end if;

  select c.* into v_customer
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  where l.access_token = p_access_token
  for update of c;

  if not found then
    raise exception 'invalid_access_token';
  end if;

  -- The card UI hides the questionnaire after the first submission. Enforce the
  -- same rule in SQL so direct/repeated RPC calls cannot create duplicate feedback.
  if exists (
    select 1 from public.satisfaction_feedback f
    where f.customer_id = v_customer.id
  ) then
    return query select true, 0, v_customer.points_balance;
    return;
  end if;

  select greatest(coalesce(e.feedback_bonus_points, 10), 0)
    into v_reward
  from public.establishments e
  where e.id = v_customer.establishment_id;
  v_reward := coalesce(v_reward, 10);

  insert into public.satisfaction_feedback(
    customer_id, establishment_id, rating, comment, points_awarded
  ) values (
    v_customer.id, v_customer.establishment_id, p_rating, v_comment, v_reward
  ) returning id into v_feedback_id;

  if v_reward > 0 then
    update public.loyalty_customers as lc
    set points_balance = lc.points_balance + v_reward,
        total_points_earned = lc.total_points_earned + v_reward,
        updated_at = now()
    where lc.id = v_customer.id;

    insert into public.loyalty_transactions(
      establishment_id, customer_id, amount, points, type, description, transaction_reference
    ) values (
      v_customer.establishment_id, v_customer.id, null, v_reward, 'EARN',
      'Bonus questionnaire satisfaction', 'feedback_bonus:' || v_feedback_id::text
    );
  end if;

  return query
    select true, v_reward, v_customer.points_balance + v_reward;
end;
$$;

revoke all on function public.get_public_loyalty_engagement_context(uuid) from public, anon, authenticated;
grant execute on function public.get_public_loyalty_engagement_context(uuid) to anon, authenticated;
revoke all on function public.submit_public_loyalty_feedback(uuid, integer, text) from public, anon, authenticated;
grant execute on function public.submit_public_loyalty_feedback(uuid, integer, text) to anon, authenticated;
