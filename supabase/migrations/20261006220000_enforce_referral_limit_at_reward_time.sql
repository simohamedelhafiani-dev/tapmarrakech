-- Enforce referral caps when the reward is actually granted, not only at signup.
create or replace function public.complete_pending_loyalty_referral(p_customer_id uuid)
returns table(referral_id uuid, referrer_points integer, referee_points integer)
language plpgsql security definer
set search_path = public, extensions
as $function$
declare
  v_referral public.loyalty_referrals%rowtype;
  v_referrer public.loyalty_customers%rowtype;
  v_config jsonb;
  v_max_referrals integer;
  v_completed_referrals integer;
  v_referrer_type text;
  v_referee_type text;
  v_referrer_value numeric;
  v_referee_value numeric;
  v_referrer_points integer := 0;
  v_referee_points integer := 0;
begin
  select * into v_referral from public.loyalty_referrals r
  where r.referee_id=p_customer_id and r.status='pending'
  order by r.created_at asc limit 1 for update;
  if not found then return; end if;

  select * into v_referrer from public.loyalty_customers c
  where c.id=v_referral.referrer_id and c.establishment_id=v_referral.establishment_id
  for update;
  if not found then
    update public.loyalty_referrals set status='cancelled',updated_at=now() where id=v_referral.id;
    return;
  end if;

  select s.referral_config into v_config from public.loyalty_settings s
  where s.establishment_id=v_referral.establishment_id for update;
  if not coalesce((v_config ->> 'enabled')::boolean,false) then return; end if;

  v_max_referrals := case when v_config ? 'max_referrals' and v_config ->> 'max_referrals' is not null
    then (v_config ->> 'max_referrals')::integer else null end;

  select count(*)::integer into v_completed_referrals from public.loyalty_referrals r
  where r.establishment_id=v_referral.establishment_id
    and r.referrer_id=v_referral.referrer_id and r.status='completed';

  if v_max_referrals is not null and v_completed_referrals >= v_max_referrals then
    update public.loyalty_referrals set status='cancelled',updated_at=now() where id=v_referral.id;
    return;
  end if;

  v_referrer_type:=upper(coalesce(nullif(v_config ->> 'referrer_bonus_type',''),'POINTS'));
  v_referee_type:=upper(coalesce(nullif(v_config ->> 'referee_bonus_type',''),'POINTS'));
  v_referrer_value:=greatest(coalesce((v_config ->> 'referrer_bonus_value')::numeric,(v_config ->> 'referrer_bonus_points')::numeric,0),0);
  v_referee_value:=greatest(coalesce((v_config ->> 'referee_bonus_value')::numeric,(v_config ->> 'referee_bonus_points')::numeric,0),0);

  if v_referrer_value>0 then
    v_referrer_points:=public.apply_loyalty_referral_reward(v_referral.referrer_id,v_referral.establishment_id,v_referrer_type,v_referrer_value,'Bonus parrainage');
  end if;
  if v_referee_value>0 then
    v_referee_points:=public.apply_loyalty_referral_reward(v_referral.referee_id,v_referral.establishment_id,v_referee_type,v_referee_value,'Bonus de bienvenue — parrainage');
  end if;

  update public.loyalty_referrals set status='completed',reward_given_at=now(),updated_at=now() where id=v_referral.id;
  return query select v_referral.id,v_referrer_points,v_referee_points;
end;
$function$;