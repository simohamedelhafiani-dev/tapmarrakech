-- Secure campaign history for the establishment dashboard. Direct table reads stay restricted by RLS.
create or replace function public.get_loyalty_notification_campaign_history(
  p_establishment_id uuid,
  p_limit integer default 30
)
returns table (
  id uuid,
  title text,
  message text,
  type text,
  audience jsonb,
  recipient_count integer,
  status text,
  created_at timestamptz,
  expires_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  if not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'Accès à cet établissement refusé';
  end if;

  return query
  select c.id, c.title, c.message, c.type, c.audience,
         c.recipient_count, c.status, c.created_at, c.expires_at
  from public.loyalty_notification_campaigns c
  where c.establishment_id = p_establishment_id
  order by c.created_at desc
  limit greatest(1, least(coalesce(p_limit, 30), 100));
end;
$$;

revoke all on function public.get_loyalty_notification_campaign_history(uuid, integer) from public, anon;
grant execute on function public.get_loyalty_notification_campaign_history(uuid, integer) to authenticated;
