/*
  Public establishment scanner access.
  The permanent scanner token is the access key; no employee login/code is required.
  The scanner can only operate on customers belonging to the establishment bound to that token.
*/

CREATE OR REPLACE FUNCTION public.get_public_scanner_settings(
  p_scanner_token uuid
)
RETURNS TABLE (
  points_per_currency numeric,
  currency text,
  enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.points_per_currency,
    s.currency,
    s.enabled
  FROM public.establishment_scanner_links l
  JOIN public.loyalty_settings s
    ON s.establishment_id = l.establishment_id
  WHERE l.access_token = p_scanner_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.search_public_scanner_customers(
  p_scanner_token uuid,
  p_query text
)
RETURNS TABLE (
  customer_id uuid,
  establishment_id uuid,
  loyalty_number text,
  first_name text,
  last_name text,
  phone text,
  points_balance integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.establishment_id,
    c.loyalty_number,
    c.first_name,
    c.last_name,
    c.phone,
    c.points_balance
  FROM public.establishment_scanner_links l
  JOIN public.loyalty_customers c
    ON c.establishment_id = l.establishment_id
  WHERE l.access_token = p_scanner_token
    AND length(trim(coalesce(p_query, ''))) >= 2
    AND (
      c.loyalty_number ILIKE '%' || trim(p_query) || '%'
      OR c.phone ILIKE '%' || trim(p_query) || '%'
      OR concat_ws(' ', c.first_name, c.last_name) ILIKE '%' || trim(p_query) || '%'
    )
  ORDER BY c.created_at DESC
  LIMIT 8;
$$;

CREATE OR REPLACE FUNCTION public.add_loyalty_points_by_scanner(
  p_scanner_token uuid,
  p_customer_id uuid,
  p_amount numeric,
  p_invoice_number text DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_establishment_id uuid;
  v_points_per_currency numeric;
  v_enabled boolean;
  v_customer public.loyalty_customers%ROWTYPE;
  v_points integer;
  v_new_balance integer;
BEGIN
  SELECT
    l.establishment_id
  INTO v_establishment_id
  FROM public.establishment_scanner_links l
  WHERE l.access_token = p_scanner_token
  LIMIT 1;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Lien scanner invalide';
  END IF;

  SELECT
    s.points_per_currency,
    s.enabled
  INTO
    v_points_per_currency,
    v_enabled
  FROM public.loyalty_settings s
  WHERE s.establishment_id = v_establishment_id
  LIMIT 1;

  IF coalesce(v_enabled, true) = false THEN
    RAISE EXCEPTION 'Le programme de fidélité est désactivé pour cet établissement';
  END IF;

  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Montant invalide';
  END IF;

  IF coalesce(v_points_per_currency, 0) <= 0 THEN
    RAISE EXCEPTION 'Le taux de points est invalide';
  END IF;

  v_points := floor(p_amount * v_points_per_currency)::integer;

  IF v_points <= 0 THEN
    RAISE EXCEPTION 'Le montant est trop faible pour générer des points';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.loyalty_customers c
  WHERE c.id = p_customer_id
    AND c.establishment_id = v_establishment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable pour cet établissement';
  END IF;

  v_new_balance := coalesce(v_customer.points_balance, 0) + v_points;

  UPDATE public.loyalty_customers
  SET
    points_balance = v_new_balance,
    total_points_earned = coalesce(total_points_earned, 0) + v_points,
    visit_count = coalesce(visit_count, 0) + 1,
    last_visit_at = now()
  WHERE id = p_customer_id;

  INSERT INTO public.loyalty_transactions (
    establishment_id,
    customer_id,
    employee_id,
    amount,
    points,
    type,
    description,
    invoice_number
  )
  VALUES (
    v_establishment_id,
    p_customer_id,
    NULL,
    p_amount,
    v_points,
    'EARN',
    coalesce(p_description, 'Achat via scanner fidélité'),
    nullif(trim(coalesce(p_invoice_number, '')), '')
  );

  RETURN v_new_balance;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_scanner_settings(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_public_scanner_customers(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_loyalty_points_by_scanner(uuid, uuid, numeric, text, text) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_scanner_settings(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_public_scanner_customers(uuid, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_loyalty_points_by_scanner(uuid, uuid, numeric, text, text) TO anon, authenticated;
