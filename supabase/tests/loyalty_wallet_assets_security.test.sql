begin;

select plan(7);

select ok(
  exists (
    select 1 from storage.buckets
    where id = 'loyalty-assets'
      and public = true
      and file_size_limit = 8388608
  ),
  'Wallet asset bucket is public-read with an 8 MiB upload limit'
);

select ok(
  (select relrowsecurity from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'storage' and c.relname = 'objects'),
  'storage.objects keeps row-level security enabled'
);

select ok(
  (select with_check like '%is_tapmarrakech_admin%'
          and with_check like '%user_owns_establishment%'
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'Wallet assets owner upload'),
  'Wallet asset uploads are limited to establishment owners and authorized admins'
);

select ok(
  (select qual like '%is_tapmarrakech_admin%'
          and qual like '%user_owns_establishment%'
          and with_check like '%is_tapmarrakech_admin%'
          and with_check like '%user_owns_establishment%'
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'Wallet assets owner update'),
  'Wallet asset updates check both the old and new object ownership'
);

select ok(
  (select qual like '%is_tapmarrakech_admin%'
          and qual like '%user_owns_establishment%'
   from pg_policies
   where schemaname = 'storage' and tablename = 'objects'
     and policyname = 'Wallet assets owner delete'),
  'Wallet asset deletion is limited to establishment owners and authorized admins'
);

select ok(
  (select prosecdef and has_function_privilege('authenticated', oid, 'EXECUTE')
   from pg_proc where oid = 'public.is_tapmarrakech_admin()'::regprocedure),
  'admin authorization helper is SECURITY DEFINER and callable by authenticated users'
);

select ok(
  not has_function_privilege('anon', 'public.is_tapmarrakech_admin()', 'EXECUTE'),
  'anonymous users cannot call the admin authorization helper'
);

select * from finish();
rollback;
