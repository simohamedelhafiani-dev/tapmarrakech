-- Coexistence webhook persistence contract and tenant-safe service-only access.
DO $test$
DECLARE
  v_upsert oid;
  v_contact oid;
BEGIN
  IF to_regclass('public.whatsapp_contacts') IS NULL
     OR to_regclass('public.whatsapp_history_sync_chunks') IS NULL THEN
    RAISE EXCEPTION 'WhatsApp coexistence persistence tables are missing';
  END IF;

  IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.whatsapp_contacts'::regclass)
     OR NOT (SELECT relrowsecurity FROM pg_class WHERE oid='public.whatsapp_history_sync_chunks'::regclass) THEN
    RAISE EXCEPTION 'WhatsApp coexistence tables must have RLS enabled';
  END IF;

  IF has_table_privilege('anon','public.whatsapp_contacts','SELECT')
     OR has_table_privilege('authenticated','public.whatsapp_contacts','SELECT')
     OR has_table_privilege('anon','public.whatsapp_history_sync_chunks','SELECT')
     OR has_table_privilege('authenticated','public.whatsapp_history_sync_chunks','SELECT') THEN
    RAISE EXCEPTION 'WhatsApp coexistence persistence tables must not be directly readable by clients';
  END IF;

  v_upsert := to_regprocedure('public.upsert_whatsapp_conversation(uuid,uuid,text,text,timestamp with time zone)');
  v_contact := to_regprocedure('public.apply_whatsapp_contact_sync_event(uuid,uuid,text,text,boolean,timestamp with time zone)');
  IF v_upsert IS NULL OR v_contact IS NULL THEN
    RAISE EXCEPTION 'WhatsApp coexistence persistence RPCs are missing';
  END IF;

  IF has_function_privilege('anon',v_upsert,'EXECUTE')
     OR has_function_privilege('authenticated',v_upsert,'EXECUTE')
     OR NOT has_function_privilege('service_role',v_upsert,'EXECUTE')
     OR has_function_privilege('anon',v_contact,'EXECUTE')
     OR has_function_privilege('authenticated',v_contact,'EXECUTE')
     OR NOT has_function_privilege('service_role',v_contact,'EXECUTE') THEN
    RAISE EXCEPTION 'WhatsApp persistence RPC grants are not service-role-only';
  END IF;
END
$test$;
