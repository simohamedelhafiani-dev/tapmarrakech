-- These tables intentionally have RLS enabled with no direct API policies.
-- Remove broad table grants so access remains mediated by vetted RPCs/Edge Functions.
REVOKE ALL PRIVILEGES ON TABLE
  public.loyalty_customer_links,
  public.loyalty_rewards,
  public.whatsapp_connections,
  public.whatsapp_consent_events,
  public.whatsapp_conversations,
  public.whatsapp_handoff_requests,
  public.whatsapp_messages
FROM anon, authenticated;
