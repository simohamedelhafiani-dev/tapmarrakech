-- Preserve an existing WhatsApp contact name when Meta sends an add event
-- without a name. A remove event still clears the name.
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
  SET customer_name = CASE
        WHEN EXCLUDED.active THEN coalesce(
          EXCLUDED.customer_name,
          public.whatsapp_contacts.customer_name
        )
        ELSE NULL
      END,
      active = EXCLUDED.active,
      last_event_at = EXCLUDED.last_event_at,
      updated_at = now()
  WHERE EXCLUDED.last_event_at >= public.whatsapp_contacts.last_event_at
  RETURNING true INTO v_applied;

  RETURN coalesce(v_applied, false);
END;
$function$;
