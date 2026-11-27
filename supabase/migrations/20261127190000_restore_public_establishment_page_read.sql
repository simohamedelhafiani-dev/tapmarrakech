-- Restore anonymous read access needed by the public establishment page
-- (/r/:slug and /p/:slug). Production had lost both the anon grant and the
-- public SELECT policy, so every visitor saw "establishment not found".
-- Only public-facing columns are granted; user_id and internal ids stay hidden.
-- Some columns exist only in Production (schema drift), so grant the ones present.

DROP POLICY IF EXISTS establishments_public_select ON public.establishments;
CREATE POLICY establishments_public_select
  ON public.establishments
  FOR SELECT
  TO anon
  USING (true);

REVOKE SELECT ON public.establishments FROM anon;

DO $migration$
DECLARE
  v_columns text;
BEGIN
  SELECT string_agg(quote_ident(c.column_name), ', ')
    INTO v_columns
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'establishments'
    AND c.column_name = ANY (ARRAY[
      'id', 'name', 'slug', 'logo_url', 'google_review_url', 'tripadvisor_review_url',
      'redirect_threshold', 'business_type', 'address', 'city', 'phone', 'email',
      'website_url', 'description', 'opening_hours', 'instagram_url', 'facebook_url',
      'tiktok_url', 'whatsapp_number', 'theme_config', 'page_template_id',
      'menu_template_id', 'menu_display_mode', 'menu_pdf_url', 'menu_ai_design',
      'menu_ai_photo_mode', 'review_bonus_points', 'feedback_bonus_points'
    ]);

  EXECUTE format('GRANT SELECT (%s) ON public.establishments TO anon', v_columns);
END
$migration$;

-- Public menu templates: the RLS policy already limits anon to active rows,
-- but the table-level grant was missing.
GRANT SELECT ON public.templates TO anon;

NOTIFY pgrst, 'reload schema';
