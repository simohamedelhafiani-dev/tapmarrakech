begin;

select plan(18);

-- Public loyalty-card RPCs are token-scoped capabilities used by the live card UI.
select ok(
  has_function_privilege('anon', 'public.get_public_loyalty_program_context(uuid)', 'EXECUTE'),
  'public loyalty cards can still load the active loyalty program'
);
select ok(
  has_function_privilege('anon', 'public.get_public_loyalty_rewards(uuid)', 'EXECUTE'),
  'public loyalty cards can still load their available rewards'
);
select ok(
  has_function_privilege('anon', 'public.get_public_loyalty_notifications(uuid,integer)', 'EXECUTE'),
  'public loyalty cards can still load notifications'
);
select ok(
  has_function_privilege('authenticated', 'public.get_loyalty_customer_link(uuid)', 'EXECUTE'),
  'authenticated staff can still retrieve a customer card link within their establishment scope'
);
select ok(
  has_function_privilege('anon', 'public.get_public_loyalty_discount_status(uuid)', 'EXECUTE'),
  'public loyalty cards can still load discount-card status'
);
select ok(
  has_function_privilege('anon', 'public.get_public_loyalty_raffles(uuid)', 'EXECUTE'),
  'public loyalty cards can still load eligible tombolas'
);

-- The public enrollment flow creates the card and immediately resolves its bearer URL.
select ok(
  has_function_privilege('anon', 'public.register_public_loyalty_customer_for_enrollment_v2(uuid,text,text,text,date,text,text[],boolean,boolean,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.register_public_loyalty_customer_for_enrollment_v2(uuid,text,text,text,date,text,text[],boolean,boolean,text,text)', 'EXECUTE'),
  'public loyalty enrollment remains anonymous-only through the intended v2 wrapper'
);
select ok(
  has_function_privilege('anon', 'public.register_public_loyalty_customer_for_enrollment_v3(uuid,text,text,text,date,text,text[],boolean,boolean,text,text)', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.register_public_loyalty_customer_for_enrollment_v3(uuid,text,text,text,date,text,text[],boolean,boolean,text,text)', 'EXECUTE')
  and pg_get_function_result('public.register_public_loyalty_customer_for_enrollment_v3(uuid,text,text,text,date,text,text[],boolean,boolean,text,text)'::regprocedure) = 'jsonb'
  and position('access_token' in lower(pg_get_functiondef('public.register_public_loyalty_customer_for_enrollment_v3(uuid,text,text,text,date,text,text[],boolean,boolean,text,text)'::regprocedure))) > 0
  and position('loyalty_number' in lower(pg_get_functiondef('public.register_public_loyalty_customer_for_enrollment_v3(uuid,text,text,text,date,text,text[],boolean,boolean,text,text)'::regprocedure))) > 0,
  'public enrollment returns only the new customer details and bearer link through the dedicated RPC'
);

-- The public claim flows must remain reachable through their narrow RPCs.
select ok(
  has_function_privilege('anon', 'public.create_public_loyalty_reward_claim(uuid,uuid)', 'EXECUTE'),
  'customers can still claim a configured loyalty reward'
);
select ok(
  has_function_privilege('anon', 'public.create_public_loyalty_stamp_reward_claim(uuid)', 'EXECUTE'),
  'customers can still claim a stamp-based reward'
);
select ok(
  has_function_privilege('anon', 'public.create_public_loyalty_promotion_claim(uuid,uuid)', 'EXECUTE'),
  'customers can still claim an eligible promotion'
);
select ok(
  has_function_privilege('anon', 'public.get_public_scanner_context(uuid)', 'EXECUTE'),
  'the existing stamp/points scanner can still load its token-scoped context'
);
select ok(
  has_function_privilege('anon', 'public.get_public_loyalty_raffle_winner_by_code(uuid,uuid)', 'EXECUTE'),
  'the scanner can still verify a tombola prize claim code'
);
select ok(
  has_function_privilege('anon', 'public.redeem_public_loyalty_raffle_winner_by_code(uuid,uuid)', 'EXECUTE'),
  'the scanner can still redeem a validated tombola prize claim'
);

-- Internal raffle processing must never become a public RPC.
select ok(
  not has_function_privilege('anon', 'public.process_due_loyalty_raffles()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.process_due_loyalty_raffles()', 'EXECUTE'),
  'the internal tombola worker is not directly callable by browser roles'
);

-- Core private/customer mutation tables stay behind RLS while the public UI uses RPCs.
select ok(
  (select relrowsecurity from pg_class where oid = 'public.loyalty_card_notifications'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.loyalty_push_subscriptions'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.loyalty_reward_claims'::regclass)
  and (select relrowsecurity from pg_class where oid = 'public.loyalty_stamp_reward_claims'::regclass),
  'notifications, push subscriptions and reward claims keep row-level security enabled'
);

select is(
  (select count(*)::integer
   from cron.job
   where jobname = 'kelyani-process-loyalty-raffles'
     and active = true
     and schedule = '* * * * *'),
  1,
  'exactly one active minute-based tombola scheduler remains installed'
);
select ok(
  position('process_due_loyalty_raffles()' in (
    select command from cron.job
    where jobname = 'kelyani-process-loyalty-raffles'
      and active = true
  )) > 0,
  'the scheduled tombola worker invokes the protected draw processor'
);

select * from finish();
rollback;
