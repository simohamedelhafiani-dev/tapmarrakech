-- Smart features shown on the customer's KELYANI card: current promotions (with their
-- validity), Happy Hour during its time slot, birthday gift, VIP status and progress
-- encouragement. Read-only: it never sends anything, it only reflects the merchant's
-- Smart Marketing settings for the card holder identified by the access token.

create or replace function public.get_public_loyalty_smart_offers(p_access_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'pg_catalog', 'public', 'pg_temp'
as $$
declare
  v_customer public.loyalty_customers;
  v_now_local timestamp := (now() at time zone 'Africa/Casablanca');
  v_time text := to_char(v_now_local, 'HH24:MI');
  v_weekday int := extract(dow from v_now_local)::int;
  v_cfg jsonb;
  v_enabled boolean;
  v_result jsonb := '{}'::jsonb;
  v_schedule text;
  v_start text;
  v_end text;
  v_days int[];
  v_threshold numeric;
  v_goal int;
  v_stamps int;
begin
  select c.* into v_customer
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  where l.access_token = p_access_token
  limit 1;
  if v_customer.id is null then
    return null;
  end if;

  -- Promotions currently valid and not yet used by this customer.
  v_result := v_result || jsonb_build_object('promotions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'description', p.description, 'image_url', p.image_url,
      'normal_price', p.normal_price, 'promo_price', p.promo_price,
      'start_at', p.start_at, 'end_at', p.end_at) order by p.display_order, p.created_at)
    from public.promotions p
    where p.establishment_id = v_customer.establishment_id
      and p.active = true
      and (p.start_at is null or p.start_at <= now())
      and (p.end_at is null or p.end_at >= now())
      and not exists (
        select 1 from public.loyalty_promotion_claims c
        where c.customer_id = v_customer.id and c.promotion_id = p.id and c.status = 'REDEEMED')
  ), '[]'::jsonb));

  -- Happy Hour: shown with its slot; active_now only inside the slot (Casablanca time).
  select enabled, config into v_enabled, v_cfg from public.smart_marketing_configs
  where establishment_id = v_customer.establishment_id and smart_id = 'happyhour';
  if coalesce(v_enabled, false) then
    v_schedule := trim(coalesce(v_cfg->>'schedule', ''));
    if v_schedule ~ '^\d{2}:\d{2}\s*-\s*\d{2}:\d{2}$' then
      v_start := substring(v_schedule from '^(\d{2}:\d{2})');
      v_end := substring(v_schedule from '(\d{2}:\d{2})$');
      select coalesce(array_agg(x::int), '{}') into v_days
      from regexp_split_to_table(coalesce(v_cfg->>'days', ''), '\s*,\s*') x
      where x ~ '^[0-6]$';
      v_result := v_result || jsonb_build_object('happy_hour', jsonb_build_object(
        'start', v_start, 'end', v_end, 'days', to_jsonb(v_days),
        'offer', nullif(v_cfg->>'offer', 'Offre à définir'),
        'message', v_cfg->>'message',
        'active_now', v_time >= v_start and v_time < v_end and (cardinality(v_days) = 0 or v_weekday = any(v_days))));
    end if;
  end if;

  -- Birthday: during the customer's birthday month, highlighted on the day itself.
  select enabled, config into v_enabled, v_cfg from public.smart_marketing_configs
  where establishment_id = v_customer.establishment_id and smart_id = 'birthday';
  if coalesce(v_enabled, false) and v_customer.birth_month is not null
     and v_customer.birth_month = extract(month from v_now_local)::int then
    v_result := v_result || jsonb_build_object('birthday', jsonb_build_object(
      'is_today', v_customer.birth_day = extract(day from v_now_local)::int,
      'offer', nullif(v_cfg->>'offer', 'Cadeau à définir'),
      'message', v_cfg->>'message'));
  end if;

  -- VIP: reached once the visit threshold is met.
  select enabled, config into v_enabled, v_cfg from public.smart_marketing_configs
  where establishment_id = v_customer.establishment_id and smart_id = 'vip';
  if coalesce(v_enabled, false) then
    v_threshold := greatest(1, coalesce(nullif(substring(coalesce(v_cfg->>'thresholdVisits', v_cfg->>'threshold_visits', v_cfg->>'threshold', '10') from '(\d+)'), '')::numeric, 10));
    v_result := v_result || jsonb_build_object('vip', jsonb_build_object(
      'is_vip', coalesce(v_customer.visit_count, 0) >= v_threshold,
      'threshold', v_threshold,
      'visits', coalesce(v_customer.visit_count, 0),
      'benefit', nullif(v_cfg->>'benefit', 'Avantage VIP'),
      'message', v_cfg->>'message'));
  end if;

  -- Progress: encouragement once the stamp card passes the configured percentage.
  select enabled, config into v_enabled, v_cfg from public.smart_marketing_configs
  where establishment_id = v_customer.establishment_id and smart_id = 'progress';
  if coalesce(v_enabled, false) then
    select greatest(1, coalesce(s.stamp_goal, 10)) into v_goal
    from public.loyalty_settings s
    where s.establishment_id = v_customer.establishment_id and s.program_type = 'STAMP' and s.enabled = true
    limit 1;
    if v_goal is not null then
      v_stamps := coalesce(v_customer.stamps_balance, 0);
      v_threshold := least(100, greatest(1, coalesce(nullif(substring(coalesce(v_cfg->>'thresholdPercent', v_cfg->>'threshold_percent', v_cfg->>'threshold', '80') from '(\d+)'), '')::numeric, 80)));
      v_result := v_result || jsonb_build_object('progress', jsonb_build_object(
        'near', v_stamps >= ceil(v_goal * v_threshold / 100) and v_stamps < v_goal,
        'stamps', v_stamps, 'goal', v_goal, 'remaining', greatest(0, v_goal - v_stamps),
        'message', v_cfg->>'message'));
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.get_public_loyalty_smart_offers(uuid) from public;
grant execute on function public.get_public_loyalty_smart_offers(uuid) to anon, authenticated;
