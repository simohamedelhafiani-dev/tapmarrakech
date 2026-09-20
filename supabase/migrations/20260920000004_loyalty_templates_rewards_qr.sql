/*
  Loyalty templates + configurable rewards + one-time QR redemption.
  Keeps the existing scanner architecture: scanner token remains the employee access key.
*/

CREATE TABLE IF NOT EXISTS public.loyalty_card_designs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  template_id text NOT NULL DEFAULT 'luxury',
  primary_color text NOT NULL DEFAULT '#173D32',
  secondary_color text NOT NULL DEFAULT '#D3A84C',
  background_color text NOT NULL DEFAULT '#F7F7F3',
  text_color text NOT NULL DEFAULT '#173D32',
  button_color text NOT NULL DEFAULT '#173D32',
  border_radius integer NOT NULL DEFAULT 24 CHECK (border_radius BETWEEN 8 AND 40),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_rewards
  ADD COLUMN IF NOT EXISTS reward_type text NOT NULL DEFAULT 'GIFT',
  ADD COLUMN IF NOT EXISTS discount_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS discount_max_amount numeric(12,2);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loyalty_rewards_reward_type_check'
  ) THEN
    ALTER TABLE public.loyalty_rewards
      ADD CONSTRAINT loyalty_rewards_reward_type_check
      CHECK (reward_type IN ('GIFT', 'DISCOUNT'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'loyalty_rewards_discount_percent_check'
  ) THEN
    ALTER TABLE public.loyalty_rewards
      ADD CONSTRAINT loyalty_rewards_discount_percent_check
      CHECK (
        reward_type = 'GIFT'
        OR (discount_percent IS NOT NULL AND discount_percent > 0 AND discount_percent <= 20)
      );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.loyalty_reward_claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.loyalty_customers(id) ON DELETE CASCADE,
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  reward_id uuid NOT NULL REFERENCES public.loyalty_rewards(id) ON DELETE CASCADE,
  claim_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  points_required integer NOT NULL,
  reward_name text NOT NULL,
  reward_type text NOT NULL CHECK (reward_type IN ('GIFT', 'DISCOUNT')),
  discount_percent numeric(5,2),
  discount_max_amount numeric(12,2),
  status text NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REDEEMED', 'EXPIRED', 'CANCELLED')),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '2 minutes'),
  redeemed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_reward_claims_token_idx
  ON public.loyalty_reward_claims(claim_token);

CREATE INDEX IF NOT EXISTS loyalty_reward_claims_customer_idx
  ON public.loyalty_reward_claims(customer_id, created_at DESC);

ALTER TABLE public.loyalty_card_designs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_reward_claims ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.loyalty_card_designs FROM anon, authenticated;
REVOKE ALL ON public.loyalty_reward_claims FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.get_loyalty_card_config(
  p_establishment_id uuid
)
RETURNS TABLE (
  template_id text,
  primary_color text,
  secondary_color text,
  background_color text,
  text_color text,
  button_color text,
  border_radius integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.is_tapmarrakech_admin()
       OR public.user_has_establishment_access(p_establishment_id)
     ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT
    d.template_id,
    d.primary_color,
    d.secondary_color,
    d.background_color,
    d.text_color,
    d.button_color,
    d.border_radius
  FROM public.loyalty_card_designs d
  WHERE d.establishment_id = p_establishment_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT 'luxury', '#173D32', '#D3A84C', '#F7F7F3', '#173D32', '#173D32', 24;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_loyalty_card_design(
  p_establishment_id uuid,
  p_template_id text,
  p_primary_color text,
  p_secondary_color text,
  p_background_color text,
  p_text_color text,
  p_button_color text,
  p_border_radius integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.is_tapmarrakech_admin()
       OR public.user_has_establishment_access(p_establishment_id)
     ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF p_template_id NOT IN ('luxury','minimal','elegant','modern','bold','classic') THEN
    RAISE EXCEPTION 'Template invalide';
  END IF;

  IF p_border_radius < 8 OR p_border_radius > 40 THEN
    RAISE EXCEPTION 'Rayon invalide';
  END IF;

  INSERT INTO public.loyalty_card_designs (
    establishment_id, template_id, primary_color, secondary_color,
    background_color, text_color, button_color, border_radius, updated_at
  )
  VALUES (
    p_establishment_id, p_template_id, p_primary_color, p_secondary_color,
    p_background_color, p_text_color, p_button_color, p_border_radius, now()
  )
  ON CONFLICT (establishment_id) DO UPDATE SET
    template_id = EXCLUDED.template_id,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    background_color = EXCLUDED.background_color,
    text_color = EXCLUDED.text_color,
    button_color = EXCLUDED.button_color,
    border_radius = EXCLUDED.border_radius,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.create_loyalty_reward(
  p_establishment_id uuid,
  p_name text,
  p_description text,
  p_points_required integer,
  p_reward_type text,
  p_discount_percent numeric DEFAULT NULL,
  p_discount_max_amount numeric DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_id uuid;
BEGIN
  IF auth.uid() IS NULL
     OR NOT (
       public.is_tapmarrakech_admin()
       OR public.user_has_establishment_access(p_establishment_id)
     ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  IF NULLIF(trim(p_name), '') IS NULL OR p_points_required <= 0 THEN
    RAISE EXCEPTION 'Récompense invalide';
  END IF;

  IF p_reward_type NOT IN ('GIFT','DISCOUNT') THEN
    RAISE EXCEPTION 'Type de récompense invalide';
  END IF;

  IF p_reward_type = 'DISCOUNT'
     AND (p_discount_percent IS NULL OR p_discount_percent <= 0 OR p_discount_percent > 20) THEN
    RAISE EXCEPTION 'La réduction doit être comprise entre 0 et 20%';
  END IF;

  INSERT INTO public.loyalty_rewards (
    establishment_id, name, description, points_required, active,
    reward_type, discount_percent, discount_max_amount
  )
  VALUES (
    p_establishment_id, trim(p_name), NULLIF(trim(coalesce(p_description,'')), ''),
    p_points_required, true, p_reward_type,
    CASE WHEN p_reward_type = 'DISCOUNT' THEN p_discount_percent ELSE NULL END,
    CASE WHEN p_reward_type = 'DISCOUNT' THEN NULLIF(p_discount_max_amount, 0) ELSE NULL END
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_loyalty_card_config(
  p_access_token uuid
)
RETURNS TABLE (
  template_id text,
  primary_color text,
  secondary_color text,
  background_color text,
  text_color text,
  button_color text,
  border_radius integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(d.template_id, 'luxury'),
    COALESCE(d.primary_color, '#173D32'),
    COALESCE(d.secondary_color, '#D3A84C'),
    COALESCE(d.background_color, '#F7F7F3'),
    COALESCE(d.text_color, '#173D32'),
    COALESCE(d.button_color, '#173D32'),
    COALESCE(d.border_radius, 24)
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  LEFT JOIN public.loyalty_card_designs d ON d.establishment_id = c.establishment_id
  WHERE l.access_token = p_access_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_loyalty_rewards(
  p_access_token uuid
)
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  points_required integer,
  reward_type text,
  discount_percent numeric,
  discount_max_amount numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    r.id,
    r.name,
    r.description,
    r.points_required,
    r.reward_type,
    r.discount_percent,
    r.discount_max_amount
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  JOIN public.loyalty_rewards r
    ON r.establishment_id = c.establishment_id
   AND r.active = true
  WHERE l.access_token = p_access_token
  ORDER BY r.points_required ASC;
$$;

CREATE OR REPLACE FUNCTION public.create_public_loyalty_reward_claim(
  p_access_token uuid,
  p_reward_id uuid
)
RETURNS TABLE (
  claim_token uuid,
  reward_name text,
  reward_type text,
  points_required integer,
  discount_percent numeric,
  discount_max_amount numeric,
  expires_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer public.loyalty_customers%ROWTYPE;
  v_reward public.loyalty_rewards%ROWTYPE;
  v_claim public.loyalty_reward_claims%ROWTYPE;
BEGIN
  SELECT c.*
  INTO v_customer
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  WHERE l.access_token = p_access_token
  FOR UPDATE OF c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carte de fidélité introuvable';
  END IF;

  SELECT r.*
  INTO v_reward
  FROM public.loyalty_rewards r
  WHERE r.id = p_reward_id
    AND r.establishment_id = v_customer.establishment_id
    AND r.active = true
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Récompense introuvable';
  END IF;

  IF v_customer.points_balance < v_reward.points_required THEN
    RAISE EXCEPTION 'Points insuffisants';
  END IF;

  INSERT INTO public.loyalty_reward_claims (
    customer_id, establishment_id, reward_id, points_required,
    reward_name, reward_type, discount_percent, discount_max_amount
  )
  VALUES (
    v_customer.id, v_customer.establishment_id, v_reward.id, v_reward.points_required,
    v_reward.name, v_reward.reward_type, v_reward.discount_percent, v_reward.discount_max_amount
  )
  RETURNING * INTO v_claim;

  RETURN QUERY
  SELECT
    v_claim.claim_token,
    v_claim.reward_name,
    v_claim.reward_type,
    v_claim.points_required,
    v_claim.discount_percent,
    v_claim.discount_max_amount,
    v_claim.expires_at;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_loyalty_reward_claim(
  p_claim_token uuid
)
RETURNS TABLE (
  claim_token uuid,
  establishment_id uuid,
  customer_id uuid,
  reward_name text,
  reward_type text,
  points_required integer,
  discount_percent numeric,
  discount_max_amount numeric,
  status text,
  expires_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    c.claim_token,
    c.establishment_id,
    c.customer_id,
    c.reward_name,
    c.reward_type,
    c.points_required,
    c.discount_percent,
    c.discount_max_amount,
    c.status,
    c.expires_at
  FROM public.loyalty_reward_claims c
  WHERE c.claim_token = p_claim_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.redeem_loyalty_reward_claim(
  p_scanner_token uuid,
  p_claim_token uuid,
  p_invoice_amount numeric DEFAULT NULL,
  p_invoice_number text DEFAULT NULL
)
RETURNS TABLE (
  reward_name text,
  reward_type text,
  points_used integer,
  new_points_balance integer,
  discount_percent numeric,
  discount_amount numeric,
  final_amount numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_establishment_id uuid;
  v_claim public.loyalty_reward_claims%ROWTYPE;
  v_customer public.loyalty_customers%ROWTYPE;
  v_discount_amount numeric := 0;
  v_final_amount numeric := NULL;
BEGIN
  SELECT l.establishment_id
  INTO v_establishment_id
  FROM public.establishment_scanner_links l
  WHERE l.access_token = p_scanner_token
  LIMIT 1;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Lien scanner invalide';
  END IF;

  SELECT *
  INTO v_claim
  FROM public.loyalty_reward_claims c
  WHERE c.claim_token = p_claim_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'QR de récompense invalide';
  END IF;

  IF v_claim.establishment_id <> v_establishment_id THEN
    RAISE EXCEPTION 'Cette récompense appartient à un autre établissement';
  END IF;

  IF v_claim.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Ce QR a déjà été utilisé ou annulé';
  END IF;

  IF v_claim.expires_at <= now() THEN
    UPDATE public.loyalty_reward_claims SET status = 'EXPIRED' WHERE id = v_claim.id;
    RAISE EXCEPTION 'Ce QR a expiré';
  END IF;

  SELECT *
  INTO v_customer
  FROM public.loyalty_customers c
  WHERE c.id = v_claim.customer_id
    AND c.establishment_id = v_establishment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable pour cet établissement';
  END IF;

  IF v_customer.points_balance < v_claim.points_required THEN
    RAISE EXCEPTION 'Points insuffisants';
  END IF;

  IF v_claim.reward_type = 'DISCOUNT' THEN
    IF p_invoice_amount IS NULL OR p_invoice_amount <= 0 THEN
      RAISE EXCEPTION 'Montant de facture requis pour une réduction';
    END IF;

    v_discount_amount := p_invoice_amount * (v_claim.discount_percent / 100);
    IF v_claim.discount_max_amount IS NOT NULL THEN
      v_discount_amount := LEAST(v_discount_amount, v_claim.discount_max_amount);
    END IF;
    v_final_amount := GREATEST(p_invoice_amount - v_discount_amount, 0);
  END IF;

  UPDATE public.loyalty_customers
  SET
    points_balance = points_balance - v_claim.points_required,
    total_points_redeemed = coalesce(total_points_redeemed, 0) + v_claim.points_required
  WHERE id = v_customer.id;

  INSERT INTO public.loyalty_transactions (
    establishment_id, customer_id, employee_id, amount, points, type, description, invoice_number
  )
  VALUES (
    v_establishment_id,
    v_customer.id,
    NULL,
    CASE WHEN v_claim.reward_type = 'DISCOUNT' THEN p_invoice_amount ELSE NULL END,
    -v_claim.points_required,
    'REDEEM',
    CASE
      WHEN v_claim.reward_type = 'DISCOUNT'
      THEN 'Réduction ' || trim(to_char(v_claim.discount_percent, 'FM999990.##')) || '% — ' || v_claim.reward_name
      ELSE 'Récompense — ' || v_claim.reward_name
    END,
    NULLIF(trim(coalesce(p_invoice_number, '')), '')
  );

  UPDATE public.loyalty_reward_claims
  SET status = 'REDEEMED', redeemed_at = now()
  WHERE id = v_claim.id;

  RETURN QUERY
  SELECT
    v_claim.reward_name,
    v_claim.reward_type,
    v_claim.points_required,
    v_customer.points_balance - v_claim.points_required,
    v_claim.discount_percent,
    v_discount_amount,
    v_final_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.get_loyalty_card_config(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_loyalty_card_design(uuid, text, text, text, text, text, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_loyalty_reward(uuid, text, text, integer, text, numeric, numeric) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_loyalty_card_config(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_loyalty_rewards(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_public_loyalty_reward_claim(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_loyalty_reward_claim(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.redeem_loyalty_reward_claim(uuid, uuid, numeric, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_loyalty_card_config(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_loyalty_card_design(uuid, text, text, text, text, text, text, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_loyalty_reward(uuid, text, text, integer, text, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card_config(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_rewards(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_loyalty_reward_claim(uuid, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_reward_claim(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_loyalty_reward_claim(uuid, uuid, numeric, text) TO anon, authenticated;

INSERT INTO public.loyalty_card_designs (establishment_id)
SELECT e.id
FROM public.establishments e
LEFT JOIN public.loyalty_card_designs d ON d.establishment_id = e.id
WHERE d.establishment_id IS NULL
ON CONFLICT (establishment_id) DO NOTHING;
