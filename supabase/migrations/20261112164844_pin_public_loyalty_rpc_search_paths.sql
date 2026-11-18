-- Pin privileged public loyalty RPCs to trusted schemas and place pg_temp last.
-- Some production installations never had the legacy enrollment overloads.
DO $migration$
DECLARE
  target record;
  fn regprocedure;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('public.consume_loyalty_card_recovery(uuid)', 'pg_catalog, public, pg_temp'),
      ('public.create_public_loyalty_stamp_reward_claim(uuid)', 'pg_catalog, public, pg_temp'),
      ('public.get_public_loyalty_stamp_reward_claim(uuid)', 'pg_catalog, public, pg_temp'),
      ('public.register_public_loyalty_customer_for_enrollment_v2(uuid,text,text,text,date,text,text[],boolean,boolean,text,text)', 'pg_catalog, public, pg_temp'),
      ('public.register_public_loyalty_customer_for_enrollment_v3(uuid,text,text,text,date,text,text[],boolean,boolean,text,text)', 'pg_catalog, public, pg_temp'),
      ('public.register_public_loyalty_customer_with_referral(text,text,text,text,date)', 'pg_catalog, public, pg_temp')
    ) AS targets(signature, trusted_path)
  LOOP
    fn := to_regprocedure(target.signature);
    IF fn IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = %s', fn, target.trusted_path);
    END IF;
  END LOOP;
END
$migration$;

