-- Normalize the remaining SECURITY DEFINER functions with legacy public-first paths.
-- Trusted schemas only; pg_catalog first, pg_temp last. No EXECUTE grants are changed.
ALTER FUNCTION public.add_loyalty_points(uuid, uuid, numeric, text, text, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.add_loyalty_stamp_by_employee(text, uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.apply_loyalty_referral_reward(uuid, uuid, text, numeric, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.assign_subscription_to_establishment(uuid, uuid, text, integer, timestamptz, timestamptz)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.claim_public_loyalty_review_bonus(uuid, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.clear_employee_login_rate_limit(text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.complete_pending_loyalty_referral(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.consume_employee_login_attempt(text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.create_establishment_with_premium_trial(text, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.ensure_loyalty_referral_code(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.generate_loyalty_referral_code(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_active_employee_session_establishment(text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_admin_satisfaction_feedback(uuid, integer)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_employee_login_establishments()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_employee_loyalty_card_config(text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_loyalty_customer_link(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_my_employee_establishments()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_my_subscription_for_establishment(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_responsible_subscription_card(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.login_employee_with_code(uuid, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.login_employee_with_code_only(text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.logout_employee(text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.loyalty_points_discount_unlock_trigger()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.process_loyalty_referral(text, uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.register_public_loyalty_customer_for_enrollment(uuid, text, text, text, date)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.register_public_loyalty_customer_v2(uuid, text, text, text, date, text, text[], boolean, boolean, text, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.revoke_employee_sessions_on_code_deactivation()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.revoke_employee_sessions_on_deactivation()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.set_employee_access_code(uuid, uuid, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.set_employee_access_code_status(uuid, boolean)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.set_loyalty_admin_code(uuid, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
