-- Contract tests for WhatsApp manager access and OAuth token expiry storage.
DO $test$
DECLARE
  v_function oid;
  v_is_security_definer boolean;
  v_settings text[];
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'whatsapp_connections'
      AND column_name = 'token_expires_at'
      AND data_type = 'timestamp with time zone'
  ) THEN
    RAISE EXCEPTION 'whatsapp_connections.token_expires_at is missing or has the wrong type';
  END IF;

  v_function := to_regprocedure('public.user_can_manage_whatsapp(uuid)');
  IF v_function IS NULL THEN
    RAISE EXCEPTION 'user_can_manage_whatsapp(uuid) is missing';
  END IF;

  SELECT prosecdef, proconfig
    INTO v_is_security_definer, v_settings
  FROM pg_proc
  WHERE oid = v_function;

  IF NOT v_is_security_definer THEN
    RAISE EXCEPTION 'user_can_manage_whatsapp must be SECURITY DEFINER to evaluate manager helpers safely';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM unnest(coalesce(v_settings, ARRAY[]::text[])) s
    WHERE s LIKE 'search_path=%pg_catalog%'
  ) THEN
    RAISE EXCEPTION 'user_can_manage_whatsapp must pin its search_path';
  END IF;

  -- anon inherits any PUBLIC EXECUTE grant, so this also detects PUBLIC access.
  IF has_function_privilege('anon', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon/PUBLIC must not execute user_can_manage_whatsapp';
  END IF;
  IF NOT has_function_privilege('authenticated', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'authenticated must execute user_can_manage_whatsapp';
  END IF;
  IF NOT has_function_privilege('service_role', v_function, 'EXECUTE') THEN
    RAISE EXCEPTION 'service_role must execute user_can_manage_whatsapp';
  END IF;
END
$test$;
