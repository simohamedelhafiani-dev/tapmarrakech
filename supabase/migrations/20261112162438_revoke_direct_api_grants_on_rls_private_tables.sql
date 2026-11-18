-- Revoke direct table access only where the optional tables exist in this environment.
-- WhatsApp remains an incomplete feature and its tables are not present in Production.
DO $guard$
DECLARE
  v_table text;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'loyalty_customer_links',
    'loyalty_rewards',
    'whatsapp_connections',
    'whatsapp_consent_events',
    'whatsapp_conversations',
    'whatsapp_handoff_requests',
    'whatsapp_messages'
  ] LOOP
    IF to_regclass(format('public.%I', v_table)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
        v_table
      );
    END IF;
  END LOOP;
END;
$guard$;

