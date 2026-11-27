BEGIN;
SELECT plan(3);
SELECT ok(to_regprocedure('public.apply_whatsapp_contact_sync_event(uuid,uuid,text,text,boolean,timestamp with time zone)') IS NOT NULL, 'contact sync RPC exists');
SELECT ok(
  pg_get_functiondef('public.apply_whatsapp_contact_sync_event(uuid,uuid,text,text,boolean,timestamp with time zone)'::regprocedure)
    ILIKE '%coalesce(%'
    AND pg_get_functiondef('public.apply_whatsapp_contact_sync_event(uuid,uuid,text,text,boolean,timestamp with time zone)'::regprocedure) ILIKE '%EXCLUDED.customer_name%'
    AND pg_get_functiondef('public.apply_whatsapp_contact_sync_event(uuid,uuid,text,text,boolean,timestamp with time zone)'::regprocedure) ILIKE '%public.whatsapp_contacts.customer_name%',
  'contact add without a name preserves the stored name'
);
SELECT ok(
  pg_get_functiondef('public.apply_whatsapp_contact_sync_event(uuid,uuid,text,text,boolean,timestamp with time zone)'::regprocedure)
    ILIKE '%ELSE NULL%',
  'contact removal clears the stored name'
);
SELECT * FROM finish();
ROLLBACK;
