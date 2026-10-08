-- Prevent numeric NaN / integer overflow during points calculation.
-- Keep the existing business model while making the calculation deterministic.

create or replace function public.add_loyalty_points(
  p_establishment_id uuid, p_customer_id uuid, p_amount numeric,
  p_invoice_number text default null, p_responsible_code text default null,
  p_description text default null
)
returns integer language plpgsql security definer
set search_path = public, extensions
as $$
declare
  v_rate numeric; v_type text; v_customer_establishment uuid; v_points integer;
  v_new_balance integer; v_hash text; v_employee uuid; v_calculated numeric;
begin
  if not public.user_has_establishment_access(p_establishment_id) then raise exception 'Accès non autorisé à cet établissement'; end if;
  v_employee:=auth.uid(); if v_employee is null then raise exception 'Utilisateur non authentifié'; end if;
  if p_responsible_code is null or length(trim(p_responsible_code))<4 then raise exception 'Code responsable obligatoire'; end if;
  select admin_code_hash into v_hash from public.loyalty_admin_secrets where establishment_id=p_establishment_id;
  if v_hash is null then raise exception 'Aucun code responsable configuré pour cet établissement'; end if;
  if v_hash <> crypt(trim(p_responsible_code),v_hash) then raise exception 'Code responsable incorrect'; end if;
  if p_amount is null or p_amount <= 0 or p_amount = 'NaN'::numeric then raise exception 'Montant de facture invalide'; end if;
  select s.program_type,s.points_per_currency into v_type,v_rate from public.loyalty_settings s
  where s.establishment_id=p_establishment_id and s.enabled=true limit 1;
  if v_type is null then raise exception 'Le programme de fidélité n''est pas configuré'; end if;
  if v_type not in ('POINTS_REWARD','POINTS_DISCOUNT') then raise exception 'Cet établissement utilise un programme à tampons. Les points ne sont pas disponibles.'; end if;
  if coalesce(v_rate,0)<=0 or v_rate='NaN'::numeric then raise exception 'Le taux de points est invalide'; end if;
  v_calculated := floor(p_amount*v_rate);
  if v_calculated > 2147483647 then raise exception 'Montant trop élevé pour le calcul des points'; end if;
  if v_calculated <= 0 then raise exception 'Le montant ne génère aucun point'; end if;
  v_points := v_calculated::integer;
  select establishment_id into v_customer_establishment from public.loyalty_customers where id=p_customer_id for update;
  if not found then raise exception 'Client introuvable'; end if;
  if v_customer_establishment<>p_establishment_id then raise exception 'Ce client appartient à un autre établissement'; end if;
  update public.loyalty_customers c set points_balance=coalesce(c.points_balance,0)+v_points,total_points_earned=coalesce(c.total_points_earned,0)+v_points,visit_count=coalesce(c.visit_count,0)+1,last_visit_at=now()
  where c.id=p_customer_id and c.establishment_id=p_establishment_id returning c.points_balance into v_new_balance;
  insert into public.loyalty_transactions(establishment_id,customer_id,employee_id,points,amount,description,type,invoice_number)
  values(p_establishment_id,p_customer_id,v_employee,v_points,p_amount,coalesce(p_description,'Achat - points fidélité'),'EARN',nullif(trim(p_invoice_number),''));
  return v_new_balance;
exception when unique_violation then raise exception 'Cette facture a déjà généré des points';
end;
$$;

create or replace function public.add_loyalty_points_by_scanner(
  p_scanner_token uuid, p_customer_id uuid, p_amount numeric,
  p_invoice_number text default null, p_description text default null
)
returns integer language plpgsql security definer
set search_path = public
as $$
declare
  v_est uuid; v_rate numeric; v_type text; v_enabled boolean;
  v_customer public.loyalty_customers%rowtype; v_points integer; v_new integer; v_calculated numeric;
begin
  select establishment_id into v_est from public.establishment_scanner_links where access_token=p_scanner_token limit 1;
  if v_est is null then raise exception 'Lien scanner invalide'; end if;
  select s.program_type,s.points_per_currency,s.enabled into v_type,v_rate,v_enabled from public.loyalty_settings s where s.establishment_id=v_est limit 1;
  if coalesce(v_enabled,true)=false then raise exception 'Le programme de fidélité est désactivé pour cet établissement'; end if;
  if v_type not in ('POINTS_REWARD','POINTS_DISCOUNT') then raise exception 'Cet établissement utilise un programme à tampons. Les points ne sont pas disponibles.'; end if;
  if p_amount is null or p_amount<=0 or p_amount='NaN'::numeric then raise exception 'Montant invalide'; end if;
  if coalesce(v_rate,0)<=0 or v_rate='NaN'::numeric then raise exception 'Le taux de points est invalide'; end if;
  v_calculated:=floor(p_amount*v_rate);
  if v_calculated>2147483647 then raise exception 'Montant trop élevé pour le calcul des points'; end if;
  v_points:=v_calculated::integer;
  if v_points<=0 then raise exception 'Le montant est trop faible pour générer des points'; end if;
  select * into v_customer from public.loyalty_customers c where c.id=p_customer_id and c.establishment_id=v_est for update;
  if not found then raise exception 'Client introuvable pour cet établissement'; end if;
  v_new:=coalesce(v_customer.points_balance,0)+v_points;
  if v_new<0 then raise exception 'Solde de points invalide'; end if;
  update public.loyalty_customers c set points_balance=v_new,total_points_earned=coalesce(c.total_points_earned,0)+v_points,visit_count=coalesce(c.visit_count,0)+1,last_visit_at=now(),updated_at=now() where c.id=p_customer_id and c.establishment_id=v_est;
  insert into public.loyalty_transactions(establishment_id,customer_id,employee_id,amount,points,type,description,invoice_number) values(v_est,p_customer_id,null,p_amount,v_points,'EARN',coalesce(p_description,'Achat via scanner fidélité'),nullif(trim(coalesce(p_invoice_number,'')),''));
  perform public.complete_pending_loyalty_referral(p_customer_id);
  return v_new;
end;
$$;
