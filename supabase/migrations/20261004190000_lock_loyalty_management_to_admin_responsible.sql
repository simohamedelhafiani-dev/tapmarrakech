-- Commercial audit: loyalty program administration belongs to admin/responsible only.
-- Employees keep operational scanner/reward actions but cannot alter program configuration.

create or replace function public.save_loyalty_program_settings(
  p_establishment_id uuid,
  p_program_type text,
  p_stamp_goal integer default 10,
  p_stamp_reward_name text default null,
  p_stamp_reward_description text default null,
  p_discount_percent numeric default null,
  p_discount_valid_days integer default 7,
  p_points_per_currency numeric default 1,
  p_currency text default 'MAD',
  p_enabled boolean default true,
  p_discount_points_threshold integer default 1000
)
returns void
language plpgsql
security definer
set search_path = ''
as $
begin
  if auth.uid() is null
     or not (public.is_tapmarrakech_admin() or public.is_establishment_responsible(p_establishment_id)) then
    raise exception 'Accès refusé';
  end if;

  if p_program_type not in ('STAMP','POINTS_REWARD','POINTS_DISCOUNT') then
    raise exception 'Type de programme invalide';
  end if;

  if p_stamp_goal < 1 or p_stamp_goal > 10 then
    raise exception 'Le nombre de tampons doit être compris entre 1 et 10';
  end if;

  if p_program_type = 'POINTS_DISCOUNT'
     and (p_discount_percent is null or p_discount_percent <= 0 or p_discount_percent > 100) then
    raise exception 'La réduction doit être comprise entre 1 et 100%%';
  end if;

  if p_program_type = 'POINTS_DISCOUNT'
     and (p_discount_points_threshold is null or p_discount_points_threshold < 1) then
    raise exception 'Le seuil de points doit être supérieur à 0';
  end if;

  insert into public.loyalty_settings(
    establishment_id,program_type,stamp_goal,stamp_reward_name,stamp_reward_description,
    discount_percent,discount_valid_days,discount_points_threshold,points_per_currency,currency,enabled
  )
  values(
    p_establishment_id,p_program_type,least(greatest(p_stamp_goal,1),10),
    nullif(trim(p_stamp_reward_name),''),nullif(trim(p_stamp_reward_description),''),
    case when p_program_type='POINTS_DISCOUNT' then p_discount_percent else null end,
    least(greatest(coalesce(p_discount_valid_days,7),1),365),
    greatest(coalesce(p_discount_points_threshold,1000),1),
    greatest(p_points_per_currency,0.01),coalesce(nullif(trim(p_currency),''),'MAD'),p_enabled
  )
  on conflict (establishment_id) do update set
    program_type=excluded.program_type,
    stamp_goal=excluded.stamp_goal,
    stamp_reward_name=excluded.stamp_reward_name,
    stamp_reward_description=excluded.stamp_reward_description,
    discount_percent=excluded.discount_percent,
    discount_valid_days=excluded.discount_valid_days,
    discount_points_threshold=excluded.discount_points_threshold,
    points_per_currency=excluded.points_per_currency,
    currency=excluded.currency,
    enabled=excluded.enabled,
    updated_at=now();
end;
$$;

create or replace function public.create_loyalty_reward(
  p_establishment_id uuid,
  p_name text,
  p_description text,
  p_points_required integer,
  p_reward_type text,
  p_discount_percent numeric default null,
  p_discount_max_amount numeric default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if auth.uid() is null
     or not (
       public.is_tapmarrakech_admin()
       or public.is_establishment_responsible(p_establishment_id)
     ) then
    raise exception 'Not authorized';
  end if;

  if nullif(trim(p_name), '') is null or p_points_required <= 0 then
    raise exception 'Récompense invalide';
  end if;

  if p_reward_type not in ('GIFT','DISCOUNT') then
    raise exception 'Type de récompense invalide';
  end if;

  if p_reward_type = 'DISCOUNT'
     and (p_discount_percent is null or p_discount_percent <= 0 or p_discount_percent > 20) then
    raise exception 'La réduction doit être comprise entre 0 et 20%%';
  end if;

  insert into public.loyalty_rewards(
    establishment_id,name,description,points_required,active,reward_type,discount_percent,discount_max_amount
  )
  values(
    p_establishment_id,trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_points_required,true,
    p_reward_type,
    case when p_reward_type='DISCOUNT' then p_discount_percent else null end,
    case when p_reward_type='DISCOUNT' then nullif(p_discount_max_amount,0) else null end
  )
  returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.update_loyalty_reward(
  p_reward_id uuid,
  p_name text,
  p_description text,
  p_points_required integer,
  p_reward_type text,
  p_discount_percent numeric,
  p_discount_max_amount numeric,
  p_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_est uuid;
begin
  select establishment_id into v_est from public.loyalty_rewards where id=p_reward_id;

  if v_est is null or auth.uid() is null
     or not (public.is_tapmarrakech_admin() or public.is_establishment_responsible(v_est)) then
    raise exception 'Not authorized';
  end if;

  if nullif(trim(p_name),'') is null or p_points_required <= 0 then
    raise exception 'Récompense invalide';
  end if;

  if p_reward_type not in ('GIFT','DISCOUNT') then
    raise exception 'Type de récompense invalide';
  end if;

  if p_reward_type='DISCOUNT'
     and (p_discount_percent is null or p_discount_percent <= 0 or p_discount_percent > 20) then
    raise exception 'La réduction doit être comprise entre 0 et 20%%';
  end if;

  update public.loyalty_rewards
  set name=trim(p_name),
      description=nullif(trim(coalesce(p_description,'')),''),
      points_required=p_points_required,
      reward_type=p_reward_type,
      discount_percent=case when p_reward_type='DISCOUNT' then p_discount_percent else null end,
      discount_max_amount=case when p_reward_type='DISCOUNT' then nullif(p_discount_max_amount,0) else null end,
      active=p_active,
      updated_at=now()
  where id=p_reward_id;
end;
$$;

create or replace function public.delete_loyalty_reward(p_reward_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_est uuid;
begin
  select establishment_id into v_est from public.loyalty_rewards where id=p_reward_id;

  if v_est is null or auth.uid() is null
     or not (public.is_tapmarrakech_admin() or public.is_establishment_responsible(v_est)) then
    raise exception 'Not authorized';
  end if;

  update public.loyalty_rewards
  set active=false,updated_at=now()
  where id=p_reward_id;
end;
$$;

create or replace function public.update_loyalty_reward_schedule(
  p_reward_id uuid,
  p_valid_days text[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_est uuid;
  v_days text[];
begin
  select establishment_id into v_est from public.loyalty_rewards where id=p_reward_id;

  if v_est is null or auth.uid() is null
     or not (public.is_tapmarrakech_admin() or public.is_establishment_responsible(v_est)) then
    raise exception 'Not authorized';
  end if;

  v_days := array(
    select distinct upper(trim(x))
    from unnest(coalesce(p_valid_days,array[]::text[])) as x
    where upper(trim(x)) in ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY')
  );

  if cardinality(v_days)=0 then
    raise exception 'Sélectionne au moins un jour';
  end if;

  update public.loyalty_rewards
  set valid_days=v_days,updated_at=now()
  where id=p_reward_id;
end;
$$;
