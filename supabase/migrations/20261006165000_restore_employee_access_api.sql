-- Restore the employee access/session schema and RPCs required by the current KELYANI employee app.
-- These definitions are reconstructed from the read-only production schema audit.
-- Employee code verification is server-side; the current Edge Function calls the
-- code-only RPC with service_role after rate limiting. Session-scoped actions require
-- an authenticated employee JWT and a valid session token.

create table if not exists public.employee_access_codes (
  id uuid primary key default gen_random_uuid(),
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  active boolean not null default true,
  last_used_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint employee_access_codes_user_unique unique (establishment_id, user_id)
);

create index if not exists idx_employee_access_codes_active on public.employee_access_codes(active);
create index if not exists idx_employee_access_codes_establishment on public.employee_access_codes(establishment_id);
create index if not exists idx_employee_access_codes_user on public.employee_access_codes(user_id);

create table if not exists public.employee_sessions (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references auth.users(id) on delete cascade,
  establishment_id uuid not null references public.establishments(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  last_used_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_employee_sessions_employee on public.employee_sessions(employee_id);
create index if not exists idx_employee_sessions_establishment on public.employee_sessions(establishment_id);
create index if not exists idx_employee_sessions_expires on public.employee_sessions(expires_at);
create index if not exists idx_employee_sessions_token_hash on public.employee_sessions(token_hash);

alter table public.employee_access_codes enable row level security;
alter table public.employee_sessions enable row level security;
revoke all on public.employee_access_codes from public, anon, authenticated;
revoke all on public.employee_sessions from public, anon, authenticated;
grant all on public.employee_access_codes to service_role;
grant all on public.employee_sessions to service_role;

-- Match production's owner/admin/self access model for staff assignments.
alter table public.establishment_staff enable row level security;
drop policy if exists establishment_staff_admin_delete on public.establishment_staff;
create policy establishment_staff_admin_delete on public.establishment_staff
  for delete to authenticated using (public.is_tapmarrakech_admin());
drop policy if exists establishment_staff_admin_select on public.establishment_staff;
create policy establishment_staff_admin_select on public.establishment_staff
  for select to authenticated using (public.is_tapmarrakech_admin());
drop policy if exists establishment_staff_admin_update on public.establishment_staff;
create policy establishment_staff_admin_update on public.establishment_staff
  for update to authenticated using (public.is_tapmarrakech_admin())
  with check (public.is_tapmarrakech_admin());
drop policy if exists staff_owner_delete on public.establishment_staff;
create policy staff_owner_delete on public.establishment_staff
  for delete to authenticated using (public.user_owns_establishment(establishment_id));
drop policy if exists staff_owner_insert on public.establishment_staff;
create policy staff_owner_insert on public.establishment_staff
  for insert to authenticated with check (public.user_owns_establishment(establishment_id));
drop policy if exists staff_owner_select on public.establishment_staff;
create policy staff_owner_select on public.establishment_staff
  for select to authenticated using (public.user_owns_establishment(establishment_id));
drop policy if exists staff_owner_update on public.establishment_staff;
create policy staff_owner_update on public.establishment_staff
  for update to authenticated using (public.user_owns_establishment(establishment_id))
  with check (public.user_owns_establishment(establishment_id));
drop policy if exists staff_user_select_own on public.establishment_staff;
create policy staff_user_select_own on public.establishment_staff
  for select to authenticated using (user_id = auth.uid());
revoke all on public.establishment_staff from anon;
grant select, insert, update, delete on public.establishment_staff to authenticated;
grant all on public.establishment_staff to service_role;

create or replace function public.get_employee_login_establishments()
returns table(id uuid, name text)
language sql stable security definer
set search_path = public, pg_temp
as $function$
  select distinct e.id, e.name
  from public.establishments e
  join public.employee_access_codes c on c.establishment_id = e.id
  join public.establishment_staff es
    on es.establishment_id = e.id and es.user_id = c.user_id
  join public.profiles p on p.id = c.user_id
  where c.active = true
    and es.active = true
    and es.role = 'STAFF'
    and p.role = 'employee'
  order by e.name;
$function$;

create or replace function public.get_my_employee_establishments()
returns table(id uuid, name text, logo_url text)
language sql stable security definer
set search_path = public, pg_temp
as $function$
  select e.id, e.name, e.logo_url
  from public.establishments e
  join public.establishment_staff es
    on es.establishment_id = e.id and es.user_id = auth.uid()
  join public.profiles p on p.id = auth.uid()
  where auth.uid() is not null and p.role = 'employee' and es.active = true
  order by e.created_at;
$function$;

create or replace function public.login_employee_with_code_only(p_code text)
returns table(
  session_token text, employee_id uuid, employee_name text,
  establishment_id uuid, establishment_name text, expires_at timestamptz
)
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_code text := trim(coalesce(p_code, ''));
  v_match_count integer := 0;
  v_employee_id uuid;
  v_employee_name text;
  v_establishment_id uuid;
  v_establishment_name text;
  v_raw_token text;
  v_token_hash text;
  v_expires_at timestamptz;
  c record;
begin
  if length(v_code) < 4 then raise exception 'Code employé invalide'; end if;

  for c in
    select eac.user_id, eac.code_hash, eac.establishment_id,
           p.name as employee_name, e.name as establishment_name
    from public.employee_access_codes eac
    join public.establishment_staff es
      on es.user_id = eac.user_id
     and es.establishment_id = eac.establishment_id
     and es.active = true and es.role = 'STAFF'
    join public.profiles p on p.id = eac.user_id and p.role = 'employee'
    join public.establishments e on e.id = eac.establishment_id
    where eac.active = true
  loop
    if extensions.crypt(v_code, c.code_hash) = c.code_hash then
      v_match_count := v_match_count + 1;
      v_employee_id := c.user_id;
      v_employee_name := c.employee_name;
      v_establishment_id := c.establishment_id;
      v_establishment_name := c.establishment_name;
    end if;
  end loop;

  if v_match_count = 0 then raise exception 'Code employé incorrect'; end if;
  if v_match_count > 1 then raise exception 'Ce code employé est utilisé par plusieurs employés'; end if;

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_raw_token, 'sha256'), 'hex');
  v_expires_at := now() + interval '12 hours';

  delete from public.employee_sessions s where s.employee_id = v_employee_id;
  insert into public.employee_sessions(employee_id, establishment_id, token_hash, expires_at, last_used_at)
  values(v_employee_id, v_establishment_id, v_token_hash, v_expires_at, now());

  update public.employee_access_codes
  set last_used_at = now(), updated_at = now()
  where employee_access_codes.user_id = v_employee_id
    and employee_access_codes.establishment_id = v_establishment_id;

  return query select v_raw_token, v_employee_id, v_employee_name,
                      v_establishment_id, v_establishment_name, v_expires_at;
end;
$function$;

create or replace function public.login_employee_with_code(p_establishment_id uuid, p_code text)
returns table(
  session_token text, employee_id uuid, employee_name text,
  establishment_id uuid, establishment_name text, expires_at timestamptz
)
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_employee_id uuid;
  v_employee_name text;
  v_establishment_name text;
  v_token text;
  v_token_hash text;
  v_expires_at timestamptz;
begin
  if p_establishment_id is null then raise exception 'Établissement invalide'; end if;
  if p_code is null or length(trim(p_code)) < 4 then raise exception 'Code employé invalide'; end if;

  select c.user_id, coalesce(p.name, p.email, 'Employé'), e.name
  into v_employee_id, v_employee_name, v_establishment_name
  from public.employee_access_codes c
  join public.establishments e on e.id = c.establishment_id
  join public.profiles p on p.id = c.user_id
  join public.establishment_staff es on es.user_id = c.user_id and es.establishment_id = c.establishment_id
  where c.establishment_id = p_establishment_id
    and c.active = true and es.active = true and es.role = 'STAFF'
    and p.role = 'employee'
    and extensions.crypt(trim(p_code), c.code_hash) = c.code_hash
  limit 1;

  if v_employee_id is null then raise exception 'Code employé incorrect ou désactivé'; end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(v_token, 'sha256'), 'hex');
  v_expires_at := now() + interval '12 hours';

  delete from public.employee_sessions where employee_id = v_employee_id;
  insert into public.employee_sessions(employee_id, establishment_id, token_hash, expires_at)
  values(v_employee_id, p_establishment_id, v_token_hash, v_expires_at);
  update public.employee_access_codes set last_used_at = now()
  where establishment_id = p_establishment_id and user_id = v_employee_id;

  return query select v_token, v_employee_id, v_employee_name,
                      p_establishment_id, v_establishment_name, v_expires_at;
end;
$function$;

create or replace function public.get_employee_loyalty_card_config(p_session_token text)
returns table(
  template_id text, primary_color text, secondary_color text, background_color text,
  text_color text, button_color text, border_radius integer, design_config jsonb, published boolean
)
language plpgsql stable security definer
set search_path = public, extensions, pg_temp
as $function$
declare v_establishment_id uuid;
begin
  select s.establishment_id into v_establishment_id
  from public.employee_sessions s
  where s.token_hash = encode(extensions.digest(trim(p_session_token), 'sha256'), 'hex')
    and s.expires_at > now()
  limit 1;
  if v_establishment_id is null then return; end if;

  return query
  select d.template_id, d.primary_color, d.secondary_color, d.background_color, d.text_color,
         d.button_color, d.border_radius, coalesce(d.design_config, '{}'::jsonb), true
  from public.loyalty_card_designs d
  where d.establishment_id = v_establishment_id and d.published = true
  limit 1;

  if not found then
    return query select 'luxury', '#173D32', '#D3A84C', '#F7F7F3', '#173D32',
                        '#173D32', 24, '{}'::jsonb, false;
  end if;
end;
$function$;

create or replace function public.logout_employee(p_session_token text)
returns boolean
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $function$
declare v_token_hash text;
begin
  if p_session_token is null then return true; end if;
  v_token_hash := encode(extensions.digest(trim(p_session_token), 'sha256'), 'hex');
  delete from public.employee_sessions where token_hash = v_token_hash;
  return true;
end;
$function$;

create or replace function public.add_loyalty_stamp_by_employee(p_session_token text, p_customer_id uuid)
returns table(stamps_balance integer, stamps_total integer, reward_ready boolean, reward_name text)
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_establishment uuid;
  v_goal integer;
  v_name text;
  v_balance integer;
  v_total integer;
begin
  v_establishment := public.get_active_employee_session_establishment(p_session_token);
  if v_establishment is null then raise exception 'Session employé invalide, expirée ou désactivée'; end if;

  select s.stamp_goal, s.stamp_reward_name into v_goal, v_name
  from public.loyalty_settings s
  where s.establishment_id = v_establishment and s.program_type = 'STAMP' and s.enabled = true
  limit 1;
  if v_goal is null then raise exception 'Le programme à tampons n’est pas activé'; end if;

  update public.loyalty_customers c
  set stamps_balance = c.stamps_balance + 1, stamps_total = c.stamps_total + 1, updated_at = now()
  where c.id = p_customer_id and c.establishment_id = v_establishment
  returning c.stamps_balance, c.stamps_total into v_balance, v_total;
  if not found then raise exception 'Client introuvable'; end if;

  return query select v_balance, v_total, v_balance >= v_goal, v_name;
end;
$function$;

create or replace function public.redeem_loyalty_stamp_reward_by_employee(p_session_token text, p_customer_id uuid)
returns table(new_stamps_balance integer, reward_name text)
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $function$
declare
  v_establishment uuid;
  v_employee_id uuid;
  v_goal integer;
  v_name text;
  v_balance integer;
  v_new integer;
begin
  select es.establishment_id, es.employee_id into v_establishment, v_employee_id
  from public.employee_sessions es
  where es.token_hash = encode(extensions.digest(trim(p_session_token), 'sha256'), 'hex')
    and es.expires_at > now()
  limit 1;
  if v_establishment is null or v_employee_id is null then raise exception 'Session employé invalide ou expirée'; end if;

  select s.stamp_goal, s.stamp_reward_name into v_goal, v_name
  from public.loyalty_settings s
  where s.establishment_id = v_establishment and s.program_type = 'STAMP' and s.enabled = true
  limit 1;
  if v_goal is null then raise exception 'Le programme à tampons n’est pas activé'; end if;

  select c.stamps_balance into v_balance from public.loyalty_customers c
  where c.id = p_customer_id and c.establishment_id = v_establishment for update;
  if v_balance is null then raise exception 'Client introuvable'; end if;
  if v_balance < v_goal then raise exception 'La récompense n’est pas encore débloquée'; end if;

  update public.loyalty_customers set stamps_balance = 0, updated_at = now()
  where id = p_customer_id and establishment_id = v_establishment
  returning stamps_balance into v_new;

  insert into public.loyalty_transactions(establishment_id, customer_id, employee_id, amount, points, type, description)
  values(v_establishment, p_customer_id, v_employee_id, null, 0, 'REDEEM',
         'Récompense à tampons réclamée — ' || coalesce(v_name, 'Cadeau fidélité'));
  return query select v_new, v_name;
end;
$function$;

create or replace function public.redeem_loyalty_discount_by_employee(
  p_session_token text, p_customer_id uuid, p_invoice_amount numeric,
  p_invoice_number text default null, p_payment_method text default 'CASH'
)
returns table(discount_percent numeric, discount_amount numeric, amount_paid numeric, expires_at timestamptz)
language plpgsql security definer
set search_path = public, extensions, pg_temp
as $function$
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
  where es.token_hash = encode(extensions.digest(trim(p_session_token), 'sha256'), 'hex')
    and es.expires_at > now()
  limit 1;
  if v_establishment is null or v_employee_id is null then raise exception 'Session employé invalide ou expirée'; end if;
  if p_invoice_amount is null or p_invoice_amount <= 0 then raise exception 'Montant de facture invalide'; end if;

  v_payment_method := upper(trim(coalesce(p_payment_method, 'CASH')));
  if v_payment_method not in ('CASH', 'CARD', 'TRANSFER', 'OTHER') then raise exception 'Mode de paiement invalide'; end if;

  select d.* into v_discount from public.loyalty_discount_cards d
  where d.customer_id = p_customer_id and d.establishment_id = v_establishment
    and d.status = 'ACTIVE' and d.valid_from <= now() and d.expires_at > now()
  order by d.created_at desc limit 1 for update;
  if not found then raise exception 'Aucune réduction active pour ce client'; end if;

  v_discount_amount := round(p_invoice_amount * (v_discount.discount_percent / 100), 2);
  v_amount_paid := greatest(p_invoice_amount - v_discount_amount, 0);

  insert into public.loyalty_transactions(
    establishment_id, customer_id, employee_id, amount, points, type, description, invoice_number
  ) values (
    v_establishment, p_customer_id, v_employee_id, p_invoice_amount, 0, 'REDEEM',
    'Réduction fidélité ' || trim(to_char(v_discount.discount_percent, 'FM999990.##')) || '% — ' ||
    trim(to_char(v_discount_amount, 'FM999999990.00')) || ' économisés',
    nullif(trim(coalesce(p_invoice_number, '')), '')
  );

  return query select v_discount.discount_percent, v_discount_amount, v_amount_paid, v_discount.expires_at;
end;
$function$;

-- Keep client-side employee operations authenticated-only; only the Edge Function
-- receives permission to invoke the code-only login RPC. The later hardening migrations
-- re-assert these grants after removing inherited PUBLIC execution.
revoke all on function public.get_employee_login_establishments() from public, anon;
revoke all on function public.get_my_employee_establishments() from public, anon;
revoke all on function public.login_employee_with_code_only(text) from public, anon, authenticated;
revoke all on function public.login_employee_with_code(uuid, text) from public, anon;
revoke all on function public.get_employee_loyalty_card_config(text) from public, anon;
revoke all on function public.logout_employee(text) from public, anon;
revoke all on function public.add_loyalty_stamp_by_employee(text, uuid) from public, anon;
revoke all on function public.redeem_loyalty_stamp_reward_by_employee(text, uuid) from public, anon;
revoke all on function public.redeem_loyalty_discount_by_employee(text, uuid, numeric, text, text) from public, anon;

grant execute on function public.get_employee_login_establishments() to authenticated, service_role;
grant execute on function public.get_my_employee_establishments() to authenticated, service_role;
grant execute on function public.login_employee_with_code_only(text) to service_role;
grant execute on function public.login_employee_with_code(uuid, text) to authenticated, service_role;
grant execute on function public.get_employee_loyalty_card_config(text) to authenticated, service_role;
grant execute on function public.logout_employee(text) to authenticated, service_role;
grant execute on function public.add_loyalty_stamp_by_employee(text, uuid) to authenticated, service_role;
grant execute on function public.redeem_loyalty_stamp_reward_by_employee(text, uuid) to authenticated, service_role;
grant execute on function public.redeem_loyalty_discount_by_employee(text, uuid, numeric, text, text) to authenticated, service_role;
