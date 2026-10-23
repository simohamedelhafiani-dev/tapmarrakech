begin;

select plan(2);

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

select * from finish();
rollback;
