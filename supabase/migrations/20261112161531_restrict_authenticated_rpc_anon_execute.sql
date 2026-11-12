-- Restrict authenticated-only business RPCs from anonymous callers.
-- These functions either require auth.uid() or enforce a signed-in platform/staff role.
-- Public token-based card/scanner RPCs are intentionally left unchanged.

REVOKE ALL ON FUNCTION public.add_loyalty_points(uuid, uuid, numeric, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_loyalty_points(uuid, uuid, numeric, text, text, text)
  TO authenticated;

REVOKE ALL ON FUNCTION public.create_birthday_reward(uuid, uuid, text, text, integer, numeric)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_birthday_reward(uuid, uuid, text, text, integer, numeric)
  TO authenticated;

REVOKE ALL ON FUNCTION public.get_loyalty_program_settings(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_loyalty_program_settings(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.redeem_loyalty_raffle_winner(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_raffle_winner(uuid)
  TO authenticated;

REVOKE ALL ON FUNCTION public.save_loyalty_card_design(
  uuid, text, text, text, text, text, text, integer, jsonb, boolean
) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_loyalty_card_design(
  uuid, text, text, text, text, text, text, integer, jsonb, boolean
) TO authenticated;
