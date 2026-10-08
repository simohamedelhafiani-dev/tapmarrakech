-- KELYANI role permissions
-- Admin manages Google Business and menu design.
-- Responsible can read Google reviews/replies and edit menu categories only.

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

drop policy if exists "menu_items_responsible_insert" on public.menu_items;
drop policy if exists "menu_items_responsible_update" on public.menu_items;
drop policy if exists "menu_items_responsible_delete" on public.menu_items;
drop policy if exists "menu_items_responsible_select" on public.menu_items;
create policy "menu_items_responsible_select"
  on public.menu_items for select to authenticated
  using (public.is_establishment_responsible(establishment_id));

drop policy if exists "menu_categories_responsible_insert" on public.menu_categories;
drop policy if exists "menu_categories_responsible_update" on public.menu_categories;
drop policy if exists "menu_categories_responsible_delete" on public.menu_categories;
create policy "menu_categories_responsible_insert"
  on public.menu_categories for insert to authenticated
  with check (public.is_establishment_responsible(establishment_id));
create policy "menu_categories_responsible_update"
  on public.menu_categories for update to authenticated
  using (public.is_establishment_responsible(establishment_id))
  with check (public.is_establishment_responsible(establishment_id));
create policy "menu_categories_responsible_delete"
  on public.menu_categories for delete to authenticated
  using (public.is_establishment_responsible(establishment_id));

create or replace function public.update_establishment_menu_design(
  p_establishment_id uuid,
  p_menu_ai_design jsonb
)
returns public.establishments
language plpgsql
security definer
set search_path = public
as $function$
declare v_row public.establishments;
begin
  if not public.is_tapmarrakech_admin() then raise exception 'Accès non autorisé'; end if;
  update public.establishments set menu_ai_design = p_menu_ai_design
  where id = p_establishment_id returning * into v_row;
  if not found then raise exception 'Établissement introuvable'; end if;
  return v_row;
end;
$function$;

create or replace function public.update_establishment_menu_template(
  p_establishment_id uuid,
  p_menu_template_id text
)
returns public.establishments
language plpgsql
security definer
set search_path = public
as $function$
declare v_row public.establishments;
begin
  if not public.is_tapmarrakech_admin() then raise exception 'Accès non autorisé'; end if;
  update public.establishments set menu_template_id = p_menu_template_id
  where id = p_establishment_id returning * into v_row;
  if not found then raise exception 'Établissement introuvable'; end if;
  return v_row;
end;
$function$;

create or replace function public.prevent_responsible_menu_design_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if public.is_establishment_responsible(old.id) and (
    new.menu_template_id is distinct from old.menu_template_id
    or new.menu_ai_design is distinct from old.menu_ai_design
    or new.menu_display_mode is distinct from old.menu_display_mode
    or new.menu_pdf_url is distinct from old.menu_pdf_url
  ) then
    raise exception 'Les paramètres de design du menu sont réservés à l’administrateur';
  end if;
  return new;
end;
$function$;

drop trigger if exists trg_prevent_responsible_menu_design_update on public.establishments;
create trigger trg_prevent_responsible_menu_design_update
before update on public.establishments
for each row execute function public.prevent_responsible_menu_design_update();

revoke execute on function public.update_establishment_menu_design(uuid,jsonb) from public, anon;
revoke execute on function public.update_establishment_menu_template(uuid,text) from public, anon;
revoke execute on function public.prevent_responsible_menu_design_update() from public, anon;
grant execute on function public.update_establishment_menu_design(uuid,jsonb) to authenticated;
grant execute on function public.update_establishment_menu_template(uuid,text) to authenticated;
