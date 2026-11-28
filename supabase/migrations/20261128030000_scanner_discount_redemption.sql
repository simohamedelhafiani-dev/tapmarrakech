-- Scanner (team link /employee?scanner=…): show the customer's unlocked loyalty discount
-- and apply it to a purchase, like the employee space already does.

create or replace function public.get_scanner_customer_status(p_scanner_token uuid, p_customer_id uuid)
returns table(points_balance integer, stamps_balance integer, discount_percent numeric, discount_expires_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_est uuid;
begin
  select establishment_id into v_est from public.establishment_scanner_links where access_token = p_scanner_token limit 1;
  if v_est is null then raise exception 'Lien scanner invalide'; end if;
  return query
    select c.points_balance, coalesce(c.stamps_balance, 0),
      d.discount_percent, d.expires_at
    from public.loyalty_customers c
    left join lateral (
      select dc.discount_percent, dc.expires_at
      from public.loyalty_discount_cards dc
      where dc.customer_id = c.id and dc.establishment_id = v_est and dc.status = 'ACTIVE'
        and dc.valid_from <= now() and dc.expires_at > now()
      order by dc.created_at desc
      limit 1
    ) d on true
    where c.id = p_customer_id and c.establishment_id = v_est;
end;
$$;

create or replace function public.redeem_loyalty_discount_by_scanner(
  p_scanner_token uuid,
  p_customer_id uuid,
  p_invoice_amount numeric,
  p_invoice_number text default null
)
returns table(discount_percent numeric, discount_amount numeric, amount_paid numeric, expires_at timestamptz)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est uuid;
  v_discount public.loyalty_discount_cards%rowtype;
  v_discount_amount numeric;
  v_amount_paid numeric;
begin
  select establishment_id into v_est from public.establishment_scanner_links where access_token = p_scanner_token limit 1;
  if v_est is null then raise exception 'Lien scanner invalide'; end if;
  if p_invoice_amount is null or p_invoice_amount <= 0 or p_invoice_amount = 'NaN'::numeric then raise exception 'Montant de facture invalide'; end if;
  if p_invoice_amount > 1000000 then raise exception 'Montant de facture trop élevé'; end if;
  select d.* into v_discount from public.loyalty_discount_cards d
  where d.customer_id = p_customer_id and d.establishment_id = v_est and d.status = 'ACTIVE'
    and d.valid_from <= now() and d.expires_at > now()
  order by d.created_at desc limit 1 for update;
  if not found then raise exception 'Aucune réduction active pour ce client'; end if;
  v_discount_amount := round(p_invoice_amount * (v_discount.discount_percent / 100), 2);
  v_amount_paid := greatest(p_invoice_amount - v_discount_amount, 0);
  insert into public.loyalty_transactions(establishment_id, customer_id, employee_id, amount, points, type, description, invoice_number)
  values (v_est, p_customer_id, null, p_invoice_amount, 0, 'REDEEM',
    'Réduction fidélité ' || trim(to_char(v_discount.discount_percent, 'FM999990.##')) || '% — ' || trim(to_char(v_discount_amount, 'FM999999990.00')) || ' économisés (scanner)',
    nullif(trim(coalesce(p_invoice_number, '')), ''));
  return query select v_discount.discount_percent, v_discount_amount, v_amount_paid, v_discount.expires_at;
end;
$$;

revoke all on function public.get_scanner_customer_status(uuid, uuid) from public;
revoke all on function public.redeem_loyalty_discount_by_scanner(uuid, uuid, numeric, text) from public;
grant execute on function public.get_scanner_customer_status(uuid, uuid) to anon, authenticated;
grant execute on function public.redeem_loyalty_discount_by_scanner(uuid, uuid, numeric, text) to anon, authenticated;
