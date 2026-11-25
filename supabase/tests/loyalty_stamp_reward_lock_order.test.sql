-- Structural regression checks for the stamp-reward lock ordering.
DO $test$
DECLARE
  v_create_definition text;
  v_redeem_definition text;
  v_customer_lock_position integer;
  v_claim_lock_position integer;
BEGIN
  v_create_definition := pg_get_functiondef(
    'public.create_public_loyalty_stamp_reward_claim(uuid)'::regprocedure
  );
  IF position('FOR UPDATE OF c' IN v_create_definition) = 0 THEN
    RAISE EXCEPTION 'Claim creation must lock the customer row';
  END IF;
  IF position('expires_at <= now()' IN v_create_definition) = 0
     OR position('expires_at > now()' IN v_create_definition) = 0
     OR position('v_existing.claim_token' IN v_create_definition) = 0 THEN
    RAISE EXCEPTION 'Claim creation must expire stale claims and reuse a live claim';
  END IF;

  v_redeem_definition := pg_get_functiondef(
    'public.redeem_public_loyalty_stamp_reward_claim(uuid,uuid)'::regprocedure
  );
  v_customer_lock_position := position('FOR UPDATE OF customer' IN v_redeem_definition);
  v_claim_lock_position := position('FOR UPDATE OF claim' IN v_redeem_definition);

  IF v_customer_lock_position = 0 OR v_claim_lock_position = 0 THEN
    RAISE EXCEPTION 'Redemption must lock both customer and claim rows';
  END IF;
  IF v_customer_lock_position > v_claim_lock_position THEN
    RAISE EXCEPTION 'Lock inversion: redemption must lock customer before claim';
  END IF;
  IF position('claim.expires_at > now()' IN v_redeem_definition) = 0
     OR position('claim.customer_id = v_customer' IN v_redeem_definition) = 0 THEN
    RAISE EXCEPTION 'Redemption must revalidate claim ownership and expiry after waiting';
  END IF;
END
$test$;
