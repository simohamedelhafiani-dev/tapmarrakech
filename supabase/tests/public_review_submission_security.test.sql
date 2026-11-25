begin;

select plan(10);

select ok(
  to_regprocedure('public.consume_public_review_rate_limit(text,integer,integer)') is not null,
  'public review submission has a versioned server-side rate limiter'
);

select ok(
  has_function_privilege('service_role', 'public.consume_public_review_rate_limit(text,integer,integer)', 'EXECUTE'),
  'only the trusted server role is granted the rate-limit RPC'
);

select ok(
  not has_function_privilege('anon', 'public.consume_public_review_rate_limit(text,integer,integer)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.consume_public_review_rate_limit(text,integer,integer)', 'EXECUTE'),
  'browser roles cannot bypass the review Edge Function rate limiter'
);

select ok(
  (select relrowsecurity
   from pg_class
   where oid = 'public.public_review_rate_limits'::regclass),
  'hashed public review rate-limit keys remain behind row-level security'
);

select ok(
  not has_table_privilege('anon', 'public.reviews', 'INSERT')
  and not has_table_privilege('authenticated', 'public.reviews', 'INSERT'),
  'public reviews cannot be inserted directly through the Data API'
);

select ok(
  not exists (
    select 1
    from information_schema.column_privileges
    where table_schema = 'public'
      and table_name = 'reviews'
      and grantee in ('PUBLIC', 'anon', 'authenticated')
      and privilege_type = 'INSERT'
  ),
  'PUBLIC and browser roles have no column-level review INSERT grants'
);

select ok(
  has_table_privilege('service_role', 'public.reviews', 'INSERT'),
  'the trusted Edge Function service role retains review INSERT access'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews'
      and policyname = 'reviews_public_insert'
  ),
  'the legacy public review INSERT policy is removed'
);

select ok(
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'reviews'
      and cmd = 'INSERT'
  ),
  'no direct INSERT RLS policy remains on public reviews'
);

select ok(
  not has_table_privilege('anon', 'public.public_review_rate_limits', 'SELECT')
  and not has_table_privilege('authenticated', 'public.public_review_rate_limits', 'SELECT')
  and not has_table_privilege('anon', 'public.public_review_rate_limits', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.public_review_rate_limits', 'UPDATE'),
  'browser roles cannot read or alter stored review rate-limit state'
);

select * from finish();
rollback;
