create or replace function public.get_public_loyalty_notifications(
  p_access_token uuid,
  p_limit integer default 20
)
returns table(
  id uuid,
  title text,
  message text,
  type text,
  created_at timestamptz,
  expires_at timestamptz,
  is_read boolean
)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_customer_id uuid;
  v_establishment_id uuid;
begin
  select lc.id, lc.establishment_id
    into v_customer_id, v_establishment_id
  from public.loyalty_customers lc
  join public.loyalty_customer_links lcl on lcl.customer_id = lc.id
  where lcl.access_token = p_access_token
  limit 1;

  if v_customer_id is null then
    return;
  end if;

  return query
  select
    n.id,
    n.title,
    n.message,
    n.type,
    n.created_at,
    n.expires_at,
    false
  from public.loyalty_card_notifications n
  where n.establishment_id = v_establishment_id
    and (n.customer_id is null or n.customer_id = v_customer_id)
    and (n.expires_at is null or n.expires_at > now())
    and not exists (
      select 1
      from public.loyalty_card_notification_reads r
      where r.notification_id = n.id
        and r.customer_id = v_customer_id
    )
  order by n.created_at desc
  limit greatest(1, least(coalesce(p_limit, 20), 50));
end
$function$;
