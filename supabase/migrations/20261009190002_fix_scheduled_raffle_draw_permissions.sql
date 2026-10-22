-- Scheduled draws run without an authenticated end-user JWT.
-- Do not call ensure_default_loyalty_tiers() from the scheduler: that management
-- helper intentionally requires an admin/responsible auth.uid(), so it would
-- abort every scheduled draw. Tiers are initialized when the raffle is created.
create or replace function public.process_due_loyalty_raffles()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  vf timestamptz;
  vu timestamptz;
  n integer := 0;
begin
  for r in
    select *
    from public.loyalty_raffles
    where status = 'SCHEDULED' and draw_at <= now()
    order by draw_at
    for update skip locked
  loop
    -- Backfill defaults for legacy scheduled raffles created before tier setup.
    -- Preserve any tiers already customized by the establishment.
    insert into public.loyalty_tiers(
      establishment_id, tier_key, name, sort_order,
      min_total_points, min_rewards_redeemed, qualification_mode, ticket_multiplier
    )
    values
      (r.establishment_id, 'STANDARD', 'Standard', 0, 0, 0, 'OR', 1),
      (r.establishment_id, 'BRONZE', 'Bronze', 1, 250, 1, 'OR', 2),
      (r.establishment_id, 'SILVER', 'Silver', 2, 750, 3, 'OR', 3),
      (r.establishment_id, 'GOLD', 'Gold', 3, 1500, 5, 'OR', 5),
      (r.establishment_id, 'PLATINUM', 'Platinum', 4, 3000, 8, 'OR', 10)
    on conflict do nothing;

    insert into public.loyalty_raffle_entries(raffle_id, customer_id, tickets)
    select r.id, c.id,
      case when r.ticket_multiplier_mode = 'TIER'
        then greatest(1, coalesce(t.ticket_multiplier, 1))
        else 1
      end
    from public.loyalty_customers c
    join lateral public.get_loyalty_customer_tier(c.id) t on true
    join public.loyalty_tiers eligible
      on eligible.establishment_id = c.establishment_id
     and eligible.tier_key = r.minimum_tier_key
     and eligible.active = true
    where c.establishment_id = r.establishment_id
      and c.created_at <= r.draw_at
      and t.sort_order >= eligible.sort_order
    on conflict (raffle_id, customer_id)
    do update set tickets = excluded.tickets;

    if r.reward_validity_mode = 'DAYS_AFTER_DRAW' then
      vf := r.draw_at;
      vu := r.draw_at + make_interval(days => r.reward_valid_days);
    else
      vf := r.reward_valid_from;
      vu := r.reward_valid_until;
    end if;

    with scored_entries as materialized (
      select
        e.customer_id,
        -ln(greatest(random(), 1e-12)) / greatest(e.tickets, 1) as draw_key
      from public.loyalty_raffle_entries e
      where e.raffle_id = r.id
    ),
    ranked_entries as (
      select
        customer_id,
        row_number() over (order by draw_key, customer_id) as winner_rank
      from scored_entries
    )
    insert into public.loyalty_raffle_winners(
      raffle_id, customer_id, rank, prize_name, prize_description,
      valid_from, valid_until, reservation_required, single_use, non_cumulative
    )
    select
      r.id, e.customer_id, e.winner_rank,
      r.prize_name, r.prize_description, vf, vu,
      r.reservation_required, r.single_use, r.non_cumulative
    from ranked_entries e
    where e.winner_rank <= r.winners_count
    on conflict (raffle_id, customer_id) do nothing;

    insert into public.loyalty_card_notifications(
      establishment_id, customer_id, title, message, type, expires_at
    )
    select
      r.establishment_id, w.customer_id,
      '🎉 Félicitations, vous avez gagné !',
      'Vous avez gagné « ' || w.prize_name || ' ». Votre récompense est valable du '
        || to_char(w.valid_from, 'DD/MM/YYYY') || ' au '
        || to_char(w.valid_until, 'DD/MM/YYYY')
        || case when w.reservation_required then '. Réservation obligatoire.' else '.' end,
      'REWARD', w.valid_until
    from public.loyalty_raffle_winners w
    where w.raffle_id = r.id;

    update public.loyalty_raffle_winners
    set status = 'EXPIRED'
    where raffle_id = r.id and valid_until < now();

    update public.loyalty_raffles
    set status = 'DRAWN',
        drawn_at = now(),
        eligibility_snapshot_at = now(),
        updated_at = now()
    where id = r.id;

    n := n + 1;
  end loop;
  return n;
end;
$$;
