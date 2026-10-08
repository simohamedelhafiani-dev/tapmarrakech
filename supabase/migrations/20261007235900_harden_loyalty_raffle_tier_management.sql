-- KELYANI pre-commercial hardening for loyalty tiers and raffles.
-- Keeps the raffle selection system server-side and limits management RPCs to authenticated users.

create or replace function public.ensure_default_loyalty_tiers(p_establishment_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  if not (public.is_tapmarrakech_admin() or public.is_establishment_responsible(p_establishment_id)) then
    raise exception 'not_authorized';
  end if;

  insert into public.loyalty_tiers(
    establishment_id, tier_key, name, sort_order,
    min_total_points, min_rewards_redeemed, qualification_mode, ticket_multiplier
  )
  values
    (p_establishment_id, 'STANDARD', 'Standard', 0, 0, 0, 'OR', 1),
    (p_establishment_id, 'BRONZE', 'Bronze', 1, 250, 1, 'OR', 2),
    (p_establishment_id, 'SILVER', 'Silver', 2, 750, 3, 'OR', 3),
    (p_establishment_id, 'GOLD', 'Gold', 3, 1500, 5, 'OR', 5),
    (p_establishment_id, 'PLATINUM', 'Platinum', 4, 3000, 8, 'OR', 10)
  on conflict (establishment_id, tier_key) do nothing;
end;
$function$;

revoke execute on function public.ensure_default_loyalty_tiers(uuid) from public, anon;
grant execute on function public.ensure_default_loyalty_tiers(uuid) to authenticated;

revoke execute on function public.create_loyalty_raffle(uuid,text,text,text,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,integer,boolean,boolean,boolean) from public, anon;
revoke execute on function public.create_loyalty_raffle(uuid,text,text,text,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,integer,boolean,boolean,boolean,text,text) from public, anon;
grant execute on function public.create_loyalty_raffle(uuid,text,text,text,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,integer,boolean,boolean,boolean) to authenticated;
grant execute on function public.create_loyalty_raffle(uuid,text,text,text,text,timestamptz,timestamptz,integer,text,timestamptz,timestamptz,integer,boolean,boolean,boolean,text,text) to authenticated;

revoke execute on function public.get_loyalty_raffles(uuid) from public, anon;
grant execute on function public.get_loyalty_raffles(uuid) to authenticated;

revoke execute on function public.get_loyalty_tiers(uuid) from public, anon;
grant execute on function public.get_loyalty_tiers(uuid) to authenticated;

revoke execute on function public.update_loyalty_tier(uuid,text,integer,integer,text,integer,boolean) from public, anon;
grant execute on function public.update_loyalty_tier(uuid,text,integer,integer,text,integer,boolean) to authenticated;

revoke execute on function public.cancel_loyalty_raffle(uuid) from public, anon;
grant execute on function public.cancel_loyalty_raffle(uuid) to authenticated;

revoke execute on function public.process_due_loyalty_raffles() from public, anon, authenticated;
