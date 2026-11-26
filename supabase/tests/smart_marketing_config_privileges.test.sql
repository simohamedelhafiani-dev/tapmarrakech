BEGIN;
SELECT plan(16);

SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.smart_marketing_configs'::regclass), 'Smart Marketing config RLS is enabled');
SELECT ok(NOT has_table_privilege('anon','public.smart_marketing_configs','SELECT'), 'anon cannot select Smart Marketing configs');
SELECT ok(NOT has_table_privilege('anon','public.smart_marketing_configs','INSERT'), 'anon cannot insert Smart Marketing configs');
SELECT ok(NOT has_table_privilege('anon','public.smart_marketing_configs','UPDATE'), 'anon cannot update Smart Marketing configs');
SELECT ok(NOT has_table_privilege('anon','public.smart_marketing_configs','DELETE'), 'anon cannot delete Smart Marketing configs');
SELECT ok(NOT has_table_privilege('anon','public.smart_marketing_configs','TRUNCATE'), 'anon cannot truncate Smart Marketing configs');
SELECT ok(NOT has_table_privilege('anon','public.smart_marketing_configs','TRIGGER'), 'anon cannot create triggers on Smart Marketing configs');
SELECT ok(NOT has_table_privilege('anon','public.smart_marketing_configs','REFERENCES'), 'anon cannot create references to Smart Marketing configs');
SELECT ok(has_table_privilege('authenticated','public.smart_marketing_configs','SELECT'), 'authenticated can select through RLS');
SELECT ok(has_table_privilege('authenticated','public.smart_marketing_configs','INSERT'), 'authenticated can insert through RLS');
SELECT ok(has_table_privilege('authenticated','public.smart_marketing_configs','UPDATE'), 'authenticated can update through RLS');
SELECT ok(has_table_privilege('authenticated','public.smart_marketing_configs','DELETE') AND NOT has_table_privilege('authenticated','public.smart_marketing_configs','TRUNCATE'), 'authenticated can delete through RLS but cannot bypass it with TRUNCATE');


SELECT ok(
  (SELECT count(*) = 4 FROM pg_policies
   WHERE schemaname='public' AND tablename='smart_marketing_configs'
     AND policyname IN ('smart_marketing_configs_read_access','smart_marketing_configs_insert_manager','smart_marketing_configs_update_manager','smart_marketing_configs_delete_manager')),
  'all four tenant-scoped Smart Marketing RLS policies exist'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='smart_marketing_configs' AND c.contype='c'
      AND pg_get_constraintdef(c.oid) ILIKE '%smart_id%'
      AND pg_get_constraintdef(c.oid) ILIKE '%winback%'
      AND pg_get_constraintdef(c.oid) ILIKE '%nearby%'
      AND pg_get_constraintdef(c.oid) ILIKE '%birthday%'
      AND pg_get_constraintdef(c.oid) ILIKE '%reward%'
      AND pg_get_constraintdef(c.oid) ILIKE '%vip%'
      AND pg_get_constraintdef(c.oid) ILIKE '%progress%'
      AND pg_get_constraintdef(c.oid) ILIKE '%happyhour%'
      AND pg_get_constraintdef(c.oid) ILIKE '%challenge%'
      AND pg_get_constraintdef(c.oid) ILIKE '%referral%'
      AND pg_get_constraintdef(c.oid) ILIKE '%comeback%'
  ),
  'Smart Marketing config enforces the ten known automation IDs'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='smart_marketing_configs' AND c.contype='u'
      AND pg_get_constraintdef(c.oid) ILIKE '%establishment_id%smart_id%'
  ),
  'one config per establishment and Smart ID is enforced'
);
SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_trigger g
    JOIN pg_class t ON t.oid=g.tgrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace
    WHERE n.nspname='public' AND t.relname='smart_marketing_configs'
      AND g.tgname='smart_marketing_configs_updated_at' AND NOT g.tgisinternal
      AND pg_get_triggerdef(g.oid) ILIKE '%INSERT%' AND pg_get_triggerdef(g.oid) ILIKE '%UPDATE%'
  ),
  'audit trigger updates metadata on insert and update'
);

SELECT * FROM finish();
ROLLBACK;
