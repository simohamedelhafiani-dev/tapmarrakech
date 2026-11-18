-- Move the legacy one-argument overload out of the PostgREST RPC name to
-- prevent PGRST203 ambiguity while retaining it for a controlled rollback.
DO $migration$
BEGIN
  IF to_regprocedure('public.get_loyalty_notification_campaign_history(uuid)') IS NOT NULL
     AND to_regprocedure('public.get_loyalty_notification_campaign_history_legacy(uuid)') IS NULL THEN
    ALTER FUNCTION public.get_loyalty_notification_campaign_history(uuid)
      RENAME TO get_loyalty_notification_campaign_history_legacy;
  END IF;

  IF to_regprocedure('public.get_loyalty_notification_campaign_history_legacy(uuid)') IS NOT NULL THEN
    REVOKE ALL ON FUNCTION public.get_loyalty_notification_campaign_history_legacy(uuid)
      FROM PUBLIC, anon, authenticated;
  END IF;
END
$migration$;

REVOKE ALL ON FUNCTION public.get_loyalty_notification_campaign_history(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_loyalty_notification_campaign_history(uuid, integer) TO authenticated;

