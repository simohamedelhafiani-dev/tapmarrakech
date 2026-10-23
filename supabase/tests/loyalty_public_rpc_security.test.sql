begin;

select plan(8);

-- Public review links must never award loyalty points through the legacy claim RPC.
select ok(
  not has_function_privilege('anon', 'public.claim_public_loyalty_review_bonus(text,text)', 'EXECUTE'),
  'anonymous callers cannot execute the legacy text-token public-review bonus RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_public_loyalty_review_bonus(text,text)', 'EXECUTE'),
  'authenticated callers cannot execute the legacy text-token public-review bonus RPC'
);
select ok(
  not has_function_privilege('anon', 'public.claim_public_loyalty_review_bonus(uuid,text)', 'EXECUTE'),
  'anonymous callers cannot execute the UUID-token public-review bonus RPC'
);
select ok(
  not has_function_privilege('authenticated', 'public.claim_public_loyalty_review_bonus(uuid,text)', 'EXECUTE'),
  'authenticated callers cannot execute the UUID-token public-review bonus RPC'
);

-- The private satisfaction questionnaire remains the supported token-based bonus path.
select ok(
  has_function_privilege('anon', 'public.submit_public_loyalty_feedback(uuid,integer,text)', 'EXECUTE'),
  'public loyalty cards can still submit private satisfaction feedback'
);
select ok(
  position('feedback_bonus_points' in lower(pg_get_functiondef('public.submit_public_loyalty_feedback(uuid,integer,text)'::regprocedure))) > 0,
  'satisfaction feedback reads the establishment-configured bonus amount'
);
select ok(
  position('if exists (' in lower(pg_get_functiondef('public.submit_public_loyalty_feedback(uuid,integer,text)'::regprocedure))) > 0
  and position('return query select true, 0' in lower(pg_get_functiondef('public.submit_public_loyalty_feedback(uuid,integer,text)'::regprocedure))) > 0,
  'repeat submissions cannot grant a second satisfaction bonus'
);

-- A public card can view its own information only through its high-entropy access token.
select ok(
  has_function_privilege('anon', 'public.get_public_loyalty_card(uuid)', 'EXECUTE')
  and position('l.access_token = p_access_token' in lower(pg_get_functiondef('public.get_public_loyalty_card(uuid)'::regprocedure))) > 0,
  'public card lookup remains available and is scoped by the card access token'
);

select * from finish();
rollback;
