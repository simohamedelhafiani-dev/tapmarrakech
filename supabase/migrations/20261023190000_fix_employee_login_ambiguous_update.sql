-- Fix ambiguous PL/pgSQL variable/column names in the employee code login RPC.
-- This forward migration also repairs databases that already applied the original API migration.
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

REVOKE ALL ON FUNCTION public.login_employee_with_code_only(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.login_employee_with_code_only(text) TO service_role;
