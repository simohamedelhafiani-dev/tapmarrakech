begin;
select plan(17);
select has_table('public','smart_marketing_configs','Smart configuration table exists');
select has_table('public','smart_marketing_queue','queue table exists');
select has_table('public','smart_marketing_runs','run log table exists');
select has_column('public','smart_marketing_queue','trigger_key','queue trigger key exists');
select has_column('public','smart_marketing_queue','status','queue lifecycle status exists');
select has_column('public','smart_marketing_queue','recovery_count','failed event recovery attempts are capped');
select has_column('public','smart_marketing_queue','processing_started_at','processing lease timestamp exists');
select has_column('public','loyalty_card_notifications','smart_marketing_queue_id','notification idempotency link exists');
select has_index('public','loyalty_card_notifications','loyalty_card_notifications_smart_queue_unique','notifications are unique per Smart queue item');
select has_function('public','claim_smart_marketing_queue','atomic queue claim function exists');
select has_trigger('public','smart_marketing_queue','smart_marketing_queue_tenant_guard','queue enforces customer-establishment ownership');
select has_function('public','smart_marketing_queue_validate_tenant','queue tenant guard trigger function exists');
select ok(not has_table_privilege('anon','public.smart_marketing_queue','SELECT')
 and not has_table_privilege('authenticated','public.smart_marketing_queue','SELECT')
 and has_table_privilege('service_role','public.smart_marketing_queue','SELECT'),
 'queue table is inaccessible to client roles and available to service_role');
select ok(not has_function_privilege('anon','public.smart_marketing_queue_validate_tenant()','EXECUTE')
 and not has_function_privilege('authenticated','public.smart_marketing_queue_validate_tenant()','EXECUTE'),
 'tenant guard function is not directly executable by client roles');
select ok(not has_function_privilege('anon','public.claim_smart_marketing_queue(integer)','EXECUTE')
 and not has_function_privilege('authenticated','public.claim_smart_marketing_queue(integer)','EXECUTE')
 and has_function_privilege('service_role','public.claim_smart_marketing_queue(integer)','EXECUTE'),
 'queue claim function is restricted to service_role');
select has_function('public','requeue_failed_smart_marketing_queue','FAILED/SKIPPED event recovery RPC exists');
select ok(not has_function_privilege('anon','public.requeue_failed_smart_marketing_queue(uuid,uuid,text,text,jsonb)','EXECUTE')
 and not has_function_privilege('authenticated','public.requeue_failed_smart_marketing_queue(uuid,uuid,text,text,jsonb)','EXECUTE')
 and has_function_privilege('service_role','public.requeue_failed_smart_marketing_queue(uuid,uuid,text,text,jsonb)','EXECUTE'),
 'terminal recovery RPC is restricted to service_role');
select * from finish();
rollback;
