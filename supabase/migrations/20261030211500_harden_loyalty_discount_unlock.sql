-- Security hardening: discount unlock must be scoped to an authorized establishment
-- and must derive eligibility from the persisted customer balance, never caller-supplied points.

CREATE OR REPLACE FUNCTION public.unlock_loyalty_discount_if_ready(
  p_customer_id uuid,
  p_establishment_id uuid,
  p_previous_points integer,
  p_new_points integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_threshold integer;
  v_discount numeric;
  v_days integer;
  v_customer_establishment uuid;
  v_customer_points integer;
  v_request_role text;
BEGIN
  IF p_customer_id IS NULL OR p_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Client ou établissement invalide';
  END IF;

  -- SECURITY DEFINER changes current_user to the function owner. Use the
  -- request JWT role to distinguish the trusted service_role from client roles.
  v_request_role := COALESCE(
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  );

  IF v_request_role <> 'service_role' THEN
    IF auth.uid() IS NULL
       OR NOT (
         public.is_tapmarrakech_admin()
         OR public.user_has_establishment_access(p_establishment_id)
       )
    THEN
      RAISE EXCEPTION 'Accès non autorisé à cet établissement'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  -- Lock and bind the customer to the requested establishment.
  SELECT c.establishment_id, COALESCE(c.points_balance, 0)
    INTO v_customer_establishment, v_customer_points
  FROM public.loyalty_customers AS c
  WHERE c.id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND OR v_customer_establishment <> p_establishment_id THEN
    RAISE EXCEPTION 'Client introuvable pour cet établissement'
      USING ERRCODE = '42501';
  END IF;

  SELECT s.discount_points_threshold, s.discount_percent, s.discount_valid_days
    INTO v_threshold, v_discount, v_days
  FROM public.loyalty_settings AS s
  WHERE s.establishment_id = p_establishment_id
    AND s.program_type = 'POINTS_DISCOUNT'
    AND s.enabled = true
  LIMIT 1;

  IF v_threshold IS NULL OR v_discount IS NULL OR v_discount <= 0 THEN
    RETURN;
  END IF;

  -- Never trust p_previous_points / p_new_points to establish eligibility.
  -- The persisted balance is the source of truth.
  IF v_customer_points < v_threshold THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.loyalty_discount_cards AS dc
    WHERE dc.customer_id = p_customer_id
      AND dc.establishment_id = p_establishment_id
      AND dc.status = 'ACTIVE'
      AND dc.expires_at > now()
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.loyalty_discount_cards
    (establishment_id, customer_id, discount_percent, valid_from, expires_at, status, qr_token)
  VALUES
    (
      p_establishment_id,
      p_customer_id,
      LEAST(GREATEST(v_discount, 1), 100),
      now(),
      now() + make_interval(days => GREATEST(COALESCE(v_days, 7), 1)),
      'ACTIVE',
      extensions.gen_random_uuid()
    );
END;
$function$;

-- Remove inherited/public access and explicitly retain only authenticated
-- callers (subject to the checks above) and the trusted service role.
REVOKE ALL ON FUNCTION public.unlock_loyalty_discount_if_ready(uuid, uuid, integer, integer)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.unlock_loyalty_discount_if_ready(uuid, uuid, integer, integer)
  TO authenticated, service_role;
