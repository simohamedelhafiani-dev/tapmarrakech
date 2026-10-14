create extension if not exists pg_cron;
select cron.schedule('kelyani-process-loyalty-raffles','* * * * *','select public.process_due_loyalty_raffles()');
