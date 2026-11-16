-- Restrict Web Push subscription endpoints to supported browser push services.
-- Store only same-origin loyalty-card paths, never arbitrary external URLs.
CREATE OR REPLACE FUNCTION public.register_loyalty_push_subscription(
  p_access_token uuid,
  p_subscription jsonb,
  p_card_url text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $function$
DECLARE
  v_customer_id uuid;
  v_establishment_id uuid;
  v_endpoint text;
  v_endpoint_host text;
  v_p256dh text;
  v_auth text;
  v_user_agent text;
  v_card_url text;
  v_id uuid;
BEGIN
  IF p_access_token IS NULL OR p_subscription IS NULL OR jsonb_typeof(p_subscription) <> 'object' THEN
    RAISE EXCEPTION 'invalid_push_subscription_request';
  END IF;

  v_endpoint := nullif(trim(p_subscription->>'endpoint'), '');
  v_p256dh := nullif(trim(p_subscription->'keys'->>'p256dh'), '');
  v_auth := nullif(trim(p_subscription->'keys'->>'auth'), '');
  v_user_agent := nullif(trim(current_setting('request.headers', true)::jsonb->>'user-agent'), '');
  v_card_url := nullif(trim(coalesce(p_card_url, '')), '');

  IF v_endpoint IS NULL OR v_p256dh IS NULL OR v_auth IS NULL THEN
    RAISE EXCEPTION 'invalid_push_subscription';
  END IF;

  IF v_endpoint !~ '^https://[^/:?#]+/[^[:space:]]+$' THEN
    RAISE EXCEPTION 'invalid_push_endpoint';
  END IF;

  v_endpoint_host := lower(substring(v_endpoint from '^https://([^/:?#]+)'));
  IF NOT (
    v_endpoint_host = 'fcm.googleapis.com'
    OR v_endpoint_host = 'updates.push.services.mozilla.com'
    OR v_endpoint_host LIKE '%.push.services.mozilla.com'
    OR v_endpoint_host LIKE '%.notify.windows.com'
    OR v_endpoint_host = 'web.push.apple.com'
    OR v_endpoint_host LIKE '%.push.apple.com'
  ) THEN
    RAISE EXCEPTION 'unsupported_push_endpoint';
  END IF;

  IF v_card_url IS NOT NULL AND v_card_url !~ '^/loyalty(/[A-Za-z0-9_-]+)?$' THEN
    RAISE EXCEPTION 'invalid_card_url';
  END IF;

  SELECT c.id, c.establishment_id
    INTO v_customer_id, v_establishment_id
  FROM public.loyalty_customer_links l
  JOIN public.loyalty_customers c ON c.id = l.customer_id
  WHERE l.access_token = p_access_token
  LIMIT 1;

  IF v_customer_id IS NULL THEN
    RAISE EXCEPTION 'invalid_loyalty_card';
  END IF;

  INSERT INTO public.loyalty_push_subscriptions (
    customer_id, establishment_id, endpoint, p256dh, auth,
    user_agent, card_url, last_seen_at, updated_at
  )
  VALUES (
    v_customer_id, v_establishment_id, v_endpoint, v_p256dh, v_auth,
    v_user_agent, v_card_url, pg_catalog.now(), pg_catalog.now()
  )
  ON CONFLICT (endpoint) DO UPDATE SET
    customer_id = excluded.customer_id,
    establishment_id = excluded.establishment_id,
    p256dh = excluded.p256dh,
    auth = excluded.auth,
    user_agent = excluded.user_agent,
    card_url = coalesce(excluded.card_url, public.loyalty_push_subscriptions.card_url),
    last_seen_at = pg_catalog.now(),
    updated_at = pg_catalog.now()
  RETURNING id INTO v_id;

  UPDATE public.loyalty_customers
  SET notification_consent = true,
      updated_at = pg_catalog.now()
  WHERE id = v_customer_id;

  RETURN jsonb_build_object('success', true, 'subscription_id', v_id);
END;
$function$;

REVOKE ALL ON FUNCTION public.register_loyalty_push_subscription(uuid, jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_loyalty_push_subscription(uuid, jsonb, text) TO anon, authenticated;
