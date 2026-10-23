-- The current employee scanner writes through session-bound RPCs.
-- A scanner token identifies an establishment; it is not proof of employee identity.
-- Keep the public scanner context and raffle claim-code flows, but do not allow
-- browser roles to mutate loyalty balances directly through legacy scanner RPCs.

REVOKE EXECUTE ON FUNCTION public.add_loyalty_points_by_scanner(uuid, uuid, numeric, text, text)
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.add_loyalty_stamp_by_scanner(uuid, uuid)
  FROM PUBLIC, anon, authenticated;
