-- Commercial audit: responsible users must be able to manage menu categories,
-- matching the existing responsible menu-item permissions and current UI behavior.
do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_categories'
      and policyname = 'menu_categories_responsible_insert'
  ) then
    create policy menu_categories_responsible_insert
      on public.menu_categories
      for insert
      to authenticated
      with check (is_establishment_responsible(establishment_id));
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'menu_categories'
      and policyname = 'menu_categories_responsible_delete'
  ) then
    create policy menu_categories_responsible_delete
      on public.menu_categories
      for delete
      to authenticated
      using (is_establishment_responsible(establishment_id));
  end if;
end
$$;
