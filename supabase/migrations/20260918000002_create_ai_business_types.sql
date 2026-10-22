-- Restore the AI prompt registry required by the menu AI migrations.
-- This is a branch-only migration; permissions are admin-only to match the live table.

CREATE TABLE IF NOT EXISTS public.ai_business_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  ai_prompt text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_business_types ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.ai_business_types FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_business_types TO authenticated;

DROP POLICY IF EXISTS "Admin can manage AI business types" ON public.ai_business_types;
CREATE POLICY "Admin can manage AI business types"
  ON public.ai_business_types
  FOR ALL
  TO authenticated
  USING (public.is_tapmarrakech_admin())
  WITH CHECK (public.is_tapmarrakech_admin());
