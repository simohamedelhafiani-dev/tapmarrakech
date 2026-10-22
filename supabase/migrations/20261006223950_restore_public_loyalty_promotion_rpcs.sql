-- Restore the public promotion QR RPCs used by the loyalty-card experience.
-- These are SECURITY DEFINER entry points; keep object references schema-qualified.
CREATE OR REPLACE FUNCTION public.get_public_loyalty_available_promotions(p_access_token uuid)
RETURNS TABLE(id uuid, name text, description text, promo_price numeric, start_at timestamptz, end_at timestamptz, active boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p.id, p.name, p.description, p.promo_price, p.start_at, p.end_at, p.active
  FROM public.promotions p
  JOIN public.loyalty_customers lc ON lc.establishment_id = p.establishment_id
  JOIN public.loyalty_customer_links l ON l.customer_id = lc.id AND l.access_token = p_access_token
  WHERE p.active = true
    AND (p.start_at IS NULL OR p.start_at <= now())
    AND (p.end_at IS NULL OR p.end_at >= now())
    AND NOT EXISTS (
      SELECT 1 FROM public.loyalty_promotion_claims c
      WHERE c.customer_id = lc.id
        AND c.promotion_id = p.id
        AND c.status = 'REDEEMED'
    )
  ORDER BY p.display_order;
$$;

CREATE OR REPLACE FUNCTION public.create_public_loyalty_promotion_claim(
  p_access_token uuid,
  p_promotion_id uuid
)
RETURNS TABLE(claim_token uuid, promotion_id uuid, promotion_name text, description text, promo_price numeric, expires_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_customer public.loyalty_customers%ROWTYPE;
  v_promotion public.promotions%ROWTYPE;
BEGIN
  SELECT c.* INTO v_customer
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  WHERE l.access_token = p_access_token
  FOR UPDATE OF c;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Carte de fidélité introuvable';
  END IF;

  SELECT p.* INTO v_promotion
  FROM public.promotions p
  WHERE p.id = p_promotion_id
    AND p.establishment_id = v_customer.establishment_id
    AND p.active = true
    AND (p.start_at IS NULL OR p.start_at <= now())
    AND (p.end_at IS NULL OR p.end_at >= now())
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cette offre n’est plus disponible';
  END IF;

  UPDATE public.loyalty_promotion_claims c
  SET status = 'EXPIRED'
  WHERE c.customer_id = v_customer.id
    AND c.status = 'PENDING'
    AND c.expires_at <= now();

  INSERT INTO public.loyalty_promotion_claims (customer_id, establishment_id, promotion_id)
  VALUES (v_customer.id, v_customer.establishment_id, v_promotion.id)
  RETURNING claim_token, public.loyalty_promotion_claims.expires_at
  INTO claim_token, expires_at;

  promotion_id := v_promotion.id;
  promotion_name := v_promotion.name;
  description := v_promotion.description;
  promo_price := v_promotion.promo_price;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_loyalty_promotion_claim(p_claim_token uuid)
RETURNS TABLE(claim_token uuid, establishment_id uuid, customer_id uuid, promotion_id uuid, promotion_name text, description text, promo_price numeric, status text, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT c.claim_token, c.establishment_id, c.customer_id, c.promotion_id,
         p.name, p.description, p.promo_price, c.status, c.expires_at
  FROM public.loyalty_promotion_claims c
  JOIN public.promotions p ON p.id = c.promotion_id
  WHERE c.claim_token = p_claim_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.redeem_public_loyalty_promotion_claim(
  p_scanner_token uuid,
  p_claim_token uuid
)
RETURNS TABLE(promotion_name text, customer_id uuid, redeemed_at timestamptz)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_establishment_id uuid;
  v_claim public.loyalty_promotion_claims%ROWTYPE;
  v_promotion public.promotions%ROWTYPE;
  v_redeemed_at timestamptz;
BEGIN
  SELECT l.establishment_id INTO v_establishment_id
  FROM public.establishment_scanner_links l
  WHERE l.access_token = p_scanner_token
  LIMIT 1;

  IF v_establishment_id IS NULL THEN
    RAISE EXCEPTION 'Lien scanner invalide';
  END IF;

  SELECT * INTO v_claim
  FROM public.loyalty_promotion_claims c
  WHERE c.claim_token = p_claim_token
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'QR promotion invalide'; END IF;
  IF v_claim.establishment_id <> v_establishment_id THEN
    RAISE EXCEPTION 'Cette offre appartient à un autre établissement';
  END IF;
  IF v_claim.status <> 'PENDING' THEN
    RAISE EXCEPTION 'Ce QR a déjà été utilisé ou annulé';
  END IF;
  IF v_claim.expires_at <= now() THEN
    UPDATE public.loyalty_promotion_claims SET status = 'EXPIRED' WHERE id = v_claim.id;
    RAISE EXCEPTION 'Ce QR a expiré';
  END IF;

  SELECT * INTO v_promotion
  FROM public.promotions p
  WHERE p.id = v_claim.promotion_id
    AND p.establishment_id = v_establishment_id
    AND p.active = true
    AND (p.start_at IS NULL OR p.start_at <= now())
    AND (p.end_at IS NULL OR p.end_at >= now())
  FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Cette offre n’est plus disponible'; END IF;

  v_redeemed_at := now();
  UPDATE public.loyalty_promotion_claims
  SET status = 'REDEEMED', redeemed_at = v_redeemed_at
  WHERE id = v_claim.id;

  RETURN QUERY SELECT v_promotion.name, v_claim.customer_id, v_redeemed_at;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_loyalty_available_promotions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_public_loyalty_promotion_claim(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_loyalty_promotion_claim(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_public_loyalty_promotion_claim(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_available_promotions(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_public_loyalty_promotion_claim(uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_promotion_claim(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_public_loyalty_promotion_claim(uuid, uuid) TO anon, authenticated, service_role;
