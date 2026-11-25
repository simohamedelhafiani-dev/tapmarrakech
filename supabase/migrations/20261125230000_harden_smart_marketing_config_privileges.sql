-- Harden Smart Marketing configuration privileges against project-wide default grants.
-- RLS does not protect TRUNCATE, REFERENCES, or TRIGGER privileges.
REVOKE ALL PRIVILEGES ON TABLE public.smart_marketing_configs FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.smart_marketing_configs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.smart_marketing_configs TO authenticated;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.smart_marketing_configs
  FROM anon, authenticated;
