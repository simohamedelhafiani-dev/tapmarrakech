begin;

select plan(11);

create temporary table employee_access_fixture (
  employee_id uuid not null,
  establishment_id uuid not null
) on commit drop;

-- The auth user and its profile are created atomically below to avoid
-- conflicting with the on_auth_user_created profile trigger.

WITH inserted_user AS (
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  VALUES (
    gen_random_uuid(), 'authenticated', 'authenticated',
    'employee-flow-' || replace(gen_random_uuid()::text, '-', '') || '@test.invalid',
    '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  )
  RETURNING id, email
)
INSERT INTO public.profiles (id, email, name)
SELECT id, email, 'Employee flow test'
FROM inserted_user
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    name = EXCLUDED.name;

insert into public.establishments (user_id, name, slug)
select p.id, 'Employee access flow test', 'employee-flow-' || replace(gen_random_uuid()::text, '-', '')
from public.profiles p
where p.name = 'Employee flow test';

insert into employee_access_fixture (employee_id, establishment_id)
select p.id, e.id
from public.profiles p
join public.establishments e on e.user_id = p.id
where p.name = 'Employee flow test';

insert into public.establishment_staff (establishment_id, user_id, role, active)
select establishment_id, employee_id, 'STAFF', true
from employee_access_fixture;

insert into public.employee_access_codes (establishment_id, user_id, code_hash, active)
select establishment_id, employee_id, extensions.crypt('4837', extensions.gen_salt('bf')), true
from employee_access_fixture;

insert into public.employee_sessions (employee_id, establishment_id, token_hash, expires_at)
select employee_id, establishment_id,
       encode(extensions.digest('employee-flow-session-token', 'sha256'), 'hex'),
       now() + interval '1 hour'
from employee_access_fixture;

select is(
  public.get_active_employee_session_establishment('employee-flow-session-token'),
  (select establishment_id from employee_access_fixture),
  'active STAFF membership and employee profile authorize the active session'
);

create temporary table employee_login_result on commit drop as
select * from public.login_employee_with_code_only('4837');

select is(
  (select count(*)::integer from employee_login_result),
  1,
  'valid employee code logs in exactly one active employee'
);

select ok(
  (select length(session_token) = 64 and expires_at > now()
   from employee_login_result),
  'login returns a strong token and a future expiry'
);

select ok(
  exists (
    select 1
    from public.employee_sessions s
    join employee_login_result l on l.employee_id = s.employee_id
    where s.token_hash = encode(extensions.digest(l.session_token, 'sha256'), 'hex')
      and s.token_hash <> l.session_token
      and s.expires_at = l.expires_at
  ),
  'session stores only the token hash, never the raw token'
);

select is(
  public.logout_employee((select session_token from employee_login_result)),
  true,
  'employee logout succeeds'
);

select is(
  (select count(*)::integer
   from public.employee_sessions s
   join employee_login_result l on l.employee_id = s.employee_id),
  0,
  'logout invalidates the employee session'
);

-- These RPCs are called through the service-role employee-login Edge Function.
-- Exposing the SECURITY DEFINER login RPC to authenticated clients bypasses the
-- Edge Function's IP rate limit and can permit code-guessing against staff PINs.
select ok(
  not has_function_privilege('anon', 'public.login_employee_with_code_only(text)', 'EXECUTE'),
  'anonymous clients cannot call the SECURITY DEFINER employee login RPC directly'
);

select ok(
  not has_function_privilege('authenticated', 'public.login_employee_with_code_only(text)', 'EXECUTE'),
  'authenticated clients cannot bypass employee login rate limiting through the RPC'
);

select ok(
  not has_function_privilege('anon', 'public.get_active_employee_session_establishment(text)', 'EXECUTE'),
  'anonymous clients cannot inspect employee session scope'
);

select ok(
  not has_function_privilege('authenticated', 'public.get_active_employee_session_establishment(text)', 'EXECUTE'),
  'authenticated clients cannot call the internal employee session resolver'
);

select ok(
  has_function_privilege('service_role', 'public.login_employee_with_code_only(text)', 'EXECUTE')
  and has_function_privilege('service_role', 'public.get_active_employee_session_establishment(text)', 'EXECUTE'),
  'the trusted Edge Function service role retains the required employee RPC access'
);

select * from finish();
rollback;
