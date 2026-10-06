-- Birthday privacy hardening: store only day/month for loyalty customers.
alter table public.loyalty_customers add column if not exists birth_day smallint, add column if not exists birth_month smallint;
update public.loyalty_customers set birth_day=extract(day from birth_date)::smallint,birth_month=extract(month from birth_date)::smallint where birth_date is not null and (birth_day is null or birth_month is null);
alter table public.loyalty_customers drop constraint if exists loyalty_customers_birth_day_check;
alter table public.loyalty_customers add constraint loyalty_customers_birth_day_check check (birth_day is null or birth_day between 1 and 31);
alter table public.loyalty_customers drop constraint if exists loyalty_customers_birth_month_check;
alter table public.loyalty_customers add constraint loyalty_customers_birth_month_check check (birth_month is null or birth_month between 1 and 12);

create or replace function public.normalize_loyalty_customer_birthday()
returns trigger language plpgsql as $$
begin
  if new.birth_date is not null then
    new.birth_day:=extract(day from new.birth_date)::smallint;
    new.birth_month:=extract(month from new.birth_date)::smallint;
    new.birth_date:=null;
  end if;
  if new.birth_day is not null and new.birth_month is not null and new.birth_day>29 and new.birth_month=2 then
    raise exception 'Jour de naissance invalide';
  end if;
  return new;
end;
$$;
drop trigger if exists trg_normalize_loyalty_customer_birthday on public.loyalty_customers;
create trigger trg_normalize_loyalty_customer_birthday before insert or update on public.loyalty_customers for each row execute function public.normalize_loyalty_customer_birthday();
update public.loyalty_customers set birth_date=null where birth_date is not null;

create or replace function public.create_birthday_reward(p_establishment_id uuid,p_customer_id uuid,p_reward_name text default null,p_description text default null,p_reward_points integer default null,p_reward_amount numeric default null)
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare c public.loyalty_customers%rowtype; s public.loyalty_settings%rowtype; y integer; birthday date; rid uuid; rname text; rdescription text; rpoints integer; ramount numeric;
begin
  if not public.user_has_establishment_access(p_establishment_id) then raise exception 'Accès refusé à cet établissement'; end if;
  select * into c from public.loyalty_customers where id=p_customer_id and establishment_id=p_establishment_id;
  if not found then raise exception 'Client introuvable'; end if;
  if c.birth_day is null or c.birth_month is null then raise exception 'La date de naissance du client est inconnue'; end if;
  select * into s from public.loyalty_settings where establishment_id=p_establishment_id limit 1;
  if not found then raise exception 'Paramètres fidélité introuvables'; end if;
  if not s.birthday_reward_enabled then raise exception 'La récompense anniversaire est désactivée'; end if;
  y:=extract(year from current_date)::integer;
  begin birthday:=make_date(y,c.birth_month,c.birth_day); exception when others then if c.birth_month=2 and c.birth_day=29 then birthday:=make_date(y,2,28); else raise; end if; end;
  rname:=coalesce(nullif(trim(p_reward_name),''),nullif(trim(s.birthday_reward_name),''),'Récompense anniversaire');
  rdescription:=coalesce(p_description,s.birthday_reward_description);
  rpoints:=coalesce(p_reward_points,s.birthday_reward_points,0);
  ramount:=coalesce(p_reward_amount,s.birthday_reward_amount,0);
  insert into public.loyalty_birthday_rewards(establishment_id,customer_id,birthday_year,birthday_date,reward_name,description,reward_points,reward_amount,valid_from,valid_until,status)
  values(p_establishment_id,p_customer_id,y,birthday,rname,rdescription,rpoints,ramount,birthday,birthday,'AVAILABLE')
  on conflict(establishment_id,customer_id,birthday_year) do nothing returning id into rid;
  if rid is null then select id into rid from public.loyalty_birthday_rewards where establishment_id=p_establishment_id and customer_id=p_customer_id and birthday_year=y; end if;
  return rid;
end;
$$;
