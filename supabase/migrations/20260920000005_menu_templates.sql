-- Normalize menu template selection to stable template keys.
-- The database may already contain a UUID-based menu_template_id with a foreign key.
-- We intentionally replace that relation with stable text template keys.

ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS menu_template_id text;

ALTER TABLE public.establishments
  DROP CONSTRAINT IF EXISTS establishments_menu_template_id_fkey;

ALTER TABLE public.establishments
  ALTER COLUMN menu_template_id DROP DEFAULT;

ALTER TABLE public.establishments
  ALTER COLUMN menu_template_id TYPE text
  USING NULL;

ALTER TABLE public.establishments
  ALTER COLUMN menu_template_id SET DEFAULT 'editorial';

UPDATE public.establishments
SET menu_template_id = 'editorial'
WHERE menu_template_id IS NULL;

ALTER TABLE public.establishments
  DROP CONSTRAINT IF EXISTS establishments_menu_template_id_check;

ALTER TABLE public.establishments
  ADD CONSTRAINT establishments_menu_template_id_check
  CHECK (menu_template_id IN ('editorial', 'luxury', 'cards', 'dark'));

CREATE INDEX IF NOT EXISTS establishments_menu_template_id_idx
  ON public.establishments(menu_template_id);
