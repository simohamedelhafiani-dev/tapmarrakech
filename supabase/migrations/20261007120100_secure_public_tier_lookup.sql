-- Security for public customer-level lookup and authenticated management
create or replace function public.get_public_loyalty_customer_tier(p_access_token uuid)
returns table(tier_key text,tier_name text,sort_order integer,total_points integer,rewards_redeemed integer,ticket_multiplier integer,next_tier_key text,next_tier_name text,next_points integer,next_rewards integer)
language sql stable security definer set search_path=public as $$
select t.tier_key,t.tier_name,t.sort_order,t.total_points,t.rewards_redeemed,t.ticket_multiplier,t.next_tier_key,t.next_tier_name,t.next_points,t.next_rewards
from public.loyalty_customer_links l
cross join lateral public.get_loyalty_customer_tier(l.customer_id) t
where l.access_token=p_access_token limit 1;
$$;
revoke all on function public.get_public_loyalty_customer_tier(uuid) from public;
grant execute on function public.get_public_loyalty_customer_tier(uuid) to anon,authenticated;
revoke all on function public.get_loyalty_customer_tier(uuid) from public;
grant execute on function public.get_loyalty_customer_tier(uuid) to authenticated;\nrevoke execute on function public.get_loyalty_customer_tier(uuid) from anon;\nrevoke execute on function public.update_loyalty_tier(uuid,text,integer,integer,text,integer,boolean) from anon;\n