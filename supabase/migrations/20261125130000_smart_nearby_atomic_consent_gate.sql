-- Re-check all required consents under a customer-row lock at notification commit time.
-- This serializes notification creation with GPS/marketing/notification consent revocation.
drop function if exists public.smart_nearby_notify_atomic(uuid,uuid,text,text,text);

create function public.smart_nearby_notify_atomic(
  p_customer_id uuid,
  p_establishment_id uuid,
  p_zone_key text,
  p_title text,
  p_message text
)
returns table(created boolean, consent_valid boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_gps_consent boolean;
  v_notification_consent boolean;
  v_marketing_consent boolean;
  v_establishment_id uuid;
  v_event_id uuid;
begin
  if p_customer_id is null or p_establishment_id is null then
    raise exception 'Customer and establishment are required' using errcode = '22023';
  end if;

  select c.gps_consent, c.notification_consent, c.marketing_consent, c.establishment_id
    into v_gps_consent, v_notification_consent, v_marketing_consent, v_establishment_id
  from public.loyalty_customers c
  where c.id = p_customer_id
  for update;

  if not found
     or v_establishment_id is distinct from p_establishment_id
     or not coalesce(v_gps_consent, false)
     or not coalesce(v_notification_consent, false)
     or not coalesce(v_marketing_consent, false) then
    return query select false, false;
    return;
  end if;

  begin
    insert into public.smart_nearby_events(customer_id,establishment_id,zone_key)
    values(p_customer_id,p_establishment_id,left(coalesce(p_zone_key,'main'),40))
    returning id into v_event_id;
  exception when unique_violation then
    return query select false, true;
    return;
  end;

  insert into public.loyalty_card_notifications(establishment_id,customer_id,title,message,type)
  values(p_establishment_id,p_customer_id,left(coalesce(p_title,'Vous êtes à proximité !'),120),left(coalesce(p_message,'Passez nous voir, nous serons ravis de vous accueillir !'),1000),'OFFER');

  return query select true, true;
end;
$$;

revoke all on function public.smart_nearby_notify_atomic(uuid,uuid,text,text) from public, anon, authenticated;
grant execute on function public.smart_nearby_notify_atomic(uuid,uuid,text,text,text) to service_role;

notify pgrst, 'reload schema';
