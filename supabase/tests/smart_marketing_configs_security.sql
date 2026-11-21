-- Structural security checks for Smart Marketing config table.
-- Run in a disposable Staging SQL session with elevated read access.
-- These checks validate RLS/policy definitions; tenant behavior must be exercised
-- with real authenticated test users (see smart_marketing_configs_rls_matrix.md).
begin;
do $$
declare
  rls_enabled boolean;
  policy_count integer;
  allowed_ids_constraint boolean;
  smart_ids_constraint_definition text;
  unique_constraint boolean;
  trigger_count integer;
  trigger_definition text;
begin
  select c.relrowsecurity into rls_enabled
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname='smart_marketing_configs';
  if coalesce(rls_enabled,false) is not true then
    raise exception 'FAIL: RLS must be enabled on public.smart_marketing_configs';
  end if;

  select count(*) into policy_count
  from pg_policies
  where schemaname='public' and tablename='smart_marketing_configs'
    and policyname in ('smart_marketing_configs_read_access',
      'smart_marketing_configs_insert_manager','smart_marketing_configs_update_manager',
      'smart_marketing_configs_delete_manager');
  if policy_count <> 4 then raise exception 'FAIL: expected four named RLS policies, found %',policy_count; end if;

  select pg_get_constraintdef(c.oid) into smart_ids_constraint_definition
  from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname='smart_marketing_configs' and c.contype='c'
    and pg_get_constraintdef(c.oid) ilike '%smart_id%'
  order by c.oid limit 1;
  allowed_ids_constraint := smart_ids_constraint_definition is not null
    and smart_ids_constraint_definition ilike '%winback%'
    and smart_ids_constraint_definition ilike '%nearby%'
    and smart_ids_constraint_definition ilike '%birthday%'
    and smart_ids_constraint_definition ilike '%reward%'
    and smart_ids_constraint_definition ilike '%vip%'
    and smart_ids_constraint_definition ilike '%progress%'
    and smart_ids_constraint_definition ilike '%happyhour%'
    and smart_ids_constraint_definition ilike '%challenge%'
    and smart_ids_constraint_definition ilike '%referral%'
    and smart_ids_constraint_definition ilike '%comeback%';
  if not allowed_ids_constraint then raise exception 'FAIL: Smart ID allowlist incomplete or missing'; end if;

  select exists(select 1 from pg_constraint c
    join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='smart_marketing_configs' and c.contype='u'
      and pg_get_constraintdef(c.oid) ilike '%establishment_id%smart_id%')
    into unique_constraint;
  if not unique_constraint then raise exception 'FAIL: unique establishment_id + smart_id constraint missing'; end if;

  select count(*) into trigger_count
  from pg_trigger g join pg_class t on t.oid=g.tgrelid join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname='smart_marketing_configs'
    and g.tgname='smart_marketing_configs_updated_at' and not g.tgisinternal;
  if trigger_count <> 1 then raise exception 'FAIL: updated_at/updated_by trigger missing'; end if;
  select pg_get_triggerdef(g.oid) into trigger_definition
  from pg_trigger g join pg_class t on t.oid=g.tgrelid join pg_namespace n on n.oid=t.relnamespace
  where n.nspname='public' and t.relname='smart_marketing_configs'
    and g.tgname='smart_marketing_configs_updated_at' and not g.tgisinternal;
  if trigger_definition is null or trigger_definition not ilike '%INSERT%' then
    raise exception 'FAIL: audit trigger must run on INSERT and UPDATE';
  end if;

  raise notice 'PASS: RLS enabled, policies present, Smart allowlist, unique tenant key, audit trigger.';
end $$;
rollback;
