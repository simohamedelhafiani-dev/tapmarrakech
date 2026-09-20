-- TapMarrakech V1 — responsible promotions with AI-generated visuals.

CREATE TABLE IF NOT EXISTS public.promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  image_url text,
  normal_price numeric(10,2) CHECK (normal_price IS NULL OR normal_price >= 0),
  promo_price numeric(10,2) CHECK (promo_price IS NULL OR promo_price >= 0),
  start_at timestamptz,
  end_at timestamptz,
  active boolean NOT NULL DEFAULT true,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.promotions
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS normal_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS promo_price numeric(10,2),
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_order integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS promotions_establishment_order_idx
  ON public.promotions(establishment_id, display_order);

CREATE INDEX IF NOT EXISTS promotions_establishment_active_idx
  ON public.promotions(establishment_id, active);

ALTER TABLE public.promotions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "promotions_public_select" ON public.promotions;
CREATE POLICY "promotions_public_select"
  ON public.promotions
  FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_id
    )
  );

DROP POLICY IF EXISTS "promotions_admin_all" ON public.promotions;
CREATE POLICY "promotions_admin_all"
  ON public.promotions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "promotions_responsible_all" ON public.promotions;
CREATE POLICY "promotions_responsible_all"
  ON public.promotions
  FOR ALL
  TO authenticated
  USING (
    public.user_owns_establishment(establishment_id)
    OR public.is_establishment_responsible(establishment_id)
  )
  WITH CHECK (
    public.user_owns_establishment(establishment_id)
    OR public.is_establishment_responsible(establishment_id)
  );

DROP TRIGGER IF EXISTS promotions_updated_at ON public.promotions;
CREATE OR REPLACE FUNCTION public.update_promotions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW
EXECUTE FUNCTION public.update_promotions_updated_at();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'promotion-images',
  'promotion-images',
  true,
  10485760,
  ARRAY['image/png','image/jpeg','image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/png','image/jpeg','image/webp'];
