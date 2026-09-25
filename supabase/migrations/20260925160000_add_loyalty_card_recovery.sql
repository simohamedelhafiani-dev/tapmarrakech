create or replace function public.get_loyalty_recovery_context(
  p_establishment_id uuid
) returns table (
  establishment_name text
)
language sql
security definer
set search_path = public
as $$
  select e.name
  from public.establishments e
  where e.id = p_establishment_id
  limit 1;
$$;

create or replace function public.recover_loyalty_card(
  p_establishment_id uuid,
  p_phone text
) returns table (
  access_token uuid,
  first_name text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_phone text;
begin
  if p_establishment_id is null or p_phone is null then
    return;
  end if;

  v_phone := regexp_replace(trim(p_phone), '\D', '', 'g');

  if left(v_phone, 3) = '212' and length(v_phone) = 12 then
    v_phone := '0' || right(v_phone, 9);
  end if;

  if length(v_phone) < 9 then
    return;
  end if;

  return query
  select l.access_token, c.first_name
  from public.loyalty_customers c
  join public.loyalty_customer_links l on l.customer_id = c.id
  where c.establishment_id = p_establishment_id
    and regexp_replace(coalesce(c.phone, ''), '\D', '', 'g') = v_phone
  limit 1;
end;
$$;

revoke all on function public.get_loyalty_recovery_context(uuid) from public;
grant execute on function public.get_loyalty_recovery_context(uuid) to anon, authenticated;

revoke all on function public.recover_loyalty_card(uuid, text) from public;
grant execute on function public.recover_loyalty_card(uuid, text) to anon, authenticated;
