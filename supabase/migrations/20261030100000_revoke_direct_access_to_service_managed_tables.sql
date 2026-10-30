-- These tables are deliberately service-managed. RLS is enabled and no
-- end-user policies are defined; explicitly remove direct API table grants.
-- Service-role Edge Functions retain their access. SECURITY DEFINER RPCs are
-- governed separately by their own EXECUTE grants and function-level checks.
REVOKE ALL PRIVILEGES ON TABLE
  public.customer_reviews_claims,
  public.employee_access_codes,
  public.employee_login_rate_limits,
  public.employee_sessions,
  public.google_business_accounts,
  public.google_business_oauth_states,
  public.loyalty_admin_secrets,
  public.loyalty_card_notification_reads,
  public.loyalty_card_notifications,
  public.loyalty_card_recovery_sessions,
  public.loyalty_customer_links,
  public.loyalty_notification_campaigns,
  public.loyalty_notification_push_attempts,
  public.loyalty_promotion_claims,
  public.loyalty_push_subscriptions,
  public.loyalty_raffle_draw_audit,
  public.loyalty_referrals,
  public.loyalty_reward_claims,
  public.satisfaction_feedback
FROM anon, authenticated;

COMMENT ON TABLE public.loyalty_admin_secrets IS
  'Service-managed secrets; direct anon/authenticated table privileges are revoked.';

