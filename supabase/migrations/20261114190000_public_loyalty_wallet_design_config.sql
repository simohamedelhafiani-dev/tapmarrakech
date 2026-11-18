-- Expose only the Wallet-specific design for a valid public loyalty-card token.
-- This keeps the wallet presentation independent from the KELYANI card design.
create or replace function public.get_public_loyalty_wallet_config(p_access_token uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $function$
  select coalesce(d.design_config -> 'wallet_design', '{}'::jsonb)
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  left join public.loyalty_card_designs d on d.establishment_id = c.establishment_id
  where l.access_token = p_access_token
  limit 1;
$function$;

revoke all on function public.get_public_loyalty_wallet_config(uuid) from public;
grant execute on function public.get_public_loyalty_wallet_config(uuid) to anon, authenticated;
