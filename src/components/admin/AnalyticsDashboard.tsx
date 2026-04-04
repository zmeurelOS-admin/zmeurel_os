import { AdminAnalyticsDashboardView } from '@/components/admin/analytics/AdminAnalyticsDashboardView'
import { loadAnalyticsDashboardData } from '@/lib/admin/analytics-dashboard-data'
import type { AnalyticsDashboardParams } from '@/lib/admin/analytics-dashboard-data'
import { getSentryTechHealth } from '@/lib/monitoring/sentry-tech-health'
import { createClient } from '@/lib/supabase/server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

export type { AnalyticsDashboardParams }

export async function AnalyticsDashboard({ filters }: { filters: AnalyticsDashboardParams }) {
  const supabase = await createClient()
  const admin = getSupabaseAdmin()
  const today = new Date().toISOString().slice(0, 10)
  await supabase.rpc('refresh_tenant_metrics_daily', { p_date: today })
  const data = await loadAnalyticsDashboardData(admin, filters)
  const sentryTechHealth = getSentryTechHealth()
  return <AdminAnalyticsDashboardView data={data} params={filters} sentryTechHealth={sentryTechHealth} />
}
