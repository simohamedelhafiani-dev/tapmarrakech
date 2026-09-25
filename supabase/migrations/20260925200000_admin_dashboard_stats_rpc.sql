drop function if exists public.get_admin_dashboard_stats(uuid);
create function public.get_admin_dashboard_stats(p_establishment_id uuid default null)
returns table(
  reviews_count bigint,
  average_rating numeric,
  positive_reviews_count bigint,
  negative_reviews_count bigint,
  loyalty_customers_count bigint,
  analytics_events_count bigint
)
language plpgsql stable security definer set search_path = public
as $function$
begin
  if auth.uid() is null or not public.is_tapmarrakech_admin() then
    raise exception 'Not authorized';
  end if;
  return query
  select
    (select count(*) from public.reviews r where p_establishment_id is null or r.establishment_id = p_establishment_id),
    coalesce((select avg(r.rating) from public.reviews r where p_establishment_id is null or r.establishment_id = p_establishment_id), 0),
    (select count(*) from public.reviews r where (p_establishment_id is null or r.establishment_id = p_establishment_id) and r.rating >= 4),
    (select count(*) from public.reviews r where (p_establishment_id is null or r.establishment_id = p_establishment_id) and r.rating <= 3),
    (select count(*) from public.loyalty_customers c where p_establishment_id is null or c.establishment_id = p_establishment_id),
    (select count(*) from public.analytics_events a where p_establishment_id is null or a.establishment_id = p_establishment_id);
end;
$function$;
revoke all on function public.get_admin_dashboard_stats(uuid) from public;
grant execute on function public.get_admin_dashboard_stats(uuid) to authenticated;