/*
  Global Admin templates.
  Admin owns template definitions; Responsable only consumes active templates.
  Existing page/menu template behavior is preserved.
*/

CREATE TABLE IF NOT EXISTS public.templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  name text NOT NULL,
  description text,
  thumbnail_url text,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.templates ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.templates'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%kind%'
  LOOP
    EXECUTE format('ALTER TABLE public.templates DROP CONSTRAINT IF EXISTS %I', r.conname);
  END LOOP;
END $$;

ALTER TABLE public.templates
  ADD CONSTRAINT templates_kind_check CHECK (kind IN ('page','menu','loyalty'));

CREATE INDEX IF NOT EXISTS templates_kind_active_idx ON public.templates(kind, active, created_at DESC);

DROP POLICY IF EXISTS templates_admin_all ON public.templates;
CREATE POLICY templates_admin_all ON public.templates FOR ALL TO authenticated
USING (public.is_tapmarrakech_admin()) WITH CHECK (public.is_tapmarrakech_admin());

DROP POLICY IF EXISTS templates_responsible_select ON public.templates;
CREATE POLICY templates_responsible_select ON public.templates FOR SELECT TO authenticated
USING (active = true);

INSERT INTO public.templates (id,kind,name,description,config,active,is_default) VALUES
('00000000-0000-0000-0000-000000000101','menu','Editorial','Typographie éditoriale et mise en page raffinée.','{"key":"editorial","layout":"editorial","categoryStyle":"editorial","itemStyle":"editorial-list","showPhotos":false,"showDescriptions":true,"showPrices":true,"showSearch":false,"hero":{"style":"typographic","eyebrow":"La carte","titleStyle":"display"},"theme":{"primary":"#173F35","accent":"#C9A45C","background":"#F3EEE2"}}',true,true),
('00000000-0000-0000-0000-000000000102','menu','Luxury','Version luxe avec visuels et cartes produits.','{"key":"luxury","layout":"luxury","categoryStyle":"editorial","itemStyle":"image-card","showPhotos":true,"showDescriptions":true,"showPrices":true,"showSearch":false,"hero":{"style":"image","overlay":true},"theme":{"primary":"#173F35","accent":"#C9A45C","background":"#F7F3EA"}}',true,false),
('00000000-0000-0000-0000-000000000103','menu','Cards','Présentation moderne en cartes.','{"key":"cards","layout":"cards","categoryStyle":"section-title","itemStyle":"image-card","showPhotos":true,"showDescriptions":true,"showPrices":true,"showSearch":false,"hero":{"style":"image","overlay":true},"theme":{"primary":"#173F35","accent":"#C9A45C","background":"#F7F3EA"}}',true,false),
('00000000-0000-0000-0000-000000000104','menu','Noir Signature','Univers sombre premium.','{"key":"dark","layout":"dark","categoryStyle":"editorial","itemStyle":"premium-list","showPhotos":true,"showDescriptions":true,"showPrices":true,"showSearch":false,"hero":{"style":"dark","accent":"gold"},"theme":{"primary":"#102B24","accent":"#C9A45C","background":"#102B24"}}',true,false),
('00000000-0000-0000-0000-000000000201','loyalty','Obsidian','Fond immersif, contraste cinématique et or discret.','{"key":"obsidian","primary":"#0A0A09","secondary":"#D6B15A","background":"#111111","text":"#FFFFFF","radius":30,"mode":"QR","title":"Bon goût. Belles rencontres.","subtitle":"Votre fidélité mérite une expérience à part.","stampStyle":"circles"}',true,false),
('00000000-0000-0000-0000-000000000202','loyalty','Editorial','Ivoire, typographie magazine et détails champagne.','{"key":"editorial","primary":"#3B332B","secondary":"#C9A86A","background":"#F4EDE1","text":"#17130F","radius":30,"mode":"QR","title":"Des moments qui comptent.","subtitle":"Une expérience pensée pour vous.","stampStyle":"circles"}',true,true),
('00000000-0000-0000-0000-000000000203','loyalty','Glass','Photo plein écran, blur et lumière.','{"key":"glass","primary":"#18372C","secondary":"#D8C28A","background":"#10251E","text":"#FFFFFF","radius":30,"mode":"QR","title":"Prendre soin de vous, toujours.","subtitle":"Vos avantages évoluent avec vous.","stampStyle":"circles"}',true,false),
('00000000-0000-0000-0000-000000000204','loyalty','Titanium','Noir profond et signature métallique.','{"key":"titanium","primary":"#11110F","secondary":"#D6B15A","background":"#10100F","text":"#FFFFFF","radius":26,"mode":"QR","title":"GOOD FOOD. BETTER PEOPLE.","subtitle":"Elevate every visit.","stampStyle":"squares"}',true,false),
('00000000-0000-0000-0000-000000000205','loyalty','Hospitality','Univers hôtel, restaurant et travel.','{"key":"hospitality","primary":"#3A2115","secondary":"#E2B66D","background":"#2B1B13","text":"#FFFFFF","radius":30,"mode":"QR","title":"Plus qu’un repas, une expérience.","subtitle":"Saveurs. Partage. Souvenirs.","stampStyle":"circles"}',true,false),
('00000000-0000-0000-0000-000000000206','loyalty','Apple Wallet','Minimalisme premium et lecture instantanée.','{"key":"apple-wallet","primary":"#403A32","secondary":"#B9975B","background":"#F2EEE6","text":"#1B1A18","radius":28,"mode":"QR","title":"Beauty in every detail.","subtitle":"Vos privilèges, toujours avec vous.","stampStyle":"circles"}',true,false)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.establishments DROP CONSTRAINT IF EXISTS establishments_menu_template_id_check;
ALTER TABLE public.establishments ADD CONSTRAINT establishments_menu_template_id_check
CHECK (menu_template_id IS NULL OR length(menu_template_id) > 0);
