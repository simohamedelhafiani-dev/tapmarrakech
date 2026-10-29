-- Restore the stamp-reward claim schema and public token RPCs in the versioned
-- migration chain. Production already has these objects; IF NOT EXISTS and
-- CREATE OR REPLACE make this migration safe to replay against that schema.
-- No customer data is inserted, updated, or deleted by this migration.

CREATE TABLE IF NOT EXISTS public.loyalty_stamp_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.loyalty_customers(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  claim_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  stamps_required integer NOT NULL,
  reward_name text NOT NULL,
  reward_description text,
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_stamp_reward_claims ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.create_public_loyalty_stamp_reward_claim(
  p_access_token uuid
)
RETURNS TABLE(claim_token uuid, reward_name text, stamps_required integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_customer uuid;
  v_establishment uuid;
  v_balance integer;
  v_goal integer;
  v_name text;
  v_description text;
  v_token uuid;
BEGIN
  SELECT l.customer_id, c.establishment_id, c.stamps_balance
  INTO v_customer, v_establishment, v_balance
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  WHERE l.access_token = p_access_token
  LIMIT 1;

  IF v_customer IS NULL THEN
    RAISE EXCEPTION 'Carte invalide';
  END IF;

  SELECT stamp_goal, stamp_reward_name, stamp_reward_description
  INTO v_goal, v_name, v_description
  FROM public.loyalty_settings
  WHERE establishment_id = v_establishment
    AND program_type = 'STAMP'
    AND enabled = true
  LIMIT 1;

  IF v_goal IS NULL THEN
    RAISE EXCEPTION 'Programme à tampons non actif';
  END IF;

  IF v_balance < v_goal THEN
    RAISE EXCEPTION 'Récompense pas encore débloquée';
  END IF;

  UPDATE public.loyalty_stamp_reward_claims
  SET status = 'EXPIRED'
  WHERE customer_id = v_customer
    AND status = 'PENDING'
    AND expires_at <= now();

  INSERT INTO public.loyalty_stamp_reward_claims (
    customer_id, establishment_id, stamps_required, reward_name, reward_description
  )
  VALUES (v_customer, v_establishment, v_goal, v_name, v_description)
  RETURNING loyalty_stamp_reward_claims.claim_token INTO v_token;

  RETURN QUERY SELECT v_token, v_name, v_goal;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_loyalty_stamp_reward_claim(
  p_claim_token uuid
)
RETURNS TABLE(
  claim_token uuid,
  establishment_id uuid,
  customer_id uuid,
  reward_name text,
  reward_description text,
  stamps_required integer,
  status text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT c.claim_token, c.establishment_id, c.customer_id, c.reward_name,
         c.reward_description, c.stamps_required, c.status, c.expires_at
  FROM public.loyalty_stamp_reward_claims c
  WHERE c.claim_token = p_claim_token;
$function$;

REVOKE ALL ON FUNCTION public.create_public_loyalty_stamp_reward_claim(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_loyalty_stamp_reward_claim(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_loyalty_stamp_reward_claim(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_stamp_reward_claim(uuid) TO anon, authenticated;
