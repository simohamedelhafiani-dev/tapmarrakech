-- Public, token-scoped view of the currently running raffle for a loyalty card.
-- Never exposes customer identities or internal raffle-entry rows.
create or replace function public.get_public_loyalty_raffles(p_access_token uuid)
returns table(
  id uuid,
  title text,
  description text,
  prize_name text,
  prize_description text,
  starts_at timestamptz,
  draw_at timestamptz,
  winners_count integer,
  participant_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    r.id,
    r.title,
    r.description,
    r.prize_name,
    r.prize_description,
    r.starts_at,
    r.draw_at,
    r.winners_count,
    (
      select count(*)
      from public.loyalty_customers c
      join lateral public.get_loyalty_customer_tier(c.id) t on true
      join public.loyalty_tiers eligible
        on eligible.establishment_id = r.establishment_id
       and eligible.tier_key = r.minimum_tier_key
       and eligible.active = true
      where c.establishment_id = r.establishment_id
        and c.created_at <= r.draw_at
        and t.sort_order >= eligible.sort_order
    ) as participant_count
  from public.loyalty_raffles r
  join public.loyalty_customer_links l
    on l.access_token = p_access_token
  join public.loyalty_customers current_customer
    on current_customer.id = l.customer_id
   and current_customer.establishment_id = r.establishment_id
  where r.status = 'SCHEDULED'
    and r.starts_at <= now()
    and r.draw_at > now()
  order by r.draw_at asc
  limit 3;
$$;

revoke all on function public.get_public_loyalty_raffles(uuid) from public;
grant execute on function public.get_public_loyalty_raffles(uuid) to anon, authenticated;
