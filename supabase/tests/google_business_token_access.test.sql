begin;

select plan(2);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'google_business_connections'
      and policyname = 'Google connections visible to admins and responsibles'
  ),
  'responsible users have no SELECT policy on rows containing Google OAuth tokens'
);

select ok(
  exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'google_business_connections'
      and policyname = 'Google connections managed by admins'
      and cmd = 'ALL'
  ),
  'Google Business connection management remains restricted by the admin-only policy'
);

select * from finish();
rollback;
