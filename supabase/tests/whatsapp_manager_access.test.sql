BEGIN;

SELECT plan(4);

CREATE TEMP TABLE whatsapp_access_fixture (
  admin_id uuid NOT NULL,
  owner_id uuid NOT NULL,
  responsible_id uuid NOT NULL,
  staff_id uuid NOT NULL,
  establishment_id uuid NOT NULL
) ON COMMIT DROP;

WITH users AS (
  INSERT INTO auth.users (
    id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  )
  SELECT gen_random_uuid(), 'authenticated', 'authenticated',
         'whatsapp-access-' || replace(gen_random_uuid()::text, '-', '') || '@test.invalid',
         '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  FROM generate_series(1, 4)
  RETURNING id, email
),
numbered AS (
  SELECT id, email, row_number() OVER (ORDER BY id) AS rn FROM users
)
INSERT INTO public.profiles (id, email, name)
SELECT id, email, 'WhatsApp access fixture ' || rn
FROM (
  SELECT id, email, row_number() OVER (ORDER BY id) AS rn
  FROM auth.users
  WHERE email LIKE 'whatsapp-access-%@test.invalid'
) numbered
ON CONFLICT (id) DO UPDATE
SET email = EXCLUDED.email,
    name = EXCLUDED.name;

-- The role-authority trigger reserves privileged role assignment for trusted
-- server-side provisioning; model that trusted setup explicitly in the fixture.
SELECT set_config('request.jwt.claims', '{"role":"service_role"}', true);
UPDATE public.profiles
SET role = CASE
  WHEN name = 'WhatsApp access fixture 1' THEN 'admin'
  WHEN name = 'WhatsApp access fixture 4' THEN 'employee'
  ELSE 'responsible'
END
WHERE name LIKE 'WhatsApp access fixture %';
SELECT set_config('request.jwt.claims', '{}', true);

INSERT INTO public.establishments (user_id, name, slug)
SELECT p.id, 'WhatsApp access fixture', 'wa-access-' || replace(gen_random_uuid()::text, '-', '')
FROM public.profiles p
WHERE p.name = 'WhatsApp access fixture 2';

INSERT INTO whatsapp_access_fixture
SELECT
  (SELECT id FROM public.profiles WHERE name = 'WhatsApp access fixture 1'),
  (SELECT id FROM public.profiles WHERE name = 'WhatsApp access fixture 2'),
  (SELECT id FROM public.profiles WHERE name = 'WhatsApp access fixture 3'),
  (SELECT id FROM public.profiles WHERE name = 'WhatsApp access fixture 4'),
  (SELECT id FROM public.establishments WHERE name = 'WhatsApp access fixture' ORDER BY created_at DESC LIMIT 1);

GRANT SELECT ON whatsapp_access_fixture TO authenticated;

INSERT INTO public.establishment_staff (establishment_id, user_id, role, active)
SELECT establishment_id, responsible_id, 'MANAGER', true FROM whatsapp_access_fixture
UNION ALL
SELECT establishment_id, staff_id, 'STAFF', true FROM whatsapp_access_fixture;

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
