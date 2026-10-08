-- Align employee access-code management with the establishment responsible role.
-- Also harden SECURITY DEFINER search_path and keep these admin-only RPCs non-public.

create or replace function public.set_employee_access_code(p_establishment_id uuid, p_user_id uuid, p_code text)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_role text;
begin
  if not (public.is_tapmarrakech_admin() or public.is_establishment_responsible(p_establishment_id)) then
    raise exception 'Accès refusé';
  end if;
  if p_code is null or length(trim(p_code)) < 4 then raise exception 'Le code doit contenir au moins 4 caractères'; end if;
  if length(trim(p_code)) > 12 then raise exception 'Le code est trop long'; end if;
  select role into v_role from public.profiles where id=p_user_id;
  if v_role is distinct from 'employee' then raise exception 'Cet utilisateur n''est pas un employé'; end if;
  if not exists (
    select 1 from public.establishment_staff es
    where es.establishment_id=p_establishment_id and es.user_id=p_user_id
      and es.role='STAFF' and es.active=true
  ) then raise exception 'Cet employé n''est pas rattaché à cet établissement'; end if;
  insert into public.employee_access_codes(establishment_id,user_id,code_hash,active,updated_at)
  values(p_establishment_id,p_user_id,crypt(trim(p_code),gen_salt('bf')),true,now())
  on conflict(establishment_id,user_id) do update
  set code_hash=excluded.code_hash,active=true,updated_at=now();
  return true;
end;
$function$;

create or replace function public.set_employee_access_code_status(p_employee_code_id uuid, p_active boolean)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not public.is_tapmarrakech_admin() and not exists (
    select 1 from public.employee_access_codes c
    where c.id=p_employee_code_id and public.is_establishment_responsible(c.establishment_id)
  ) then raise exception 'Accès refusé'; end if;
  update public.employee_access_codes set active=p_active,updated_at=now() where id=p_employee_code_id;
  return true;
end;
$function$;

create or replace function public.set_loyalty_admin_code(target_establishment_id uuid, new_code text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $function$
begin
  if not (public.is_tapmarrakech_admin() or public.user_owns_establishment(target_establishment_id)) then raise exception 'Not authorized'; end if;
  if new_code is null or length(trim(new_code)) < 4 then raise exception 'Admin code must contain at least 4 characters'; end if;
  insert into public.loyalty_admin_secrets(establishment_id,admin_code_hash)
  values(target_establishment_id,crypt(trim(new_code),gen_salt('bf')))
  on conflict(establishment_id) do update
  set admin_code_hash=crypt(trim(new_code),gen_salt('bf')),updated_at=now();
  return true;
end;
$function$;

revoke execute on function public.set_employee_access_code(uuid,uuid,text) from public, anon;
revoke execute on function public.set_employee_access_code_status(uuid,boolean) from public, anon;
revoke execute on function public.set_loyalty_admin_code(uuid,text) from public, anon;
grant execute on function public.set_employee_access_code(uuid,uuid,text) to authenticated;
grant execute on function public.set_employee_access_code_status(uuid,boolean) to authenticated;
grant execute on function public.set_loyalty_admin_code(uuid,text) to authenticated;
