-- Restore the public stamp scanner RPC used by the existing /employee scanner route.
-- Its scanner UUID is a bearer credential: the function must look up the establishment
-- from that token and constrain every customer write to that establishment. Keep the
-- behavior consistent with production while ensuring clean database resets recreate it.

CREATE OR REPLACE FUNCTION public.add_loyalty_stamp_by_scanner(
  p_scanner_token uuid,
  p_customer_id uuid
)
RETURNS TABLE(
  stamps_balance integer,
  stamps_total integer,
  reward_ready boolean,
  reward_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_establishment uuid;
  v_goal integer;
  v_name text;
  v_description text;
  v_balance integer;
  v_total integer;
BEGIN
  SELECT establishment_id
    INTO v_establishment
  FROM public.establishment_scanner_links
  WHERE access_token = p_scanner_token
  LIMIT 1;

  IF v_establishment IS NULL THEN
    RAISE EXCEPTION 'Scanner invalide';
  END IF;

  SELECT stamp_goal, stamp_reward_name, stamp_reward_description
    INTO v_goal, v_name, v_description
  FROM public.loyalty_settings
  WHERE establishment_id = v_establishment
    AND program_type = 'STAMP'
    AND enabled = true
  LIMIT 1;

  IF v_goal IS NULL THEN
    RAISE EXCEPTION 'Le programme à tampons n’est pas activé';
  END IF;

  UPDATE public.loyalty_customers AS c
  SET stamps_balance = c.stamps_balance + 1,
      stamps_total = c.stamps_total + 1,
      visit_count = c.visit_count + 1,
      last_visit_at = now(),
      updated_at = now()
  WHERE c.id = p_customer_id
    AND c.establishment_id = v_establishment
  RETURNING c.stamps_balance, c.stamps_total
    INTO v_balance, v_total;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable';
  END IF;

  INSERT INTO public.loyalty_transactions(
    establishment_id, customer_id, amount, points, type, description
  )
  VALUES (
    v_establishment, p_customer_id, 0, 0, 'EARN', 'Tampon fidélité ajouté'
  );

  PERFORM public.complete_pending_loyalty_referral(p_customer_id);
  RETURN QUERY SELECT v_balance, v_total, v_balance >= v_goal, v_name;
END;
$function$;

REVOKE ALL ON FUNCTION public.add_loyalty_stamp_by_scanner(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.add_loyalty_stamp_by_scanner(uuid, uuid)
  TO anon, authenticated, service_role;
