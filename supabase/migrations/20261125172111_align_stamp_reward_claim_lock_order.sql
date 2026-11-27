-- Keep stamp reward claim operations on one lock order:
-- customer row first, claim row second. Claim creation already serializes on
-- the customer row; redemption must do the same to avoid a customer/claim
-- lock inversion when a claim expires during a concurrent redemption.

CREATE OR REPLACE FUNCTION public.create_public_loyalty_stamp_reward_claim(p_access_token uuid)
RETURNS TABLE(claim_token uuid, reward_name text, stamps_required integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_customer uuid;
  v_establishment uuid;
  v_balance integer;
  v_goal integer;
  v_name text;
  v_description text;
  v_token uuid;
  v_existing public.loyalty_stamp_reward_claims%rowtype;
BEGIN
  SELECT c.id, c.establishment_id, c.stamps_balance
    INTO v_customer, v_establishment, v_balance
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  WHERE l.access_token = p_access_token
  LIMIT 1
  FOR UPDATE OF c;

  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'Carte invalide';
  END IF;

  SELECT stamp_goal, stamp_reward_name, stamp_reward_description
    INTO v_goal, v_name, v_description
  FROM public.loyalty_settings
  WHERE establishment_id = v_establishment
    AND program_type = 'STAMP'
    AND enabled = true
  LIMIT 1;

  IF v_goal IS NULL THEN
    RAISE EXCEPTION 'Programme à tampons non actif';
  END IF;

  -- Customer lock serializes creators; expire old claims before checking for
  -- an existing live claim so the pending-claim invariant remains stable.
  UPDATE public.loyalty_stamp_reward_claims
  SET status = 'EXPIRED'
  WHERE customer_id = v_customer
    AND establishment_id = v_establishment
    AND status = 'PENDING'
    AND expires_at <= now();

  SELECT *
    INTO v_existing
  FROM public.loyalty_stamp_reward_claims
  WHERE customer_id = v_customer
    AND establishment_id = v_establishment
    AND status = 'PENDING'
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_existing.claim_token, v_existing.reward_name, v_existing.stamps_required;
    RETURN;
  END IF;

  IF coalesce(v_balance, 0) < v_goal THEN
    RAISE EXCEPTION 'Récompense pas encore débloquée';
  END IF;

  INSERT INTO public.loyalty_stamp_reward_claims (
    customer_id, establishment_id, stamps_required, reward_name, reward_description
  )
  VALUES (v_customer, v_establishment, v_goal, v_name, v_description)
  RETURNING loyalty_stamp_reward_claims.claim_token INTO v_token;

  RETURN QUERY SELECT v_token, v_name, v_goal;
END;
$function$;

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
  v_claim_establishment uuid;
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

  -- First read only identifies the customer. Do not lock the claim yet:
  -- every code path must acquire customer before claim.
  SELECT claim.customer_id, claim.establishment_id
    INTO v_customer, v_claim_establishment
  FROM public.loyalty_stamp_reward_claims AS claim
  WHERE claim.claim_token = p_claim_token
    AND claim.establishment_id = v_establishment
    AND claim.status = 'PENDING'
    AND claim.expires_at > now()
  LIMIT 1;

  IF v_customer IS NULL OR v_claim_establishment IS DISTINCT FROM v_establishment THEN
    RAISE EXCEPTION 'QR cadeau invalide, expiré ou déjà utilisé';
  END IF;

  SELECT customer.stamps_balance
    INTO v_current_stamps
  FROM public.loyalty_customers AS customer
  WHERE customer.id = v_customer
    AND customer.establishment_id = v_establishment
  FOR UPDATE OF customer;

  IF NOT FOUND OR v_current_stamps IS NULL THEN
    RAISE EXCEPTION 'Client introuvable';
  END IF;

  -- Revalidate and lock the claim after acquiring the customer lock. A claim
  -- may have expired or been consumed while this transaction waited.
  SELECT claim.reward_name, claim.stamps_required
    INTO v_name, v_goal
  FROM public.loyalty_stamp_reward_claims AS claim
  WHERE claim.claim_token = p_claim_token
    AND claim.customer_id = v_customer
    AND claim.establishment_id = v_establishment
    AND claim.status = 'PENDING'
    AND claim.expires_at > now()
  FOR UPDATE OF claim;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR cadeau invalide, expiré ou déjà utilisé';
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
  SET status = 'REDEEMED',
      redeemed_at = now()
  WHERE claim_token = p_claim_token
    AND customer_id = v_customer
    AND establishment_id = v_establishment
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
