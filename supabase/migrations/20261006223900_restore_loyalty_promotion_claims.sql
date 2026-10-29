-- Restore the promotion-claim table used by the public loyalty promotion RPCs.
-- This object exists in the live schema; keeping it in migration history is
-- required for clean Supabase reconstruction and the pending-claim uniqueness migration.
CREATE TABLE IF NOT EXISTS public.loyalty_promotion_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.loyalty_customers(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL,
  promotion_id uuid NOT NULL REFERENCES public.promotions(id) ON DELETE CASCADE,
  claim_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '5 minutes'),
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_promotion_claims_customer_idx
  ON public.loyalty_promotion_claims(customer_id);

CREATE INDEX IF NOT EXISTS loyalty_promotion_claims_promotion_idx
  ON public.loyalty_promotion_claims(promotion_id);

CREATE INDEX IF NOT EXISTS loyalty_promotion_claims_token_idx
  ON public.loyalty_promotion_claims(claim_token);

REVOKE ALL ON public.loyalty_promotion_claims FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.loyalty_promotion_claims TO service_role;
