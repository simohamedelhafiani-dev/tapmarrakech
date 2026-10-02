/*
  TapMarrakech — Loyalty Studio: three explicit program modes
  STAMP / POINTS_REWARD / POINTS_DISCOUNT
*/

ALTER TABLE public.loyalty_settings
  ADD COLUMN IF NOT EXISTS discount_points_threshold integer NOT NULL DEFAULT 1000;

ALTER TABLE public.loyalty_settings DROP CONSTRAINT IF EXISTS loyalty_settings_program_type_check;
ALTER TABLE public.loyalty_settings DROP CONSTRAINT IF EXISTS loyalty_settings_stamp_goal_check;
ALTER TABLE public.loyalty_settings DROP CONSTRAINT IF EXISTS loyalty_settings_discount_points_threshold_check;

UPDATE public.loyalty_settings
SET program_type = CASE
  WHEN program_type = 'STAMP' THEN 'STAMP'
  WHEN program_type = 'DISCOUNT' THEN 'POINTS_DISCOUNT'
  ELSE 'POINTS_REWARD'
END,
stamp_goal = LEAST(GREATEST(COALESCE(stamp_goal, 10), 1), 10),
discount_points_threshold = GREATEST(COALESCE(discount_points_threshold, 1000), 1);

ALTER TABLE public.loyalty_settings ADD CONSTRAINT loyalty_settings_program_type_check
  CHECK (program_type IN ('STAMP','POINTS_REWARD','POINTS_DISCOUNT'));

ALTER TABLE public.loyalty_settings ADD CONSTRAINT loyalty_settings_stamp_goal_check
  CHECK (stamp_goal BETWEEN 1 AND 10);

ALTER TABLE public.loyalty_settings ADD CONSTRAINT loyalty_settings_discount_points_threshold_check
  CHECK (discount_points_threshold >= 1);

CREATE OR REPLACE FUNCTION public.normalize_loyalty_referral_config_for_program()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
DECLARE v_config jsonb; v_bonus_type text;
BEGIN
  IF NEW.program_type NOT IN ('STAMP','POINTS_REWARD','POINTS_DISCOUNT') THEN RETURN NEW; END IF;
  v_bonus_type := CASE WHEN NEW.program_type = 'STAMP' THEN 'STAMP' ELSE 'POINTS' END;
  IF NEW.referral_draft_config IS NOT NULL THEN
    v_config := jsonb_set(NEW.referral_draft_config,'{referrer_bonus_type}',to_jsonb(v_bonus_type),true);
    v_config := jsonb_set(v_config,'{referee_bonus_type}',to_jsonb(v_bonus_type),true);
    NEW.referral_draft_config := v_config;
  END IF;
  IF NEW.referral_config IS NOT NULL THEN
    v_config := jsonb_set(NEW.referral_config,'{referrer_bonus_type}',to_jsonb(v_bonus_type),true);
    v_config := jsonb_set(v_config,'{referee_bonus_type}',to_jsonb(v_bonus_type),true);
    NEW.referral_config := v_config;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS loyalty_settings_normalize_referral_program ON public.loyalty_settings;
CREATE TRIGGER loyalty_settings_normalize_referral_program
BEFORE INSERT OR UPDATE OF program_type, referral_draft_config, referral_config
ON public.loyalty_settings FOR EACH ROW
EXECUTE FUNCTION public.normalize_loyalty_referral_config_for_program();

CREATE OR REPLACE FUNCTION public.unlock_loyalty_discount_if_ready(
  p_customer_id uuid, p_establishment_id uuid, p_previous_points integer, p_new_points integer
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public','extensions' AS $$
DECLARE v_threshold integer; v_discount numeric; v_days integer;
BEGIN
  SELECT discount_points_threshold, discount_percent, discount_valid_days
  INTO v_threshold, v_discount, v_days
  FROM public.loyalty_settings
  WHERE establishment_id = p_establishment_id
    AND program_type = 'POINTS_DISCOUNT' AND enabled = true
  LIMIT 1;

  IF v_threshold IS NULL OR v_discount IS NULL OR v_discount <= 0
     OR p_previous_points >= v_threshold OR p_new_points < v_threshold THEN RETURN; END IF;

  IF EXISTS (
    SELECT 1 FROM public.loyalty_discount_cards
    WHERE customer_id = p_customer_id AND establishment_id = p_establishment_id
      AND status = 'ACTIVE' AND expires_at > now()
  ) THEN RETURN; END IF;

  INSERT INTO public.loyalty_discount_cards
    (establishment_id, customer_id, discount_percent, valid_from, expires_at, status, qr_token)
  VALUES
    (p_establishment_id, p_customer_id, LEAST(GREATEST(v_discount,1),100), now(),
     now() + make_interval(days => GREATEST(COALESCE(v_days,7),1)), 'ACTIVE',
     extensions.gen_random_uuid());
END;
$$;

CREATE OR REPLACE FUNCTION public.loyalty_points_discount_unlock_trigger()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public','extensions' AS $$
BEGIN
  IF NEW.points_balance > OLD.points_balance THEN
    PERFORM public.unlock_loyalty_discount_if_ready(
      NEW.id, NEW.establishment_id, COALESCE(OLD.points_balance,0), COALESCE(NEW.points_balance,0)
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS loyalty_points_discount_unlock ON public.loyalty_customers;
CREATE TRIGGER loyalty_points_discount_unlock
AFTER UPDATE OF points_balance ON public.loyalty_customers
FOR EACH ROW WHEN (NEW.points_balance > OLD.points_balance)
EXECUTE FUNCTION public.loyalty_points_discount_unlock_trigger();

DROP FUNCTION IF EXISTS public.save_loyalty_program_settings(uuid,text,integer,text,text,numeric,integer,numeric,text,boolean);

CREATE OR REPLACE FUNCTION public.save_loyalty_program_settings(
  p_establishment_id uuid, p_program_type text, p_stamp_goal integer DEFAULT 10,
  p_stamp_reward_name text DEFAULT NULL, p_stamp_reward_description text DEFAULT NULL,
  p_discount_percent numeric DEFAULT NULL, p_discount_valid_days integer DEFAULT 7,
  p_points_per_currency numeric DEFAULT 1, p_currency text DEFAULT 'MAD',
  p_enabled boolean DEFAULT true, p_discount_points_threshold integer DEFAULT 1000
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public' AS $$
BEGIN
  IF NOT public.user_has_establishment_access(p_establishment_id) THEN RAISE EXCEPTION 'Accès refusé'; END IF;
  IF p_program_type NOT IN ('STAMP','POINTS_REWARD','POINTS_DISCOUNT') THEN RAISE EXCEPTION 'Type de programme invalide'; END IF;
  IF p_stamp_goal < 1 OR p_stamp_goal > 10 THEN RAISE EXCEPTION 'Le nombre de tampons doit être compris entre 1 et 10'; END IF;
  IF p_program_type = 'POINTS_DISCOUNT'
     AND (p_discount_percent IS NULL OR p_discount_percent <= 0 OR p_discount_percent > 100)
    THEN RAISE EXCEPTION 'La réduction doit être comprise entre 1 et 100%%'; END IF;
  IF p_program_type = 'POINTS_DISCOUNT'
     AND (p_discount_points_threshold IS NULL OR p_discount_points_threshold < 1)
    THEN RAISE EXCEPTION 'Le seuil de points doit être supérieur à 0'; END IF;

  INSERT INTO public.loyalty_settings
    (establishment_id,program_type,stamp_goal,stamp_reward_name,stamp_reward_description,
     discount_percent,discount_valid_days,discount_points_threshold,points_per_currency,currency,enabled)
  VALUES
    (p_establishment_id,p_program_type,LEAST(GREATEST(p_stamp_goal,1),10),
     NULLIF(trim(p_stamp_reward_name),''),NULLIF(trim(p_stamp_reward_description),''),
     CASE WHEN p_program_type='POINTS_DISCOUNT' THEN p_discount_percent ELSE NULL END,
     LEAST(GREATEST(COALESCE(p_discount_valid_days,7),1),365),
     GREATEST(COALESCE(p_discount_points_threshold,1000),1),
     GREATEST(p_points_per_currency,0.01),COALESCE(NULLIF(trim(p_currency),''),'MAD'),p_enabled)
  ON CONFLICT (establishment_id) DO UPDATE SET
    program_type=EXCLUDED.program_type, stamp_goal=EXCLUDED.stamp_goal,
    stamp_reward_name=EXCLUDED.stamp_reward_name, stamp_reward_description=EXCLUDED.stamp_reward_description,
    discount_percent=EXCLUDED.discount_percent, discount_valid_days=EXCLUDED.discount_valid_days,
    discount_points_threshold=EXCLUDED.discount_points_threshold, points_per_currency=EXCLUDED.points_per_currency,
    currency=EXCLUDED.currency, enabled=EXCLUDED.enabled, updated_at=now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_loyalty_program_settings(p_establishment_id uuid)
RETURNS TABLE(
  program_type text, stamp_goal integer, stamp_reward_name text, stamp_reward_description text,
  discount_percent numeric, discount_valid_days integer, discount_points_threshold integer,
  points_per_currency numeric, currency text, enabled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT s.program_type,s.stamp_goal,s.stamp_reward_name,s.stamp_reward_description,
         s.discount_percent,s.discount_valid_days,s.discount_points_threshold,
         s.points_per_currency,s.currency,s.enabled
  FROM public.loyalty_settings s
  WHERE s.establishment_id=p_establishment_id
    AND public.user_has_establishment_access(p_establishment_id);
$$;

CREATE OR REPLACE FUNCTION public.add_loyalty_points(
  p_establishment_id uuid,p_customer_id uuid,p_amount numeric,
  p_invoice_number text DEFAULT NULL,p_responsible_code text DEFAULT NULL,p_description text DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='public','extensions' AS $$
DECLARE
  v_rate numeric; v_type text; v_customer_establishment uuid; v_points integer;
  v_new_balance integer; v_hash text; v_employee uuid;
BEGIN
  IF NOT public.user_has_establishment_access(p_establishment_id) THEN RAISE EXCEPTION 'Accès non autorisé à cet établissement'; END IF;
  v_employee:=auth.uid(); IF v_employee IS NULL THEN RAISE EXCEPTION 'Utilisateur non authentifié'; END IF;
  IF p_responsible_code IS NULL OR length(trim(p_responsible_code))<4 THEN RAISE EXCEPTION 'Code responsable obligatoire'; END IF;
  SELECT admin_code_hash INTO v_hash FROM public.loyalty_admin_secrets WHERE establishment_id=p_establishment_id;
  IF v_hash IS NULL THEN RAISE EXCEPTION 'Aucun code responsable configuré pour cet établissement'; END IF;
  IF v_hash <> crypt(trim(p_responsible_code),v_hash) THEN RAISE EXCEPTION 'Code responsable incorrect'; END IF;
  IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Montant de facture invalide'; END IF;

  SELECT s.program_type,s.points_per_currency INTO v_type,v_rate
  FROM public.loyalty_settings s
  WHERE s.establishment_id=p_establishment_id AND s.enabled=true LIMIT 1;
  IF v_type IS NULL THEN RAISE EXCEPTION 'Le programme de fidélité n''est pas configuré'; END IF;
  IF v_type NOT IN ('POINTS_REWARD','POINTS_DISCOUNT') THEN RAISE EXCEPTION 'Cet établissement utilise un programme à tampons. Les points ne sont pas disponibles.'; END IF;
  IF COALESCE(v_rate,0)<=0 THEN RAISE EXCEPTION 'Le taux de points est invalide'; END IF;

  SELECT establishment_id INTO v_customer_establishment FROM public.loyalty_customers WHERE id=p_customer_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client introuvable'; END IF;
  IF v_customer_establishment<>p_establishment_id THEN RAISE EXCEPTION 'Ce client appartient à un autre établissement'; END IF;

  v_points:=floor(p_amount*v_rate)::integer;
  IF v_points<=0 THEN RAISE EXCEPTION 'Le montant ne génère aucun point'; END IF;

  UPDATE public.loyalty_customers c
  SET points_balance=COALESCE(c.points_balance,0)+v_points,
      total_points_earned=COALESCE(c.total_points_earned,0)+v_points,
      visit_count=COALESCE(c.visit_count,0)+1,last_visit_at=now()
  WHERE c.id=p_customer_id AND c.establishment_id=p_establishment_id
  RETURNING c.points_balance INTO v_new_balance;

  INSERT INTO public.loyalty_transactions(establishment_id,customer_id,employee_id,points,amount,description,type,invoice_number)
  VALUES(p_establishment_id,p_customer_id,v_employee,v_points,p_amount,
         COALESCE(p_description,'Achat - points fidélité'),'EARN',NULLIF(trim(p_invoice_number),''));
  RETURN v_new_balance;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'Cette facture a déjà généré des points';
END;
$$;

CREATE OR REPLACE FUNCTION public.add_loyalty_points_by_scanner(
  p_scanner_token uuid,p_customer_id uuid,p_amount numeric,
  p_invoice_number text DEFAULT NULL,p_description text DEFAULT NULL
)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path='public' AS $$
DECLARE
  v_est uuid; v_rate numeric; v_type text; v_enabled boolean;
  v_customer public.loyalty_customers%ROWTYPE; v_points integer; v_new integer;
BEGIN
  SELECT establishment_id INTO v_est FROM public.establishment_scanner_links WHERE access_token=p_scanner_token LIMIT 1;
  IF v_est IS NULL THEN RAISE EXCEPTION 'Lien scanner invalide'; END IF;
  SELECT s.program_type,s.points_per_currency,s.enabled INTO v_type,v_rate,v_enabled
  FROM public.loyalty_settings s WHERE s.establishment_id=v_est LIMIT 1;
  IF COALESCE(v_enabled,true)=false THEN RAISE EXCEPTION 'Le programme de fidélité est désactivé pour cet établissement'; END IF;
  IF v_type NOT IN ('POINTS_REWARD','POINTS_DISCOUNT') THEN RAISE EXCEPTION 'Cet établissement utilise un programme à tampons. Les points ne sont pas disponibles.'; END IF;
  IF p_amount IS NULL OR p_amount<=0 THEN RAISE EXCEPTION 'Montant invalide'; END IF;
  IF COALESCE(v_rate,0)<=0 THEN RAISE EXCEPTION 'Le taux de points est invalide'; END IF;
  v_points:=floor(p_amount*v_rate)::integer;
  IF v_points<=0 THEN RAISE EXCEPTION 'Le montant est trop faible pour générer des points'; END IF;

  SELECT * INTO v_customer FROM public.loyalty_customers c
  WHERE c.id=p_customer_id AND c.establishment_id=v_est FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Client introuvable pour cet établissement'; END IF;

  v_new:=COALESCE(v_customer.points_balance,0)+v_points;
  UPDATE public.loyalty_customers c
  SET points_balance=v_new,total_points_earned=COALESCE(c.total_points_earned,0)+v_points,
      visit_count=COALESCE(c.visit_count,0)+1,last_visit_at=now()
  WHERE c.id=p_customer_id AND c.establishment_id=v_est;

  INSERT INTO public.loyalty_transactions(establishment_id,customer_id,employee_id,amount,points,type,description,invoice_number)
  VALUES(v_est,p_customer_id,NULL,p_amount,v_points,'EARN',
         COALESCE(p_description,'Achat via scanner fidélité'),NULLIF(trim(COALESCE(p_invoice_number,'')),''));
  RETURN v_new;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_loyalty_program_context(p_access_token uuid)
RETURNS TABLE(
  program_type text,stamp_goal integer,stamp_reward_name text,stamp_reward_description text,
  discount_percent numeric,discount_valid_days integer,discount_points_threshold integer,
  points_per_currency numeric,currency text,enabled boolean,stamps_balance integer,stamps_total integer,
  referral_enabled boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='public' AS $$
  SELECT s.program_type,s.stamp_goal,s.stamp_reward_name,s.stamp_reward_description,
         s.discount_percent,s.discount_valid_days,s.discount_points_threshold,
         s.points_per_currency,s.currency,s.enabled,c.stamps_balance,c.stamps_total,
         COALESCE((s.referral_config->>'enabled')::boolean,false)
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id=l.customer_id
  JOIN public.loyalty_settings s ON s.establishment_id=c.establishment_id
  WHERE l.access_token=p_access_token LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.save_loyalty_program_settings(uuid,text,integer,text,text,numeric,integer,numeric,text,boolean,integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loyalty_program_settings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_loyalty_points(uuid,uuid,numeric,text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_loyalty_points_by_scanner(uuid,uuid,numeric,text,text) TO anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_program_context(uuid) TO anon,authenticated;
