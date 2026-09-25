drop function if exists public.get_dashboard_program_stats(uuid, integer);

create function public.get_dashboard_program_stats(
  p_establishment_id uuid,
  p_days integer default 30
)
returns table(
  reviews_count bigint,
  average_rating numeric,
  positive_reviews bigint,
  negative_reviews bigint,
  pending_negative_reviews bigint,
  current_reviews bigint,
  review_growth numeric,
  current_registrations bigint,
  registration_growth numeric,
  returning_rate numeric,
  returning_customers bigint,
  active_rate numeric,
  active_customers bigint,
  redemption_rate numeric,
  points_earned numeric,
  points_redeemed numeric,
  visits numeric,
  current_revenue numeric,
  previous_revenue numeric,
  revenue_growth numeric,
  total_revenue numeric,
  current_transactions bigint,
  average_basket numeric,
  current_redemptions bigint,
  previous_redemptions bigint,
  redemption_growth numeric,
  points_redeemed_on_period numeric,
  reward_value_on_period numeric,
  previous_reward_value numeric,
  redemption_revenue numeric,
  reward_efficiency numeric,
  reward_cost_on_period numeric,
  net_contribution numeric,
  real_roi numeric
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_days integer := greatest(1, least(coalesce(p_days, 30), 3650));
  v_now timestamptz := now();
  v_current_start timestamptz := v_now - make_interval(days => v_days);
  v_previous_start timestamptz := v_now - make_interval(days => v_days * 2);
  v_points_per_currency numeric := 1;
begin
  if auth.uid() is null or not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'Not authorized';
  end if;

  select coalesce(ls.points_per_currency, 1)
  into v_points_per_currency
  from public.loyalty_settings ls
  where ls.establishment_id = p_establishment_id
  limit 1;

  return query
  with
  rv as (select r.* from public.reviews r where r.establishment_id = p_establishment_id),
  current_rv as (select r.* from rv r where r.created_at >= v_current_start),
  previous_rv as (select r.* from rv r where r.created_at >= v_previous_start and r.created_at < v_current_start),
  customers as (select c.* from public.loyalty_customers c where c.establishment_id = p_establishment_id),
  current_customers as (select c.* from customers c where c.created_at >= v_current_start),
  previous_customers as (select c.* from customers c where c.created_at >= v_previous_start and c.created_at < v_current_start),
  tx as (select t.* from public.loyalty_transactions t where t.establishment_id = p_establishment_id and t.type = 'EARN'),
  current_tx as (select t.* from tx t where t.created_at >= v_current_start),
  previous_tx as (select t.* from tx t where t.created_at >= v_previous_start and t.created_at < v_current_start),
  rd as (select r.* from public.loyalty_redemptions r where r.establishment_id = p_establishment_id),
  current_rd as (select r.* from rd r where r.created_at >= v_current_start),
  previous_rd as (select r.* from rd r where r.created_at >= v_previous_start and r.created_at < v_current_start),
  base as (
    select
      (select count(*) from rv) reviews_count,
      coalesce((select avg(r.rating) from rv r), 0) average_rating,
      (select count(*) from rv r where r.rating >= 4 or r.type = 'positive') positive_reviews,
      (select count(*) from rv r where r.rating <= 3 or r.type = 'negative') negative_reviews,
      (select count(*) from rv r where r.status = 'Nouveau' and r.rating <= 3) pending_negative_reviews,
      (select count(*) from current_rv) current_reviews,
      (select count(*) from previous_rv) previous_reviews,
      (select count(*) from current_customers) current_registrations,
      (select count(*) from previous_customers) previous_registrations,
      (select count(*) from customers) total_customers,
      (select count(*) from customers c where coalesce(c.visit_count,0) >= 2) returning_customers,
      (select count(*) from customers c where c.last_visit_at >= v_current_start) active_customers,
      coalesce((select sum(c.total_points_earned) from customers c),0)::numeric points_earned,
      coalesce((select sum(c.total_points_redeemed) from customers c),0)::numeric points_redeemed,
      coalesce((select sum(c.visit_count) from customers c),0)::numeric visits,
      coalesce((select sum(t.amount) from current_tx t),0)::numeric current_revenue,
      coalesce((select sum(t.amount) from previous_tx t),0)::numeric previous_revenue,
      coalesce((select sum(t.amount) from tx t),0)::numeric total_revenue,
      (select count(*) from current_tx) current_transactions,
      (select count(*) from current_rd) current_redemptions,
      (select count(*) from previous_rd) previous_redemptions,
      coalesce((select sum(r.points_used) from current_rd r),0)::numeric points_redeemed_on_period,
      coalesce((select sum(r.points_used) from previous_rd r),0)::numeric previous_points_redeemed_on_period,
      coalesce((select sum(coalesce(r.amount_paid, r.invoice_amount, 0)) from current_rd r),0)::numeric redemption_revenue,
      coalesce((select sum(coalesce(r.reward_cost_mad,0)) from current_rd r),0)::numeric reward_cost_on_period
  )
  select
    b.reviews_count,
    b.average_rating,
    b.positive_reviews,
    b.negative_reviews,
    b.pending_negative_reviews,
    b.current_reviews,
    case when b.previous_reviews = 0 then case when b.current_reviews > 0 then 100 else 0 end else ((b.current_reviews - b.previous_reviews)::numeric / b.previous_reviews) * 100 end,
    b.current_registrations,
    case when b.previous_registrations = 0 then case when b.current_registrations > 0 then 100 else 0 end else ((b.current_registrations - b.previous_registrations)::numeric / b.previous_registrations) * 100 end,
    case when b.total_customers = 0 then 0 else (b.returning_customers::numeric / b.total_customers) * 100 end,
    b.returning_customers,
    case when b.total_customers = 0 then 0 else (b.active_customers::numeric / b.total_customers) * 100 end,
    b.active_customers,
    case when b.points_earned = 0 then 0 else (b.points_redeemed / b.points_earned) * 100 end,
    b.points_earned,
    b.points_redeemed,
    b.visits,
    b.current_revenue,
    b.previous_revenue,
    case when b.previous_revenue = 0 then case when b.current_revenue > 0 then 100 else 0 end else ((b.current_revenue - b.previous_revenue) / b.previous_revenue) * 100 end,
    b.total_revenue,
    b.current_transactions,
    case when b.current_transactions = 0 then 0 else b.current_revenue / b.current_transactions end,
    b.current_redemptions,
    b.previous_redemptions,
    case when b.previous_redemptions = 0 then case when b.current_redemptions > 0 then 100 else 0 end else ((b.current_redemptions - b.previous_redemptions)::numeric / b.previous_redemptions) * 100 end,
    b.points_redeemed_on_period,
    case when v_points_per_currency <= 0 then 0 else b.points_redeemed_on_period / v_points_per_currency end,
    case when v_points_per_currency <= 0 then 0 else b.previous_points_redeemed_on_period / v_points_per_currency end,
    b.redemption_revenue,
    case when (b.points_redeemed_on_period / nullif(v_points_per_currency,0)) = 0 then 0 else b.redemption_revenue / (b.points_redeemed_on_period / nullif(v_points_per_currency,0)) end,
    b.reward_cost_on_period,
    b.redemption_revenue - b.reward_cost_on_period,
    case when b.reward_cost_on_period > 0 then ((b.redemption_revenue - b.reward_cost_on_period) / b.reward_cost_on_period) * 100 else null end
  from base b;
end;
$function$;

revoke all on function public.get_dashboard_program_stats(uuid, integer) from public;
grant execute on function public.get_dashboard_program_stats(uuid, integer) to authenticated;
