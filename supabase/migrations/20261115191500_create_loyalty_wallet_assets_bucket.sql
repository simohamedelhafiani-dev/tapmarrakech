-- Wallet design assets: public read for Google Wallet image fetches, owner-scoped writes.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loyalty-assets', 'loyalty-assets', true, 8388608, array['image/png','image/jpeg','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Wallet assets public read" on storage.objects;
create policy "Wallet assets public read"
on storage.objects for select to public
using (bucket_id = 'loyalty-assets');

drop policy if exists "Wallet assets owner upload" on storage.objects;
create policy "Wallet assets owner upload"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'loyalty-assets'
  and array_length(storage.foldername(name), 1) >= 2
  and case
    when public.is_tapmarrakech_admin() then true
    when array_length(storage.foldername(name), 1) >= 2
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.user_owns_establishment((storage.foldername(name))[2]::uuid)
    else false
  end
);

drop policy if exists "Wallet assets owner update" on storage.objects;
create policy "Wallet assets owner update"
on storage.objects for update to authenticated
using (
  bucket_id = 'loyalty-assets'
  and array_length(storage.foldername(name), 1) >= 2
  and case
    when public.is_tapmarrakech_admin() then true
    when array_length(storage.foldername(name), 1) >= 2
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.user_owns_establishment((storage.foldername(name))[2]::uuid)
    else false
  end
)
with check (
  bucket_id = 'loyalty-assets'
  and array_length(storage.foldername(name), 1) >= 2
  and case
    when public.is_tapmarrakech_admin() then true
    when array_length(storage.foldername(name), 1) >= 2
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.user_owns_establishment((storage.foldername(name))[2]::uuid)
    else false
  end
);

drop policy if exists "Wallet assets owner delete" on storage.objects;
create policy "Wallet assets owner delete"
on storage.objects for delete to authenticated
using (
  bucket_id = 'loyalty-assets'
  and array_length(storage.foldername(name), 1) >= 2
  and case
    when public.is_tapmarrakech_admin() then true
    when array_length(storage.foldername(name), 1) >= 2
      and (storage.foldername(name))[2] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then public.user_owns_establishment((storage.foldername(name))[2]::uuid)
    else false
  end
);
