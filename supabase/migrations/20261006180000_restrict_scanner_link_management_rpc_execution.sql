-- Pre-commercial hardening: scanner-link management is authenticated-only.
-- The trigger function ensure_establishment_scanner_link() is intentionally left
-- executable because PostgreSQL invokes it from the establishments trigger.
REVOKE EXECUTE ON FUNCTION public.get_or_create_establishment_scanner_link(uuid)
FROM anon, public;
