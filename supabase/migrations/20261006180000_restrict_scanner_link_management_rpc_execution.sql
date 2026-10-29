-- Pre-commercial hardening: scanner-link management is authenticated-only.
-- The trigger function ensure_establishment_scanner_link() is intentionally left
-- executable as needed by PostgreSQL trigger invocation.
do $$
begin
  if to_regprocedure('public.get_or_create_establishment_scanner_link(uuid)') is not null then
    revoke execute on function public.get_or_create_establishment_scanner_link(uuid) from anon, public;
    grant execute on function public.get_or_create_establishment_scanner_link(uuid) to authenticated;
  end if;
end;
$$;
