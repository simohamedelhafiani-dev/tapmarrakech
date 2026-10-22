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

/*
  Core loyalty program tables referenced by the quick-access and scanner
  migrations. Later feature migrations add RPCs, policies, and evolving fields.
*/
CREATE TABLE IF NOT EXISTS public.loyalty_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  points_per_currency numeric NOT NULL DEFAULT 1,
  currency text NOT NULL DEFAULT 'MAD',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  redemption_mode text DEFAULT 'BOTH',
  max_discount_percent numeric DEFAULT 10,
  discount_enabled boolean DEFAULT true,
  employee_reward_enabled boolean DEFAULT false,
  employee_reward_visits integer DEFAULT 3,
  employee_reward_points integer DEFAULT 0,
  employee_reward_amount numeric DEFAULT 0,
  birthday_reward_enabled boolean DEFAULT false,
  birthday_reward_name text,
  birthday_reward_description text,
  birthday_reward_points integer DEFAULT 0,
  birthday_reward_amount numeric DEFAULT 0,
  program_type text NOT NULL DEFAULT 'POINTS',
  stamp_goal integer NOT NULL DEFAULT 10,
  stamp_reward_name text,
  stamp_reward_description text,
  discount_percent numeric,
  discount_valid_days integer NOT NULL DEFAULT 7,
  referral_draft_config jsonb NOT NULL DEFAULT '{"enabled":false,"max_referrals":null,"referee_bonus_type":"POINTS","referee_bonus_value":0,"referrer_bonus_type":"POINTS","referee_bonus_points":0,"referrer_bonus_value":50,"referrer_bonus_points":50}'::jsonb,
  referral_config jsonb NOT NULL DEFAULT '{"enabled":false,"max_referrals":null,"referee_bonus_type":"POINTS","referee_bonus_value":0,"referrer_bonus_type":"POINTS","referee_bonus_points":0,"referrer_bonus_value":50,"referrer_bonus_points":50}'::jsonb,
  discount_points_threshold integer NOT NULL DEFAULT 1000
);

CREATE TABLE IF NOT EXISTS public.loyalty_rewards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  points_required integer NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  cost_mad numeric NOT NULL DEFAULT 0,
  reward_type text NOT NULL DEFAULT 'GIFT',
  discount_percent numeric(5,2),
  discount_max_amount numeric(12,2),
  valid_days text[] NOT NULL DEFAULT ARRAY['MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY']::text[]
);

CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.loyalty_customers(id) ON DELETE CASCADE,
  employee_id uuid,
  amount numeric,
  points integer NOT NULL,
  type text NOT NULL DEFAULT 'EARN',
  description text,
  transaction_reference text,
  created_at timestamptz NOT NULL DEFAULT now(),
  invoice_number text
);

CREATE INDEX IF NOT EXISTS loyalty_transactions_customer_created_idx
  ON public.loyalty_transactions(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loyalty_rewards_establishment_idx
  ON public.loyalty_rewards(establishment_id);
ALTER TABLE public.loyalty_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_transactions ENABLE ROW LEVEL SECURITY;
