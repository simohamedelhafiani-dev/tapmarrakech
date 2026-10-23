begin;

select plan(7);

select ok(
  not has_function_privilege('anon', 'public.add_loyalty_points_by_scanner(uuid,uuid,numeric,text,text)', 'EXECUTE'),
  'anonymous clients cannot directly award points with a scanner link'
);
select ok(
  not has_function_privilege('authenticated', 'public.add_loyalty_points_by_scanner(uuid,uuid,numeric,text,text)', 'EXECUTE'),
  'authenticated clients cannot bypass the employee session with the legacy points RPC'
);
select ok(
  not has_function_privilege('anon', 'public.add_loyalty_stamp_by_scanner(uuid,uuid)', 'EXECUTE'),
  'anonymous clients cannot directly award stamps with a scanner link'
);
select ok(
  not has_function_privilege('authenticated', 'public.add_loyalty_stamp_by_scanner(uuid,uuid)', 'EXECUTE'),
  'authenticated clients cannot bypass the employee session with the legacy stamp RPC'
);

-- These public entry points are intentionally preserved for existing scanner/raffle
-- screens; they validate scanner and claim tokens but do not award loyalty points.
select ok(
  has_function_privilege('anon', 'public.get_public_scanner_context(uuid)', 'EXECUTE'),
  'the public scanner can still load its establishment context'
);
select ok(
  has_function_privilege('anon', 'public.get_public_loyalty_raffle_winner_by_code(uuid,uuid)', 'EXECUTE'),
  'the employee scanner can still look up a raffle prize claim code'
);
select ok(
  has_function_privilege('anon', 'public.redeem_public_loyalty_raffle_winner_by_code(uuid,uuid)', 'EXECUTE'),
  'the employee scanner can still redeem a validated raffle prize claim code'
);

select * from finish();
rollback;
