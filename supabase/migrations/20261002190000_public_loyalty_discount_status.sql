create or replace function public.get_public_loyalty_discount_status(p_access_token uuid)
returns table(
  discount_percent numeric,
  valid_from timestamptz,
  expires_at timestamptz,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    d.discount_percent,
    d.valid_from,
    d.expires_at,
    d.status
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  join public.loyalty_discount_cards d
    on d.customer_id = c.id
   and d.establishment_id = c.establishment_id
  where l.access_token = p_access_token
    and d.status = 'ACTIVE'
    and d.expires_at > now()
  order by d.created_at desc
  limit 1;
$$;
