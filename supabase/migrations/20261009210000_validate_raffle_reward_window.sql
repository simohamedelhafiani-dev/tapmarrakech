-- A raffle reward must still be usable after the draw completes.
-- DAYS_AFTER_DRAW derives its end from draw_at and is inherently future-valid.
create or replace function public.validate_loyalty_raffle_reward_window()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.reward_validity_mode in ('ONE_DAY', 'DATE_RANGE')
     and (new.reward_valid_until is null or new.reward_valid_until <= new.draw_at) then
    raise exception 'reward_must_be_valid_after_draw';
  end if;
  return new;
end;
$$;

drop trigger if exists loyalty_raffles_validate_reward_window on public.loyalty_raffles;
create trigger loyalty_raffles_validate_reward_window
before insert or update of draw_at, reward_validity_mode, reward_valid_until, reward_valid_days
on public.loyalty_raffles
for each row execute function public.validate_loyalty_raffle_reward_window();
