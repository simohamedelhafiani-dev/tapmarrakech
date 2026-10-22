/*
  Restore the missing core loyalty_customers table in the versioned migration chain.
  This is a schema-only baseline: no production data is read or changed.
  Later migrations remain responsible for access policies, indexes that depend on
  helper functions, and the loyalty-card refresh/automation triggers.
*/
CREATE TABLE IF NOT EXISTS public.loyalty_customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  phone text NOT NULL,
  first_name text NOT NULL DEFAULT '',
  last_name text,
  points_balance integer NOT NULL DEFAULT 0 CHECK (points_balance >= 0),
  total_points_earned integer NOT NULL DEFAULT 0 CHECK (total_points_earned >= 0),
  total_points_redeemed integer NOT NULL DEFAULT 0 CHECK (total_points_redeemed >= 0),
  visit_count integer NOT NULL DEFAULT 0 CHECK (visit_count >= 0),
  last_visit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  birth_date date,
  loyalty_number text,
  created_by_employee_id uuid,
  stamps_balance integer NOT NULL DEFAULT 0 CHECK (stamps_balance >= 0),
  stamps_total integer NOT NULL DEFAULT 0 CHECK (stamps_total >= 0),
  referral_code text,
  email text,
  interests text[] NOT NULL DEFAULT '{}'::text[],
  marketing_consent boolean NOT NULL DEFAULT false,
  notification_consent boolean NOT NULL DEFAULT false,
  preferred_channel text NOT NULL DEFAULT 'WHATSAPP'
    CHECK (preferred_channel IN ('WHATSAPP','SMS','EMAIL','PUSH','NONE')),
  visit_frequency text
    CHECK (visit_frequency IS NULL OR visit_frequency IN ('WEEKLY','MONTHLY','OCCASIONAL')),
  birth_day smallint CHECK (birth_day IS NULL OR birth_day BETWEEN 1 AND 31),
  birth_month smallint CHECK (birth_month IS NULL OR birth_month BETWEEN 1 AND 12)
);

CREATE INDEX IF NOT EXISTS loyalty_customers_establishment_idx
  ON public.loyalty_customers(establishment_id);
CREATE INDEX IF NOT EXISTS loyalty_customers_phone_idx
  ON public.loyalty_customers(phone);
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_customers_loyalty_number_unique
  ON public.loyalty_customers(loyalty_number) WHERE loyalty_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_customers_referral_code_uidx
  ON public.loyalty_customers(referral_code) WHERE referral_code IS NOT NULL;

ALTER TABLE public.loyalty_customers ENABLE ROW LEVEL SECURITY;
