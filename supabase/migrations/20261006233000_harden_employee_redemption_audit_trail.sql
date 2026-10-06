-- Preserve the existing redemption business rules while recording the employee
-- responsible for the redemption. This migration is intentionally narrow.
create or replace function public.redeem_loyalty_discount_by_employee(
  p_session_token text,
  p_customer_id uuid,
  p_invoice_amount numeric,
  p_invoice_number text default null,
  p_payment_method text default 'CASH'
)
returns table(discount_percent numeric, discount_amount numeric, amount_paid numeric, expires_at timestamptz)
language plpgsql security definer
set search_path = public
as $$
declare
  v_establishment uuid;
  v_employee_id uuid;
  v_discount public.loyalty_discount_cards%rowtype;
  v_discount_amount numeric;
  v_amount_paid numeric;
  v_payment_method text;
begin
  select es.establishment_id, es.employee_id into v_establishment, v_employee_id
  from public.employee_sessions es
  where es.token_hash = encode(digest(trim(p_session_token),'sha256'),'hex')
    and es.expires_at > now()
  limit 1;
  if v_establishment is null or v_employee_id is null then raise exception 'Session employé invalide ou expirée'; end if;
  if p_invoice_amount is null or p_invoice_amount <= 0 then raise exception 'Montant de facture invalide'; end if;
  v_payment_method := upper(trim(coalesce(p_payment_method, 'CASH')));
  if v_payment_method not in ('CASH','CARD','TRANSFER','OTHER') then raise exception 'Mode de paiement invalide'; end if;
  select d.* into v_discount from public.loyalty_discount_cards d
  where d.customer_id=p_customer_id and d.establishment_id=v_establishment and d.status='ACTIVE'
    and d.valid_from<=now() and d.expires_at>now()
  order by d.created_at desc limit 1 for update;
  if not found then raise exception 'Aucune réduction active pour ce client'; end if;
  v_discount_amount := round(p_invoice_amount * (v_discount.discount_percent / 100), 2);
  v_amount_paid := greatest(p_invoice_amount - v_discount_amount, 0);
  insert into public.loyalty_transactions(establishment_id,customer_id,employee_id,amount,points,type,description,invoice_number)
  values(v_establishment,p_customer_id,v_employee_id,p_invoice_amount,0,'REDEEM',
    'Réduction fidélité '||trim(to_char(v_discount.discount_percent,'FM999990.##'))||'% — '||trim(to_char(v_discount_amount,'FM999999990.00'))||' économisés',
    nullif(trim(coalesce(p_invoice_number,'')),''));
  return query select v_discount.discount_percent,v_discount_amount,v_amount_paid,v_discount.expires_at;
end;
$$;

create or replace function public.redeem_loyalty_stamp_reward_by_employee(
  p_session_token text, p_customer_id uuid
)
returns table(new_stamps_balance integer, reward_name text)
language plpgsql security definer
set search_path = public
as $$
declare
  v_establishment uuid; v_employee_id uuid; v_goal integer; v_name text; v_balance integer; v_new integer;
begin
  select es.establishment_id, es.employee_id into v_establishment, v_employee_id
  from public.employee_sessions es
  where es.token_hash=encode(digest(trim(p_session_token),'sha256'),'hex') and es.expires_at>now() limit 1;
  if v_establishment is null or v_employee_id is null then raise exception 'Session employé invalide ou expirée'; end if;
  select s.stamp_goal,s.stamp_reward_name into v_goal,v_name from public.loyalty_settings s
  where s.establishment_id=v_establishment and s.program_type='STAMP' and s.enabled=true limit 1;
  if v_goal is null then raise exception 'Le programme à tampons n’est pas activé'; end if;
  select c.stamps_balance into v_balance from public.loyalty_customers c
  where c.id=p_customer_id and c.establishment_id=v_establishment for update;
  if v_balance is null then raise exception 'Client introuvable'; end if;
  if v_balance<v_goal then raise exception 'La récompense n’est pas encore débloquée'; end if;
  update public.loyalty_customers set stamps_balance=0,updated_at=now()
  where id=p_customer_id and establishment_id=v_establishment returning stamps_balance into v_new;
  insert into public.loyalty_transactions(establishment_id,customer_id,employee_id,amount,points,type,description)
  values(v_establishment,p_customer_id,v_employee_id,null,0,'REDEEM','Récompense à tampons réclamée — '||coalesce(v_name,'Cadeau fidélité'));
  return query select v_new,v_name;
end;
$$;
