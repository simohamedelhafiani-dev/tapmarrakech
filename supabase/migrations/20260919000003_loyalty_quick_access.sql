/*
  TapMarrakech — Loyalty quick access
  - Permanent bearer links for customer loyalty cards.
  - One permanent scanner link per establishment.
  - Public data is exposed only through tokenized SECURITY DEFINER RPCs.
*/

CREATE TABLE IF NOT EXISTS public.loyalty_customer_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL UNIQUE REFERENCES public.loyalty_customers(id) ON DELETE CASCADE,
  access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS loyalty_customer_links_token_idx
  ON public.loyalty_customer_links(access_token);

ALTER TABLE public.loyalty_customer_links ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.establishment_scanner_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  access_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS establishment_scanner_links_token_idx
  ON public.establishment_scanner_links(access_token);

ALTER TABLE public.establishment_scanner_links ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.ensure_loyalty_customer_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.loyalty_customer_links(customer_id)
  VALUES (NEW.id)
  ON CONFLICT (customer_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS loyalty_customer_link_after_insert
ON public.loyalty_customers;

CREATE TRIGGER loyalty_customer_link_after_insert
AFTER INSERT ON public.loyalty_customers
FOR EACH ROW
EXECUTE FUNCTION public.ensure_loyalty_customer_link();

CREATE OR REPLACE FUNCTION public.ensure_establishment_scanner_link()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.establishment_scanner_links(establishment_id)
  VALUES (NEW.id)
  ON CONFLICT (establishment_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS establishment_scanner_link_after_insert
ON public.establishments;

CREATE TRIGGER establishment_scanner_link_after_insert
AFTER INSERT ON public.establishments
FOR EACH ROW
EXECUTE FUNCTION public.ensure_establishment_scanner_link();

INSERT INTO public.loyalty_customer_links(customer_id)
SELECT c.id
FROM public.loyalty_customers c
LEFT JOIN public.loyalty_customer_links l ON l.customer_id = c.id
WHERE l.customer_id IS NULL
ON CONFLICT (customer_id) DO NOTHING;

INSERT INTO public.establishment_scanner_links(establishment_id)
SELECT e.id
FROM public.establishments e
LEFT JOIN public.establishment_scanner_links l ON l.establishment_id = e.id
WHERE l.establishment_id IS NULL
ON CONFLICT (establishment_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_public_loyalty_card(p_access_token uuid)
RETURNS TABLE (
  customer_id uuid,
  establishment_id uuid,
  establishment_name text,
  establishment_logo_url text,
  loyalty_number text,
  first_name text,
  last_name text,
  points_balance integer,
  total_points_earned integer,
  total_points_redeemed integer,
  visit_count integer,
  last_visit_at timestamptz,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.id,
    c.establishment_id,
    e.name,
    e.logo_url,
    c.loyalty_number,
    c.first_name,
    c.last_name,
    c.points_balance,
    c.total_points_earned,
    c.total_points_redeemed,
    c.visit_count,
    c.last_visit_at,
    c.created_at
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  JOIN public.establishments e ON e.id = c.establishment_id
  WHERE l.access_token = p_access_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_public_loyalty_transactions(p_access_token uuid)
RETURNS TABLE (
  id uuid,
  points integer,
  transaction_type text,
  description text,
  created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.id,
    t.points,
    t.type,
    t.description,
    t.created_at
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_transactions t ON t.customer_id = l.customer_id
  WHERE l.access_token = p_access_token
  ORDER BY t.created_at DESC
  LIMIT 30;
$$;

CREATE OR REPLACE FUNCTION public.get_or_create_establishment_scanner_link(
  p_establishment_id uuid
)
RETURNS TABLE (
  establishment_id uuid,
  establishment_name text,
  scanner_token uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT (
    public.is_tapmarrakech_admin()
    OR public.user_has_establishment_access(p_establishment_id)
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  INSERT INTO public.establishment_scanner_links(establishment_id)
  VALUES (p_establishment_id)
  ON CONFLICT (establishment_id) DO NOTHING;

  RETURN QUERY
  SELECT e.id, e.name, l.access_token
  FROM public.establishments e
  JOIN public.establishment_scanner_links l
    ON l.establishment_id = e.id
  WHERE e.id = p_establishment_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_scanner_context(
  p_scanner_token uuid
)
RETURNS TABLE (
  establishment_id uuid,
  establishment_name text,
  establishment_logo_url text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.id, e.name, e.logo_url
  FROM public.establishment_scanner_links l
  JOIN public.establishments e ON e.id = l.establishment_id
  WHERE l.access_token = p_scanner_token
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_loyalty_customer_link(
  p_customer_id uuid
)
RETURNS TABLE (
  customer_id uuid,
  access_token uuid
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.loyalty_customers c
    WHERE c.id = p_customer_id
      AND (
        public.is_tapmarrakech_admin()
        OR public.user_has_establishment_access(c.establishment_id)
      )
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  SELECT l.customer_id, l.access_token
  FROM public.loyalty_customer_links l
  WHERE l.customer_id = p_customer_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_loyalty_card(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_loyalty_transactions(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_public_scanner_context(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_or_create_establishment_scanner_link(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_loyalty_customer_link(uuid) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_transactions(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_scanner_context(uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_or_create_establishment_scanner_link(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loyalty_customer_link(uuid) TO authenticated;
