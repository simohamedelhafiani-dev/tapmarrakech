create or replace function public.get_loyalty_dashboard_stats(p_establishment_id uuid)
returns table(
  customers_count bigint,
  points_in_circulation numeric,
  active_customers_count bigint,
  rewards_count bigint
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
    (select count(*) from public.loyalty_customers c where c.establishment_id = p_establishment_id),
    coalesce((select sum(c.points_balance) from public.loyalty_customers c where c.establishment_id = p_establishment_id), 0),
    (select count(*) from public.loyalty_customers c where c.establishment_id = p_establishment_id and c.visit_count > 0),
    (select count(*) from public.loyalty_rewards r where r.establishment_id = p_establishment_id and r.active = true);
end;
$function$;

revoke all on function public.get_loyalty_dashboard_stats(uuid) from public;
grant execute on function public.get_loyalty_dashboard_stats(uuid) to authenticated;