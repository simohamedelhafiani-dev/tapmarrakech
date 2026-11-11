CREATE OR REPLACE FUNCTION public.get_dashboard_stats(
  p_establishment_id uuid DEFAULT NULL,
  p_days integer DEFAULT 30
)
RETURNS TABLE (
  period_days integer,
  reviews_count bigint,
  average_rating numeric,
  positive_reviews_count bigint,
  negative_reviews_count bigint,
  pending_reviews_count bigint,
  loyalty_customers_count bigint,
  returning_customers_count bigint,
  active_customers_count bigint,
  visits_total bigint,
  points_balance_total bigint,
  points_earned_total bigint,
  points_redeemed_total bigint,
  analytics_events_count bigint,
  current_analytics_events_count bigint,
  current_reviews_count bigint,
  previous_reviews_count bigint,
  review_growth numeric,
  current_registrations_count bigint,
  previous_registrations_count bigint,
  registration_growth numeric,
  returning_rate numeric,
  active_rate numeric,
  redemption_rate numeric,
  current_revenue numeric,
  previous_revenue numeric,
  total_revenue numeric,
  current_transactions_count bigint,
  average_basket numeric,
  current_redemptions_count bigint,
  previous_redemptions_count bigint,
  redemption_growth numeric,
  points_redeemed_on_period bigint,
  reward_value_on_period numeric,
  redemption_revenue numeric,
  reward_cost_on_period numeric,
  net_contribution numeric,
  real_roi numeric,
  reward_efficiency numeric,
  points_per_currency numeric
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
DECLARE
  v_days integer := greatest(1, least(coalesce(p_days, 30), 365));
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_previous_since timestamptz := now() - make_interval(days => 2 * greatest(1, least(coalesce(p_days, 30), 365)));
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_establishment_id IS NULL THEN
    IF NOT public.is_tapmarrakech_admin() THEN
      RAISE EXCEPTION 'Platform admin access required' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.user_has_establishment_access(p_establishment_id) THEN
    RAISE EXCEPTION 'Establishment access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  WITH scoped_reviews AS (
    SELECT r.* FROM public.reviews r
    WHERE p_establishment_id IS NULL OR r.establishment_id = p_establishment_id
  ),
  scoped_customers AS (
    SELECT c.* FROM public.loyalty_customers c
    WHERE p_establishment_id IS NULL OR c.establishment_id = p_establishment_id
  ),
  scoped_transactions AS (
    SELECT t.* FROM public.loyalty_transactions t
    WHERE (p_establishment_id IS NULL OR t.establishment_id = p_establishment_id)
      AND t.type = 'EARN'
  ),
  scoped_redemptions AS (
    SELECT r.* FROM public.loyalty_redemptions r
    WHERE p_establishment_id IS NULL OR r.establishment_id = p_establishment_id
  ),
  scoped_events AS (
    SELECT e.* FROM public.analytics_events e
    WHERE p_establishment_id IS NULL OR e.establishment_id = p_establishment_id
  ),
  review_metrics AS (
    SELECT
      count(*)::bigint AS total,
      coalesce(avg(rating), 0)::numeric AS avg_rating,
      count(*) FILTER (WHERE rating >= 4)::bigint AS positive,
      count(*) FILTER (WHERE rating <= 3)::bigint AS negative,
      count(*) FILTER (WHERE lower(coalesce(status,'')) IN ('pending','new','unread'))::bigint AS pending,
      count(*) FILTER (WHERE created_at >= v_since)::bigint AS current_count,
      count(*) FILTER (WHERE created_at >= v_previous_since AND created_at < v_since)::bigint AS previous_count
    FROM scoped_reviews
  ),
  customer_metrics AS (
    SELECT
      count(*)::bigint AS total,
      count(*) FILTER (WHERE coalesce(visit_count,0) > 1)::bigint AS returning,
      count(*) FILTER (WHERE last_visit_at >= v_since)::bigint AS active,
      coalesce(sum(coalesce(visit_count,0)),0)::bigint AS visits,
      coalesce(sum(coalesce(points_balance,0)),0)::bigint AS points_balance,
      coalesce(sum(coalesce(total_points_earned,0)),0)::bigint AS points_earned,
      coalesce(sum(coalesce(total_points_redeemed,0)),0)::bigint AS points_redeemed,
      count(*) FILTER (WHERE created_at >= v_since)::bigint AS current_regs,
      count(*) FILTER (WHERE created_at >= v_previous_since AND created_at < v_since)::bigint AS previous_regs
    FROM scoped_customers
  ),
  transaction_metrics AS (
    SELECT
      coalesce(sum(amount) FILTER (WHERE created_at >= v_since),0)::numeric AS current_revenue,
      coalesce(sum(amount) FILTER (WHERE created_at >= v_previous_since AND created_at < v_since),0)::numeric AS previous_revenue,
      coalesce(sum(amount),0)::numeric AS total_revenue,
      count(*) FILTER (WHERE created_at >= v_since)::bigint AS current_count
    FROM scoped_transactions
  ),
  redemption_metrics AS (
    SELECT
      count(*) FILTER (WHERE created_at >= v_since)::bigint AS current_count,
      count(*) FILTER (WHERE created_at >= v_previous_since AND created_at < v_since)::bigint AS previous_count,
      coalesce(sum(points_used) FILTER (WHERE created_at >= v_since),0)::bigint AS points_period,
      coalesce(sum(discount_amount) FILTER (WHERE created_at >= v_since),0)::numeric AS reward_value,
      coalesce(sum(amount_paid) FILTER (WHERE created_at >= v_since),0)::numeric AS redemption_revenue,
      coalesce(sum(reward_cost_mad) FILTER (WHERE created_at >= v_since),0)::numeric AS reward_cost,
      count(DISTINCT customer_id) FILTER (WHERE created_at >= v_since)::bigint AS redeemed_customers
    FROM scoped_redemptions
  ),
  event_metrics AS (
    SELECT
      count(*)::bigint AS total,
      count(*) FILTER (WHERE created_at >= v_since)::bigint AS current_count
    FROM scoped_events
  ),
  settings_metrics AS (
    SELECT coalesce(avg(points_per_currency),1)::numeric AS points_per_currency
    FROM public.loyalty_settings s
    WHERE p_establishment_id IS NULL OR s.establishment_id = p_establishment_id
  )
  SELECT
    v_days,
    rm.total,
    rm.avg_rating,
    rm.positive,
    rm.negative,
    rm.pending,
    cm.total,
    cm.returning,
    cm.active,
    cm.visits,
    cm.points_balance,
    cm.points_earned,
    cm.points_redeemed,
    em.total,
    em.current_count,
    rm.current_count,
    rm.previous_count,
    CASE WHEN rm.previous_count = 0 THEN CASE WHEN rm.current_count > 0 THEN 100::numeric ELSE 0::numeric END
         ELSE round(((rm.current_count - rm.previous_count)::numeric / rm.previous_count) * 100, 2) END,
    cm.current_regs,
    cm.previous_regs,
    CASE WHEN cm.previous_regs = 0 THEN CASE WHEN cm.current_regs > 0 THEN 100::numeric ELSE 0::numeric END
         ELSE round(((cm.current_regs - cm.previous_regs)::numeric / cm.previous_regs) * 100, 2) END,
    CASE WHEN cm.total = 0 THEN 0::numeric ELSE round(cm.returning::numeric / cm.total * 100, 2) END,
    CASE WHEN cm.total = 0 THEN 0::numeric ELSE round(cm.active::numeric / cm.total * 100, 2) END,
    CASE WHEN cm.total = 0 THEN 0::numeric ELSE round(rdm.redeemed_customers::numeric / cm.total * 100, 2) END,
    tm.current_revenue,
    tm.previous_revenue,
    tm.total_revenue,
    tm.current_count,
    CASE WHEN tm.current_count = 0 THEN 0::numeric ELSE round(tm.current_revenue / tm.current_count, 2) END,
    rdm.current_count,
    rdm.previous_count,
    CASE WHEN rdm.previous_count = 0 THEN CASE WHEN rdm.current_count > 0 THEN 100::numeric ELSE 0::numeric END
         ELSE round(((rdm.current_count - rdm.previous_count)::numeric / rdm.previous_count) * 100, 2) END,
    rdm.points_period,
    rdm.reward_value,
    rdm.redemption_revenue,
    rdm.reward_cost,
    tm.current_revenue - rdm.reward_cost,
    CASE WHEN rdm.reward_cost = 0 THEN NULL::numeric
         ELSE round(((tm.current_revenue - rdm.reward_cost) / rdm.reward_cost) * 100, 2) END,
    CASE WHEN rdm.reward_cost = 0 THEN 0::numeric
         ELSE round(rdm.reward_value / rdm.reward_cost, 2) END,
    sm.points_per_currency
  FROM review_metrics rm
  CROSS JOIN customer_metrics cm
  CROSS JOIN transaction_metrics tm
  CROSS JOIN redemption_metrics rdm
  CROSS JOIN event_metrics em
  CROSS JOIN settings_metrics sm;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(uuid, integer) TO authenticated;
