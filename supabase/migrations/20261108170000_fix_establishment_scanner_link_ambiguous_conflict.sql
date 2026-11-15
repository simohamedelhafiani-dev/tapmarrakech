CREATE OR REPLACE FUNCTION public.get_or_create_establishment_scanner_link(p_establishment_id uuid)
 RETURNS TABLE(establishment_id uuid, establishment_name text, scanner_token uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.is_tapmarrakech_admin()
    OR public.user_has_establishment_access(p_establishment_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.establishment_scanner_links(establishment_id)
  VALUES (p_establishment_id)
  ON CONFLICT ON CONSTRAINT establishment_scanner_links_establishment_id_key DO NOTHING;

  RETURN QUERY
  SELECT e.id, e.name, l.access_token
  FROM public.establishments e
  JOIN public.establishment_scanner_links l
    ON l.establishment_id = e.id
  WHERE e.id = p_establishment_id;
END;
$function$;
