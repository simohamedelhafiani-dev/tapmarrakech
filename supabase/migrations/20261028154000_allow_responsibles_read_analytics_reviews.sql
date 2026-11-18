-- Allow assigned establishment responsibles to read their own analytics and reviews.
-- Ownership policies remain unchanged; RLS combines permissive policies with OR.
CREATE POLICY analytics_responsible_select
  ON public.analytics_events
  FOR SELECT
  TO authenticated
  USING (public.is_establishment_responsible(establishment_id));

CREATE POLICY reviews_responsible_select
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (public.is_establishment_responsible(establishment_id));
