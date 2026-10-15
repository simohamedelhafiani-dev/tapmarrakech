begin;

select plan(11);

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
