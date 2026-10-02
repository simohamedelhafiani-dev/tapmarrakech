-- Referral engine v2: modular rewards, per-referrer limits and instant referral loop.

alter table public.loyalty_settings
  alter column referral_draft_config set default '{"enabled":false,"referrer_bonus_type":"POINTS","referrer_bonus_value":50,"referee_bonus_type":"POINTS","referee_bonus_value":0,"max_referrals":null,"referrer_bonus_points":50,"referee_bonus_points":0}'::jsonb,
  alter column referral_config set default '{"enabled":false,"referrer_bonus_type":"POINTS","referrer_bonus_value":50,"referee_bonus_type":"POINTS","referee_bonus_value":0,"max_referrals":null,"referrer_bonus_points":50,"referee_bonus_points":0}'::jsonb;

update public.loyalty_settings
set
  referral_draft_config = jsonb_build_object(
    'enabled', coalesce((referral_draft_config ->> 'enabled')::boolean, false),
    'referrer_bonus_type', coalesce(nullif(referral_draft_config ->> 'referrer_bonus_type', ''), 'POINTS'),
    'referrer_bonus_value', greatest(coalesce((referral_draft_config ->> 'referrer_bonus_value')::numeric, (referral_draft_config ->> 'referrer_bonus_points')::numeric, 50), 0),
    'referee_bonus_type', coalesce(nullif(referral_draft_config ->> 'referee_bonus_type', ''), 'POINTS'),
    'referee_bonus_value', greatest(coalesce((referral_draft_config ->> 'referee_bonus_value')::numeric, (referral_draft_config ->> 'referee_bonus_points')::numeric, 0), 0),
    'max_referrals', case when referral_draft_config ? 'max_referrals' and referral_draft_config ->> 'max_referrals' is not null then (referral_draft_config ->> 'max_referrals')::integer else null end,
    'referrer_bonus_points', greatest(coalesce((referral_draft_config ->> 'referrer_bonus_points')::integer, 0), 0),
    'referee_bonus_points', greatest(coalesce((referral_draft_config ->> 'referee_bonus_points')::integer, 0), 0)
  ),
  referral_config = jsonb_build_object(
    'enabled', coalesce((referral_config ->> 'enabled')::boolean, false),
    'referrer_bonus_type', coalesce(nullif(referral_config ->> 'referrer_bonus_type', ''), 'POINTS'),
    'referrer_bonus_value', greatest(coalesce((referral_config ->> 'referrer_bonus_value')::numeric, (referral_config ->> 'referrer_bonus_points')::numeric, 50), 0),
    'referee_bonus_type', coalesce(nullif(referral_config ->> 'referee_bonus_type', ''), 'POINTS'),
    'referee_bonus_value', greatest(coalesce((referral_config ->> 'referee_bonus_value')::numeric, (referral_config ->> 'referee_bonus_points')::numeric, 0), 0),
    'max_referrals', case when referral_config ? 'max_referrals' and referral_config ->> 'max_referrals' is not null then (referral_config ->> 'max_referrals')::integer else null end,
    'referrer_bonus_points', greatest(coalesce((referral_config ->> 'referrer_bonus_points')::integer, 0), 0),
    'referee_bonus_points', greatest(coalesce((referral_config ->> 'referee_bonus_points')::integer, 0), 0)
  );

create or replace function public.ensure_loyalty_referral_code(p_customer_id uuid)
returns text
language plpgsql
security definer
set search_path = 'public','extensions'
as $$
declare
  v_existing text;
  v_code text;
  v_attempt integer;
begin
  select c.referral_code into v_existing
  from public.loyalty_customers c
  where c.id = p_customer_id
  for update;

  if v_existing is not null then return v_existing; end if;

  for v_attempt in 1..20 loop
    v_code := upper(substr(replace(extensions.gen_random_uuid()::text, '-', ''), 1, 8));
    begin
      update public.loyalty_customers
      set referral_code = v_code, updated_at = now()
      where id = p_customer_id and referral_code is null
      returning referral_code into v_existing;
      if v_existing is not null then return v_existing; end if;
    exception when unique_violation then
      null;
    end;
  end loop;

  raise exception 'Impossible de générer le code de parrainage';
end;
$$;

revoke all on function public.ensure_loyalty_referral_code(uuid) from public, anon, authenticated;

create or replace function public.apply_loyalty_referral_reward(
  p_customer_id uuid,
  p_establishment_id uuid,
  p_bonus_type text,
  p_bonus_value numeric,
  p_description text
)
returns integer
language plpgsql
security definer
set search_path = 'public','extensions'
as $$
declare
  v_value numeric := greatest(coalesce(p_bonus_value, 0), 0);
  v_points integer := 0;
  v_discount_days integer;
begin
  if p_bonus_type = 'POINTS' then
    if v_value <= 0 or v_value <> trunc(v_value) or v_value > 1000000 then
      raise exception 'Bonus points invalide';
    end if;
    v_points := v_value::integer;
    update public.loyalty_customers
    set points_balance = coalesce(points_balance, 0) + v_points,
        total_points_earned = coalesce(total_points_earned, 0) + v_points,
        updated_at = now()
    where id = p_customer_id and establishment_id = p_establishment_id;
    insert into public.loyalty_transactions (establishment_id, customer_id, employee_id, points, amount, description, type)
    values (p_establishment_id, p_customer_id, null, v_points, null, p_description, 'EARN');

  elsif p_bonus_type = 'STAMP' then
    if v_value <= 0 or v_value <> trunc(v_value) or v_value > 1000000 then
      raise exception 'Bonus stamps invalide';
    end if;
    update public.loyalty_customers
    set stamps_balance = coalesce(stamps_balance, 0) + v_value::integer,
        stamps_total = coalesce(stamps_total, 0) + v_value::integer,
        updated_at = now()
    where id = p_customer_id and establishment_id = p_establishment_id;
    insert into public.loyalty_transactions (establishment_id, customer_id, employee_id, points, amount, description, type)
    values (p_establishment_id, p_customer_id, null, 0, null, p_description, 'EARN');

  elsif p_bonus_type = 'REDUCTION' then
    if v_value <= 0 or v_value > 100 then
      raise exception 'La réduction doit être comprise entre 1 et 100 %%';
    end if;

    select greatest(coalesce(s.discount_valid_days, 7), 1)
    into v_discount_days
    from public.loyalty_settings s
    where s.establishment_id = p_establishment_id
    limit 1;

    insert into public.loyalty_discount_cards (
      establishment_id, customer_id, discount_percent, valid_from, expires_at, status, qr_token
    )
    values (
      p_establishment_id, p_customer_id, v_value, now(),
      now() + make_interval(days => coalesce(v_discount_days, 7)),
      'ACTIVE', extensions.gen_random_uuid()
    );

    insert into public.loyalty_transactions (establishment_id, customer_id, employee_id, points, amount, description, type)
    values (p_establishment_id, p_customer_id, null, 0, null, p_description, 'EARN');

  else
    raise exception 'Type de bonus de parrainage invalide';
  end if;

  return v_points;
end;
$$;

revoke all on function public.apply_loyalty_referral_reward(uuid,uuid,text,numeric,text) from public, anon, authenticated;

create or replace function public.save_loyalty_referral_draft(p_establishment_id uuid, p_config jsonb)
returns void
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_enabled boolean;
  v_referrer_type text;
  v_referee_type text;
  v_referrer_value numeric;
  v_referee_value numeric;
  v_max_referrals integer;
begin
  if not public.user_has_establishment_access(p_establishment_id) then raise exception 'Accès refusé'; end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then raise exception 'Configuration de parrainage invalide'; end if;

  v_enabled := coalesce((p_config ->> 'enabled')::boolean, false);
  v_referrer_type := upper(coalesce(nullif(p_config ->> 'referrer_bonus_type', ''), 'POINTS'));
  v_referee_type := upper(coalesce(nullif(p_config ->> 'referee_bonus_type', ''), 'POINTS'));
  v_referrer_value := greatest(coalesce((p_config ->> 'referrer_bonus_value')::numeric, (p_config ->> 'referrer_bonus_points')::numeric, 0), 0);
  v_referee_value := greatest(coalesce((p_config ->> 'referee_bonus_value')::numeric, (p_config ->> 'referee_bonus_points')::numeric, 0), 0);

  if v_referrer_type not in ('POINTS','STAMP','REDUCTION') or v_referee_type not in ('POINTS','STAMP','REDUCTION') then
    raise exception 'Type de bonus de parrainage invalide';
  end if;

  if v_referrer_value > 1000000 or v_referee_value > 1000000 then raise exception 'Valeur de bonus trop élevée'; end if;
  if v_enabled and v_referrer_value <= 0 then raise exception 'Le bonus du parrain doit être supérieur à 0'; end if;
  if v_referee_value < 0 then raise exception 'Le bonus du filleul est invalide'; end if;
  if v_referrer_type in ('POINTS','STAMP') and v_referrer_value <> trunc(v_referrer_value) then raise exception 'La valeur du bonus du parrain doit être un entier'; end if;
  if v_referee_type in ('POINTS','STAMP') and v_referee_value <> trunc(v_referee_value) then raise exception 'La valeur du bonus du filleul doit être un entier'; end if;
  if v_referrer_type = 'REDUCTION' and (v_referrer_value <= 0 or v_referrer_value > 100) then raise exception 'La réduction du parrain doit être comprise entre 1 et 100 %%'; end if;
  if v_referee_type = 'REDUCTION' and (v_referee_value < 0 or v_referee_value > 100) then raise exception 'La réduction du filleul doit être comprise entre 0 et 100 %%'; end if;

  if p_config ? 'max_referrals' and p_config ->> 'max_referrals' is not null then
    v_max_referrals := (p_config ->> 'max_referrals')::integer;
    if v_max_referrals < 0 or v_max_referrals > 1000000 then raise exception 'La limite de parrainages est invalide'; end if;
  else
    v_max_referrals := null;
  end if;

  insert into public.loyalty_settings (establishment_id, referral_draft_config)
  values (
    p_establishment_id,
    jsonb_build_object(
      'enabled', v_enabled,
      'referrer_bonus_type', v_referrer_type,
      'referrer_bonus_value', v_referrer_value,
      'referee_bonus_type', v_referee_type,
      'referee_bonus_value', v_referee_value,
      'max_referrals', v_max_referrals,
      'referrer_bonus_points', case when v_referrer_type = 'POINTS' then v_referrer_value::integer else 0 end,
      'referee_bonus_points', case when v_referee_type = 'POINTS' then v_referee_value::integer else 0 end
    )
  )
  on conflict (establishment_id)
  do update set referral_draft_config = excluded.referral_draft_config, updated_at = now();
end;
$$;

create or replace function public.publish_loyalty_referral_settings(p_establishment_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = 'public'
as $$
declare v_config jsonb;
begin
  if not public.user_has_establishment_access(p_establishment_id) then raise exception 'Accès refusé'; end if;
  select s.referral_draft_config into v_config
  from public.loyalty_settings s where s.establishment_id = p_establishment_id for update;

  if v_config is null then
    v_config := '{"enabled":false,"referrer_bonus_type":"POINTS","referrer_bonus_value":50,"referee_bonus_type":"POINTS","referee_bonus_value":0,"max_referrals":null,"referrer_bonus_points":50,"referee_bonus_points":0}'::jsonb;
  end if;

  update public.loyalty_settings set referral_config = v_config, updated_at = now()
  where establishment_id = p_establishment_id;
  return v_config;
end;
$$;

create or replace function public.process_loyalty_referral(p_code text, p_new_customer_id uuid)
returns table(referral_id uuid, status text, referrer_points integer, referee_points integer)
language plpgsql
security definer
set search_path = 'public','extensions'
as $$
declare
  v_referrer public.loyalty_customers%rowtype;
  v_referee public.loyalty_customers%rowtype;
  v_existing public.loyalty_referrals%rowtype;
  v_config jsonb;
  v_referrer_type text;
  v_referee_type text;
  v_referrer_value numeric;
  v_referee_value numeric;
  v_max_referrals integer;
  v_completed_referrals integer;
  v_referral_id uuid;
  v_referrer_points integer := 0;
  v_referee_points integer := 0;
begin
  if auth.uid() is null then raise exception 'Utilisateur non authentifié'; end if;
  if nullif(trim(p_code), '') is null then raise exception 'Code de parrainage obligatoire'; end if;

  select * into v_referee from public.loyalty_customers c where c.id = p_new_customer_id for update;
  if not found then raise exception 'Nouveau client introuvable'; end if;

  select * into v_referrer
  from public.loyalty_customers c
  where upper(c.referral_code) = upper(trim(p_code))
  limit 1
  for update;
  if not found then raise exception 'Code de parrainage invalide'; end if;

  if v_referrer.id = v_referee.id then raise exception 'Un client ne peut pas se parrainer lui-même'; end if;
  if v_referrer.establishment_id <> v_referee.establishment_id then raise exception 'Le code de parrainage appartient à un autre établissement'; end if;

  select s.referral_config into v_config
  from public.loyalty_settings s
  where s.establishment_id = v_referee.establishment_id
  limit 1
  for update;

  if not coalesce((v_config ->> 'enabled')::boolean, false) then raise exception 'Le parrainage n''est pas activé'; end if;

  v_referrer_type := upper(coalesce(nullif(v_config ->> 'referrer_bonus_type', ''), 'POINTS'));
  v_referee_type := upper(coalesce(nullif(v_config ->> 'referee_bonus_type', ''), 'POINTS'));
  v_referrer_value := greatest(coalesce((v_config ->> 'referrer_bonus_value')::numeric, (v_config ->> 'referrer_bonus_points')::numeric, 0), 0);
  v_referee_value := greatest(coalesce((v_config ->> 'referee_bonus_value')::numeric, (v_config ->> 'referee_bonus_points')::numeric, 0), 0);
  v_max_referrals := case when v_config ? 'max_referrals' and v_config ->> 'max_referrals' is not null then (v_config ->> 'max_referrals')::integer else null end;

  select count(*)::integer into v_completed_referrals
  from public.loyalty_referrals r
  where r.establishment_id = v_referrer.establishment_id and r.referrer_id = v_referrer.id and r.status = 'completed';

  if v_max_referrals is not null and v_completed_referrals >= v_max_referrals then raise exception 'referral_limit_reached'; end if;

  select * into v_existing
  from public.loyalty_referrals r
  where r.establishment_id = v_referee.establishment_id and r.referee_id = v_referee.id
  for update;

  if found then
    if v_existing.status = 'completed' then raise exception 'Ce client a déjà utilisé un parrainage'; end if;
    return query select v_existing.id, v_existing.status, 0, 0;
    return;
  end if;

  insert into public.loyalty_referrals (establishment_id, referrer_id, referee_id, status, reward_given_at)
  values (v_referee.establishment_id, v_referrer.id, v_referee.id, 'pending', null)
  returning id into v_referral_id;

  v_referrer_points := public.apply_loyalty_referral_reward(v_referrer.id, v_referee.establishment_id, v_referrer_type, v_referrer_value, 'Bonus parrainage');

  if v_referee_value > 0 then
    v_referee_points := public.apply_loyalty_referral_reward(v_referee.id, v_referee.establishment_id, v_referee_type, v_referee_value, 'Bonus de bienvenue — parrainage');
  end if;

  update public.loyalty_referrals
  set status = 'completed', reward_given_at = now(), updated_at = now()
  where id = v_referral_id;

  return query select v_referral_id, 'completed'::text, v_referrer_points, v_referee_points;
end;
$$;

create or replace function public.register_public_loyalty_customer_with_referral(
  p_referral_code text, p_first_name text, p_last_name text, p_phone text, p_birth_date date default null
)
returns table(customer_id uuid, access_token uuid, referral_id uuid, referral_status text, referrer_points integer, referee_points integer)
language plpgsql
security definer
set search_path = 'public','extensions'
as $$
declare
  v_referrer public.loyalty_customers%rowtype;
  v_customer public.loyalty_customers%rowtype;
  v_link public.loyalty_customer_links%rowtype;
  v_config jsonb;
  v_referrer_type text;
  v_referee_type text;
  v_referrer_value numeric;
  v_referee_value numeric;
  v_max_referrals integer;
  v_completed_referrals integer;
  v_referral_id uuid;
  v_referrer_points integer := 0;
  v_referee_points integer := 0;
begin
  if nullif(trim(p_referral_code), '') is null then raise exception 'Code de parrainage obligatoire'; end if;
  if btrim(coalesce(p_first_name, '')) = '' then raise exception 'Le prénom est obligatoire'; end if;
  if btrim(coalesce(p_last_name, '')) = '' then raise exception 'Le nom est obligatoire'; end if;
  if btrim(coalesce(p_phone, '')) = '' then raise exception 'Le téléphone est obligatoire'; end if;

  select * into v_referrer
  from public.loyalty_customers c
  where upper(c.referral_code) = upper(trim(p_referral_code))
  limit 1
  for update;
  if not found then raise exception 'Code de parrainage invalide'; end if;

  select s.referral_config into v_config
  from public.loyalty_settings s
  where s.establishment_id = v_referrer.establishment_id
  limit 1
  for update;
  if not coalesce((v_config ->> 'enabled')::boolean, false) then raise exception 'Le parrainage n''est pas activé'; end if;

  v_referrer_type := upper(coalesce(nullif(v_config ->> 'referrer_bonus_type', ''), 'POINTS'));
  v_referee_type := upper(coalesce(nullif(v_config ->> 'referee_bonus_type', ''), 'POINTS'));
  v_referrer_value := greatest(coalesce((v_config ->> 'referrer_bonus_value')::numeric, (v_config ->> 'referrer_bonus_points')::numeric, 0), 0);
  v_referee_value := greatest(coalesce((v_config ->> 'referee_bonus_value')::numeric, (v_config ->> 'referee_bonus_points')::numeric, 0), 0);
  v_max_referrals := case when v_config ? 'max_referrals' and v_config ->> 'max_referrals' is not null then (v_config ->> 'max_referrals')::integer else null end;

  select count(*)::integer into v_completed_referrals
  from public.loyalty_referrals r
  where r.establishment_id = v_referrer.establishment_id and r.referrer_id = v_referrer.id and r.status = 'completed';
  if v_max_referrals is not null and v_completed_referrals >= v_max_referrals then raise exception 'referral_limit_reached'; end if;

  select c.id into v_customer.id
  from public.loyalty_customers c
  where c.establishment_id = v_referrer.establishment_id and btrim(c.phone) = btrim(p_phone)
  limit 1;
  if v_customer.id is not null then raise exception 'already_registered'; end if;

  insert into public.loyalty_customers (
    establishment_id, phone, first_name, last_name, birth_date,
    points_balance, total_points_earned, total_points_redeemed, visit_count
  )
  values (
    v_referrer.establishment_id, btrim(p_phone), btrim(p_first_name), btrim(p_last_name), p_birth_date,
    0, 0, 0, 0
  )
  returning * into v_customer;

  select * into v_link from public.loyalty_customer_links l where l.customer_id = v_customer.id limit 1;
  if v_link.access_token is null then raise exception 'Impossible de créer votre carte fidélité'; end if;

  perform public.ensure_loyalty_referral_code(v_customer.id);

  insert into public.loyalty_referrals (establishment_id, referrer_id, referee_id, status, reward_given_at)
  values (v_customer.establishment_id, v_referrer.id, v_customer.id, 'pending', null)
  returning id into v_referral_id;

  v_referrer_points := public.apply_loyalty_referral_reward(v_referrer.id, v_customer.establishment_id, v_referrer_type, v_referrer_value, 'Bonus parrainage');

  if v_referee_value > 0 then
    v_referee_points := public.apply_loyalty_referral_reward(v_customer.id, v_customer.establishment_id, v_referee_type, v_referee_value, 'Bonus de bienvenue — parrainage');
  end if;

  update public.loyalty_referrals
  set status = 'completed', reward_given_at = now(), updated_at = now()
  where id = v_referral_id;

  return query select v_customer.id, v_link.access_token, v_referral_id, 'completed'::text, v_referrer_points, v_referee_points;
end;
$$;

create or replace function public.register_public_loyalty_customer_for_enrollment(
  p_establishment_id uuid, p_first_name text, p_last_name text, p_phone text, p_birth_date date default null
)
returns table(establishment_name text, access_token uuid)
language plpgsql
security definer
set search_path = 'public','extensions'
as $$
declare
  v_customer public.loyalty_customers%rowtype;
  v_access_token uuid;
  v_establishment_name text;
  v_enabled boolean;
begin
  if p_establishment_id is null then raise exception 'Établissement invalide'; end if;

  select e.name, coalesce(s.enabled, false) into v_establishment_name, v_enabled
  from public.establishments e
  left join public.loyalty_settings s on s.establishment_id = e.id
  where e.id = p_establishment_id
  limit 1;

  if v_establishment_name is null then raise exception 'Établissement invalide'; end if;
  if not v_enabled then raise exception 'loyalty_program_disabled'; end if;

  v_customer := public.register_public_loyalty_customer(p_establishment_id, p_first_name, p_last_name, p_phone, p_birth_date);
  perform public.ensure_loyalty_referral_code(v_customer.id);

  select l.access_token into v_access_token
  from public.loyalty_customer_links l
  where l.customer_id = v_customer.id
  limit 1;

  if v_access_token is null then raise exception 'Impossible de créer votre carte fidélité'; end if;
  return query select v_establishment_name, v_access_token;
end;
$$;

create or replace function public.get_loyalty_referral_stats(p_establishment_id uuid)
returns table(acquired_count bigint)
language sql
stable
security definer
set search_path = 'public'
as $$
  select count(*)::bigint
  from public.loyalty_referrals r
  where r.establishment_id = p_establishment_id
    and r.status = 'completed'
    and public.user_has_establishment_access(p_establishment_id);
$$;

revoke all on function public.get_loyalty_referral_stats(uuid) from public;
grant execute on function public.get_loyalty_referral_stats(uuid) to authenticated;
grant execute on function public.process_loyalty_referral(text, uuid) to authenticated;
grant execute on function public.register_public_loyalty_customer_with_referral(text, text, text, text, date) to anon, authenticated;
grant execute on function public.register_public_loyalty_customer_for_enrollment(uuid, text, text, text, date) to anon, authenticated;
