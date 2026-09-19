ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS menu_template_id text NOT NULL DEFAULT 'editorial';

ALTER TABLE public.establishments
  DROP CONSTRAINT IF EXISTS establishments_menu_template_id_check;

ALTER TABLE public.establishments
  ADD CONSTRAINT establishments_menu_template_id_check
  CHECK (menu_template_id IN ('editorial', 'luxury', 'cards', 'dark'));

CREATE INDEX IF NOT EXISTS establishments_menu_template_id_idx
  ON public.establishments(menu_template_id);
