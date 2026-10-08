-- Fix ambiguity between RETURNS TABLE expires_at output and recovery session column.
create or replace function public.create_loyalty_card_recovery_session(p_customer_id uuid)
returns table(recovery_token uuid, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_establishment_id uuid;
  v_token uuid;
  v_expires timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  select c.establishment_id
    into v_establishment_id
  from public.loyalty_customers as c
  where c.id = p_customer_id;

  if v_establishment_id is null then
    raise exception 'Customer not found';
  end if;

  if not public.user_has_establishment_access(v_establishment_id) then
    raise exception 'Access denied';
  end if;

  update public.loyalty_card_recovery_sessions as s
  set consumed_at = now()
  where s.customer_id = p_customer_id
    and s.consumed_at is null
    and s.expires_at > now();

  insert into public.loyalty_card_recovery_sessions (
    establishment_id, customer_id, expires_at, created_by
  )
  values (
    v_establishment_id, p_customer_id,
    now() + interval '5 minutes', auth.uid()
  )
  returning loyalty_card_recovery_sessions.recovery_token,
            loyalty_card_recovery_sessions.expires_at
  into v_token, v_expires;

  return query select v_token, v_expires;
end;
$function$;