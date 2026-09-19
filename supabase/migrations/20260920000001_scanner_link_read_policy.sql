-- Allow authenticated administrators/responsibles to read only their establishment scanner token.
DROP POLICY IF EXISTS "Admins can read scanner links" ON public.establishment_scanner_links;
CREATE POLICY "Admins can read scanner links"
  ON public.establishment_scanner_links
  FOR SELECT
  TO authenticated
  USING (
    public.is_tapmarrakech_admin()
    OR public.user_has_establishment_access(establishment_id)
  );
