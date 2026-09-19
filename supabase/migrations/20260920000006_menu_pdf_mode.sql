ALTER TABLE public.establishments
  ADD COLUMN IF NOT EXISTS menu_display_mode text NOT NULL DEFAULT 'digital',
  ADD COLUMN IF NOT EXISTS menu_pdf_url text;

ALTER TABLE public.establishments
  DROP CONSTRAINT IF EXISTS establishments_menu_display_mode_check;

ALTER TABLE public.establishments
  ADD CONSTRAINT establishments_menu_display_mode_check
  CHECK (menu_display_mode IN ('digital', 'pdf'));

CREATE INDEX IF NOT EXISTS establishments_menu_display_mode_idx
  ON public.establishments(menu_display_mode);

INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-pdfs', 'menu-pdfs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can read menu PDFs" ON storage.objects;
CREATE POLICY "Public can read menu PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'menu-pdfs');

DROP POLICY IF EXISTS "Authenticated can upload menu PDFs" ON storage.objects;
CREATE POLICY "Authenticated can upload menu PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'menu-pdfs');

DROP POLICY IF EXISTS "Authenticated can update menu PDFs" ON storage.objects;
CREATE POLICY "Authenticated can update menu PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'menu-pdfs')
WITH CHECK (bucket_id = 'menu-pdfs');

DROP POLICY IF EXISTS "Authenticated can delete menu PDFs" ON storage.objects;
CREATE POLICY "Authenticated can delete menu PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'menu-pdfs');
