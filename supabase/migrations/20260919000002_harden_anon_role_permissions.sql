/*
  TapMarrakech — Point 4
  Harden anonymous privileges on role-sensitive tables.

  Scope:
  - Remove direct table privileges from the anon role only.
  - Preserve all authenticated privileges and existing RLS policies.
  - No data modification, deletion, truncation, or schema removal.
  - Public/anonymous workflows that need these tables must use existing
    SECURITY DEFINER RPCs / Edge Functions.
*/

BEGIN;

REVOKE ALL PRIVILEGES ON TABLE public.profiles FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.establishment_staff FROM anon;

COMMIT;
