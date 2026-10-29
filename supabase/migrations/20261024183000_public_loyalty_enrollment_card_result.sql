-- Return the link and the minimum card details for the customer created by
-- this public enrollment request. This avoids a second RPC that looks up a
-- permanent bearer token by phone + loyalty number.
CREATE OR REPLACE FUNCTION public.register_public_loyalty_customer_for_enrollment_v3(
  p_establishment_id uuid,
  p_first_name text,
  p_last_name text,
  p_phone text,
  p_birth_date date DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_interests text[] DEFAULT '{}'::text[],
  p_marketing_consent boolean DEFAULT false,
  p_notification_consent boolean DEFAULT false,
  p_preferred_channel text DEFAULT 'NONE',
  p_visit_frequency text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $function$
DECLARE
  v_enrollment record;
  v_customer public.loyalty_customers%rowtype;
BEGIN
  SELECT *
  INTO v_enrollment
  FROM public.register_public_loyalty_customer_for_enrollment_v2(
    p_establishment_id,
    p_first_name,
    p_last_name,
    p_phone,
    p_birth_date,
    p_email,
    p_interests,
    p_marketing_consent,
    p_notification_consent,
    p_preferred_channel,
    p_visit_frequency
  );

  IF v_enrollment.access_token IS NULL OR v_enrollment.establishment_name IS NULL THEN
    RAISE EXCEPTION 'Impossible de créer votre carte fidélité';
  END IF;

  SELECT c.*
  INTO v_customer
  FROM public.loyalty_customer_links AS l
  JOIN public.loyalty_customers AS c ON c.id = l.customer_id
  WHERE l.access_token = v_enrollment.access_token
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Impossible de retrouver la carte créée';
  END IF;

  RETURN jsonb_build_object(
    'establishment_name', v_enrollment.establishment_name,
    'access_token', v_enrollment.access_token,
    'first_name', v_customer.first_name,
    'loyalty_number', v_customer.loyalty_number,
    'points_balance', COALESCE(v_customer.points_balance, 0),
    'visit_count', COALESCE(v_customer.visit_count, 0)
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.register_public_loyalty_customer_for_enrollment_v3(
  uuid, text, text, text, date, text, text[], boolean, boolean, text, text
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.register_public_loyalty_customer_for_enrollment_v3(
  uuid, text, text, text, date, text, text[], boolean, boolean, text, text
) TO anon;
