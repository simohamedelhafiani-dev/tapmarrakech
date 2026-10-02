-- Public bridge for the loyalty referral feature.
-- Keeps existing authentication and private referral RPCs unchanged.
-- Access is scoped exclusively by the customer's existing loyalty card access token.

DROP FUNCTION IF EXISTS public.get_public_loyalty_program_context(uuid);

CREATE FUNCTION public.get_public_loyalty_program_context(p_access_token uuid)
RETURNS TABLE(
  program_type text,
  stamp_goal integer,
  stamp_reward_name text,
  stamp_reward_description text,
  discount_percent numeric,
  discount_valid_days integer,
  points_per_currency numeric,
  currency text,
  enabled boolean,
  stamps_balance integer,
  stamps_total integer,
  referral_enabled boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT
    s.program_type,
    s.stamp_goal,
    s.stamp_reward_name,
    s.stamp_reward_description,
    s.discount_percent,
    s.discount_valid_days,
    s.points_per_currency,
    s.currency,
    s.enabled,
    c.stamps_balance,
    c.stamps_total,
    COALESCE((s.referral_config ->> 'enabled')::boolean, false) AS referral_enabled
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  JOIN public.loyalty_settings s ON s.establishment_id = c.establishment_id
  WHERE l.access_token = p_access_token
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.get_public_referral_code(p_access_token uuid)
RETURNS TABLE(referral_code text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT c.referral_code
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  WHERE l.access_token = p_access_token
  LIMIT 1;
$function$;

REVOKE ALL ON FUNCTION public.get_public_referral_code(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_referral_code(uuid) TO anon, authenticated;

REVOKE ALL ON FUNCTION public.get_public_loyalty_program_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_loyalty_program_context(uuid) TO anon, authenticated;
