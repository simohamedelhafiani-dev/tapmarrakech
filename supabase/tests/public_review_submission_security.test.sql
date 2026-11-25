begin;

-- Keep this deterministic test key isolated and ensure the first-hit assertions
-- start from an absent row. The surrounding transaction rolls the fixture back.
delete from public.public_review_rate_limits
where key_hash in (repeat('e', 64), repeat('f', 64), repeat('a', 64), repeat('b', 64));

select plan(18);

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

select ok(
  position(
    'ON CONFLICT (key_hash) DO NOTHING'
    in pg_get_functiondef('public.consume_public_review_rate_limit(text,integer,integer)'::regprocedure)
  ) > 0,
  'first-hit initialization uses an atomic primary-key conflict path'
);

select throws_ok(
  'SELECT public.consume_public_review_rate_limit(repeat(''d'', 64), NULL, 900)',
  'P0001',
  'invalid_rate_limit_parameters',
  'a NULL request limit is rejected instead of disabling quota enforcement'
);

select throws_ok(
  'SELECT public.consume_public_review_rate_limit(repeat(''c'', 64), 1, NULL)',
  'P0001',
  'invalid_rate_limit_parameters',
  'a NULL rate-limit window is rejected'
);

select throws_ok(
  'SELECT public.consume_public_review_rate_limit(repeat(''b'', 64), 1, 86401)',
  'P0001',
  'invalid_rate_limit_parameters',
  'rate-limit windows longer than one day are rejected'
);

select ok(
  public.consume_public_review_rate_limit(repeat('e', 64), 1, 900),
  'the first request for a new key is accepted'
);

select ok(
  not public.consume_public_review_rate_limit(repeat('e', 64), 1, 900),
  'a subsequent request observes and enforces the existing limit'
);

select ok(
  (
    select count(*) filter (where allowed) = 100
    from (
      select public.consume_public_review_rate_limit(repeat('f', 64), 100, 900) as allowed
      from generate_series(1, 100)
    ) hits
  )
  and not public.consume_public_review_rate_limit(repeat('f', 64), 100, 900),
  'the global IP bucket allows 100 hits and rejects the 101st within one window'
);

select ok(
  public.consume_public_review_rate_limit(repeat('a', 64), 5, 900),
  'a separate establishment-scoped bucket remains available alongside the global bucket'
);

select * from finish();
rollback;
