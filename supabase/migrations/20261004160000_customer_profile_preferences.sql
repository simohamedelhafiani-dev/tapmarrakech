-- Customer profile and notification preferences for loyalty enrollment.
alter table public.loyalty_customers
  add column if not exists email text,
  add column if not exists interests text[] not null default '{}',
  add column if not exists marketing_consent boolean not null default false,
  add column if not exists notification_consent boolean not null default false,
  add column if not exists preferred_channel text not null default 'WHATSAPP',
  add column if not exists visit_frequency text;

alter table public.loyalty_customers
  drop constraint if exists loyalty_customers_preferred_channel_check;

alter table public.loyalty_customers
  add constraint loyalty_customers_preferred_channel_check
  check (preferred_channel in ('WHATSAPP','SMS','EMAIL','PUSH','NONE'));

alter table public.loyalty_customers
  drop constraint if exists loyalty_customers_visit_frequency_check;

alter table public.loyalty_customers
  add constraint loyalty_customers_visit_frequency_check
  check (visit_frequency is null or visit_frequency in ('WEEKLY','MONTHLY','OCCASIONAL'));

create or replace function public.register_public_loyalty_customer_v2(
  p_establishment_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_birth_date date default null,
  p_email text default null,
  p_interests text[] default '{}',
  p_marketing_consent boolean default false,
  p_notification_consent boolean default false,
  p_preferred_channel text default 'WHATSAPP',
  p_visit_frequency text default null
)
returns public.loyalty_customers
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_customer public.loyalty_customers;
  v_existing_id uuid;
  v_channel text := upper(coalesce(nullif(trim(p_preferred_channel), ''), 'WHATSAPP'));
  v_frequency text := upper(nullif(trim(p_visit_frequency), ''));
  v_email text := nullif(trim(p_email), '');
  v_interests text[];
begin
  if p_establishment_id is null then raise exception 'Établissement invalide'; end if;
  if btrim(coalesce(p_first_name, '')) = '' then raise exception 'Le prénom est obligatoire'; end if;
  if btrim(coalesce(p_last_name, '')) = '' then raise exception 'Le nom est obligatoire'; end if;
  if btrim(coalesce(p_phone, '')) = '' then raise exception 'Le téléphone est obligatoire'; end if;

  if v_channel not in ('WHATSAPP','SMS','EMAIL','PUSH','NONE') then
    raise exception 'Canal de notification invalide';
  end if;

  if v_frequency is not null and v_frequency not in ('WEEKLY','MONTHLY','OCCASIONAL') then
    raise exception 'Fréquence de visite invalide';
  end if;

  if v_email is not null and v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'Adresse email invalide';
  end if;

  v_interests := coalesce(
    array(
      select distinct trim(value)
      from unnest(coalesce(p_interests, '{}')) as value
      where trim(value) <> ''
      limit 12
    ),
    '{}'
  );

  select c.id into v_existing_id
  from public.loyalty_customers c
  where c.establishment_id = p_establishment_id
    and btrim(c.phone) = btrim(p_phone)
  limit 1;

  if v_existing_id is not null then raise exception 'already_registered'; end if;

  insert into public.loyalty_customers (
    establishment_id, phone, first_name, last_name, birth_date, email, interests,
    marketing_consent, notification_consent, preferred_channel, visit_frequency,
    points_balance, total_points_earned, total_points_redeemed, visit_count
  )
  values (
    p_establishment_id, btrim(p_phone), btrim(p_first_name), btrim(p_last_name), p_birth_date,
    v_email, v_interests, coalesce(p_marketing_consent, false),
    coalesce(p_notification_consent, false), v_channel, v_frequency, 0, 0, 0, 0
  )
  returning * into v_customer;

  return v_customer;
end;
$function$;

create or replace function public.register_public_loyalty_customer_for_enrollment_v2(
  p_establishment_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_birth_date date default null,
  p_email text default null,
  p_interests text[] default '{}',
  p_marketing_consent boolean default false,
  p_notification_consent boolean default false,
  p_preferred_channel text default 'WHATSAPP',
  p_visit_frequency text default null
)
returns table(establishment_name text, access_token uuid)
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  v_customer public.loyalty_customers%rowtype;
  v_access_token uuid;
  v_establishment_name text;
  v_enabled boolean;
begin
  select e.name, coalesce(s.enabled, false) into v_establishment_name, v_enabled
  from public.establishments e
  left join public.loyalty_settings s on s.establishment_id = e.id
  where e.id = p_establishment_id
  limit 1;

  if v_establishment_name is null then raise exception 'Établissement invalide'; end if;
  if not v_enabled then raise exception 'loyalty_program_disabled'; end if;

  v_customer := public.register_public_loyalty_customer_v2(
    p_establishment_id, p_first_name, p_last_name, p_phone, p_birth_date,
    p_email, p_interests, p_marketing_consent, p_notification_consent,
    p_preferred_channel, p_visit_frequency
  );

  perform public.ensure_loyalty_referral_code(v_customer.id);

  select l.access_token into v_access_token
  from public.loyalty_customer_links l
  where l.customer_id = v_customer.id
  limit 1;

  if v_access_token is null then raise exception 'Impossible de créer votre carte fidélité'; end if;
  return query select v_establishment_name, v_access_token;
end;
$function$;

revoke execute on function public.register_public_loyalty_customer_v2(uuid,text,text,text,date,text,text[],boolean,boolean,text,text) from public, anon, authenticated;
grant execute on function public.register_public_loyalty_customer_v2(uuid,text,text,text,date,text,text[],boolean,boolean,text,text) to anon;

revoke execute on function public.register_public_loyalty_customer_for_enrollment_v2(uuid,text,text,text,date,text,text[],boolean,boolean,text,text) from public, anon, authenticated;
grant execute on function public.register_public_loyalty_customer_for_enrollment_v2(uuid,text,text,text,date,text,text[],boolean,boolean,text,text) to anon;
