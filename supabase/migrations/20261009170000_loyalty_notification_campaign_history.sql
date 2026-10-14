-- Secure history for published loyalty notification campaigns.
create or replace function public.get_loyalty_notification_campaign_history(p_establishment_id uuid)
returns table(
  id uuid,
  title text,
  message text,
  type text,
  audience jsonb,
  expires_at timestamptz,
  recipient_count integer,
  status text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'not_authorized';
  end if;

  return query
  select c.id, c.title, c.message, c.type, c.audience, c.expires_at,
         c.recipient_count, c.status, c.created_at
  from public.loyalty_notification_campaigns c
  where c.establishment_id = p_establishment_id
  order by c.created_at desc
  limit 100;
end;
$function$;

revoke execute on function public.get_loyalty_notification_campaign_history(uuid) from public, anon;
grant execute on function public.get_loyalty_notification_campaign_history(uuid) to authenticated;
