-- Prevent duplicate Web Push sends for the same loyalty campaign.
-- This provides at-most-once campaign claiming; it intentionally does not auto-retry partial sends,
-- because retrying a partially delivered campaign could notify the same customer twice.
alter table public.loyalty_notification_campaigns
  add column if not exists push_delivery_status text,
  add column if not exists push_delivery_started_at timestamptz,
  add column if not exists push_delivery_finished_at timestamptz,
  add column if not exists push_delivery_sent integer not null default 0,
  add column if not exists push_delivery_failed integer not null default 0,
  add column if not exists push_delivery_removed integer not null default 0;

alter table public.loyalty_notification_campaigns
  drop constraint if exists loyalty_notification_campaigns_push_delivery_status_check;
alter table public.loyalty_notification_campaigns
  add constraint loyalty_notification_campaigns_push_delivery_status_check
  check (push_delivery_status is null or push_delivery_status in ('PROCESSING','COMPLETED','PARTIAL','FAILED'));

create or replace function public.claim_loyalty_campaign_push_delivery(p_campaign_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_establishment_id uuid;
  v_campaign_status text;
  v_claimed integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  select c.establishment_id, c.status
    into v_establishment_id, v_campaign_status
  from public.loyalty_notification_campaigns c
  where c.id = p_campaign_id;
  if v_establishment_id is null then
    raise exception 'Campagne introuvable';
  end if;
  if v_campaign_status <> 'PUBLISHED' then
    raise exception 'Campagne non publiable ou annulée';
  end if;
  if not public.user_has_establishment_access(v_establishment_id) then
    raise exception 'Accès à cet établissement refusé';
  end if;

  update public.loyalty_notification_campaigns
  set push_delivery_status = 'PROCESSING', push_delivery_started_at = now(),
      push_delivery_finished_at = null, push_delivery_sent = 0,
      push_delivery_failed = 0, push_delivery_removed = 0
  where id = p_campaign_id and push_delivery_status is null;
  get diagnostics v_claimed = row_count;
  return v_claimed = 1;
end;
$$;

revoke all on function public.claim_loyalty_campaign_push_delivery(uuid) from public, anon;
grant execute on function public.claim_loyalty_campaign_push_delivery(uuid) to authenticated;
