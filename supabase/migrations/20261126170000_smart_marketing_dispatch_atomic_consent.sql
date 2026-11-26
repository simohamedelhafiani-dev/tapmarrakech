-- Serialize Smart Marketing delivery with customer consent changes.
-- A revocation and a dispatch now contend on the same customer row lock.
create or replace function public.smart_marketing_dispatch_notification_atomic(
  p_queue_id uuid,
  p_title text,
  p_message text,
  p_type text
)
returns table(created boolean, consent_valid boolean)
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_customer_id uuid;
  v_establishment_id uuid;
  v_queue_status text;
  v_customer_establishment_id uuid;
  v_notification_consent boolean;
  v_marketing_consent boolean;
  v_notification_id uuid;
begin
  if p_queue_id is null
     or nullif(btrim(p_title), '') is null
     or char_length(btrim(p_title)) > 120
     or nullif(btrim(p_message), '') is null
     or char_length(btrim(p_message)) > 1000
     or p_type not in ('INFO', 'OFFER', 'REWARD', 'POINTS') then
    raise exception 'Invalid Smart Marketing notification payload'
      using errcode = '22023';
  end if;

  select q.customer_id, q.establishment_id, q.status
    into v_customer_id, v_establishment_id, v_queue_status
  from public.smart_marketing_queue q
  where q.id = p_queue_id
  for update;

  if not found or v_queue_status <> 'PROCESSING' then
    return query select false, false;
    return;
  end if;

  -- Consent updates lock this same row, so delivery is ordered before or after revocation.
  select c.establishment_id, c.notification_consent, c.marketing_consent
    into v_customer_establishment_id, v_notification_consent, v_marketing_consent
  from public.loyalty_customers c
  where c.id = v_customer_id
  for update;

  if not found
     or v_customer_establishment_id is distinct from v_establishment_id
     or not coalesce(v_notification_consent, false)
     or not coalesce(v_marketing_consent, false) then
    update public.smart_marketing_queue
    set status = 'SKIPPED',
        processing_started_at = null,
        processed_at = now(),
        last_error = 'Consent missing at atomic dispatch'
    where id = p_queue_id;
    return query select false, false;
    return;
  end if;

  insert into public.loyalty_card_notifications(
    establishment_id, customer_id, smart_marketing_queue_id, title, message, type
  )
  values (
    v_establishment_id, v_customer_id, p_queue_id,
    left(btrim(p_title), 120), left(btrim(p_message), 1000), p_type
  )
  on conflict (smart_marketing_queue_id)
    where smart_marketing_queue_id is not null
    do nothing
  returning id into v_notification_id;

  update public.smart_marketing_queue
  set status = 'SENT',
      processing_started_at = null,
      processed_at = now(),
      last_error = null
  where id = p_queue_id;

  return query select v_notification_id is not null, true;
end;
$$;

revoke all on function public.smart_marketing_dispatch_notification_atomic(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function public.smart_marketing_dispatch_notification_atomic(uuid, text, text, text)
  to service_role;

notify pgrst, 'reload schema';
