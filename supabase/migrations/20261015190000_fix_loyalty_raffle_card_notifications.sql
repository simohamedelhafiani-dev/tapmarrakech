-- Keep upcoming scheduled raffles visible on public loyalty cards and announce them in-card.
create or replace function public.get_public_loyalty_raffles(p_access_token uuid)
returns table(id uuid,title text,description text,prize_name text,prize_description text,starts_at timestamptz,draw_at timestamptz,winners_count integer,participant_count bigint)
language sql stable security definer set search_path=public as $$
select r.id,r.title,r.description,r.prize_name,r.prize_description,r.starts_at,r.draw_at,r.winners_count,
 (select count(*) from public.loyalty_customers c
  join lateral public.get_loyalty_customer_tier(c.id) t on true
  join public.loyalty_tiers eligible on eligible.establishment_id=r.establishment_id and eligible.tier_key=r.minimum_tier_key and eligible.active=true
  where c.establishment_id=r.establishment_id and c.created_at<=r.draw_at and t.sort_order>=eligible.sort_order)
from public.loyalty_raffles r
join public.loyalty_customer_links l on l.access_token=p_access_token
join public.loyalty_customers current_customer on current_customer.id=l.customer_id and current_customer.establishment_id=r.establishment_id
where r.status='SCHEDULED' and r.draw_at>now()
order by r.starts_at asc,r.draw_at asc limit 3;
$$;
revoke all on function public.get_public_loyalty_raffles(uuid) from public;
grant execute on function public.get_public_loyalty_raffles(uuid) to anon, authenticated;

create or replace function public.create_loyalty_raffle(
 p_establishment_id uuid,p_title text,p_description text,p_prize_name text,p_prize_description text,
 p_starts_at timestamptz,p_draw_at timestamptz,p_winners_count integer,p_reward_validity_mode text,
 p_reward_valid_from timestamptz,p_reward_valid_until timestamptz,p_reward_valid_days integer,
 p_reservation_required boolean,p_single_use boolean,p_non_cumulative boolean,
 p_minimum_tier_key text default 'STANDARD',p_ticket_multiplier_mode text default 'TIER'
)
returns uuid language plpgsql security definer set search_path=public as $
declare v_id uuid; v_title text; v_prize text;
begin
 if not(public.is_tapmarrakech_admin() or public.is_establishment_responsible(p_establishment_id)) then raise exception 'not_authorized'; end if;
 perform public.ensure_default_loyalty_tiers(p_establishment_id);
 if not exists(select 1 from public.loyalty_tiers where establishment_id=p_establishment_id and tier_key=p_minimum_tier_key and active) then raise exception 'invalid_minimum_tier'; end if;
 if p_ticket_multiplier_mode not in ('TIER','NONE') then raise exception 'invalid_ticket_multiplier_mode'; end if;
 v_title:=trim(p_title); v_prize:=trim(p_prize_name);
 insert into public.loyalty_raffles(establishment_id,title,description,prize_name,prize_description,starts_at,draw_at,winners_count,reward_validity_mode,reward_valid_from,reward_valid_until,reward_valid_days,reservation_required,single_use,non_cumulative,status,created_by,minimum_tier_key,ticket_multiplier_mode)
 values(p_establishment_id,v_title,nullif(trim(coalesce(p_description,'')),''),v_prize,nullif(trim(coalesce(p_prize_description,'')),''),p_starts_at,p_draw_at,p_winners_count,p_reward_validity_mode,p_reward_valid_from,p_reward_valid_until,p_reward_valid_days,p_reservation_required,p_single_use,p_non_cumulative,'SCHEDULED',auth.uid(),p_minimum_tier_key,p_ticket_multiplier_mode)
 returning id into v_id;
 insert into public.loyalty_card_notifications(establishment_id,customer_id,title,message,type,expires_at,created_by)
 values(p_establishment_id,null,'🎟 Nouvelle tombola : '||v_title,
  'Participez à notre tombola fidélité ! À gagner : '||v_prize||
  '. Début : '||to_char(p_starts_at,'DD/MM/YYYY HH24:MI')||
  '. Tirage : '||to_char(p_draw_at,'DD/MM/YYYY HH24:MI')||'.',
  'OFFER',p_draw_at,auth.uid());
 return v_id;
end; $$;
revoke execute on function public.create_loyalty_raffle(uuid,text,text,text,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,integer,boolean,boolean,boolean,text,text) from public, anon;
grant execute on function public.create_loyalty_raffle(uuid,text,text,text,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,integer,boolean,boolean,boolean,text,text) to authenticated;
