-- Referral anti-abuse hardening.
-- Referrals stay pending until the referred customer performs a real scanner loyalty action.

create or replace function public.complete_pending_loyalty_referral(p_customer_id uuid)
returns table(referral_id uuid, referrer_points integer, referee_points integer)
language plpgsql security definer
set search_path to 'public','extensions'
as $$
declare
  r public.loyalty_referrals%rowtype;
  cfg jsonb;
  rt text; et text; rv numeric; ev numeric;
  rp integer := 0; ep integer := 0;
begin
  select * into r from public.loyalty_referrals
  where referee_id=p_customer_id and status='pending'
  order by created_at asc limit 1 for update;
  if not found then return; end if;

  select referral_config into cfg from public.loyalty_settings
  where establishment_id=r.establishment_id limit 1;
  if not coalesce((cfg->>'enabled')::boolean,false) then return; end if;

  rt:=upper(coalesce(nullif(cfg->>'referrer_bonus_type',''),'POINTS'));
  et:=upper(coalesce(nullif(cfg->>'referee_bonus_type',''),'POINTS'));
  rv:=greatest(coalesce((cfg->>'referrer_bonus_value')::numeric,(cfg->>'referrer_bonus_points')::numeric,0),0);
  ev:=greatest(coalesce((cfg->>'referee_bonus_value')::numeric,(cfg->>'referee_bonus_points')::numeric,0),0);

  if rv>0 then rp:=public.apply_loyalty_referral_reward(r.referrer_id,r.establishment_id,rt,rv,'Bonus parrainage'); end if;
  if ev>0 then ep:=public.apply_loyalty_referral_reward(r.referee_id,r.establishment_id,et,ev,'Bonus de bienvenue — parrainage'); end if;

  update public.loyalty_referrals set status='completed',reward_given_at=now(),updated_at=now() where id=r.id;
  return query select r.id,rp,ep;
end;
$$;

create or replace function public.register_public_loyalty_customer_with_referral(
  p_referral_code text,p_first_name text,p_last_name text,p_phone text,p_birth_date date default null)
returns table(customer_id uuid,access_token uuid,referral_id uuid,referral_status text,referrer_points integer,referee_points integer)
language plpgsql security definer
set search_path to 'public','extensions'
as $$
declare
  ref public.loyalty_customers%rowtype;
  c public.loyalty_customers%rowtype;
  l public.loyalty_customer_links%rowtype;
  cfg jsonb; max_ref integer; done_ref integer; rid uuid;
begin
  if nullif(trim(p_referral_code),'') is null then raise exception 'Code de parrainage obligatoire'; end if;
  if btrim(coalesce(p_first_name,''))='' then raise exception 'Le prénom est obligatoire'; end if;
  if btrim(coalesce(p_last_name,''))='' then raise exception 'Le nom est obligatoire'; end if;
  if btrim(coalesce(p_phone,''))='' then raise exception 'Le téléphone est obligatoire'; end if;

  select * into ref from public.loyalty_customers
  where upper(referral_code)=upper(trim(p_referral_code)) limit 1 for update;
  if not found then raise exception 'Code de parrainage invalide'; end if;

  select referral_config into cfg from public.loyalty_settings
  where establishment_id=ref.establishment_id limit 1 for update;
  if not coalesce((cfg->>'enabled')::boolean,false) then raise exception 'Le parrainage n''est pas activé'; end if;

  max_ref:=case when cfg ? 'max_referrals' and cfg->>'max_referrals' is not null then (cfg->>'max_referrals')::integer else null end;
  select count(*)::integer into done_ref from public.loyalty_referrals
  where establishment_id=ref.establishment_id and referrer_id=ref.id and status='completed';
  if max_ref is not null and done_ref>=max_ref then raise exception 'referral_limit_reached'; end if;

  if exists(select 1 from public.loyalty_customers where establishment_id=ref.establishment_id and btrim(phone)=btrim(p_phone)) then
    raise exception 'already_registered';
  end if;

  insert into public.loyalty_customers(establishment_id,phone,first_name,last_name,birth_date,points_balance,total_points_earned,total_points_redeemed,visit_count)
  values(ref.establishment_id,btrim(p_phone),btrim(p_first_name),btrim(p_last_name),p_birth_date,0,0,0,0)
  returning * into c;

  select * into l from public.loyalty_customer_links where customer_id=c.id limit 1;
  if l.access_token is null then raise exception 'Impossible de créer votre carte fidélité'; end if;

  perform public.ensure_loyalty_referral_code(c.id);

  insert into public.loyalty_referrals(establishment_id,referrer_id,referee_id,status,reward_given_at)
  values(c.establishment_id,ref.id,c.id,'pending',null) returning id into rid;

  return query select c.id,l.access_token,rid,'pending'::text,0,0;
end;
$$;

create or replace function public.process_loyalty_referral(p_code text,p_new_customer_id uuid)
returns table(referral_id uuid,status text,referrer_points integer,referee_points integer)
language plpgsql security definer
set search_path to 'public','extensions'
as $$
declare ref public.loyalty_customers%rowtype; c public.loyalty_customers%rowtype;
cfg jsonb; max_ref integer; done_ref integer; existing public.loyalty_referrals%rowtype; rid uuid;
begin
  if auth.uid() is null then raise exception 'Utilisateur non authentifié'; end if;
  select * into c from public.loyalty_customers where id=p_new_customer_id for update;
  if not found then raise exception 'Nouveau client introuvable'; end if;
  select * into ref from public.loyalty_customers where upper(referral_code)=upper(trim(p_code)) limit 1 for update;
  if not found then raise exception 'Code de parrainage invalide'; end if;
  if ref.id=c.id then raise exception 'Un client ne peut pas se parrainer lui-même'; end if;
  if ref.establishment_id<>c.establishment_id then raise exception 'Le code de parrainage appartient à un autre établissement'; end if;
  select referral_config into cfg from public.loyalty_settings where establishment_id=c.establishment_id limit 1 for update;
  if not coalesce((cfg->>'enabled')::boolean,false) then raise exception 'Le parrainage n''est pas activé'; end if;
  max_ref:=case when cfg ? 'max_referrals' and cfg->>'max_referrals' is not null then (cfg->>'max_referrals')::integer else null end;
  select count(*)::integer into done_ref from public.loyalty_referrals where establishment_id=ref.establishment_id and referrer_id=ref.id and status='completed';
  if max_ref is not null and done_ref>=max_ref then raise exception 'referral_limit_reached'; end if;
  select * into existing from public.loyalty_referrals where establishment_id=c.establishment_id and referee_id=c.id for update;
  if found then return query select existing.id,existing.status,0,0; return; end if;
  insert into public.loyalty_referrals(establishment_id,referrer_id,referee_id,status,reward_given_at)
  values(c.establishment_id,ref.id,c.id,'pending',null) returning id into rid;
  return query select rid,'pending'::text,0,0;
end;
$$;

revoke execute on function public.complete_pending_loyalty_referral(uuid) from public,anon,authenticated;
