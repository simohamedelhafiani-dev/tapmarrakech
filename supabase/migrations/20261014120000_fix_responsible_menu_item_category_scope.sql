-- Ensure responsible menu-item writes can only reference a category
-- belonging to the same establishment as the item being written.
-- This is additive so environments that already ran the earlier policy
-- migration receive the corrected policy definition.

drop policy if exists "menu_items_responsible_insert" on public.menu_items;
drop policy if exists "menu_items_responsible_update" on public.menu_items;

create policy "menu_items_responsible_insert"
  on public.menu_items
  for insert
  to authenticated
  with check (
    public.is_establishment_responsible(menu_items.establishment_id)
    and exists (
      select 1
      from public.menu_categories c
      where c.id = menu_items.category_id
        and c.establishment_id = menu_items.establishment_id
    )
  );

create policy "menu_items_responsible_update"
  on public.menu_items
  for update
  to authenticated
  using (
    public.is_establishment_responsible(menu_items.establishment_id)
  )
  with check (
    public.is_establishment_responsible(menu_items.establishment_id)
    and exists (
      select 1
      from public.menu_categories c
      where c.id = menu_items.category_id
        and c.establishment_id = menu_items.establishment_id
    )
  );
