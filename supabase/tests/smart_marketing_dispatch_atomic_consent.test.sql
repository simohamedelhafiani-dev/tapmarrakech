BEGIN;
SELECT plan(8);

SELECT has_function(
  'public',
  'smart_marketing_dispatch_notification_atomic',
  ARRAY['uuid','text','text','text'],
  'atomic Smart Marketing notification RPC exists'
);

SELECT ok(
  (SELECT prosecdef FROM pg_proc
   WHERE oid='public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)'::regprocedure),
  'atomic notification RPC runs as SECURITY DEFINER'
);

SELECT ok(
  (SELECT proconfig @> ARRAY['search_path=pg_catalog, public']::text[]
   FROM pg_proc
   WHERE oid='public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)'::regprocedure),
  'atomic notification RPC pins its search_path'
);

SELECT ok(
  has_function_privilege('service_role','public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)','EXECUTE'),
  'service_role can execute the atomic notification RPC'
);

SELECT ok(
  NOT has_function_privilege('anon','public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)','EXECUTE')
  AND NOT has_function_privilege('authenticated','public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)','EXECUTE'),
  'client roles cannot execute the atomic notification RPC'
);

SELECT ok(
  (SELECT pg_get_functiondef('public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)'::regprocedure) ILIKE '%FOR UPDATE%'
    AND pg_get_functiondef('public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)'::regprocedure) ILIKE '%notification_consent%'
    AND pg_get_functiondef('public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)'::regprocedure) ILIKE '%marketing_consent%'),
  'delivery locks the customer row and rechecks both communication consents'
);

SELECT has_index(
  'public',
  'loyalty_card_notifications',
  'loyalty_card_notifications_smart_queue_unique',
  'notification idempotency is enforced per queue item'
);

SELECT ok(
  (SELECT pg_get_functiondef('public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)'::regprocedure) ILIKE '%ON CONFLICT%'
    AND pg_get_functiondef('public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)'::regprocedure) ILIKE '%status = ''SENT''%'
    AND pg_get_functiondef('public.smart_marketing_dispatch_notification_atomic(uuid,text,text,text)'::regprocedure) ILIKE '%status = ''SKIPPED''%'),
  'atomic delivery preserves idempotency and terminal queue states'
);

SELECT * FROM finish();
ROLLBACK;
