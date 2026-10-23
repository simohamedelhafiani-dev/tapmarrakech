begin;

select plan(7);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'google_business_connections'
      and cmd = 'SELECT'
  ),
  'google_business_connections has no separate SELECT policy: OAuth token rows are admin-only'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'google_business_connections'
      and policyname = 'Google connections managed by admins'
      and cmd = 'ALL'
      and qual ilike '%is_tapmarrakech_admin%'
      and with_check ilike '%is_tapmarrakech_admin%'
  ),
  'Google Business connection management remains restricted by the admin-only policy'
);


select ok(
  not has_table_privilege('anon', 'public.google_business_accounts', 'SELECT')
  and not has_table_privilege('authenticated', 'public.google_business_accounts', 'SELECT'),
  'Google OAuth account tokens are not directly readable through the Data API'
);

select ok(
  not has_table_privilege('anon', 'public.google_business_accounts', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.google_business_accounts', 'UPDATE'),
  'Google OAuth account tokens cannot be changed directly by browser roles'
);


select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'can_responsible_access_google_business_location'
      and p.prosecdef = true
      and pg_get_function_result(p.oid) = 'boolean'
  )
  and has_function_privilege('authenticated', 'public.can_responsible_access_google_business_location(uuid)', 'EXECUTE')
  and not has_function_privilege('anon', 'public.can_responsible_access_google_business_location(uuid)', 'EXECUTE'),
  'responsible access uses a private SECURITY DEFINER boolean helper without returning OAuth row data'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'google_business_locations'
      and policyname = 'Google locations visible to admins and responsibles'
      and cmd = 'SELECT'
      and qual ilike '%can_responsible_access_google_business_location%'
  ),
  'responsibles retain scoped location visibility without SELECT access to OAuth token rows'
);

select ok(
  exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'google_business_reviews'
      and policyname = 'Google reviews visible to admins and responsibles'
      and cmd = 'SELECT'
      and qual ilike '%can_responsible_access_google_business_location%'
  ),
  'responsibles retain scoped review visibility without a token-table RLS subquery'
);

select * from finish();
rollback;
