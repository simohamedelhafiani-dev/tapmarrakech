-- Correct birthday targeting: only customers whose day AND month match today.
-- This replaces the earlier month-only filter so a birthday campaign cannot target
-- every opted-in customer born in the current month.
create or replace function public.create_loyalty_notification_campaign(
  p_establishment_id uuid,
  p_title text,
  p_message text,
  p_type text default 'OFFER',
  p_segment text default 'all',
  p_expires_at timestamptz default null
)
returns table(campaign_id uuid, recipient_count integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_campaign_id uuid;
  v_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'Authentification requise';
  end if;

  if not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'Accès à cet établissement refusé';
  end if;

  if length(trim(coalesce(p_title, ''))) not between 1 and 120 then
    raise exception 'Le titre doit contenir entre 1 et 120 caractères';
  end if;
  if length(trim(coalesce(p_message, ''))) not between 1 and 1000 then
    raise exception 'Le message doit contenir entre 1 et 1000 caractères';
  end if;
  if p_type is null or p_type not in ('INFO','OFFER','REWARD','POINTS') then
    raise exception 'Type de notification invalide';
  end if;
  if p_segment is null or p_segment not in ('all','active','at_risk','inactive','birthdays','loyal') then
    raise exception 'Segment invalide';
  end if;

  insert into public.loyalty_notification_campaigns
    (establishment_id,title,message,type,audience,expires_at,recipient_count,status,created_by)
  values
    (p_establishment_id,trim(p_title),trim(p_message),p_type,
     jsonb_build_object('segment',p_segment),p_expires_at,0,'PUBLISHED',auth.uid())
  returning id into v_campaign_id;

  insert into public.loyalty_card_notifications
    (establishment_id,customer_id,title,message,type,expires_at,created_by,campaign_id)
  select p_establishment_id,c.id,trim(p_title),trim(p_message),p_type,p_expires_at,auth.uid(),v_campaign_id
  from public.loyalty_customers c
  where c.establishment_id = p_establishment_id
    and c.notification_consent = true
    and (p_type <> 'OFFER' or c.marketing_consent = true)
    and (
      p_segment = 'all'
      or (p_segment = 'active' and c.last_visit_at >= now() - interval '30 days')
      or (p_segment = 'at_risk' and c.last_visit_at < now() - interval '30 days' and c.last_visit_at >= now() - interval '60 days')
      or (p_segment = 'inactive' and (c.last_visit_at is null or c.last_visit_at < now() - interval '60 days'))
      or (
        p_segment = 'birthdays'
        and c.birth_day = extract(day from (now() at time zone 'Africa/Casablanca'))::integer
        and c.birth_month = extract(month from (now() at time zone 'Africa/Casablanca'))::integer
      )
      or (p_segment = 'loyal' and (c.visit_count >= 5 or c.points_balance >= 500))
    );

  get diagnostics v_count = row_count;

  update public.loyalty_notification_campaigns
    set recipient_count = v_count
    where id = v_campaign_id;

  return query select v_campaign_id, v_count;
end;
$$;

revoke all on function public.create_loyalty_notification_campaign(uuid,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.create_loyalty_notification_campaign(uuid,text,text,text,text,timestamptz) to authenticated;
