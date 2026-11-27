-- Persist WhatsApp Business App contacts and coexistence history progress.
CREATE TABLE IF NOT EXISTS public.whatsapp_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  customer_phone text NOT NULL,
  customer_name text,
  active boolean NOT NULL DEFAULT true,
  last_event_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_contacts_phone_nonempty CHECK (length(trim(customer_phone)) BETWEEN 5 AND 32),
  CONSTRAINT whatsapp_contacts_connection_phone_key UNIQUE (connection_id, customer_phone)
);

CREATE TABLE IF NOT EXISTS public.whatsapp_history_sync_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  connection_id uuid NOT NULL REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  phase smallint NOT NULL DEFAULT -1 CHECK (phase BETWEEN -1 AND 2),
  chunk_order integer NOT NULL DEFAULT -1 CHECK (chunk_order >= -1),
  progress integer NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','completed','declined')),
  error_code integer,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT whatsapp_history_sync_chunks_key UNIQUE (connection_id, phase, chunk_order)
);

ALTER TABLE public.whatsapp_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_history_sync_chunks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_contacts, public.whatsapp_history_sync_chunks FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.whatsapp_contacts, public.whatsapp_history_sync_chunks TO service_role;

CREATE OR REPLACE FUNCTION public.upsert_whatsapp_conversation(
  p_establishment_id uuid,
  p_connection_id uuid,
  p_customer_phone text,
  p_customer_name text,
  p_message_at timestamptz
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_conversation_id uuid;
BEGIN
  IF p_establishment_id IS NULL OR p_connection_id IS NULL
     OR p_customer_phone IS NULL
     OR p_customer_phone !~ '^\+?[0-9]{5,32}$' THEN
    RAISE EXCEPTION 'invalid_whatsapp_conversation_identity';
  END IF;

  INSERT INTO public.whatsapp_conversations (
    establishment_id, connection_id, customer_phone, customer_name, last_message_at, updated_at
  )
  VALUES (
    p_establishment_id, p_connection_id, p_customer_phone,
    nullif(trim(coalesce(p_customer_name, '')), ''),
    coalesce(p_message_at, now()), now()
  )
  ON CONFLICT (connection_id, customer_phone) DO UPDATE
  SET customer_name = coalesce(
        nullif(trim(EXCLUDED.customer_name), ''),
        public.whatsapp_conversations.customer_name
      ),
      last_message_at = greatest(
        public.whatsapp_conversations.last_message_at,
        EXCLUDED.last_message_at
      ),
      updated_at = now()
  RETURNING id INTO v_conversation_id;

  RETURN v_conversation_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.apply_whatsapp_contact_sync_event(
  p_establishment_id uuid,
  p_connection_id uuid,
  p_customer_phone text,
  p_customer_name text,
  p_active boolean,
  p_event_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_applied boolean := false;
BEGIN
  IF p_establishment_id IS NULL OR p_connection_id IS NULL
     OR p_customer_phone IS NULL
     OR p_customer_phone !~ '^\+?[0-9]{5,32}$'
     OR p_event_at IS NULL THEN
    RAISE EXCEPTION 'invalid_whatsapp_contact_event';
  END IF;

  INSERT INTO public.whatsapp_contacts (
    establishment_id, connection_id, customer_phone, customer_name, active, last_event_at, updated_at
  )
  VALUES (
    p_establishment_id, p_connection_id, p_customer_phone,
    nullif(trim(coalesce(p_customer_name, '')), ''),
    coalesce(p_active, true), p_event_at, now()
  )
  ON CONFLICT (connection_id, customer_phone) DO UPDATE
  SET customer_name = CASE WHEN EXCLUDED.active THEN EXCLUDED.customer_name ELSE NULL END,
      active = EXCLUDED.active,
      last_event_at = EXCLUDED.last_event_at,
      updated_at = now()
  WHERE EXCLUDED.last_event_at >= public.whatsapp_contacts.last_event_at
  RETURNING true INTO v_applied;

  RETURN coalesce(v_applied, false);
END;
$function$;

REVOKE ALL ON FUNCTION public.upsert_whatsapp_conversation(uuid,uuid,text,text,timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.apply_whatsapp_contact_sync_event(uuid,uuid,text,text,boolean,timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_whatsapp_conversation(uuid,uuid,text,text,timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.apply_whatsapp_contact_sync_event(uuid,uuid,text,text,boolean,timestamptz) TO service_role;
