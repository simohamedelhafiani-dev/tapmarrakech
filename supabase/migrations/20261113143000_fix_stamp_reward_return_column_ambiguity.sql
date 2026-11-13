-- Fix PL/pgSQL output-column ambiguity in public stamp reward redemption.
CREATE OR REPLACE FUNCTION public.redeem_public_loyalty_stamp_reward_claim(
  p_scanner_token uuid,
  p_claim_token uuid
)
RETURNS TABLE(new_stamps_balance integer, reward_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_establishment uuid;
  v_customer uuid;
  v_goal integer;
  v_name text;
  v_current_stamps integer;
  v_new integer;
BEGIN
  SELECT s.establishment_id
    INTO v_establishment
  FROM public.establishment_scanner_links AS s
  WHERE s.access_token = p_scanner_token
  LIMIT 1;

  IF v_establishment IS NULL THEN
    RAISE EXCEPTION 'Scanner invalide';
  END IF;

  SELECT claim.customer_id, claim.reward_name, claim.stamps_required
    INTO v_customer, v_name, v_goal
  FROM public.loyalty_stamp_reward_claims AS claim
  WHERE claim.claim_token = p_claim_token
    AND claim.establishment_id = v_establishment
    AND claim.status = 'PENDING'
    AND claim.expires_at > now()
  FOR UPDATE;

  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'QR cadeau invalide, expiré ou déjà utilisé';
  END IF;

  SELECT customer.stamps_balance
    INTO v_current_stamps
  FROM public.loyalty_customers AS customer
  WHERE customer.id = v_customer
    AND customer.establishment_id = v_establishment
  FOR UPDATE;

  IF v_current_stamps IS NULL THEN
    RAISE EXCEPTION 'Client introuvable';
  END IF;

  IF v_goal IS NULL OR v_goal <= 0 OR v_current_stamps < v_goal THEN
    RAISE EXCEPTION 'Solde de tampons insuffisant pour cette récompense';
  END IF;

  UPDATE public.loyalty_customers
  SET stamps_balance = v_current_stamps - v_goal,
      updated_at = now()
  WHERE id = v_customer
    AND establishment_id = v_establishment
  RETURNING stamps_balance INTO v_new;

  UPDATE public.loyalty_stamp_reward_claims
  SET status = 'REDEEMED', redeemed_at = now()
  WHERE claim_token = p_claim_token
    AND status = 'PENDING';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR cadeau déjà utilisé';
  END IF;

  INSERT INTO public.loyalty_transactions(
    establishment_id, customer_id, employee_id, amount, points, type, description
  )
  VALUES (
    v_establishment, v_customer, NULL, NULL, 0, 'REDEEM',
    'QR cadeau à tampons réclamé — ' || coalesce(v_name, 'Cadeau fidélité')
  );

  RETURN QUERY SELECT v_new, v_name;
END;
$function$;
