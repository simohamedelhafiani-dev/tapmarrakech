-- Restore the employee-facing customer-card link RPC missing from the versioned history.
-- The token is returned only after verifying access to the customer's establishment.
create or replace function public.get_loyalty_customer_link(p_customer_id uuid)
returns table(customer_id uuid, access_token uuid)
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $function$
begin
  if not exists (
    select 1
    from public.loyalty_customers c
    where c.id = p_customer_id
      and (
        public.is_tapmarrakech_admin()
        or public.user_has_establishment_access(c.establishment_id)
      )
  ) then
    raise exception 'Not authorized';
  end if;

  return query
  select l.customer_id, l.access_token
  from public.loyalty_customer_links l
  where l.customer_id = p_customer_id;
end;
$function$;

revoke all on function public.get_loyalty_customer_link(uuid) from public, anon;
grant execute on function public.get_loyalty_customer_link(uuid) to authenticated, service_role;
