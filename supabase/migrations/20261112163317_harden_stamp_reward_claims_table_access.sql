-- Keep stamp reward claims accessible only through the token-validated SECURITY DEFINER RPCs.
-- The public scanner/customer flows use get/create/redeem RPCs; direct table grants
-- are unnecessary and the prior authenticated policy did not scope responsables
-- to their active establishment membership.
REVOKE ALL PRIVILEGES ON TABLE public.loyalty_stamp_reward_claims FROM anon, authenticated;

DROP POLICY IF EXISTS loyalty_stamp_claims_admin_all
  ON public.loyalty_stamp_reward_claims;
