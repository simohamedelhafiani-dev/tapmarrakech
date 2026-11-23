-- KELYANI WhatsApp: private tenant-scoped connection storage.
-- Tokens are never exposed to authenticated client roles.
CREATE TABLE IF NOT EXISTS public.whatsapp_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  connected_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  meta_access_token text NOT NULL,
  token_type text,
  token_expires_at timestamptz,
  waba_id text,
  phone_number_id text,
  business_phone text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','connected','disconnected','error')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.whatsapp_connections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_connections FROM anon, authenticated;
GRANT ALL ON public.whatsapp_connections TO service_role;
