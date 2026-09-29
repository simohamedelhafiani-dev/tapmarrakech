-- ============================================================
-- Admin Overview Evolution
-- Adds a read-only RPC for aggregated time-series data.
--
-- IMPORTANT:
-- - Does not modify any existing function.
-- - Does not modify any table.
-- - Does not modify RLS policies.
-- - Does not insert/update/delete any data.
-- ============================================================

CREATE OR REPLACE FUNCTION public.get_admin_overview_evolution(
  p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'reviewsEvolution',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', evolution.date,
            'count', evolution.count
          )
          ORDER BY evolution.date ASC
        )
        FROM (
          SELECT
            r.created_at::date AS date,
            COUNT(*)::integer AS count
          FROM public.reviews AS r
          WHERE r.created_at >= NOW() - make_interval(days => p_days)
          GROUP BY r.created_at::date
        ) AS evolution
      ),
      '[]'::jsonb
    ),

    'scansEvolution',
    COALESCE(
      (
        SELECT jsonb_agg(
          jsonb_build_object(
            'date', evolution.date,
            'count', evolution.count
          )
          ORDER BY evolution.date ASC
        )
        FROM (
          SELECT
            ae.created_at::date AS date,
            COUNT(*)::integer AS count
          FROM public.analytics_events AS ae
          WHERE ae.created_at >= NOW() - make_interval(days => p_days)
          GROUP BY ae.created_at::date
        ) AS evolution
      ),
      '[]'::jsonb
    )
  );
$$;

REVOKE ALL ON FUNCTION public.get_admin_overview_evolution(integer)
FROM PUBLIC;

REVOKE ALL ON FUNCTION public.get_admin_overview_evolution(integer)
FROM anon;

GRANT EXECUTE ON FUNCTION public.get_admin_overview_evolution(integer)
TO authenticated;
