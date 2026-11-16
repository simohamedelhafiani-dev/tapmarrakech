CREATE OR REPLACE FUNCTION public.update_menu_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog
AS $function$
BEGIN
  NEW.updated_at = pg_catalog.now();
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.update_menu_updated_at()
  FROM PUBLIC, anon, authenticated, service_role;
