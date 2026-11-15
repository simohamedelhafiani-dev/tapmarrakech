-- Keep a single, one-argument campaign history RPC and include the latest Push attempt.
drop function if exists public.get_loyalty_notification_campaign_history(uuid, integer);

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
  created_at timestamptz,
  last_push_status text,
  last_push_at timestamptz,
  last_push_sent integer,
  last_push_failed integer,
  last_push_skipped integer,
  last_push_total integer,
  last_push_error text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null or not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'not_authorized';
  end if;

  return query
  select c.id, c.title, c.message, c.type, c.audience, c.expires_at,
         c.recipient_count, c.status, c.created_at,
         a.status, a.created_at, a.sent, a.failed, a.skipped, a.total, a.error_summary
  from public.loyalty_notification_campaigns c
  left join lateral (
    select pa.status, pa.created_at, pa.sent, pa.failed, pa.skipped, pa.total, pa.error_summary
    from public.loyalty_notification_push_attempts pa
    where pa.campaign_id = c.id
    order by pa.created_at desc
    limit 1
  ) a on true
  where c.establishment_id = p_establishment_id
  order by c.created_at desc
  limit 100;
end;
$function$;

revoke all on function public.get_loyalty_notification_campaign_history(uuid) from public, anon;
grant execute on function public.get_loyalty_notification_campaign_history(uuid) to authenticated;
