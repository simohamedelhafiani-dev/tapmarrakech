begin;

select plan(9);

-- The public scanner link is a bearer credential by design for the existing
-- point/stamp scanner screen. Keep this RPC reachable, but verify its code stays
-- bound to the scanner token's establishment and only that establishment's customer.
select ok(
  has_function_privilege('anon', 'public.add_loyalty_points_by_scanner(uuid,uuid,numeric,text,text)', 'EXECUTE'),
  'public scanner can continue awarding points through its established flow'
);
select ok(
  position('access_token=p_scanner_token' in regexp_replace(
    lower(pg_get_functiondef('public.add_loyalty_points_by_scanner(uuid,uuid,numeric,text,text)'::regprocedure)),
    '\s+', '', 'g'
  )) > 0,
  'points RPC validates its scanner token against the stored scanner link'
);
select ok(
  position('c.establishment_id = v_establishment_id' in lower(
    pg_get_functiondef('public.add_loyalty_points_by_scanner(uuid,uuid,numeric,text,text)'::regprocedure)
  )) > 0,
  'points RPC only updates a customer belonging to the scanner establishment'
);

select ok(
  has_function_privilege('anon', 'public.add_loyalty_stamp_by_scanner(uuid,uuid)', 'EXECUTE'),
  'public scanner can continue awarding stamps through its established flow'
);
select ok(
  position('access_token=p_scanner_token' in regexp_replace(
    lower(pg_get_functiondef('public.add_loyalty_stamp_by_scanner(uuid,uuid)'::regprocedure)),
    '\s+', '', 'g'
  )) > 0,
  'stamp RPC validates its scanner token against the stored scanner link'
);
select ok(
  position('c.establishment_id=v_establishment' in regexp_replace(
    lower(pg_get_functiondef('public.add_loyalty_stamp_by_scanner(uuid,uuid)'::regprocedure)),
    '\s+', '', 'g'
  )) > 0,
  'stamp RPC only updates a customer belonging to the scanner establishment'
);

select ok(
  has_function_privilege('anon', 'public.get_public_scanner_context(uuid)', 'EXECUTE'),
  'public scanner can still load its establishment context'
);
select ok(
  has_function_privilege('anon', 'public.get_public_loyalty_raffle_winner_by_code(uuid,uuid)', 'EXECUTE'),
  'scanner can still look up a raffle prize claim code'
);
select ok(
  has_function_privilege('anon', 'public.redeem_public_loyalty_raffle_winner_by_code(uuid,uuid)', 'EXECUTE'),
  'scanner can still redeem a validated raffle prize claim code'
);

select * from finish();
rollback;
