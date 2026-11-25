-- Keep Smart Reward notifications tied to one actual claim cycle.
-- A stamp balance can rise while one reward is still unclaimed; using the raw
-- balance in the queue key would enqueue another notification for every stamp.
CREATE INDEX IF NOT EXISTS loyalty_stamp_reward_claims_cycle_idx
  ON public.loyalty_stamp_reward_claims (establishment_id, customer_id, created_at DESC, id DESC);

CREATE OR REPLACE FUNCTION public.get_smart_marketing_reward_cycles(p_establishment_id uuid)
RETURNS TABLE(customer_id uuid, claim_id uuid, claim_status text, expires_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
  SELECT DISTINCT ON (claim.customer_id)
    claim.customer_id,
    claim.id,
    claim.status,
    claim.expires_at
  FROM public.loyalty_stamp_reward_claims AS claim
  WHERE p_establishment_id IS NOT NULL
    AND claim.establishment_id = p_establishment_id
  ORDER BY claim.customer_id, claim.created_at DESC, claim.id DESC;
$function$;

REVOKE ALL ON FUNCTION public.get_smart_marketing_reward_cycles(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_smart_marketing_reward_cycles(uuid) TO service_role;
