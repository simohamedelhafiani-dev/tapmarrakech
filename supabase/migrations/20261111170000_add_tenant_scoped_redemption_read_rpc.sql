-- Read-only, tenant-scoped access to redemption history.
-- Keep direct table privileges revoked; expose only rows for an establishment
-- the current authenticated user is authorized to access.
CREATE OR REPLACE FUNCTION public.get_establishment_loyalty_redemptions(
  p_establishment_id uuid
)
RETURNS SETOF public.loyalty_redemptions
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required'
      USING ERRCODE = '42501';
  END IF;

  IF p_establishment_id IS NULL
     OR NOT public.user_has_establishment_access(p_establishment_id) THEN
    RAISE EXCEPTION 'Establishment access denied'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT r.*
    FROM public.loyalty_redemptions AS r
    WHERE r.establishment_id = p_establishment_id
    ORDER BY r.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_establishment_loyalty_redemptions(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_establishment_loyalty_redemptions(uuid)
  TO authenticated;
