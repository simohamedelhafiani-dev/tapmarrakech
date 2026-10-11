-- Restore responsible CRUD permissions for menu items.
-- Access remains restricted to the responsible user's establishment.

drop policy if exists "menu_items_responsible_insert" on public.menu_items;
drop policy if exists "menu_items_responsible_update" on public.menu_items;
drop policy if exists "menu_items_responsible_delete" on public.menu_items;

create policy "menu_items_responsible_insert"
  on public.menu_items
  for insert
  to authenticated
  with check (
    public.is_establishment_responsible(establishment_id)
    and exists (
      select 1
      from public.menu_categories c
      where c.id = category_id
        and c.establishment_id = establishment_id
    )
  );

create policy "menu_items_responsible_update"
  on public.menu_items
  for update
  to authenticated
  using (
    public.is_establishment_responsible(establishment_id)
  )
  with check (
    public.is_establishment_responsible(establishment_id)
    and exists (
      select 1
      from public.menu_categories c
      where c.id = category_id
        and c.establishment_id = establishment_id
    )
  );

create policy "menu_items_responsible_delete"
  on public.menu_items
  for delete
  to authenticated
  using (
    public.is_establishment_responsible(establishment_id)
  );
