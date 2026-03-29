-- One-time cleanup: delete all pre-beta analytics data (before 2026-03-15).
-- Run once in the Supabase SQL editor. Safe to run multiple times (idempotent deletes).

-- 1. Delete pre-beta event-level analytics
DELETE FROM public.analytics_events
WHERE created_at < '2026-03-15T00:00:00+00:00';

-- 2. Delete pre-beta aggregated daily metrics
DELETE FROM public.tenant_metrics_daily
WHERE date < '2026-03-15';

-- 3. Verify counts (remaining rows should all be >= 2026-03-15)
SELECT
  'analytics_events'   AS table_name,
  count(*)             AS remaining_rows,
  min(created_at)      AS earliest_event
FROM public.analytics_events

UNION ALL

SELECT
  'tenant_metrics_daily',
  count(*),
  min(date)::timestamptz
FROM public.tenant_metrics_daily;
