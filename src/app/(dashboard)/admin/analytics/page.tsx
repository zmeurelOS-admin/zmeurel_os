import { redirect } from 'next/navigation'

import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard'
import { parseAnalyticsParams } from '@/lib/admin/analytics-url'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const superadmin = await isSuperAdmin(supabase, user.id)
  if (!superadmin) {
    redirect('/dashboard')
  }

  const resolvedSearchParams = searchParams ? await searchParams : {}
  const filters = parseAnalyticsParams(resolvedSearchParams)

  return <AnalyticsDashboard filters={filters} />
}
