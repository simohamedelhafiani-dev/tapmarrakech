-- KELYANI: fail-safe, idempotent raffle drawing with a cryptographically secure pool selection.
-- Scheduler calls the internal worker without an end-user JWT. Manual reruns use a
-- separate authenticated RPC that verifies establishment responsibility.

create extension if not exists pgcrypto with schema extensions;

alter table public.loyalty_raffles
  add column if not exists last_draw_fallback_stage text,
  add column if not exists last_draw_note text,
  add column if not exists last_draw_attempt_at timestamptz;

create table if not exists public.loyalty_raffle_draw_audit (
  id uuid primary key default gen_random_uuid(),
  raffle_id uuid not null references public.loyalty_raffles(id) on delete cascade,
  attempted_at timestamptz not null default now(),
  trigger_source text not null check (trigger_source in ('SCHEDULER','MANUAL')),
  fallback_stage text not null check (fallback_stage in ('NORMAL_POOL','EXPANDED_POOL','EXTENDED_7_DAYS','EXISTING_WINNERS')),
  candidate_count integer not null default 0 check (candidate_count >= 0),
  winner_count integer not null default 0 check (winner_count >= 0),
  scheduled_for timestamptz,
  triggered_by uuid references auth.users(id) on delete set null,
  note text not null
);

create index if not exists loyalty_raffle_draw_audit_raffle_attempt_idx
  on public.loyalty_raffle_draw_audit (raffle_id, attempted_at desc);

alter table public.loyalty_raffle_draw_audit enable row level security;
revoke all on public.loyalty_raffle_draw_audit from public, anon, authenticated;

-- Pure decision helper shared by the worker and pgTAP regression tests.
create or replace function public.resolve_loyalty_raffle_draw_pool(p_eligible_count integer, p_enrolled_count integer, p_winners_count integer)
returns table(fallback_stage text, candidate_count integer, winners_to_select integer, note text)
language plpgsql immutable set search_path = '' as $function$
begin
  if p_eligible_count is null or p_enrolled_count is null or p_winners_count is null or p_eligible_count < 0 or p_enrolled_count < 0 or p_winners_count < 1 then raise exception 'invalid_draw_pool_counts'; end if;
  if p_eligible_count > 0 then
    return query select 'NORMAL_POOL'::text, p_eligible_count, least(p_eligible_count, p_winners_count), case when p_eligible_count < p_winners_count then format('Pool de %s client(s) pour %s gagnant(s) prévu(s) : tous les participants sont gagnants.', p_eligible_count, p_winners_count) else format('Tirage normal parmi %s client(s) éligible(s).', p_eligible_count) end;
  elsif p_enrolled_count > 0 then
    return query select 'EXPANDED_POOL'::text, p_enrolled_count, least(p_enrolled_count, p_winners_count), case when p_enrolled_count < p_winners_count then format('Aucun participant éligible. Les %s client(s) inscrits sont tous gagnants.', p_enrolled_count) else format('Aucun participant éligible au niveau requis. Pool élargi à %s client(s).', p_enrolled_count) end;
  else
    return query select 'EXTENDED_7_DAYS'::text, 0, 0, 'Aucun client inscrit au programme de fidélité. Le tirage reste ouvert et a été reporté de 7 jours. Le responsable doit vérifier les inscriptions.'::text;
  end if;
end; $function$;
revoke all on function public.resolve_loyalty_raffle_draw_pool(integer, integer, integer) from public, anon, authenticated;
grant execute on function public.resolve_loyalty_raffle_draw_pool(integer, integer, integer) to service_role;

create or replace function public.draw_loyalty_raffle_internal(
  p_raffle_id uuid,
  p_force boolean default false,
  p_trigger_source text default 'SCHEDULER',
  p_triggered_by uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_raffle public.loyalty_raffles%rowtype;
  v_pool_count integer := 0;
  v_enrolled_count integer := 0;
  v_winners_to_select integer := 0;
  v_decision record;
  v_winner_count integer := 0;
  v_stage text;
  v_note text;
  v_valid_from timestamptz;
  v_valid_until timestamptz;
  v_scheduled_for timestamptz;
begin
  if p_trigger_source not in ('SCHEDULER','MANUAL') then
    raise exception 'invalid_trigger_source';
  end if;

  select r.* into v_raffle
  from public.loyalty_raffles r
  where r.id = p_raffle_id
  for update;

  if not found then
    return 'NOT_FOUND';
  end if;

  if v_raffle.status <> 'SCHEDULED' then
    return 'NOT_SCHEDULED';
  end if;

  if not p_force and v_raffle.draw_at > clock_timestamp() then
    return 'NOT_DUE';
  end if;

  -- Repair old inconsistent rows safely: existing winners are preserved and no
  -- second winner set or duplicate winner notification is created.
  select count(*)::integer into v_winner_count
  from public.loyalty_raffle_winners w
  where w.raffle_id = v_raffle.id;

  if v_winner_count > 0 then
    v_stage := 'EXISTING_WINNERS';
    v_note := format('Des gagnants existent déjà (%s). Aucun nouveau tirage n’a été créé.', v_winner_count);

    update public.loyalty_raffles
    set status = 'DRAWN',
        drawn_at = coalesce(drawn_at, clock_timestamp()),
        last_draw_fallback_stage = v_stage,
        last_draw_note = v_note,
        last_draw_attempt_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where id = v_raffle.id;

    insert into public.loyalty_raffle_draw_audit(
      raffle_id, trigger_source, fallback_stage, candidate_count,
      winner_count, scheduled_for, triggered_by, note
    ) values (
      v_raffle.id, p_trigger_source, v_stage, 0, v_winner_count,
      v_raffle.draw_at, p_triggered_by, v_note
    );

    return v_stage;
  end if;

  -- Default tiers are seeded here because the cron worker has no auth.uid().
  insert into public.loyalty_tiers(
    establishment_id, tier_key, name, sort_order,
    min_total_points, min_rewards_redeemed, qualification_mode, ticket_multiplier
  )
  values
    (v_raffle.establishment_id, 'STANDARD', 'Standard', 0, 0, 0, 'OR', 1),
    (v_raffle.establishment_id, 'BRONZE', 'Bronze', 1, 250, 1, 'OR', 2),
    (v_raffle.establishment_id, 'SILVER', 'Silver', 2, 750, 3, 'OR', 3),
    (v_raffle.establishment_id, 'GOLD', 'Gold', 3, 1500, 5, 'OR', 5),
    (v_raffle.establishment_id, 'PLATINUM', 'Platinum', 4, 3000, 8, 'OR', 10)
  on conflict (establishment_id, tier_key) do nothing;

  -- Rebuild the generated entry pool only while no winners exist. Entries are
  -- generated at draw time from enrolled customers; they are not customer-owned tickets.
  delete from public.loyalty_raffle_entries e where e.raffle_id = v_raffle.id;

  insert into public.loyalty_raffle_entries(raffle_id, customer_id, tickets)
  select v_raffle.id, c.id,
    case when v_raffle.ticket_multiplier_mode = 'TIER'
      then greatest(1, coalesce(t.ticket_multiplier, 1))
      else 1
    end
  from public.loyalty_customers c
  join lateral public.get_loyalty_customer_tier(c.id) t on true
  join public.loyalty_tiers eligible
    on eligible.establishment_id = v_raffle.establishment_id
   and eligible.tier_key = v_raffle.minimum_tier_key
   and eligible.active = true
  where c.establishment_id = v_raffle.establishment_id
    and c.created_at <= clock_timestamp()
    and t.sort_order >= eligible.sort_order
  on conflict (raffle_id, customer_id) do update set tickets = excluded.tickets;

  select count(*)::integer into v_pool_count
  from public.loyalty_raffle_entries e
  where e.raffle_id = v_raffle.id;

  if v_pool_count > 0 then
    v_stage := 'NORMAL_POOL';
  else
    -- Fallback: all enrolled customers at this establishment, one ticket each.
    insert into public.loyalty_raffle_entries(raffle_id, customer_id, tickets)
    select v_raffle.id, c.id, 1
    from public.loyalty_customers c
    where c.establishment_id = v_raffle.establishment_id
      and c.created_at <= clock_timestamp()
    on conflict (raffle_id, customer_id) do nothing;

    select count(*)::integer into v_pool_count
    from public.loyalty_raffle_entries e
    where e.raffle_id = v_raffle.id;

    if v_pool_count > 0 then
      v_stage := 'EXPANDED_POOL';
    else
      v_stage := 'EXTENDED_7_DAYS';
      v_scheduled_for := greatest(clock_timestamp(), v_raffle.starts_at + interval '1 second') + interval '7 days';
      v_note := 'Aucun client inscrit au programme de fidélité. Le tirage reste ouvert et a été reporté de 7 jours. Le responsable doit vérifier les inscriptions.';

      update public.loyalty_raffles
      set status = 'SCHEDULED',
          draw_at = v_scheduled_for,
          drawn_at = null,
          last_draw_fallback_stage = v_stage,
          last_draw_note = v_note,
          last_draw_attempt_at = clock_timestamp(),
          updated_at = clock_timestamp()
      where id = v_raffle.id;

      insert into public.loyalty_raffle_draw_audit(
        raffle_id, trigger_source, fallback_stage, candidate_count,
        winner_count, scheduled_for, triggered_by, note
      ) values (
        v_raffle.id, p_trigger_source, v_stage, 0, 0,
        v_scheduled_for, p_triggered_by, v_note
      );

      return v_stage;
    end if;
  end if;

  if v_raffle.reward_validity_mode = 'DAYS_AFTER_DRAW' then
    v_valid_from := clock_timestamp();
    v_valid_until := v_valid_from + make_interval(days => v_raffle.reward_valid_days);
  else
    v_valid_from := v_raffle.reward_valid_from;
    v_valid_until := v_raffle.reward_valid_until;
  end if;

  -- One CSPRNG sample per candidate. 56 random bits are taken from pgcrypto;
  -- exponential-race ranking gives weighted sampling without replacement.
  -- The materialized score is computed once and reused for rank + selection.
  with scored_entries as materialized (
    select
      e.customer_id,
      -ln(
        (
          (('x' || encode(extensions.gen_random_bytes(7), 'hex'))::bit(56)::bigint)::numeric + 1
        ) / 72057594037927937::numeric
      )::double precision / greatest(e.tickets, 1) as draw_key
    from public.loyalty_raffle_entries e
    where e.raffle_id = v_raffle.id
  ),
  ranked_entries as materialized (
    select
      customer_id,
      row_number() over (order by draw_key, customer_id) as winner_rank
    from scored_entries
  ),
  inserted_winners as (
    insert into public.loyalty_raffle_winners(
      raffle_id, customer_id, rank, prize_name, prize_description,
      valid_from, valid_until, reservation_required, single_use, non_cumulative
    )
    select
      v_raffle.id, ranked.customer_id, ranked.winner_rank,
      v_raffle.prize_name, v_raffle.prize_description,
      v_valid_from, v_valid_until, v_raffle.reservation_required,
      v_raffle.single_use, v_raffle.non_cumulative
    from ranked_entries ranked
    where ranked.winner_rank <= least(v_raffle.winners_count, v_pool_count)
    on conflict (raffle_id, customer_id) do nothing
    returning customer_id, prize_name, valid_from, valid_until, reservation_required
  )
  insert into public.loyalty_card_notifications(
    establishment_id, customer_id, title, message, type, expires_at
  )
  select
    v_raffle.establishment_id, winner.customer_id,
    '🎉 Félicitations, vous avez gagné !',
    'Vous avez gagné « ' || winner.prize_name || ' ». Votre récompense est valable du '
      || to_char(winner.valid_from, 'DD/MM/YYYY') || ' au '
      || to_char(winner.valid_until, 'DD/MM/YYYY')
      || case when winner.reservation_required then '. Réservation obligatoire.' else '.' end,
    'REWARD', winner.valid_until
  from inserted_winners winner;

  select count(*)::integer into v_winner_count
  from public.loyalty_raffle_winners w
  where w.raffle_id = v_raffle.id;

  if v_winner_count = 0 then
    -- Defensive invariant: never mark a raffle DRAWN if no winner was persisted.
    v_stage := 'EXTENDED_7_DAYS';
    v_scheduled_for := greatest(clock_timestamp(), v_raffle.starts_at + interval '1 second') + interval '7 days';
    v_note := 'Le tirage n’a enregistré aucun gagnant. La tombola reste ouverte et a été reportée de 7 jours.';

    update public.loyalty_raffles
    set status = 'SCHEDULED',
        draw_at = v_scheduled_for,
        drawn_at = null,
        last_draw_fallback_stage = v_stage,
        last_draw_note = v_note,
        last_draw_attempt_at = clock_timestamp(),
        updated_at = clock_timestamp()
    where id = v_raffle.id;

    insert into public.loyalty_raffle_draw_audit(
      raffle_id, trigger_source, fallback_stage, candidate_count,
      winner_count, scheduled_for, triggered_by, note
    ) values (
      v_raffle.id, p_trigger_source, v_stage, v_pool_count, 0,
      v_scheduled_for, p_triggered_by, v_note
    );

    return v_stage;
  end if;

  update public.loyalty_raffle_winners
  set status = 'EXPIRED'
  where raffle_id = v_raffle.id and valid_until < clock_timestamp();

  if v_pool_count < v_raffle.winners_count then
    v_note := format(
      'Pool de %s client(s) pour %s gagnant(s) prévu(s) : tous les participants sont gagnants.',
      v_pool_count, v_raffle.winners_count
    );
  elsif v_stage = 'EXPANDED_POOL' then
    v_note := format('Aucun participant éligible au niveau requis. Tirage effectué dans le pool élargi de %s client(s).', v_pool_count);
  else
    v_note := format('Tirage terminé dans le pool normal : %s gagnant(s) enregistré(s).', v_winner_count);
  end if;

  update public.loyalty_raffles
  set status = 'DRAWN',
      drawn_at = clock_timestamp(),
      eligibility_snapshot_at = clock_timestamp(),
      last_draw_fallback_stage = v_stage,
      last_draw_note = v_note,
      last_draw_attempt_at = clock_timestamp(),
      updated_at = clock_timestamp()
  where id = v_raffle.id
    and status = 'SCHEDULED'
    and exists (
      select 1 from public.loyalty_raffle_winners w where w.raffle_id = v_raffle.id
    );

  insert into public.loyalty_raffle_draw_audit(
    raffle_id, trigger_source, fallback_stage, candidate_count,
    winner_count, scheduled_for, triggered_by, note
  ) values (
    v_raffle.id, p_trigger_source, v_stage, v_pool_count,
    v_winner_count, v_raffle.draw_at, p_triggered_by, v_note
  );

  return v_stage;
end;
$function$;

revoke all on function public.draw_loyalty_raffle_internal(uuid, boolean, text, uuid) from public, anon, authenticated;
grant execute on function public.draw_loyalty_raffle_internal(uuid, boolean, text, uuid) to service_role;

create or replace function public.process_due_loyalty_raffles()
returns integer
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_raffle record;
  v_result text;
  v_processed integer := 0;
begin
  for v_raffle in
    select r.id
    from public.loyalty_raffles r
    where r.status = 'SCHEDULED' and r.draw_at <= clock_timestamp()
    order by r.draw_at
    for update skip locked
  loop
    v_result := public.draw_loyalty_raffle_internal(v_raffle.id, false, 'SCHEDULER', null);
    if v_result in ('NORMAL_POOL','EXPANDED_POOL','EXTENDED_7_DAYS','EXISTING_WINNERS') then
      v_processed := v_processed + 1;
    end if;
  end loop;
  return v_processed;
end;
$function$;

revoke all on function public.process_due_loyalty_raffles() from public, anon, authenticated;
grant execute on function public.process_due_loyalty_raffles() to service_role;

create or replace function public.rerun_loyalty_raffle_draw(p_raffle_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_raffle public.loyalty_raffles%rowtype;
  v_result text;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select r.* into v_raffle
  from public.loyalty_raffles r
  where r.id = p_raffle_id
  for update;

  if not found then
    raise exception 'raffle_not_found';
  end if;

  if not (
    public.is_tapmarrakech_admin()
    or public.is_establishment_responsible(v_raffle.establishment_id)
  ) then
    raise exception 'not_authorized';
  end if;

  if v_raffle.status <> 'SCHEDULED' then
    raise exception 'raffle_not_scheduled';
  end if;

  if v_raffle.draw_at > clock_timestamp()
     and v_raffle.last_draw_fallback_stage is distinct from 'EXTENDED_7_DAYS' then
    raise exception 'raffle_not_due';
  end if;

  update public.loyalty_raffles
  set draw_at = greatest(clock_timestamp(), starts_at + interval '1 second'),
      updated_at = clock_timestamp()
  where id = v_raffle.id;

  v_result := public.draw_loyalty_raffle_internal(
    v_raffle.id, true, 'MANUAL', auth.uid()
  );

  return v_result;
end;
$function$;

revoke all on function public.rerun_loyalty_raffle_draw(uuid) from public, anon;
grant execute on function public.rerun_loyalty_raffle_draw(uuid) to authenticated;

-- get_loyalty_raffles changes its return shape; drop before recreating.
drop function if exists public.get_loyalty_raffles(uuid);

create function public.get_loyalty_raffles(p_establishment_id uuid)
returns table(
  id uuid, title text, description text, prize_name text, prize_description text,
  starts_at timestamptz, draw_at timestamptz, winners_count integer,
  participation_mode text, reward_validity_mode text, reward_valid_from timestamptz,
  reward_valid_until timestamptz, reward_valid_days integer, reservation_required boolean,
  single_use boolean, non_cumulative boolean, status text, drawn_at timestamptz,
  participant_count bigint, winner_count bigint, minimum_tier_key text,
  ticket_multiplier_mode text, last_draw_fallback_stage text, last_draw_note text,
  last_draw_attempt_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin
  if auth.uid() is null
     or not public.user_has_establishment_access(p_establishment_id) then
    raise exception 'not_authorized';
  end if;

  return query
  select
    r.id, r.title, r.description, r.prize_name, r.prize_description,
    r.starts_at, r.draw_at, r.winners_count, r.participation_mode,
    r.reward_validity_mode, r.reward_valid_from, r.reward_valid_until,
    r.reward_valid_days, r.reservation_required, r.single_use, r.non_cumulative,
    r.status, r.drawn_at,
    (select count(*) from public.loyalty_raffle_entries e where e.raffle_id = r.id),
    (select count(*) from public.loyalty_raffle_winners w where w.raffle_id = r.id),
    r.minimum_tier_key, r.ticket_multiplier_mode, r.last_draw_fallback_stage,
    r.last_draw_note, r.last_draw_attempt_at
  from public.loyalty_raffles r
  where r.establishment_id = p_establishment_id
  order by r.draw_at desc;
end;
$function$;

revoke all on function public.get_loyalty_raffles(uuid) from public, anon;
grant execute on function public.get_loyalty_raffles(uuid) to authenticated;

create or replace function public.get_loyalty_raffle_draw_audit(p_raffle_id uuid)
returns table(
  attempted_at timestamptz, trigger_source text, fallback_stage text,
  candidate_count integer, winner_count integer, scheduled_for timestamptz,
  note text
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_establishment_id uuid;
begin
  if auth.uid() is null then
    raise exception 'authentication_required';
  end if;

  select r.establishment_id into v_establishment_id
  from public.loyalty_raffles r
  where r.id = p_raffle_id;

  if v_establishment_id is null
     or not (
       public.is_tapmarrakech_admin()
       or public.is_establishment_responsible(v_establishment_id)
     ) then
    raise exception 'not_authorized';
  end if;

  return query
  select a.attempted_at, a.trigger_source, a.fallback_stage,
         a.candidate_count, a.winner_count, a.scheduled_for, a.note
  from public.loyalty_raffle_draw_audit a
  where a.raffle_id = p_raffle_id
  order by a.attempted_at desc
  limit 20;
end;
$function$;

revoke all on function public.get_loyalty_raffle_draw_audit(uuid) from public, anon;
grant execute on function public.get_loyalty_raffle_draw_audit(uuid) to authenticated;
