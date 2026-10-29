-- Preserve responsible users' mapped Google Business review experience while
-- keeping OAuth access/refresh-token rows admin-only. Child-table RLS policies must
-- not rely on selecting from google_business_connections as the invoking user.
CREATE OR REPLACE FUNCTION public.can_responsible_access_google_business_location(
  p_location_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_establishment_id uuid;
BEGIN
  SELECT COALESCE(l.mapped_establishment_id, c.establishment_id)
    INTO v_establishment_id
  FROM public.google_business_locations AS l
  LEFT JOIN public.google_business_connections AS c
    ON c.id = l.connection_id
  WHERE l.id = p_location_id;

  IF v_establishment_id IS NULL THEN
    RETURN false;
  END IF;

  RETURN public.is_establishment_responsible(v_establishment_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.can_responsible_access_google_business_location(uuid)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_responsible_access_google_business_location(uuid)
  TO authenticated;

DROP POLICY IF EXISTS "Google locations visible to admins and responsibles"
  ON public.google_business_locations;
CREATE POLICY "Google locations visible to admins and responsibles"
  ON public.google_business_locations
  FOR SELECT TO authenticated
  USING (
    public.is_tapmarrakech_admin()
    OR public.can_responsible_access_google_business_location(id)
  );

DROP POLICY IF EXISTS "Google reviews visible to admins and responsibles"
  ON public.google_business_reviews;
CREATE POLICY "Google reviews visible to admins and responsibles"
  ON public.google_business_reviews
  FOR SELECT TO authenticated
  USING (
    public.is_tapmarrakech_admin()
    OR public.can_responsible_access_google_business_location(location_id)
  );
