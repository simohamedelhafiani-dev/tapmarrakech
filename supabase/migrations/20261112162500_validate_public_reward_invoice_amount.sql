-- Reject non-finite invoice amounts in public scanner reward redemption.
-- Keep the scanner-token RPC public; the scanner token remains the authorization boundary.
CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward_claim(
  p_scanner_token uuid,
  p_claim_token uuid,
  p_invoice_amount numeric DEFAULT NULL::numeric,
  p_invoice_number text DEFAULT NULL::text
)
RETURNS TABLE(
  reward_name text,
  reward_type text,
  points_used integer,
  new_points_balance integer,
  discount_percent numeric,
  discount_amount numeric,
  final_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_establishment_id uuid;
  v_claim public.loyalty_reward_claims%ROWTYPE;
  v_customer public.loyalty_customers%ROWTYPE;
  v_discount_amount numeric := 0;
  v_final_amount numeric := NULL;
BEGIN
  SELECT l.establishment_id
  INTO v_establishment_id
  FROM public.establishment_scanner_links l
  WHERE l.access_token = p_scanner_token
  LIMIT 1;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Lien scanner invalide';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.loyalty_reward_claims c
  WHERE c.claim_token = p_claim_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR de récompense invalide';
  END IF;

  IF v_claim.establishment_id <> v_establishment_id THEN
    RAISE EXCEPTION 'Cette récompense appartient à un autre établissement';
  END IF;

  IF v_claim.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Ce QR a déjà été utilisé ou annulé';
  END IF;

  IF v_claim.expires_at <= now() THEN
    UPDATE public.loyalty_reward_claims SET status = 'EXPIRED' WHERE id = v_claim.id;
    RAISE EXCEPTION 'Ce QR a expiré';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.loyalty_customers c
  WHERE c.id = v_claim.customer_id
    AND c.establishment_id = v_establishment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable pour cet établissement';
  END IF;

  IF v_customer.points_balance < v_claim.points_required THEN
    RAISE EXCEPTION 'Points insuffisants';
  END IF;

  IF v_claim.reward_type = 'DISCOUNT' THEN
    IF p_invoice_amount IS NULL
       OR p_invoice_amount <= 0
       OR p_invoice_amount::text IN ('NaN', 'Infinity', '-Infinity') THEN
      RAISE EXCEPTION 'Montant de facture invalide';
    END IF;

    v_discount_amount := p_invoice_amount * (v_claim.discount_percent / 100);
    IF v_claim.discount_max_amount IS NOT NULL THEN
      v_discount_amount := LEAST(v_discount_amount, v_claim.discount_max_amount);
    END IF;
    v_final_amount := GREATEST(p_invoice_amount - v_discount_amount, 0);
  END IF;

  UPDATE public.loyalty_customers
  SET
    points_balance = points_balance - v_claim.points_required,
    total_points_redeemed = coalesce(total_points_redeemed, 0) + v_claim.points_required
  WHERE id = v_customer.id;

  INSERT INTO public.loyalty_transactions (
    establishment_id, customer_id, employee_id, amount, points, type, description, invoice_number
  )
  VALUES (
    v_establishment_id,
    v_customer.id,
    NULL,
    CASE WHEN v_claim.reward_type = 'DISCOUNT' THEN p_invoice_amount ELSE NULL END,
    -v_claim.points_required,
    'REDEEM',
    CASE
      WHEN v_claim.reward_type = 'DISCOUNT'
      THEN 'Réduction ' || trim(to_char(v_claim.discount_percent, 'FM999990.##')) || '% — ' || v_claim.reward_name
      ELSE 'Récompense — ' || v_claim.reward_name
    END,
    NULLIF(trim(coalesce(p_invoice_number, '')), '')
  );

  UPDATE public.loyalty_reward_claims
  SET status = 'REDEEMED', redeemed_at = now()
  WHERE id = v_claim.id;

  RETURN QUERY
  SELECT
    v_claim.reward_name,
    v_claim.reward_type,
    v_claim.points_required,
    v_customer.points_balance - v_claim.points_required,
    v_claim.discount_percent,
    v_discount_amount,
    v_final_amount;
END;
$function$;
