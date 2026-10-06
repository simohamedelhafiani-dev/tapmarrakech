create or replace function public.get_active_employee_session_establishment(p_session_token text)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_establishment uuid;
begin
  select es.establishment_id
  into v_establishment
  from public.employee_sessions es
  join public.establishment_staff st
    on st.user_id = es.employee_id
   and st.establishment_id = es.establishment_id
   and st.active = true
   and st.role = 'employee'
  join public.profiles p
    on p.id = es.employee_id
   and p.role = 'employee'
  where es.token_hash = encode(digest(trim(p_session_token), 'sha256'), 'hex')
    and es.expires_at > now()
    and exists (
      select 1
      from public.employee_access_codes ec
      where ec.user_id = es.employee_id
        and ec.establishment_id = es.establishment_id
        and ec.active = true
    )
  limit 1;

  return v_establishment;
end;
$$;

create or replace function public.revoke_employee_sessions_on_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.active = false and old.active = true then
    delete from public.employee_sessions
    where employee_id = new.user_id
      and establishment_id = new.establishment_id;
  end if;
  return new;
end;
$$;

create or replace function public.revoke_employee_sessions_on_code_deactivation()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.active = false and old.active = true then
    delete from public.employee_sessions
    where employee_id = new.user_id
      and establishment_id = new.establishment_id;
  end if;
  return new;
end;
$$;

drop trigger if exists revoke_employee_sessions_on_staff_deactivation on public.establishment_staff;
create trigger revoke_employee_sessions_on_staff_deactivation
after update of active on public.establishment_staff
for each row execute function public.revoke_employee_sessions_on_deactivation();

drop trigger if exists revoke_employee_sessions_on_code_deactivation on public.employee_access_codes;
create trigger revoke_employee_sessions_on_code_deactivation
after update of active on public.employee_access_codes
for each row execute function public.revoke_employee_sessions_on_code_deactivation();

revoke execute on function public.get_active_employee_session_establishment(text) from public, anon, authenticated;
revoke execute on function public.revoke_employee_sessions_on_deactivation() from public, anon, authenticated;
revoke execute on function public.revoke_employee_sessions_on_code_deactivation() from public, anon, authenticated;
grant execute on function public.get_active_employee_session_establishment(text) to authenticated;
