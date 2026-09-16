/*
  TapMarrakech V1 — Menu CMS
  Restaurant / Café menu structure.

  This migration only creates the menu data model and its RLS policies.
  It does not change existing tables.
*/

CREATE TABLE IF NOT EXISTS public.menu_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.menu_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL REFERENCES public.establishments(id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.menu_categories(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(trim(name)) > 0),
  description text,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  image_url text,
  display_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS menu_categories_establishment_order_idx
  ON public.menu_categories(establishment_id, display_order);

CREATE INDEX IF NOT EXISTS menu_items_establishment_category_order_idx
  ON public.menu_items(establishment_id, category_id, display_order);

CREATE INDEX IF NOT EXISTS menu_items_active_idx
  ON public.menu_items(establishment_id, active);

ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "menu_categories_public_select" ON public.menu_categories;
CREATE POLICY "menu_categories_public_select"
  ON public.menu_categories
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

DROP POLICY IF EXISTS "menu_categories_admin_all" ON public.menu_categories;
CREATE POLICY "menu_categories_admin_all"
  ON public.menu_categories
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "menu_categories_responsible_all" ON public.menu_categories;
CREATE POLICY "menu_categories_responsible_all"
  ON public.menu_categories
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

DROP POLICY IF EXISTS "menu_items_public_select" ON public.menu_items;
CREATE POLICY "menu_items_public_select"
  ON public.menu_items
  FOR SELECT
  TO anon, authenticated
  USING (
    active = true
    AND EXISTS (
      SELECT 1
      FROM public.establishments e
      WHERE e.id = establishment_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.menu_categories c
      WHERE c.id = category_id
        AND c.establishment_id = menu_items.establishment_id
        AND c.active = true
    )
  );

DROP POLICY IF EXISTS "menu_items_admin_all" ON public.menu_items;
CREATE POLICY "menu_items_admin_all"
  ON public.menu_items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "menu_items_responsible_all" ON public.menu_items;
CREATE POLICY "menu_items_responsible_all"
  ON public.menu_items
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

CREATE OR REPLACE FUNCTION public.update_menu_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS menu_categories_updated_at ON public.menu_categories;
CREATE TRIGGER menu_categories_updated_at
BEFORE UPDATE ON public.menu_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_menu_updated_at();

DROP TRIGGER IF EXISTS menu_items_updated_at ON public.menu_items;
CREATE TRIGGER menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.update_menu_updated_at();
