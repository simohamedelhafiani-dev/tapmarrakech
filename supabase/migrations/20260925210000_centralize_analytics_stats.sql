-- Centralized analytics statistics. Browser pages call these RPCs instead of reading RLS-protected tables directly.

drop function if exists public.get_analytics_dashboard_stats(uuid);
create function public.get_analytics_dashboard_stats(p_establishment_id uuid)
returns table(
  reviews_count bigint,
  average_rating numeric,
  satisfaction_percent numeric,
  redirects_count bigint,
  page_views_count bigint,
  feedbacks_count bigint,
  weekly jsonb,
  distribution jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $function$
begin
  if auth.uid() is null
     or not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'Not authorized';
  end if;

  return query
  select
    (select count(*) from public.reviews r where r.establishment_id = p_establishment_id),
    coalesce((select avg(r.rating) from public.reviews r where r.establishment_id = p_establishment_id), 0),
    coalesce((
      select round(100.0 * count(*) filter (where r.rating >= 4) / nullif(count(*), 0), 0)
      from public.reviews r
      where r.establishment_id = p_establishment_id
    ), 0),
    (select count(*) from public.analytics_events e where e.establishment_id = p_establishment_id and e.event_type = 'google_redirect'),
    (select count(*) from public.analytics_events e where e.establishment_id = p_establishment_id and e.event_type = 'page_view'),
    (select count(*) from public.reviews r where r.establishment_id = p_establishment_id and r.rating <= 3),
    (
      select coalesce(jsonb_agg(
        jsonb_build_object('name', 'S' || gs.n, 'total', coalesce(x.total, 0))
        order by gs.n
      ), '[]'::jsonb)
      from generate_series(1, 8) gs(n)
      left join lateral (
        select count(*)::bigint as total
        from public.reviews r
        where r.establishment_id = p_establishment_id
          and r.created_at >= (now() - ((8 - gs.n) * interval '7 days') - interval '7 days')
          and r.created_at <= (now() - ((8 - gs.n) * interval '7 days'))
      ) x on true
    ),
    (
      select coalesce(jsonb_agg(
        jsonb_build_object('name', '⭐ ' || gs.n, 'value', coalesce(x.total, 0))
        order by gs.n desc
      ), '[]'::jsonb)
      from generate_series(1, 5) gs(n)
      left join lateral (
        select count(*)::bigint as total
        from public.reviews r
        where r.establishment_id = p_establishment_id
          and r.rating = gs.n
      ) x on true
    );
end;
$function$;

revoke all on function public.get_analytics_dashboard_stats(uuid) from public;
grant execute on function public.get_analytics_dashboard_stats(uuid) to authenticated;

drop function if exists public.get_admin_analytics_dashboard_stats(uuid, integer);
create function public.get_admin_analytics_dashboard_stats(
  p_establishment_id uuid default null,
  p_days integer default 30
)
returns table(
  reviews_count bigint,
  average_rating numeric,
  positive_reviews bigint,
  negative_reviews bigint,
  revenue numeric,
  transaction_count bigint,
  average_ticket numeric,
  points_earned numeric,
  events_count bigint,
  redemption_count bigint,
  reward_cost numeric,
  by_establishment jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  v_since timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 3650)));
begin
  if auth.uid() is null or not public.is_tapmarrakech_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  with
  tx as (
    select t.establishment_id, coalesce(t.amount, 0)::numeric amount, coalesce(t.points, 0)::numeric points
    from public.loyalty_transactions t
    where t.type = 'EARN' and t.created_at >= v_since
      and (p_establishment_id is null or t.establishment_id = p_establishment_id)
  ),
  rd as (
    select r.establishment_id, coalesce(r.reward_cost_mad, 0)::numeric reward_cost
    from public.loyalty_redemptions r
    where r.created_at >= v_since
      and (p_establishment_id is null or r.establishment_id = p_establishment_id)
  ),
  rv as (
    select r.establishment_id, r.rating, r.type
    from public.reviews r
    where r.created_at >= v_since
      and (p_establishment_id is null or r.establishment_id = p_establishment_id)
  ),
  ev as (
    select e.establishment_id
    from public.analytics_events e
    where e.created_at >= v_since
      and (p_establishment_id is null or e.establishment_id = p_establishment_id)
  ),
  filtered_establishments as (
    select e.id, e.name
    from public.establishments e
    where p_establishment_id is null or e.id = p_establishment_id
  ),
  per_establishment as (
    select
      e.id,
      e.name,
      coalesce((select sum(t.amount) from tx t where t.establishment_id = e.id), 0) revenue,
      coalesce((select count(*) from tx t where t.establishment_id = e.id), 0) transactions,
      coalesce((select count(*) from rd r where r.establishment_id = e.id), 0) rewards,
      coalesce((select sum(r.reward_cost) from rd r where r.establishment_id = e.id), 0) reward_cost,
      coalesce((select count(*) from rv r where r.establishment_id = e.id), 0) reviews,
      coalesce((select sum(r.rating) from rv r where r.establishment_id = e.id), 0) rating_total,
      coalesce((select count(*) from ev x where x.establishment_id = e.id), 0) events,
      coalesce((select sum(t.points) from tx t where t.establishment_id = e.id), 0) points
    from filtered_establishments e
  )
  select
    (select count(*) from rv),
    coalesce((select avg(r.rating) from rv r), 0),
    (select count(*) from rv r where r.type = 'positive' or r.rating >= 4),
    (select count(*) from rv r where r.type = 'negative' or r.rating <= 3),
    coalesce((select sum(t.amount) from tx t), 0),
    (select count(*) from tx),
    coalesce((select avg(t.amount) from tx t), 0),
    coalesce((select sum(t.points) from tx t), 0),
    (select count(*) from ev),
    (select count(*) from rd),
    coalesce((select sum(r.reward_cost) from rd r), 0),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'name', p.name, 'revenue', p.revenue,
        'transactions', p.transactions, 'rewards', p.rewards,
        'rewardCost', p.reward_cost, 'reviews', p.reviews,
        'ratingTotal', p.rating_total, 'events', p.events,
        'points', p.points
      ) order by p.name)
      from per_establishment p
      where p.revenue > 0 or p.rewards > 0 or p.reviews > 0 or p.events > 0
    ), '[]'::jsonb);
end;
$function$;

revoke all on function public.get_admin_analytics_dashboard_stats(uuid, integer) from public;
grant execute on function public.get_admin_analytics_dashboard_stats(uuid, integer) to authenticated;
