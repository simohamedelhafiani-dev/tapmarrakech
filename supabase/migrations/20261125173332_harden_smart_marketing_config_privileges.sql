-- Harden Smart Marketing configuration privileges against project-wide default grants.
-- RLS does not protect TRUNCATE, REFERENCES, or TRIGGER privileges.
REVOKE ALL PRIVILEGES ON TABLE public.smart_marketing_configs FROM anon;
REVOKE ALL PRIVILEGES ON TABLE public.smart_marketing_configs FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.smart_marketing_configs TO authenticated;

-- Keep the policy layer as the row-level authorization boundary for authenticated
-- managers while ensuring no non-RLS table capability is inherited.
REVOKE TRUNCATE, REFERENCES, TRIGGER ON TABLE public.smart_marketing_configs
  FROM anon, authenticated;
