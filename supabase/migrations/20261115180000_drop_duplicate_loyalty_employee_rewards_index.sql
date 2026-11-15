-- Remove a redundant unique index on the same key columns.
-- Keep loyalty_employee_rewards_customer_employee_unique as the canonical index.
-- The duplicate is not backing a PostgreSQL constraint (verified on Staging).
DROP INDEX IF EXISTS public.loyalty_employee_rewards_unique_customer_employee;
