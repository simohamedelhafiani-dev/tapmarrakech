-- Menu item photos
insert into storage.buckets (id, name, public)
values ('menu-images', 'menu-images', true)
on conflict (id) do update set public = true;

drop policy if exists "Menu images public read" on storage.objects;
create policy "Menu images public read"
on storage.objects for select
to public
using (bucket_id = 'menu-images');

drop policy if exists "Menu images authenticated upload" on storage.objects;
create policy "Menu images authenticated upload"
on storage.objects for insert
to authenticated
with check (bucket_id = 'menu-images');

drop policy if exists "Menu images authenticated update" on storage.objects;
create policy "Menu images authenticated update"
on storage.objects for update
to authenticated
using (bucket_id = 'menu-images')
with check (bucket_id = 'menu-images');

drop policy if exists "Menu images authenticated delete" on storage.objects;
create policy "Menu images authenticated delete"
on storage.objects for delete
to authenticated
using (bucket_id = 'menu-images');
