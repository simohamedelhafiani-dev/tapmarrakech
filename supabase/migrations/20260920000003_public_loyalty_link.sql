-- Publicly resolve a newly created loyalty card link using the registration data.
-- The link is still the permanent bearer URL; this helper only lets the
-- registration screen retrieve it immediately after account creation.

CREATE OR REPLACE FUNCTION public.get_public_loyalty_link(
  p_establishment_id uuid,
  p_loyalty_number text,
  p_phone text
)
RETURNS TABLE (
  access_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_establishment_id IS NULL
     OR NULLIF(trim(p_loyalty_number), '') IS NULL
     OR NULLIF(trim(p_phone), '') IS NULL THEN
    RAISE EXCEPTION 'invalid_loyalty_link_request';
  END IF;

  RETURN QUERY
  SELECT l.access_token
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c
    ON c.id = l.customer_id
  WHERE c.establishment_id = p_establishment_id
    AND c.loyalty_number = trim(p_loyalty_number)
    AND c.phone = trim(p_phone)
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_loyalty_link(uuid, text, text)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_public_loyalty_link(uuid, text, text)
  TO anon, authenticated;
