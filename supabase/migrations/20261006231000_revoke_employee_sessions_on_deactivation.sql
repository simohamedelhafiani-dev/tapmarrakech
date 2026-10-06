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

revoke all on function public.revoke_employee_sessions_on_deactivation() from public, anon, authenticated;
revoke all on function public.revoke_employee_sessions_on_code_deactivation() from public, anon, authenticated;
