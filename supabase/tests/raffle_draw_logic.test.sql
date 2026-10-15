begin;

select plan(17);

-- 1. No eligible customers and no enrolled customers: never produce a winner.
select is(
  (select fallback_stage from public.resolve_loyalty_raffle_draw_pool(0, 0, 5)),
  'EXTENDED_7_DAYS',
  'zero participants leaves the raffle open for a seven-day extension'
);
select is(
  (select winners_to_select from public.resolve_loyalty_raffle_draw_pool(0, 0, 5)),
  0,
  'zero participants never fabricates a winner'
);

-- 2. No eligible participants, but enrolled customers exist: expand the pool.
select is(
  (select fallback_stage from public.resolve_loyalty_raffle_draw_pool(0, 4, 2)),
  'EXPANDED_POOL',
  'zero eligible but enrolled customers triggers expanded pool'
);
select is(
  (select winners_to_select from public.resolve_loyalty_raffle_draw_pool(0, 4, 2)),
  2,
  'expanded pool draws no more than the configured winner count'
);

-- 3. Fewer participants than planned winners: all participants win.
select is(
  (select winners_to_select from public.resolve_loyalty_raffle_draw_pool(2, 2, 5)),
  2,
  'fewer participants than winners means every participant wins'
);
select like(
  (select note from public.resolve_loyalty_raffle_draw_pool(2, 2, 5)),
  '%tous les participants sont gagnants%',
  'small pool outcome is clearly recorded'
);

-- 4. Normal pool keeps the configured winner limit.
select is(
  (select fallback_stage from public.resolve_loyalty_raffle_draw_pool(10, 10, 3)),
  'NORMAL_POOL',
  'normal eligible pool is preferred'
);
select is(
  (select winners_to_select from public.resolve_loyalty_raffle_draw_pool(10, 10, 3)),
  3,
  'normal draw respects winners_count'
);

-- 5. Idempotency: row locking, status guard, and unique raffle/customer winners.
select ok(
  position('for update skip locked' in lower(pg_get_functiondef('public.process_due_loyalty_raffles()'::regprocedure))) > 0
  and position('status <> ''SCHEDULED''' in pg_get_functiondef('public.draw_loyalty_raffle_internal(uuid,boolean,text,uuid)'::regprocedure)) > 0
  and position('v_winner_count > 0' in pg_get_functiondef('public.draw_loyalty_raffle_internal(uuid,boolean,text,uuid)'::regprocedure)) > 0,
  'scheduler locking and existing-winner guard prevent a second winner series'
);
select ok(
  exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.loyalty_raffle_winners'::regclass
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) = 'UNIQUE (raffle_id, customer_id)'
  ),
  'database uniqueness enforces one winner row per customer per raffle'
);

-- Integration fixture: a due raffle with no enrolled customers must be extended,
-- and a second scheduler invocation must not create another audit attempt or winner set.
create temporary table raffle_draw_test_fixture (
  user_id uuid not null,
  establishment_id uuid not null,
  raffle_id uuid not null
) on commit drop;

insert into raffle_draw_test_fixture values (gen_random_uuid(), gen_random_uuid(), gen_random_uuid());

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select user_id, 'authenticated', 'authenticated',
       replace(user_id::text, '-', '') || '@raffle-test.invalid', '',
       now(), '{}'::jsonb, '{}'::jsonb, now(), now()
from raffle_draw_test_fixture;

insert into public.establishments (id, user_id, name, slug)
select establishment_id, user_id, 'Raffle draw test', 'raffle-test-' || replace(establishment_id::text, '-', '')
from raffle_draw_test_fixture;

insert into public.loyalty_raffles (
  id, establishment_id, title, prize_name, starts_at, draw_at,
  winners_count, reward_validity_mode, reward_valid_days, status
)
select raffle_id, establishment_id, 'Empty pool test', 'Test prize',
       now() - interval '2 hours', now() - interval '1 minute',
       3, 'DAYS_AFTER_DRAW', 7, 'SCHEDULED'
from raffle_draw_test_fixture;

select is(
  public.process_due_loyalty_raffles(),
  1,
  'scheduler processes a due empty raffle and records the extension'
);
select is(
  (select r.status from public.loyalty_raffles r join raffle_draw_test_fixture f on f.raffle_id = r.id),
  'SCHEDULED',
  'empty raffle is not marked DRAWN'
);
select is(
  (select count(*)::integer from public.loyalty_raffle_winners w join raffle_draw_test_fixture f on f.raffle_id = w.raffle_id),
  0,
  'empty raffle has no fabricated winners'
);
select ok(
  (select r.last_draw_fallback_stage = 'EXTENDED_7_DAYS'
          and r.draw_at >= now() + interval '6 days 23 hours'
          and (select count(*) from public.loyalty_raffle_draw_audit a where a.raffle_id = r.id) = 1
   from public.loyalty_raffles r join raffle_draw_test_fixture f on f.raffle_id = r.id),
  'empty raffle is postponed seven days and has one audit record'
);
select is(
  public.process_due_loyalty_raffles(),
  0,
  'second scheduler invocation does not process the postponed raffle again'
);
select ok(
  (select (select count(*) from public.loyalty_raffle_winners w where w.raffle_id = r.id) = 0
          and (select count(*) from public.loyalty_raffle_draw_audit a where a.raffle_id = r.id) = 1
   from public.loyalty_raffles r join raffle_draw_test_fixture f on f.raffle_id = r.id),
  'double scheduler invocation creates neither winners nor duplicate audit rows'
);

-- SECURITY DEFINER and execution privileges are part of the release gate.
select ok(
  (select p.prosecdef and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
   from pg_proc p where p.oid = 'public.process_due_loyalty_raffles()'::regprocedure),
  'scheduler worker is SECURITY DEFINER with a fixed search_path'
);
select ok(
  not has_function_privilege('anon', 'public.process_due_loyalty_raffles()', 'EXECUTE')
  and not has_function_privilege('authenticated', 'public.process_due_loyalty_raffles()', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.rerun_loyalty_raffle_draw(uuid)', 'EXECUTE'),
  'scheduler is not callable by public users; manual rerun RPC is authenticated-only'
);

select * from finish();
rollback();
