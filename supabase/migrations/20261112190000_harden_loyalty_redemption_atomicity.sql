-- Harden one-time discount redemption and stamp reward claim lifecycle.
-- Staging-first: keep all redemption state transitions inside the same transaction.

CREATE OR REPLACE FUNCTION public.redeem_loyalty_discount_by_employee(
  p_session_token text,
  p_customer_id uuid,
  p_invoice_amount numeric,
  p_invoice_number text DEFAULT NULL::text,
  p_payment_method text DEFAULT 'CASH'::text
)
RETURNS TABLE(
  discount_percent numeric,
  discount_amount numeric,
  amount_paid numeric,
  expires_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions', 'storage', 'vault', 'pg_temp'
AS $function$
DECLARE
  v_establishment uuid;
  v_employee_id uuid;
  v_discount public.loyalty_discount_cards%rowtype;
  v_discount_amount numeric;
  v_amount_paid numeric;
  v_payment_method text;
BEGIN
  SELECT es.establishment_id, es.employee_id
    INTO v_establishment, v_employee_id
  FROM public.employee_sessions es
  WHERE es.token_hash = encode(digest(trim(p_session_token), 'sha256'), 'hex')
    AND es.expires_at > now()
  LIMIT 1;

  IF v_establishment IS NULL OR v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée';
  END IF;
  IF p_invoice_amount IS NULL OR p_invoice_amount <= 0 OR p_invoice_amount = 'NaN'::numeric THEN
    RAISE EXCEPTION 'Montant de facture invalide';
  END IF;

  v_payment_method := upper(trim(coalesce(p_payment_method, 'CASH')));
  IF v_payment_method NOT IN ('CASH', 'CARD', 'TRANSFER', 'OTHER') THEN
    RAISE EXCEPTION 'Mode de paiement invalide';
  END IF;

  SELECT d.*
    INTO v_discount
  FROM public.loyalty_discount_cards d
  WHERE d.customer_id = p_customer_id
    AND d.establishment_id = v_establishment
    AND d.status = 'ACTIVE'
    AND d.valid_from <= now()
    AND d.expires_at > now()
  ORDER BY d.created_at DESC
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Aucune réduction active pour ce client';
  END IF;

  v_discount_amount := round(p_invoice_amount * (v_discount.discount_percent / 100), 2);
  v_amount_paid := greatest(p_invoice_amount - v_discount_amount, 0);

  INSERT INTO public.loyalty_transactions(
    establishment_id, customer_id, employee_id, amount, points, type, description, invoice_number
  )
  VALUES (
    v_establishment, p_customer_id, v_employee_id, p_invoice_amount, 0, 'REDEEM',
    'Réduction fidélité ' || trim(to_char(v_discount.discount_percent, 'FM999990.##')) ||
    '% — ' || trim(to_char(v_discount_amount, 'FM999999990.00')) || ' économisés',
    nullif(trim(coalesce(p_invoice_number, '')), '')
  );

  UPDATE public.loyalty_discount_cards
  SET status = 'USED', used_at = now()
  WHERE id = v_discount.id AND status = 'ACTIVE';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cette réduction a déjà été utilisée';
  END IF;

  RETURN QUERY
  SELECT v_discount.discount_percent, v_discount_amount, v_amount_paid, v_discount.expires_at;
END;
$function$;

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
  -- Serialize claim creation per customer, including concurrent requests.
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

  UPDATE public.loyalty_stamp_reward_claims
  SET status = 'EXPIRED'
  WHERE customer_id = v_customer
    AND status = 'PENDING'
    AND expires_at <= now();

  -- Reuse the live QR instead of issuing several claims against the same balance.
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
  v_goal integer;
  v_name text;
  v_current_stamps integer;
  v_new integer;
BEGIN
  SELECT establishment_id
    INTO v_establishment
  FROM public.establishment_scanner_links
  WHERE access_token = p_scanner_token
  LIMIT 1;

  IF v_establishment IS NULL THEN
    RAISE EXCEPTION 'Scanner invalide';
  END IF;

  SELECT customer_id, reward_name, stamps_required
    INTO v_customer, v_name, v_goal
  FROM public.loyalty_stamp_reward_claims
  WHERE claim_token = p_claim_token
    AND establishment_id = v_establishment
    AND status = 'PENDING'
    AND expires_at > now()
  FOR UPDATE;

  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'QR cadeau invalide, expiré ou déjà utilisé';
  END IF;

  SELECT stamps_balance
    INTO v_current_stamps
  FROM public.loyalty_customers
  WHERE id = v_customer
    AND establishment_id = v_establishment
  FOR UPDATE;

  IF v_current_stamps IS NULL THEN
    RAISE EXCEPTION 'Client introuvable';
  END IF;

  IF v_goal IS NULL OR v_goal <= 0 OR v_current_stamps < v_goal THEN
    RAISE EXCEPTION 'Solde de tampons insuffisant pour cette récompense';
  END IF;

  -- Consume exactly the reward threshold; retain stamps earned after claim creation.
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
