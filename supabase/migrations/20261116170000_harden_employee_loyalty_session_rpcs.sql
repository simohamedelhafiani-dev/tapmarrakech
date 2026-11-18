-- Preserve the validated employee session boundary on loyalty redemption RPCs.
-- Redemption state changes remain atomic and stamp rewards consume only their threshold.
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
  v_establishment := public.get_active_employee_session_establishment(p_session_token);
  IF v_establishment IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide, expirée ou désactivée'
      USING ERRCODE = '42501';
  END IF;

  SELECT es.employee_id INTO v_employee_id
  FROM public.employee_sessions AS es
  WHERE es.token_hash = encode(digest(trim(p_session_token), 'sha256'), 'hex')
    AND es.establishment_id = v_establishment
    AND es.expires_at > now()
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée'
      USING ERRCODE = '42501';
  END IF;

  IF p_invoice_amount IS NULL
     OR p_invoice_amount <= 0
     OR p_invoice_amount IN ('NaN'::numeric, 'Infinity'::numeric, '-Infinity'::numeric) THEN
    RAISE EXCEPTION 'Montant de facture invalide';
  END IF;

  v_payment_method := upper(trim(coalesce(p_payment_method, 'CASH')));
  IF v_payment_method NOT IN ('CASH', 'CARD', 'TRANSFER', 'OTHER') THEN
    RAISE EXCEPTION 'Mode de paiement invalide';
  END IF;

  SELECT d.* INTO v_discount
  FROM public.loyalty_discount_cards AS d
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

CREATE OR REPLACE FUNCTION public.redeem_loyalty_stamp_reward_by_employee(
  p_session_token text,
  p_customer_id uuid
)
RETURNS TABLE(new_stamps_balance integer, reward_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'auth', 'extensions', 'storage', 'vault', 'pg_temp'
AS $function$
DECLARE
  v_establishment uuid;
  v_employee_id uuid;
  v_goal integer;
  v_name text;
  v_balance integer;
  v_new integer;
BEGIN
  v_establishment := public.get_active_employee_session_establishment(p_session_token);
  IF v_establishment IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide, expirée ou désactivée'
      USING ERRCODE = '42501';
  END IF;

  SELECT es.employee_id INTO v_employee_id
  FROM public.employee_sessions AS es
  WHERE es.token_hash = encode(digest(trim(p_session_token), 'sha256'), 'hex')
    AND es.establishment_id = v_establishment
    AND es.expires_at > now()
  LIMIT 1;

  IF v_employee_id IS NULL THEN
    RAISE EXCEPTION 'Session employé invalide ou expirée'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.stamp_goal, s.stamp_reward_name
    INTO v_goal, v_name
  FROM public.loyalty_settings AS s
  WHERE s.establishment_id = v_establishment
    AND s.program_type = 'STAMP'
    AND s.enabled = true
  LIMIT 1;

  IF v_goal IS NULL OR v_goal <= 0 THEN
    RAISE EXCEPTION 'Le programme à tampons n’est pas activé';
  END IF;

  SELECT c.stamps_balance INTO v_balance
  FROM public.loyalty_customers AS c
  WHERE c.id = p_customer_id
    AND c.establishment_id = v_establishment
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Client introuvable';
  END IF;

  IF v_balance < v_goal THEN
    RAISE EXCEPTION 'La récompense n’est pas encore débloquée';
  END IF;

  UPDATE public.loyalty_customers
  SET stamps_balance = v_balance - v_goal,
      updated_at = now()
  WHERE id = p_customer_id
    AND establishment_id = v_establishment
  RETURNING stamps_balance INTO v_new;

  INSERT INTO public.loyalty_transactions(
    establishment_id, customer_id, employee_id, amount, points, type, description
  )
  VALUES (
    v_establishment, p_customer_id, v_employee_id, NULL, 0, 'REDEEM',
    'Récompense à tampons réclamée — ' || coalesce(v_name, 'Cadeau fidélité')
  );

  RETURN QUERY SELECT v_new, v_name;
END;
$function$;
