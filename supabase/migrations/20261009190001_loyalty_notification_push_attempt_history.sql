-- Persist every Web Push attempt so campaign history can distinguish publication from transport results.
create table if not exists public.loyalty_notification_push_attempts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.loyalty_notification_campaigns(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  triggered_by uuid references auth.users(id) on delete set null,
  status text not null default 'SENDING'
    check (status in ('SENDING','ACCEPTED_BY_PUSH_SERVICE','PARTIAL','FAILED','NO_SUBSCRIBERS','NO_RECIPIENTS','NO_DELIVERIES')),
  sent integer not null default 0,
  failed integer not null default 0,
  removed integer not null default 0,
  skipped integer not null default 0,
  total integer not null default 0,
  push_subscribers integer not null default 0,
  error_summary text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists loyalty_notification_push_attempts_campaign_created_idx
  on public.loyalty_notification_push_attempts(campaign_id, created_at desc);

alter table public.loyalty_notification_push_attempts enable row level security;
revoke all on public.loyalty_notification_push_attempts from anon, authenticated;
grant all on public.loyalty_notification_push_attempts to service_role;

drop function if exists public.get_loyalty_notification_campaign_history(uuid);
create function public.get_loyalty_notification_campaign_history(p_establishment_id uuid)
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

revoke execute on function public.get_loyalty_notification_campaign_history(uuid) from public, anon;
grant execute on function public.get_loyalty_notification_campaign_history(uuid) to authenticated;
