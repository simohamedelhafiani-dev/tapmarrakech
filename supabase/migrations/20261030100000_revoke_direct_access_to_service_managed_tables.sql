-- These tables are deliberately service-managed. RLS is enabled and no
-- end-user policies are defined; explicitly remove direct API table grants.
-- Some tables are provisioned only in production or by optional feature setup,
-- so guard each operation instead of making the entire migration fail locally.
DO $$
DECLARE
  table_name text;
  managed_tables text[] := ARRAY[
    'customer_reviews_claims',
    'employee_access_codes',
    'employee_login_rate_limits',
    'employee_sessions',
    'google_business_accounts',
    'google_business_oauth_states',
    'loyalty_admin_secrets',
    'loyalty_card_notification_reads',
    'loyalty_card_notifications',
    'loyalty_card_recovery_sessions',
    'loyalty_customer_links',
    'loyalty_notification_campaigns',
    'loyalty_notification_push_attempts',
    'loyalty_promotion_claims',
    'loyalty_push_subscriptions',
    'loyalty_raffle_draw_audit',
    'loyalty_referrals',
    'loyalty_reward_claims',
    'satisfaction_feedback'
  ];
BEGIN
  FOREACH table_name IN ARRAY managed_tables LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'REVOKE ALL PRIVILEGES ON TABLE public.%I FROM anon, authenticated',
        table_name
      );
    END IF;
  END LOOP;

  IF to_regclass('public.loyalty_admin_secrets') IS NOT NULL THEN
    EXECUTE 'COMMENT ON TABLE public.loyalty_admin_secrets IS ''Service-managed secrets; direct anon/authenticated table privileges are revoked.''';
  END IF;
END
$$;
