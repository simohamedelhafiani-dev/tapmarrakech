-- Store WhatsApp Cloud API tokens only in Supabase Vault and expose
-- narrowly scoped service-role RPCs for the Edge Functions.
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;

-- Some environments already have a WhatsApp foundation schema whose connection
-- table predates the repository migrations. Add the legacy-compatible columns
-- when absent; fresh databases already receive them from the initial migration.
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS connected_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS meta_access_token text;

-- Move any tokens saved by the earlier schema into Vault before allowing the
-- legacy plaintext column to be null. Existing connections keep their linkage.
DO $$
DECLARE
  connection_row record;
  secret_id uuid;
BEGIN
  FOR connection_row IN
    SELECT id, meta_access_token
    FROM public.whatsapp_connections
    WHERE meta_access_token IS NOT NULL
      AND btrim(meta_access_token) <> ''
      AND access_token_secret_id IS NULL
  LOOP
    secret_id := vault.create_secret(
      connection_row.meta_access_token,
      'whatsapp-access-migrated-' || connection_row.id::text,
      'Migrated WhatsApp Cloud API token for a KELYANI establishment'
    );

    UPDATE public.whatsapp_connections
    SET access_token_secret_id = secret_id,
        meta_access_token = NULL,
        updated_at = now()
    WHERE id = connection_row.id;
  END LOOP;
END;
$$;

-- New connections keep only the Vault UUID. connected_by remains required and
-- is written by whatsapp-oauth-exchange.
ALTER TABLE public.whatsapp_connections
  ALTER COLUMN meta_access_token DROP NOT NULL;

CREATE OR REPLACE FUNCTION public.whatsapp_store_secret(p_secret text, p_name text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_secret IS NULL OR length(p_secret) < 20 OR length(p_secret) > 4096 THEN
    RAISE EXCEPTION 'invalid_secret';
  END IF;
  IF p_name IS NULL OR length(p_name) < 1 OR length(p_name) > 200 THEN
    RAISE EXCEPTION 'invalid_secret_name';
  END IF;

  RETURN vault.create_secret(
    p_secret,
    p_name,
    'WhatsApp Cloud API access token managed by KELYANI'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.whatsapp_read_secret(p_secret_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  secret_value text;
BEGIN
  IF coalesce(auth.role(), '') <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required' USING ERRCODE = '42501';
  END IF;
  IF p_secret_id IS NULL THEN
    RAISE EXCEPTION 'secret_id_required';
  END IF;

  SELECT decrypted_secret
  INTO secret_value
  FROM vault.decrypted_secrets
  WHERE id = p_secret_id;

  RETURN secret_value;
END;
$$;

REVOKE ALL ON FUNCTION public.whatsapp_store_secret(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.whatsapp_read_secret(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.whatsapp_store_secret(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.whatsapp_read_secret(uuid) TO service_role;
