/*
  TapMarrakech — Digital loyalty card builder
  Stores the complete builder state without changing the existing loyalty engine.
*/

ALTER TABLE public.loyalty_card_designs
  ADD COLUMN IF NOT EXISTS design_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.save_loyalty_card_builder_config(
  p_establishment_id uuid,
  p_design_config jsonb,
  p_template_id text,
  p_primary_color text,
  p_secondary_color text,
  p_background_color text,
  p_text_color text,
  p_button_color text,
  p_border_radius integer,
  p_published boolean DEFAULT false
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

  IF p_border_radius < 8 OR p_border_radius > 40 THEN
    RAISE EXCEPTION 'Rayon invalide';
  END IF;

  IF p_design_config IS NULL OR jsonb_typeof(p_design_config) <> 'object' THEN
    RAISE EXCEPTION 'Configuration de carte invalide';
  END IF;

  INSERT INTO public.loyalty_card_designs (
    establishment_id,
    template_id,
    primary_color,
    secondary_color,
    background_color,
    text_color,
    button_color,
    border_radius,
    design_config,
    published,
    updated_at
  )
  VALUES (
    p_establishment_id,
    COALESCE(NULLIF(trim(p_template_id), ''), 'restaurant-elegant'),
    COALESCE(NULLIF(trim(p_primary_color), ''), '#173D32'),
    COALESCE(NULLIF(trim(p_secondary_color), ''), '#D3A84C'),
    COALESCE(NULLIF(trim(p_background_color), ''), '#F7F7F3'),
    COALESCE(NULLIF(trim(p_text_color), ''), '#FFFFFF'),
    COALESCE(NULLIF(trim(p_button_color), ''), '#173D32'),
    p_border_radius,
    p_design_config,
    COALESCE(p_published, false),
    now()
  )
  ON CONFLICT (establishment_id) DO UPDATE SET
    template_id = EXCLUDED.template_id,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    background_color = EXCLUDED.background_color,
    text_color = EXCLUDED.text_color,
    button_color = EXCLUDED.button_color,
    border_radius = EXCLUDED.border_radius,
    design_config = EXCLUDED.design_config,
    published = EXCLUDED.published,
    updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.get_loyalty_card_builder_config(
  p_establishment_id uuid
)
RETURNS TABLE (
  template_id text,
  primary_color text,
  secondary_color text,
  background_color text,
  text_color text,
  button_color text,
  border_radius integer,
  design_config jsonb,
  published boolean
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
    d.border_radius,
    d.design_config,
    d.published
  FROM public.loyalty_card_designs d
  WHERE d.establishment_id = p_establishment_id
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT
      'restaurant-elegant',
      '#173D32',
      '#D3A84C',
      '#F7F7F3',
      '#FFFFFF',
      '#173D32',
      28,
      '{}'::jsonb,
      false;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_public_loyalty_card_builder_config(
  p_access_token uuid
)
RETURNS TABLE (
  template_id text,
  primary_color text,
  secondary_color text,
  background_color text,
  text_color text,
  button_color text,
  border_radius integer,
  design_config jsonb
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT
    COALESCE(d.template_id, 'restaurant-elegant'),
    COALESCE(d.primary_color, '#173D32'),
    COALESCE(d.secondary_color, '#D3A84C'),
    COALESCE(d.background_color, '#F7F7F3'),
    COALESCE(d.text_color, '#FFFFFF'),
    COALESCE(d.button_color, '#173D32'),
    COALESCE(d.border_radius, 28),
    COALESCE(d.design_config, '{}'::jsonb)
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  LEFT JOIN public.loyalty_card_designs d
    ON d.establishment_id = c.establishment_id
   AND d.published = true
  WHERE l.access_token = p_access_token
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.save_loyalty_card_builder_config(uuid, jsonb, text, text, text, text, text, text, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_loyalty_card_builder_config(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_public_loyalty_card_builder_config(uuid) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.save_loyalty_card_builder_config(uuid, jsonb, text, text, text, text, text, text, integer, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_loyalty_card_builder_config(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card_builder_config(uuid) TO anon, authenticated;
