-- Commercial audit: responsible users must be able to manage menu categories,
-- matching the existing responsible menu-item permissions and current UI behavior.
create policy if not exists menu_categories_responsible_insert
on public.menu_categories
for insert
to authenticated
with check (is_establishment_responsible(establishment_id));

create policy if not exists menu_categories_responsible_delete
on public.menu_categories
for delete
to authenticated
using (is_establishment_responsible(establishment_id));
