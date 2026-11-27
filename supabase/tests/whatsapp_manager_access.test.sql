BEGIN;

SELECT plan(6);

CREATE TEMP TABLE whatsapp_access_fixture (
  admin_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  responsible_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  establishment_id uuid NOT NULL
) ON COMMIT DROP;

-- Track the fixture users by id: profile names can be rewritten by profile
-- triggers, so they are not a reliable lookup key.
CREATE TEMP TABLE whatsapp_access_users (rn integer PRIMARY KEY, id uuid NOT NULL) ON COMMIT DROP;

WITH users AS (
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  SELECT gen_random_uuid(), 'authenticated', 'authenticated',
         'whatsapp-access-' || replace(gen_random_uuid()::text, '-', '') || '@test.invalid',
         '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  FROM generate_series(1, 4)
  RETURNING id
)
INSERT INTO whatsapp_access_users (rn, id)
SELECT row_number() OVER (ORDER BY id), id FROM users;

INSERT INTO public.profiles (id, email, name)
SELECT u.id, au.email, 'WhatsApp access fixture ' || u.rn
FROM whatsapp_access_users u
JOIN auth.users au ON au.id = u.id
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    name = EXCLUDED.name;

-- The role-authority trigger reserves privileged role assignment for trusted
-- server-side provisioning; model that trusted setup explicitly in the fixture.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.profiles p
SET role = CASE u.rn
  WHEN 1 THEN 'admin'
  WHEN 4 THEN 'employee'
  ELSE 'responsible'
END
FROM whatsapp_access_users u
WHERE p.id = u.id;
SELECT set_config('request.jwt.claims', '{}', true);

INSERT INTO public.establishments (user_id, name, slug)
SELECT u.id, 'WhatsApp access fixture', 'wa-access-' || replace(gen_random_uuid()::text, '-', '')
FROM whatsapp_access_users u
WHERE u.rn = 2;

INSERT INTO whatsapp_access_fixture
SELECT
  (SELECT id FROM whatsapp_access_users WHERE rn = 1),
  (SELECT id FROM whatsapp_access_users WHERE rn = 2),
  (SELECT id FROM whatsapp_access_users WHERE rn = 3),
  (SELECT id FROM whatsapp_access_users WHERE rn = 4),
  (SELECT e.id FROM public.establishments e
     JOIN whatsapp_access_users u ON u.id = e.user_id AND u.rn = 2
   ORDER BY e.created_at DESC LIMIT 1);

GRANT SELECT ON whatsapp_access_fixture TO authenticated;

INSERT INTO public.establishment_staff (establishment_id, user_id, role, active)
SELECT establishment_id, responsible_id, 'MANAGER', true FROM whatsapp_access_fixture
UNION ALL
SELECT establishment_id, staff_id, 'STAFF', true FROM whatsapp_access_fixture;

SELECT ok(
  NOT has_function_privilege('anon', 'public.user_can_manage_whatsapp(uuid)', 'EXECUTE'),
  'anonymous clients cannot execute the WhatsApp manager authorization helper'
);
SELECT ok(
  has_function_privilege('authenticated', 'public.user_can_manage_whatsapp(uuid)', 'EXECUTE'),
  'authenticated sessions can execute the WhatsApp manager authorization helper'
);

SET LOCAL ROLE authenticated;

SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT staff_id FROM whatsapp_access_fixture), 'role', 'authenticated')::text, true);
SELECT is(
  public.user_can_manage_whatsapp((SELECT establishment_id FROM whatsapp_access_fixture)),
  false,
  'active STAFF membership cannot manage WhatsApp'
);

SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT responsible_id FROM whatsapp_access_fixture), 'role', 'authenticated')::text, true);
SELECT is(
  public.user_can_manage_whatsapp((SELECT establishment_id FROM whatsapp_access_fixture)),
  true,
  'active MANAGER with responsible profile can manage WhatsApp'
);

SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT owner_id FROM whatsapp_access_fixture), 'role', 'authenticated')::text, true);
SELECT is(
  public.user_can_manage_whatsapp((SELECT establishment_id FROM whatsapp_access_fixture)),
  true,
  'establishment owner can manage WhatsApp'
);

SELECT set_config('request.jwt.claims',
  json_build_object('sub', (SELECT admin_id FROM whatsapp_access_fixture), 'role', 'authenticated')::text, true);
SELECT is(
  public.user_can_manage_whatsapp((SELECT establishment_id FROM whatsapp_access_fixture)),
  true,
  'platform admin can manage WhatsApp'
);

SELECT * FROM finish();
ROLLBACK;
