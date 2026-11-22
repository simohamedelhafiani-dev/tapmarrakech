-- Reconcile the WhatsApp connection schema with the Embedded Signup and webhook/send functions.
-- Keep legacy columns for compatibility; the new token reference is Vault-only.
ALTER TABLE public.whatsapp_connections
  ADD COLUMN IF NOT EXISTS access_token_secret_id uuid,
  ADD COLUMN IF NOT EXISTS display_phone_number text,
  ADD COLUMN IF NOT EXISTS business_name text,
  ADD COLUMN IF NOT EXISTS auto_reply_enabled boolean NOT NULL DEFAULT false;

-- The active Embedded Signup flow uses the status "active".
-- Preserve existing connected rows by translating them to the canonical status.
ALTER TABLE public.whatsapp_connections
  DROP CONSTRAINT IF EXISTS whatsapp_connections_status_check;

UPDATE public.whatsapp_connections
SET status = 'active'
WHERE status = 'connected';

ALTER TABLE public.whatsapp_connections
  ADD CONSTRAINT whatsapp_connections_status_check
  CHECK (status IN ('pending', 'active', 'connected', 'disconnected', 'error'));

-- Prevent ambiguous webhook phone-number lookups and keep one phone ID attached
-- to at most one connection. NULL values remain permitted for unconfigured rows.
CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_connections_phone_number_id_unique
  ON public.whatsapp_connections (phone_number_id)
  WHERE phone_number_id IS NOT NULL;
