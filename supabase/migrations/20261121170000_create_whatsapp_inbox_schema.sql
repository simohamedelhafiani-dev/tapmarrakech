-- Base schema for the tenant-scoped WhatsApp inbox and message delivery.
-- Access is restricted to service_role; user-facing access goes through the
-- authenticated Edge Functions which validate establishment membership.
CREATE TABLE IF NOT EXISTS public.whatsapp_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  last_message_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_conversations_connection_customer_unique UNIQUE (connection_id, customer_phone)
);

CREATE INDEX IF NOT EXISTS whatsapp_conversations_establishment_recent_idx
  ON public.whatsapp_conversations (establishment_id, last_message_at DESC);

CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  conversation_id uuid NOT NULL REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE,
  provider_message_id text,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_type text NOT NULL DEFAULT 'text',
  body text,
  delivery_status text NOT NULL CHECK (delivery_status IN ('received', 'queued', 'sent', 'delivered', 'read', 'failed')),
  raw_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS whatsapp_messages_provider_message_id_unique
  ON public.whatsapp_messages (provider_message_id)
  WHERE provider_message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whatsapp_messages_conversation_recent_idx
  ON public.whatsapp_messages (establishment_id, conversation_id, created_at DESC);

ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_conversations, public.whatsapp_messages FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.whatsapp_conversations, public.whatsapp_messages TO service_role;
