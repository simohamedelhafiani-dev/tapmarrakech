-- Keep Smart Marketing queue tenant ownership consistent with the linked customer.
create or replace function public.smart_marketing_queue_validate_tenant()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  customer_establishment uuid;
begin
  select lc.establishment_id into customer_establishment
  from public.loyalty_customers lc
  where lc.id = new.customer_id;

  if customer_establishment is null or customer_establishment <> new.establishment_id then
    raise exception 'Smart Marketing queue customer does not belong to the establishment'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

revoke all on function public.smart_marketing_queue_validate_tenant() from public, anon, authenticated;
drop trigger if exists smart_marketing_queue_tenant_guard on public.smart_marketing_queue;
create trigger smart_marketing_queue_tenant_guard
before insert or update of establishment_id, customer_id
on public.smart_marketing_queue
for each row execute function public.smart_marketing_queue_validate_tenant();
