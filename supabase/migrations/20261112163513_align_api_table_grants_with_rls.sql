-- Align anon table privileges with the explicit public RLS policies.
-- RLS does not constrain TRUNCATE, and TRIGGER/REFERENCES are not needed by API roles.
REVOKE TRUNCATE, TRIGGER, REFERENCES ON TABLE
  public.analytics_events,
  public.establishment_scanner_links,
  public.establishments,
  public.invoices,
  public.loyalty_customers,
  public.loyalty_raffle_entries,
  public.loyalty_raffle_winners,
  public.loyalty_raffles,
  public.loyalty_settings,
  public.loyalty_tiers,
  public.loyalty_transactions,
  public.menu_categories,
  public.menu_items,
  public.payments,
  public.promotions,
  public.reviews,
  public.subscription_plans,
  public.subscriptions,
  public.templates
FROM anon, authenticated;

-- Remove all direct anonymous privileges first, then restore only the operations
-- explicitly represented by public RLS policies.
REVOKE ALL PRIVILEGES ON TABLE
  public.analytics_events,
  public.establishment_scanner_links,
  public.establishments,
  public.invoices,
  public.loyalty_customers,
  public.loyalty_raffle_entries,
  public.loyalty_raffle_winners,
  public.loyalty_raffles,
  public.loyalty_settings,
  public.loyalty_tiers,
  public.loyalty_transactions,
  public.menu_categories,
  public.menu_items,
  public.payments,
  public.promotions,
  public.reviews,
  public.subscription_plans,
  public.subscriptions,
  public.templates
FROM anon;

GRANT INSERT ON TABLE public.analytics_events TO anon;
GRANT SELECT ON TABLE public.loyalty_settings TO anon;
GRANT SELECT ON TABLE public.menu_categories TO anon;
GRANT SELECT ON TABLE public.menu_items TO anon;
GRANT SELECT ON TABLE public.promotions TO anon;
GRANT INSERT ON TABLE public.reviews TO anon;
