-- Harden authenticated SECURITY DEFINER RPCs that still used search_path=public.
-- All listed schemas are trusted: anon/authenticated have no CREATE privilege in them.
-- pg_catalog is first and pg_temp is last to prevent object shadowing.
ALTER FUNCTION public.cancel_loyalty_raffle(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.claim_loyalty_campaign_push_delivery(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.create_birthday_reward(uuid, uuid, text, text, integer, numeric)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.create_loyalty_card_recovery_session(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.create_loyalty_notification_campaign(uuid, text, text, text, text, timestamptz)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.create_loyalty_raffle(uuid, text, text, text, text, timestamptz, timestamptz, integer, text, timestamptz, timestamptz, integer, boolean, boolean, boolean, text, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.ensure_default_loyalty_tiers(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_loyalty_notification_campaign_history(uuid, integer)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_loyalty_program_settings(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_loyalty_referral_config(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_loyalty_referral_stats(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_loyalty_tiers(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_or_create_establishment_scanner_link(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.get_public_loyalty_link(uuid, text, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.is_establishment_responsible(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.is_tapmarrakech_admin()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.prevent_responsible_menu_design_update()
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.publish_loyalty_referral_settings(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.redeem_loyalty_discount_by_employee(text, uuid, numeric, text, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.redeem_loyalty_raffle_winner(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.redeem_loyalty_stamp_reward_by_employee(text, uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.save_loyalty_card_builder_config(uuid, jsonb, text, text, text, text, text, text, integer, boolean)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.save_loyalty_referral_draft(uuid, jsonb)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.update_establishment_menu_design(uuid, jsonb)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.update_establishment_menu_template(uuid, text)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.update_loyalty_tier(uuid, text, integer, integer, text, integer, boolean)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.user_has_establishment_access(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
ALTER FUNCTION public.user_owns_establishment(uuid)
  SET search_path = pg_catalog, public, auth, extensions, storage, vault, pg_temp;
