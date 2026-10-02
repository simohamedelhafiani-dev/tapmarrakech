-- Global public enrollment for a loyalty program.
-- No table or column changes: this wraps the existing customer registration
-- and customer-link flow into one public, token-returning RPC.

create or replace function public.register_public_loyalty_customer_for_enrollment(
  p_establishment_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_birth_date date default null
)
returns table(
  establishment_name text,
  access_token uuid
)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_customer public.loyalty_customers;
  v_access_token uuid;
  v_establishment_name text;
  v_enabled boolean;
begin
  if p_establishment_id is null then
    raise exception 'Établissement invalide';
  end if;

  select e.name, coalesce(s.enabled, false)
    into v_establishment_name, v_enabled
  from public.establishments e
  left join public.loyalty_settings s
    on s.establishment_id = e.id
  where e.id = p_establishment_id
  limit 1;

  if v_establishment_name is null then
    raise exception 'Établissement invalide';
  end if;

  if not v_enabled then
    raise exception 'loyalty_program_disabled';
  end if;

  v_customer := public.register_public_loyalty_customer(
    p_establishment_id,
    p_first_name,
    p_last_name,
    p_phone,
    p_birth_date
  );

  select l.access_token
    into v_access_token
  from public.loyalty_customer_links l
  where l.customer_id = v_customer.id
  limit 1;

  if v_access_token is null then
    raise exception 'Impossible de créer votre carte fidélité';
  end if;

  return query
  select v_establishment_name, v_access_token;
end;
$function$;

revoke all on function public.register_public_loyalty_customer_for_enrollment(uuid,text,text,text,date) from public;
grant execute on function public.register_public_loyalty_customer_for_enrollment(uuid,text,text,text,date) to anon, authenticated;
