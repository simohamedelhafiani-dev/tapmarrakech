-- KELYANI role permissions: Google reputation is admin-managed,
-- responsible users are read-only for Google reputation,
-- and responsible users may manage menu categories but never menu design.

grant select on table public.google_business_connections, public.google_business_locations, public.google_business_reviews, public.google_business_settings to authenticated;
grant insert, update on table public.google_business_settings to authenticated;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='google_business_connections'
      and policyname='Google connections visible to admins and responsibles'
  ) then
    create policy "Google connections visible to admins and responsibles"
      on public.google_business_connections
      for select to authenticated
      using (
        public.is_tapmarrakech_admin()
        or public.is_establishment_responsible(establishment_id)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='google_business_connections'
      and policyname='Google connections managed by admins'
  ) then
    create policy "Google connections managed by admins"
      on public.google_business_connections
      for all to authenticated
      using (public.is_tapmarrakech_admin())
      with check (public.is_tapmarrakech_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='google_business_locations'
      and policyname='Google locations visible to admins and responsibles'
  ) then
    create policy "Google locations visible to admins and responsibles"
      on public.google_business_locations
      for select to authenticated
      using (
        public.is_tapmarrakech_admin()
        or exists (
          select 1
          from public.google_business_connections c
          where c.id = google_business_locations.connection_id
            and public.is_establishment_responsible(c.establishment_id)
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='google_business_locations'
      and policyname='Google locations managed by admins'
  ) then
    create policy "Google locations managed by admins"
      on public.google_business_locations
      for all to authenticated
      using (public.is_tapmarrakech_admin())
      with check (public.is_tapmarrakech_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='google_business_reviews'
      and policyname='Google reviews visible to admins and responsibles'
  ) then
    create policy "Google reviews visible to admins and responsibles"
      on public.google_business_reviews
      for select to authenticated
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
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='google_business_reviews'
      and policyname='Google reviews managed by admins'
  ) then
    create policy "Google reviews managed by admins"
      on public.google_business_reviews
      for all to authenticated
      using (public.is_tapmarrakech_admin())
      with check (public.is_tapmarrakech_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='google_business_settings'
      and policyname='Google settings visible to admins and responsibles'
  ) then
    create policy "Google settings visible to admins and responsibles"
      on public.google_business_settings
      for select to authenticated
      using (
        public.is_tapmarrakech_admin()
        or public.is_establishment_responsible(establishment_id)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='google_business_settings'
      and policyname='Google settings managed by admins'
  ) then
    create policy "Google settings managed by admins"
      on public.google_business_settings
      for all to authenticated
      using (public.is_tapmarrakech_admin())
      with check (public.is_tapmarrakech_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='menu_categories'
      and policyname='menu_categories_responsible_insert'
  ) then
    create policy "menu_categories_responsible_insert"
      on public.menu_categories
      for insert to authenticated
      with check (public.is_establishment_responsible(establishment_id));
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='menu_categories'
      and policyname='menu_categories_responsible_delete'
  ) then
    create policy "menu_categories_responsible_delete"
      on public.menu_categories
      for delete to authenticated
      using (public.is_establishment_responsible(establishment_id));
  end if;
end $$;

create or replace function public.update_establishment_menu_design(
  p_establishment_id uuid,
  p_menu_ai_design jsonb
)
returns public.establishments
language plpgsql
security definer
set search_path = public
as $function$
declare
  v_row public.establishments;
begin
  if not public.is_tapmarrakech_admin() then
    raise exception 'Accès non autorisé';
  end if;

  update public.establishments
  set menu_ai_design = p_menu_ai_design
  where id = p_establishment_id
  returning * into v_row;

  if not found then
    raise exception 'Établissement introuvable';
  end if;

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
declare
  v_row public.establishments;
begin
  if not public.is_tapmarrakech_admin() then
    raise exception 'Accès non autorisé';
  end if;

  update public.establishments
  set menu_template_id = p_menu_template_id
  where id = p_establishment_id
  returning * into v_row;

  if not found then
    raise exception 'Établissement introuvable';
  end if;

  return v_row;
end;
$function$;

revoke update (menu_template_id, menu_ai_design) on public.establishments from authenticated;
