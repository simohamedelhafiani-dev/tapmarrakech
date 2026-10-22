-- Apply Google Business permissions after the integration tables have been created.
-- Admins retain management access; responsible users can read their establishment's data.

grant select on table public.google_business_connections, public.google_business_locations, public.google_business_reviews, public.google_business_settings to authenticated;

drop policy if exists "Google connections managed by admins" on public.google_business_connections;
drop policy if exists "Google connections visible to admins and responsibles" on public.google_business_connections;
create policy "Google connections visible to admins and responsibles"
  on public.google_business_connections for select to authenticated
  using (public.is_tapmarrakech_admin() or public.is_establishment_responsible(establishment_id));
create policy "Google connections managed by admins"
  on public.google_business_connections for all to authenticated
  using (public.is_tapmarrakech_admin())
  with check (public.is_tapmarrakech_admin());

drop policy if exists "Google locations managed by admins" on public.google_business_locations;
drop policy if exists "Google locations visible to admins and responsibles" on public.google_business_locations;
create policy "Google locations visible to admins and responsibles"
  on public.google_business_locations for select to authenticated
  using (
    public.is_tapmarrakech_admin()
    or exists (
      select 1 from public.google_business_connections c
      where c.id = google_business_locations.connection_id
        and public.is_establishment_responsible(c.establishment_id)
    )
  );
create policy "Google locations managed by admins"
  on public.google_business_locations for all to authenticated
  using (public.is_tapmarrakech_admin())
  with check (public.is_tapmarrakech_admin());

drop policy if exists "Google reviews managed by admins" on public.google_business_reviews;
drop policy if exists "Google reviews visible to admins and responsibles" on public.google_business_reviews;
create policy "Google reviews visible to admins and responsibles"
  on public.google_business_reviews for select to authenticated
  using (
    public.is_tapmarrakech_admin()
    or exists (
      select 1
      from public.google_business_locations l
      join public.google_business_connections c on c.id = l.connection_id
      where l.id = google_business_reviews.location_id
        and public.is_establishment_responsible(c.establishment_id)
    )
  );
create policy "Google reviews managed by admins"
  on public.google_business_reviews for all to authenticated
  using (public.is_tapmarrakech_admin())
  with check (public.is_tapmarrakech_admin());

drop policy if exists "Google settings managed by admins" on public.google_business_settings;
drop policy if exists "Google settings visible to admins and responsibles" on public.google_business_settings;
create policy "Google settings visible to admins and responsibles"
  on public.google_business_settings for select to authenticated
  using (public.is_tapmarrakech_admin() or public.is_establishment_responsible(establishment_id));
create policy "Google settings managed by admins"
  on public.google_business_settings for all to authenticated
  using (public.is_tapmarrakech_admin())
  with check (public.is_tapmarrakech_admin());
