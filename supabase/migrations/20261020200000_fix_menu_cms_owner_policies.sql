-- Keep the menu CMS migration replayable on a clean database while preserving
-- the explicit responsible-user policies added by later migrations.
-- This additive migration also updates installations where the original migration
-- has already been recorded as applied.

drop policy if exists "menu_categories_responsible_all" on public.menu_categories;
create policy "menu_categories_responsible_all"
  on public.menu_categories
  for all
  to authenticated
  using (
    exists (
      select 1 from public.establishments e
      where e.id = menu_categories.establishment_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.establishments e
      where e.id = menu_categories.establishment_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "menu_items_responsible_all" on public.menu_items;
create policy "menu_items_responsible_all"
  on public.menu_items
  for all
  to authenticated
  using (
    exists (
      select 1 from public.establishments e
      where e.id = menu_items.establishment_id
        and e.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.establishments e
      where e.id = menu_items.establishment_id
        and e.user_id = auth.uid()
    )
  );

drop policy if exists "menu_categories_responsible_update" on public.menu_categories;
create policy "menu_categories_responsible_update"
  on public.menu_categories
  for update
  to authenticated
  using (public.is_establishment_responsible(menu_categories.establishment_id))
  with check (public.is_establishment_responsible(menu_categories.establishment_id));
