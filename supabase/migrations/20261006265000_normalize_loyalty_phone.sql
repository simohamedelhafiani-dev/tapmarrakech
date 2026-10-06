-- Normalize loyalty customer phone numbers consistently and prevent
-- equivalent Moroccan/international representations from creating duplicates.

create or replace function public.normalize_loyalty_phone(p_phone text)
returns text
language plpgsql
immutable
set search_path = public, pg_temp
as $$
declare
  v text;
begin
  v := regexp_replace(btrim(coalesce(p_phone, '')), '[^0-9+]', '', 'g');
  if v = '' then
    return '';
  end if;

  if left(v, 2) = '00' then
    v := '+' || substr(v, 3);
  elsif left(v, 1) <> '+' then
    if left(v, 1) = '0' and length(v) = 10 then
      v := '+212' || substr(v, 2);
    elsif left(v, 3) = '212' then
      v := '+' || v;
    else
      v := '+' || v;
    end if;
  end if;

  return v;
end;
$$;

create unique index if not exists loyalty_customers_unique_normalized_phone
on public.loyalty_customers (establishment_id, public.normalize_loyalty_phone(phone))
where phone is not null and btrim(phone) <> '';

create or replace function public.register_public_loyalty_customer_v2(
  p_establishment_id uuid, p_first_name text, p_last_name text, p_phone text,
  p_birth_date date default null, p_email text default null, p_interests text[] default '{}',
  p_marketing_consent boolean default false, p_notification_consent boolean default false,
  p_preferred_channel text default 'WHATSAPP', p_visit_frequency text default null
)
returns public.loyalty_customers
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_customer public.loyalty_customers;
  v_existing_id uuid;
  v_phone text := public.normalize_loyalty_phone(p_phone);
  v_channel text := upper(coalesce(nullif(trim(p_preferred_channel), ''), 'WHATSAPP'));
  v_frequency text := upper(nullif(trim(p_visit_frequency), ''));
  v_email text := nullif(trim(p_email), '');
  v_interests text[];
begin
  if p_establishment_id is null then raise exception 'Établissement invalide'; end if;
  if btrim(coalesce(p_first_name,''))='' then raise exception 'Le prénom est obligatoire'; end if;
  if btrim(coalesce(p_last_name,''))='' then raise exception 'Le nom est obligatoire'; end if;
  if v_phone='' then raise exception 'Le téléphone est obligatoire'; end if;
  if v_channel not in ('WHATSAPP','SMS','EMAIL','PUSH','NONE') then raise exception 'Canal de notification invalide'; end if;
  if v_frequency is not null and v_frequency not in ('WEEKLY','MONTHLY','OCCASIONAL') then raise exception 'Fréquence de visite invalide'; end if;
  if v_email is not null and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Adresse email invalide'; end if;

  v_interests := coalesce(array(
    select distinct trim(value)
    from unnest(coalesce(p_interests,'{}')) as value
    where trim(value) <> ''
    limit 12
  ), '{}');

  select c.id into v_existing_id
  from public.loyalty_customers c
  where c.establishment_id=p_establishment_id
    and public.normalize_loyalty_phone(c.phone)=v_phone
  limit 1;

  if v_existing_id is not null then raise exception 'already_registered'; end if;

  begin
    insert into public.loyalty_customers(
      establishment_id,phone,first_name,last_name,birth_date,email,interests,
      marketing_consent,notification_consent,preferred_channel,visit_frequency,
      points_balance,total_points_earned,total_points_redeemed,visit_count)
    values(
      p_establishment_id,v_phone,btrim(p_first_name),btrim(p_last_name),p_birth_date,
      v_email,v_interests,coalesce(p_marketing_consent,false),coalesce(p_notification_consent,false),
      v_channel,v_frequency,0,0,0,0)
    returning * into v_customer;
  exception when unique_violation then
    raise exception 'already_registered';
  end;

  return v_customer;
end;
$$;

create or replace function public.register_public_loyalty_customer_with_referral(
  p_referral_code text, p_first_name text, p_last_name text, p_phone text, p_birth_date date default null
)
returns table(customer_id uuid, access_token uuid, referral_id uuid, referral_status text, referrer_points integer, referee_points integer)
language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_referrer public.loyalty_customers%rowtype;
  v_customer public.loyalty_customers%rowtype;
  v_link public.loyalty_customer_links%rowtype;
  v_config jsonb;
  v_max_referrals integer;
  v_completed_referrals integer;
  v_referral_id uuid;
  v_phone text := public.normalize_loyalty_phone(p_phone);
begin
  if nullif(trim(p_referral_code), '') is null then raise exception 'Code de parrainage obligatoire'; end if;
  if btrim(coalesce(p_first_name, '')) = '' then raise exception 'Le prénom est obligatoire'; end if;
  if btrim(coalesce(p_last_name, '')) = '' then raise exception 'Le nom est obligatoire'; end if;
  if v_phone = '' then raise exception 'Le téléphone est obligatoire'; end if;

  select * into v_referrer
  from public.loyalty_customers c
  where upper(c.referral_code) = upper(trim(p_referral_code))
  limit 1 for update;
  if not found then raise exception 'Code de parrainage invalide'; end if;

  select s.referral_config into v_config
  from public.loyalty_settings s
  where s.establishment_id = v_referrer.establishment_id
  limit 1 for update;
  if not coalesce((v_config ->> 'enabled')::boolean, false) then raise exception 'Le parrainage n''est pas activé'; end if;

  v_max_referrals := case when v_config ? 'max_referrals' and v_config ->> 'max_referrals' is not null then (v_config ->> 'max_referrals')::integer else null end;

  select count(*)::integer into v_completed_referrals
  from public.loyalty_referrals r
  where r.establishment_id = v_referrer.establishment_id and r.referrer_id = v_referrer.id and r.status = 'completed';
  if v_max_referrals is not null and v_completed_referrals >= v_max_referrals then raise exception 'referral_limit_reached'; end if;

  if exists (
    select 1 from public.loyalty_customers c
    where c.establishment_id = v_referrer.establishment_id
      and public.normalize_loyalty_phone(c.phone) = v_phone
  ) then
    raise exception 'already_registered';
  end if;

  insert into public.loyalty_customers(
    establishment_id,phone,first_name,last_name,birth_date,
    points_balance,total_points_earned,total_points_redeemed,visit_count)
  values(
    v_referrer.establishment_id,v_phone,btrim(p_first_name),btrim(p_last_name),p_birth_date,
    0,0,0,0)
  returning * into v_customer;

  select * into v_link from public.loyalty_customer_links l where l.customer_id=v_customer.id limit 1;
  if v_link.access_token is null then raise exception 'Impossible de créer votre carte fidélité'; end if;

  perform public.ensure_loyalty_referral_code(v_customer.id);

  insert into public.loyalty_referrals(establishment_id,referrer_id,referee_id,status,reward_given_at)
  values(v_customer.establishment_id,v_referrer.id,v_customer.id,'pending',null)
  returning id into v_referral_id;

  return query select v_customer.id,v_link.access_token,v_referral_id,'pending'::text,0,0;
end;
$$;
