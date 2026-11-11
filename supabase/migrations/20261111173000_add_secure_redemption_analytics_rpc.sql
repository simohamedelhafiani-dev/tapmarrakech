-- Secure redemption analytics for platform admins and authorized establishment users.
-- Direct SELECT on loyalty_redemptions remains revoked for authenticated users.
CREATE OR REPLACE FUNCTION public.get_loyalty_redemptions_analytics(
  p_since timestamptz,
  p_establishment_id uuid DEFAULT NULL
)
RETURNS TABLE (
  establishment_id uuid,
  points_used integer,
  reward_cost_mad numeric,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_establishment_id IS NULL THEN
    IF NOT public.is_tapmarrakech_admin() THEN
      RAISE EXCEPTION 'Platform admin access required' USING ERRCODE = '42501';
    END IF;
  ELSIF NOT public.user_has_establishment_access(p_establishment_id) THEN
    RAISE EXCEPTION 'Establishment access denied' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT r.establishment_id, r.points_used, r.reward_cost_mad, r.created_at
    FROM public.loyalty_redemptions AS r
    WHERE r.created_at >= p_since
      AND (p_establishment_id IS NULL OR r.establishment_id = p_establishment_id)
    ORDER BY r.created_at DESC;
END;
$function$;

REVOKE ALL ON FUNCTION public.get_loyalty_redemptions_analytics(timestamptz, uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_loyalty_redemptions_analytics(timestamptz, uuid)
  TO authenticated;
