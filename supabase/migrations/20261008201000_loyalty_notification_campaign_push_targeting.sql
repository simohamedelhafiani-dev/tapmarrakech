alter table public.loyalty_card_notifications
  add column if not exists campaign_id uuid references public.loyalty_notification_campaigns(id) on delete set null;

create index if not exists loyalty_card_notifications_campaign_id_idx
  on public.loyalty_card_notifications(campaign_id);

-- Campaign notifications keep the campaign id so the push worker can send
-- exactly the recipients selected by the campaign, without trusting the client.
create or replace function public.create_loyalty_notification_campaign(
  p_establishment_id uuid,
  p_title text,
  p_message text,
  p_type text default 'INFO',
  p_expires_at timestamptz default null,
  p_audience jsonb default '{}'::jsonb
)
returns table(campaign_id uuid, recipient_count integer)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_campaign_id uuid;
  v_count integer;
  v_interests text[];
  v_frequency text;
  v_min_points integer;
  v_min_visits integer;
  v_last_visit_days integer;
  v_customer_ids uuid[];
begin
  if not public.user_has_establishment_access(p_establishment_id) then raise exception 'not_authorized'; end if;
  if p_type not in ('INFO','OFFER','REWARD','POINTS') then raise exception 'invalid_notification_type'; end if;
  if p_audience is null then p_audience := '{}'::jsonb; end if;
  if jsonb_typeof(p_audience) <> 'object' then raise exception 'invalid_audience'; end if;

  if p_audience ? 'interests' then
    select coalesce(array_agg(value), '{}'::text[]) into v_interests
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_audience->'interests') = 'array' then p_audience->'interests' else '[]'::jsonb end
    ) as x(value);
  end if;

  v_frequency := nullif(trim(p_audience->>'visit_frequency'), '');
  v_min_points := greatest(0, coalesce(nullif(p_audience->>'min_points','')::integer, 0));
  v_min_visits := greatest(0, coalesce(nullif(p_audience->>'min_visits','')::integer, 0));
  v_last_visit_days := greatest(0, coalesce(nullif(p_audience->>'last_visit_days','')::integer, 0));

  if v_frequency is not null and v_frequency not in ('WEEKLY','MONTHLY','OCCASIONAL') then raise exception 'invalid_visit_frequency'; end if;

  if p_audience ? 'customer_ids' and jsonb_typeof(p_audience->'customer_ids') = 'array' then
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_customer_ids
    from jsonb_array_elements_text(p_audience->'customer_ids') as x(value);
  end if;

  insert into public.loyalty_notification_campaigns(
    establishment_id, title, message, type, audience, expires_at, created_by
  )
  values(p_establishment_id, trim(p_title), trim(p_message), p_type, p_audience, p_expires_at, auth.uid())
  returning id into v_campaign_id;

  insert into public.loyalty_card_notifications(
    establishment_id, customer_id, title, message, type, expires_at, created_by, campaign_id
  )
  select lc.establishment_id, lc.id, trim(p_title), trim(p_message), p_type, p_expires_at, auth.uid(), v_campaign_id
  from public.loyalty_customers lc
  where lc.establishment_id = p_establishment_id
    and coalesce(lc.notification_consent, false) = true
    and (v_customer_ids is null or cardinality(v_customer_ids) = 0 or lc.id = any(v_customer_ids))
    and (v_interests is null or cardinality(v_interests) = 0 or coalesce(lc.interests, '{}'::text[]) && v_interests)
    and (v_frequency is null or lc.visit_frequency = v_frequency)
    and coalesce(lc.points_balance, 0) >= v_min_points
    and coalesce(lc.visit_count, 0) >= v_min_visits
    and (v_last_visit_days = 0 or (lc.last_visit_at is not null and lc.last_visit_at >= now() - make_interval(days => v_last_visit_days)));

  get diagnostics v_count = row_count;
  update public.loyalty_notification_campaigns set recipient_count = v_count where id = v_campaign_id;

  return query select v_campaign_id, v_count;
end;
$function$;