-- Defense in depth for reward configuration. RPCs already validate most fields;
-- these constraints prevent unsafe values through any future server-side path.
alter table public.loyalty_rewards
  add constraint loyalty_rewards_discount_max_nonnegative
  check (discount_max_amount is null or discount_max_amount >= 0),
  add constraint loyalty_rewards_points_reasonable
  check (points_required between 1 and 2147483647);
