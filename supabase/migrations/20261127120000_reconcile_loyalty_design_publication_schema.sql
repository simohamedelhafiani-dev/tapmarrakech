-- Reconcile the loyalty card design schema with what Production already runs.
-- Production gained the drafts table, the published_at column and the public
-- Wallet config RPC outside the migration history, so fresh databases broke the
-- save RPCs. This migration is idempotent and safe on both kinds of database.
-- It also moves SQL-side defaults to the Nardo palette and restricts every
-- public reader to explicitly published designs.

ALTER TABLE public.loyalty_card_designs
  ADD COLUMN IF NOT EXISTS published_at timestamptz;

CREATE TABLE IF NOT EXISTS public.loyalty_card_design_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  establishment_id uuid NOT NULL UNIQUE REFERENCES public.establishments(id) ON DELETE CASCADE,
  template_id text NOT NULL DEFAULT 'luxury',
  primary_color text NOT NULL DEFAULT '#686D76',
  secondary_color text NOT NULL DEFAULT '#686D76',
  background_color text NOT NULL DEFAULT '#050505',
  text_color text NOT NULL DEFAULT '#FFFFFF',
  button_color text NOT NULL DEFAULT '#686D76',
  border_radius integer NOT NULL DEFAULT 24,
  design_config jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.loyalty_card_design_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS loyalty_card_design_drafts_no_direct_access ON public.loyalty_card_design_drafts;
CREATE POLICY loyalty_card_design_drafts_no_direct_access
  ON public.loyalty_card_design_drafts FOR ALL USING (false) WITH CHECK (false);
-- Drafts are only reached through SECURITY DEFINER RPCs.
REVOKE ALL ON public.loyalty_card_design_drafts FROM anon, authenticated;
GRANT ALL ON public.loyalty_card_design_drafts TO service_role;

-- Nardo palette defaults (existing rows are left untouched).
ALTER TABLE public.loyalty_card_designs
  ALTER COLUMN primary_color SET DEFAULT '#686D76',
  ALTER COLUMN secondary_color SET DEFAULT '#686D76',
  ALTER COLUMN background_color SET DEFAULT '#050505',
  ALTER COLUMN text_color SET DEFAULT '#FFFFFF',
  ALTER COLUMN button_color SET DEFAULT '#686D76';

ALTER TABLE public.loyalty_card_design_drafts
  ALTER COLUMN primary_color SET DEFAULT '#686D76',
  ALTER COLUMN secondary_color SET DEFAULT '#686D76',
  ALTER COLUMN background_color SET DEFAULT '#050505',
  ALTER COLUMN text_color SET DEFAULT '#FFFFFF',
  ALTER COLUMN button_color SET DEFAULT '#686D76';

-- Private Studio reader: draft first, then the published design, then Nardo.
CREATE OR REPLACE FUNCTION public.get_loyalty_card_builder_config(p_establishment_id uuid)
RETURNS TABLE(template_id text, primary_color text, secondary_color text, background_color text,
              text_color text, button_color text, border_radius integer, design_config jsonb, published boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null
     or not (public.is_tapmarrakech_admin() or public.user_has_establishment_access(p_establishment_id)) then
    raise exception 'Not authorized';
  end if;

  return query
  select d.template_id,d.primary_color,d.secondary_color,d.background_color,d.text_color,
         d.button_color,d.border_radius,coalesce(d.design_config,'{}'::jsonb),false
  from public.loyalty_card_design_drafts d
  where d.establishment_id=p_establishment_id
  limit 1;

  if found then
    return;
  end if;

  return query
  select d.template_id,d.primary_color,d.secondary_color,d.background_color,d.text_color,
         d.button_color,d.border_radius,coalesce(d.design_config,'{}'::jsonb),true
  from public.loyalty_card_designs d
  where d.establishment_id=p_establishment_id
    and d.published=true
  limit 1;

  if not found then
    return query select 'luxury','#686D76','#686D76','#050505','#FFFFFF','#686D76',24,'{}'::jsonb,false;
  end if;
end;
$function$;

REVOKE ALL ON FUNCTION public.get_loyalty_card_builder_config(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_loyalty_card_builder_config(uuid) TO authenticated, service_role;

-- Public card page reader (used by src/pages/LoyaltyCard.tsx).
CREATE OR REPLACE FUNCTION public.get_public_loyalty_card_builder_config(p_access_token uuid)
RETURNS TABLE(template_id text, primary_color text, secondary_color text, background_color text,
              text_color text, button_color text, border_radius integer, design_config jsonb)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  select coalesce(d.template_id, 'restaurant-elegant'),
         coalesce(d.primary_color, '#686D76'),
         coalesce(d.secondary_color, '#686D76'),
         coalesce(d.background_color, '#050505'),
         coalesce(d.text_color, '#FFFFFF'),
         coalesce(d.button_color, '#686D76'),
         coalesce(d.border_radius, 28),
         coalesce(d.design_config, '{}'::jsonb)
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  left join public.loyalty_card_designs d
    on d.establishment_id = c.establishment_id
   and d.published = true
  where l.access_token = p_access_token
  limit 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_loyalty_card_builder_config(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card_builder_config(uuid) TO anon, authenticated, service_role;

-- Legacy public card reader: published designs only, Nardo fallbacks.
-- Fresh databases still have the original 7-column signature, so the result
-- type changes; drop and recreate inside this migration's transaction.
DROP FUNCTION IF EXISTS public.get_public_loyalty_card_config(uuid);
CREATE FUNCTION public.get_public_loyalty_card_config(p_access_token uuid)
RETURNS TABLE(template_id text, primary_color text, secondary_color text, background_color text,
              text_color text, button_color text, border_radius integer, design_config jsonb, published boolean)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  select coalesce(d.template_id,'luxury'),
         coalesce(d.primary_color,'#686D76'),
         coalesce(d.secondary_color,'#686D76'),
         coalesce(d.background_color,'#050505'),
         coalesce(d.text_color,'#FFFFFF'),
         coalesce(d.button_color,'#686D76'),
         coalesce(d.border_radius,24),
         coalesce(d.design_config,'{}'::jsonb),
         coalesce(d.published,false)
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id=l.customer_id
  left join public.loyalty_card_designs d
    on d.establishment_id=c.establishment_id
   and d.published = true
  where l.access_token=p_access_token
  limit 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_loyalty_card_config(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_card_config(uuid) TO anon, authenticated, service_role;

-- Legacy public Wallet reader: never expose an unpublished design.
CREATE OR REPLACE FUNCTION public.get_public_loyalty_wallet_config(p_access_token uuid)
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO ''
AS $function$
  select coalesce(d.design_config -> 'wallet_design', '{}'::jsonb)
  from public.loyalty_customer_links l
  join public.loyalty_customers c on c.id = l.customer_id
  left join public.loyalty_card_designs d
    on d.establishment_id = c.establishment_id
   and d.published = true
  where l.access_token = p_access_token
  limit 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_loyalty_wallet_config(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_wallet_config(uuid) TO anon, authenticated, service_role;
