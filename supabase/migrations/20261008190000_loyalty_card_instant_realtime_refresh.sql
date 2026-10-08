create or replace function public.broadcast_loyalty_card_refresh()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_new jsonb := to_jsonb(NEW);
  v_old jsonb := to_jsonb(OLD);
  v_establishment_id text;
  v_new_customer_id text;
  v_old_customer_id text;
begin
  v_establishment_id := coalesce(v_new ->> 'establishment_id', v_old ->> 'establishment_id');

  if v_establishment_id is not null then
    perform realtime.send(
      jsonb_build_object(
        'source', TG_TABLE_NAME,
        'operation', TG_OP,
        'scope', 'establishment',
        'at', extract(epoch from clock_timestamp())::bigint
      ),
      'loyalty-card-refresh',
      'loyalty-card-establishment:' || v_establishment_id,
      false
    );
  end if;

  if TG_TABLE_NAME = 'loyalty_customers' then
    v_new_customer_id := v_new ->> 'id';
    v_old_customer_id := v_old ->> 'id';
  else
    v_new_customer_id := v_new ->> 'customer_id';
    v_old_customer_id := v_old ->> 'customer_id';
  end if;

  if v_old_customer_id is not null then
    perform realtime.send(
      jsonb_build_object(
        'source', TG_TABLE_NAME,
        'operation', TG_OP,
        'scope', 'customer',
        'at', extract(epoch from clock_timestamp())::bigint
      ),
      'loyalty-card-refresh',
      'loyalty-card-customer:' || v_old_customer_id,
      false
    );
  end if;

  if v_new_customer_id is not null and v_new_customer_id is distinct from v_old_customer_id then
    perform realtime.send(
      jsonb_build_object(
        'source', TG_TABLE_NAME,
        'operation', TG_OP,
        'scope', 'customer',
        'at', extract(epoch from clock_timestamp())::bigint
      ),
      'loyalty-card-refresh',
      'loyalty-card-customer:' || v_new_customer_id,
      false
    );
  end if;

  return coalesce(NEW, OLD);
end;
$function$;

revoke execute on function public.broadcast_loyalty_card_refresh() from public, anon, authenticated;

drop trigger if exists loyalty_card_designs_broadcast_refresh on public.loyalty_card_designs;
create trigger loyalty_card_designs_broadcast_refresh
after insert or update or delete on public.loyalty_card_designs
for each row execute function public.broadcast_loyalty_card_refresh();

drop trigger if exists loyalty_settings_broadcast_refresh on public.loyalty_settings;
create trigger loyalty_settings_broadcast_refresh
after insert or update or delete on public.loyalty_settings
for each row execute function public.broadcast_loyalty_card_refresh();

drop trigger if exists loyalty_rewards_broadcast_refresh on public.loyalty_rewards;
create trigger loyalty_rewards_broadcast_refresh
after insert or update or delete on public.loyalty_rewards
for each row execute function public.broadcast_loyalty_card_refresh();

drop trigger if exists loyalty_customers_broadcast_refresh on public.loyalty_customers;
create trigger loyalty_customers_broadcast_refresh
after insert or update or delete on public.loyalty_customers
for each row execute function public.broadcast_loyalty_card_refresh();

drop trigger if exists loyalty_transactions_broadcast_refresh on public.loyalty_transactions;
create trigger loyalty_transactions_broadcast_refresh
after insert or update or delete on public.loyalty_transactions
for each row execute function public.broadcast_loyalty_card_refresh();

drop trigger if exists loyalty_card_notifications_broadcast_refresh on public.loyalty_card_notifications;
create trigger loyalty_card_notifications_broadcast_refresh
after insert or update or delete on public.loyalty_card_notifications
for each row execute function public.broadcast_loyalty_card_refresh();