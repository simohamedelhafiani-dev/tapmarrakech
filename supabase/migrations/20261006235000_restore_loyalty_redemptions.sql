-- Restore the employee reward audit ledger used by the employee loyalty workflow.
CREATE TABLE IF NOT EXISTS public.loyalty_employee_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.loyalty_customers(id) ON DELETE CASCADE,
  employee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  visits_required integer NOT NULL,
  visits_reached integer NOT NULL,
  reward_points integer NOT NULL DEFAULT 0,
  reward_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'AWARDED' CHECK (status IN ('AWARDED', 'PAID', 'CANCELLED')),
  awarded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_employee_rewards_customer_idx
  ON public.loyalty_employee_rewards(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loyalty_employee_rewards_establishment_idx
  ON public.loyalty_employee_rewards(establishment_id, created_at DESC);

ALTER TABLE public.loyalty_employee_rewards ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loyalty_employee_rewards FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.loyalty_employee_rewards TO service_role;

-- Restore the redemption ledger required by loyalty reward/discount flows.
-- Shape and constraints are aligned with the existing production schema.
CREATE TABLE IF NOT EXISTS public.loyalty_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.loyalty_customers(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE RESTRICT,
  employee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  points_used integer NOT NULL CHECK (points_used > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  invoice_number text,
  invoice_amount numeric,
  discount_amount numeric,
  amount_paid numeric,
  payment_method text DEFAULT 'CASH' CHECK (payment_method IN ('CASH', 'CARD', 'OTHER')),
  redemption_type text DEFAULT 'REWARD' CHECK (redemption_type IN ('REWARD', 'DISCOUNT')),
  reward_cost_mad numeric NOT NULL DEFAULT 0 CHECK (reward_cost_mad >= 0),
  CONSTRAINT loyalty_redemptions_amounts_check
    CHECK (
      COALESCE(invoice_amount, 0) >= 0
      AND COALESCE(discount_amount, 0) >= 0
      AND COALESCE(amount_paid, 0) >= 0
    )
);

CREATE INDEX IF NOT EXISTS loyalty_redemptions_customer_idx
  ON public.loyalty_redemptions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loyalty_redemptions_establishment_idx
  ON public.loyalty_redemptions(establishment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loyalty_redemptions_reward_idx
  ON public.loyalty_redemptions(reward_id);

ALTER TABLE public.loyalty_redemptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loyalty_redemptions FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.loyalty_redemptions TO service_role;
