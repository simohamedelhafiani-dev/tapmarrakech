begin;

select plan(6);

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
  not has_table_privilege('anon', 'public.public_review_rate_limits', 'SELECT')
  and not has_table_privilege('authenticated', 'public.public_review_rate_limits', 'SELECT')
  and not has_table_privilege('anon', 'public.public_review_rate_limits', 'UPDATE')
  and not has_table_privilege('authenticated', 'public.public_review_rate_limits', 'UPDATE'),
  'browser roles cannot read or alter stored review rate-limit state'
);

select * from finish();
rollback;
