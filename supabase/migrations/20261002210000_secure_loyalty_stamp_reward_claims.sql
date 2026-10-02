-- Secure stamp reward claims: direct table access is restricted by RLS.
-- Admin/responsable users may manage claims through their authenticated session.
-- Employees and public clients use SECURITY DEFINER RPCs so the employee
-- session token / customer access token remains the authorization boundary.

alter table public.loyalty_stamp_reward_claims enable row level security;

drop policy if exists "loyalty_stamp_claims_admin_all" on public.loyalty_stamp_reward_claims;
create policy "loyalty_stamp_claims_admin_all"
on public.loyalty_stamp_reward_claims
for all
to authenticated
using (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'responsable')
  )
)
with check (
  exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'responsable')
  )
);

create or replace function public.redeem_loyalty_stamp_reward_by_employee(
  p_session_token text,
  p_customer_id uuid
)
returns table(new_stamps_balance integer, reward_name text)
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_establishment uuid;
  v_goal integer;
  v_name text;
  v_balance integer;
  v_new integer;
begin
  select es.establishment_id into v_establishment
  from public.employee_sessions es
  where es.token_hash = encode(digest(trim(p_session_token), 'sha256'), 'hex')
    and es.expires_at > now()
  limit 1;

  if v_establishment is null then raise exception 'Session employé invalide ou expirée'; end if;

  select s.stamp_goal, s.stamp_reward_name into v_goal, v_name
  from public.loyalty_settings s
  where s.establishment_id = v_establishment
    and s.program_type = 'STAMP'
    and s.enabled = true
  limit 1;

  if v_goal is null then raise exception 'Le programme à tampons n’est pas activé'; end if;

  select c.stamps_balance into v_balance
  from public.loyalty_customers c
  where c.id = p_customer_id and c.establishment_id = v_establishment
  for update;

  if v_balance is null then raise exception 'Client introuvable'; end if;
  if v_balance < v_goal then raise exception 'La récompense n’est pas encore débloquée'; end if;

  update public.loyalty_customers
  set stamps_balance = stamps_balance - v_goal, updated_at = now()
  where id = p_customer_id and establishment_id = v_establishment
  returning stamps_balance into v_new;

  return query select v_new, v_name;
end;
$function$;

revoke all on function public.redeem_loyalty_stamp_reward_by_employee(text, uuid) from public;
grant execute on function public.redeem_loyalty_stamp_reward_by_employee(text, uuid) to anon, authenticated;
