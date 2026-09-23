-- Stabilise le périmètre du responsable :
-- - lecture des catégories uniquement
-- - CRUD opérationnel des plats
-- - aucune modification de la structure des catégories
--
-- La migration a été appliquée en production sous le nom
-- stabilize_responsable_menu_permissions.

drop policy if exists "menu_categories_responsable_all" on public.menu_categories;
drop policy if exists "menu_items_responsable_all" on public.menu_items;

create policy "menu_categories_responsable_select"
on public.menu_categories
for select
to authenticated
using (public.is_establishment_responsible(establishment_id));

create policy "menu_items_responsable_select"
on public.menu_items
for select
to authenticated
using (public.is_establishment_responsible(establishment_id));

create policy "menu_items_responsable_insert"
on public.menu_items
for insert
to authenticated
with check (public.is_establishment_responsible(establishment_id));

create policy "menu_items_responsable_update"
on public.menu_items
for update
to authenticated
using (public.is_establishment_responsible(establishment_id))
with check (public.is_establishment_responsible(establishment_id));

create policy "menu_items_responsable_delete"
on public.menu_items
for delete
to authenticated
using (public.is_establishment_responsible(establishment_id));
