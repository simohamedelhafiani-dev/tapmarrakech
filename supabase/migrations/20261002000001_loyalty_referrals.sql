-- TapMarrakech — Loyalty Referral foundations
-- Step 1: data + server-side logic only. No UI.

ALTER TABLE public.loyalty_customers
  ADD COLUMN IF NOT EXISTS referral_code text;

CREATE UNIQUE INDEX IF NOT EXISTS loyalty_customers_referral_code_uidx
  ON public.loyalty_customers (referral_code)
  WHERE referral_code IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.loyalty_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  referrer_id uuid NOT NULL REFERENCES public.loyalty_customers(id) ON DELETE CASCADE,
  referee_id uuid NOT NULL REFERENCES public.loyalty_customers(id) ON DELETE CASCADE,
  reward_given_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT loyalty_referrals_not_self CHECK (referrer_id <> referee_id),
  CONSTRAINT loyalty_referrals_referee_once UNIQUE (establishment_id, referee_id)
);

CREATE INDEX IF NOT EXISTS loyalty_referrals_referrer_idx
  ON public.loyalty_referrals (referrer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS loyalty_referrals_referee_idx
  ON public.loyalty_referrals (referee_id, created_at DESC);

ALTER TABLE public.loyalty_settings
  ADD COLUMN IF NOT EXISTS referral_draft_config jsonb NOT NULL
    DEFAULT '{"enabled":false,"referrer_bonus_points":50,"referee_bonus_points":0}'::jsonb,
  ADD COLUMN IF NOT EXISTS referral_config jsonb NOT NULL
    DEFAULT '{"enabled":false,"referrer_bonus_points":50,"referee_bonus_points":0}'::jsonb;

ALTER TABLE public.loyalty_referrals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.loyalty_referrals FROM anon, authenticated;

CREATE OR REPLACE FUNCTION public.generate_loyalty_referral_code(
  p_customer_id uuid
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_customer public.loyalty_customers%ROWTYPE;
  v_code text;
  v_attempt integer := 0;
BEGIN
  SELECT * INTO v_customer
  FROM public.loyalty_customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Client introuvable';
  END IF;

  IF auth.uid() IS NULL OR NOT public.user_has_establishment_access(v_customer.establishment_id) THEN
    RAISE EXCEPTION 'Accès non autorisé';
  END IF;

  IF NULLIF(trim(v_customer.referral_code), '') IS NOT NULL THEN
    RETURN v_customer.referral_code;
  END IF;

  LOOP
    v_attempt := v_attempt + 1;
    v_code := upper(substr(encode(gen_random_bytes(8), 'hex'), 1, 8));

    BEGIN
      UPDATE public.loyalty_customers
      SET referral_code = v_code,
          updated_at = now()
      WHERE id = p_customer_id;

      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      IF v_attempt >= 10 THEN
        RAISE EXCEPTION 'Impossible de générer un code de parrainage unique';
      END IF;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.process_loyalty_referral(
  p_code text,
  p_new_customer_id uuid
)
RETURNS TABLE (
  referral_id uuid,
  status text,
  referrer_points integer,
  referee_points integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_referrer public.loyalty_customers%ROWTYPE;
  v_referee public.loyalty_customers%ROWTYPE;
  v_existing public.loyalty_referrals%ROWTYPE;
  v_config jsonb;
  v_referrer_bonus integer;
  v_referee_bonus integer;
  v_referral_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Utilisateur non authentifié';
  END IF;

  IF NULLIF(trim(p_code), '') IS NULL THEN
    RAISE EXCEPTION 'Code de parrainage obligatoire';
  END IF;

  SELECT * INTO v_referee
  FROM public.loyalty_customers
  WHERE id = p_new_customer_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nouveau client introuvable';
  END IF;

  SELECT * INTO v_referrer
  FROM public.loyalty_customers
  WHERE upper(referral_code) = upper(trim(p_code))
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Code de parrainage invalide';
  END IF;

  IF v_referrer.id = v_referee.id THEN
    RAISE EXCEPTION 'Un client ne peut pas se parrainer lui-même';
  END IF;

  IF v_referrer.establishment_id <> v_referee.establishment_id THEN
    RAISE EXCEPTION 'Le code de parrainage appartient à un autre établissement';
  END IF;

  SELECT referral_config INTO v_config
  FROM public.loyalty_settings
  WHERE establishment_id = v_referee.establishment_id
  LIMIT 1
  FOR UPDATE;

  IF NOT COALESCE((v_config ->> 'enabled')::boolean, false) THEN
    RAISE EXCEPTION 'Le parrainage n''est pas activé';
  END IF;

  v_referrer_bonus := GREATEST(COALESCE((v_config ->> 'referrer_bonus_points')::integer, 0), 0);
  v_referee_bonus := GREATEST(COALESCE((v_config ->> 'referee_bonus_points')::integer, 0), 0);

  SELECT * INTO v_existing
  FROM public.loyalty_referrals
  WHERE establishment_id = v_referee.establishment_id
    AND referee_id = v_referee.id
  FOR UPDATE;

  IF FOUND THEN
    IF v_existing.status = 'completed' THEN
      RAISE EXCEPTION 'Ce client a déjà utilisé un parrainage';
    END IF;
    RETURN QUERY SELECT v_existing.id, v_existing.status, 0, 0;
    RETURN;
  END IF;

  INSERT INTO public.loyalty_referrals (
    establishment_id, referrer_id, referee_id, status, reward_given_at
  )
  VALUES (
    v_referee.establishment_id, v_referrer.id, v_referee.id, 'pending', NULL
  )
  RETURNING id INTO v_referral_id;

  IF v_referrer_bonus > 0 THEN
    UPDATE public.loyalty_customers
    SET points_balance = COALESCE(points_balance, 0) + v_referrer_bonus,
        total_points_earned = COALESCE(total_points_earned, 0) + v_referrer_bonus,
        updated_at = now()
    WHERE id = v_referrer.id;

    INSERT INTO public.loyalty_transactions (
      establishment_id, customer_id, employee_id, points, amount, description, type
    )
    VALUES (
      v_referee.establishment_id, v_referrer.id, NULL, v_referrer_bonus, NULL,
      'Bonus parrainage', 'EARN'
    );
  END IF;

  IF v_referee_bonus > 0 THEN
    UPDATE public.loyalty_customers
    SET points_balance = COALESCE(points_balance, 0) + v_referee_bonus,
        total_points_earned = COALESCE(total_points_earned, 0) + v_referee_bonus,
        updated_at = now()
    WHERE id = v_referee.id;

    INSERT INTO public.loyalty_transactions (
      establishment_id, customer_id, employee_id, points, amount, description, type
    )
    VALUES (
      v_referee.establishment_id, v_referee.id, NULL, v_referee_bonus, NULL,
      'Bonus de bienvenue — parrainage', 'EARN'
    );
  END IF;

  UPDATE public.loyalty_referrals
  SET status = 'completed',
      reward_given_at = now(),
      updated_at = now()
  WHERE id = v_referral_id;

  RETURN QUERY
  SELECT v_referral_id, 'completed'::text, v_referrer_bonus, v_referee_bonus;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_loyalty_referral_config(
  p_establishment_id uuid
)
RETURNS TABLE (
  draft_config jsonb,
  published_config jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.referral_draft_config,
    s.referral_config
  FROM public.loyalty_settings s
  WHERE s.establishment_id = p_establishment_id
    AND public.user_has_establishment_access(p_establishment_id);
$$;

CREATE OR REPLACE FUNCTION public.save_loyalty_referral_draft(
  p_establishment_id uuid,
  p_config jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_referrer_bonus integer;
  v_referee_bonus integer;
BEGIN
  IF NOT public.user_has_establishment_access(p_establishment_id) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  IF p_config IS NULL OR jsonb_typeof(p_config) <> 'object' THEN
    RAISE EXCEPTION 'Configuration de parrainage invalide';
  END IF;

  v_referrer_bonus := COALESCE((p_config ->> 'referrer_bonus_points')::integer, 0);
  v_referee_bonus := COALESCE((p_config ->> 'referee_bonus_points')::integer, 0);

  IF v_referrer_bonus < 0 OR v_referrer_bonus > 1000000
     OR v_referee_bonus < 0 OR v_referee_bonus > 1000000 THEN
    RAISE EXCEPTION 'Bonus de parrainage invalide';
  END IF;

  INSERT INTO public.loyalty_settings (establishment_id, referral_draft_config)
  VALUES (
    p_establishment_id,
    jsonb_build_object(
      'enabled', COALESCE((p_config ->> 'enabled')::boolean, false),
      'referrer_bonus_points', v_referrer_bonus,
      'referee_bonus_points', v_referee_bonus
    )
  )
  ON CONFLICT (establishment_id) DO UPDATE SET
    referral_draft_config = EXCLUDED.referral_draft_config,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.publish_loyalty_referral_settings(
  p_establishment_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config jsonb;
BEGIN
  IF NOT public.user_has_establishment_access(p_establishment_id) THEN
    RAISE EXCEPTION 'Accès refusé';
  END IF;

  SELECT referral_draft_config INTO v_config
  FROM public.loyalty_settings
  WHERE establishment_id = p_establishment_id
  FOR UPDATE;

  IF v_config IS NULL THEN
    v_config := '{"enabled":false,"referrer_bonus_points":50,"referee_bonus_points":0}'::jsonb;
  END IF;

  UPDATE public.loyalty_settings
  SET referral_config = v_config,
      updated_at = now()
  WHERE establishment_id = p_establishment_id;

  RETURN v_config;
END;
$$;

REVOKE ALL ON FUNCTION public.generate_loyalty_referral_code(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.process_loyalty_referral(text, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_loyalty_referral_config(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_loyalty_referral_draft(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.publish_loyalty_referral_settings(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.generate_loyalty_referral_code(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.process_loyalty_referral(text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loyalty_referral_config(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_loyalty_referral_draft(uuid, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.publish_loyalty_referral_settings(uuid) TO authenticated;
