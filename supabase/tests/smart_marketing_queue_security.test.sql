begin;
select plan(9);
select has_table('public','smart_marketing_configs','Smart configuration table exists');
select has_table('public','smart_marketing_queue','queue table exists');
select has_table('public','smart_marketing_runs','run log table exists');
select has_column('public','smart_marketing_queue','trigger_key','queue trigger key exists');
select has_column('public','smart_marketing_queue','status','queue lifecycle status exists');
select has_column('public','loyalty_card_notifications','smart_marketing_queue_id','notification idempotency link exists');
select has_index('public','loyalty_card_notifications','loyalty_card_notifications_smart_queue_unique','notifications are unique per Smart queue item');
select has_function('public','claim_smart_marketing_queue','atomic queue claim function exists');
select ok(not has_function_privilege('anon','public.claim_smart_marketing_queue(integer)','EXECUTE')
 and not has_function_privilege('authenticated','public.claim_smart_marketing_queue(integer)','EXECUTE')
 and has_function_privilege('service_role','public.claim_smart_marketing_queue(integer)','EXECUTE'),
 'queue claim function is restricted to service_role');
select * from finish();
rollback;
