import { redirect } from 'next/navigation'
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard'
import type { AnalyticsDashboardFilters } from '@/components/admin/AnalyticsDashboard'
import { createClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'

interface AdminAnalyticsPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function pickSingle(value: string | string[] | undefined): string | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function resolveFilters(searchParams: Record<string, string | string[] | undefined>): AnalyticsDashboardFilters {
  const aiRangeParam = pickSingle(searchParams.aiRange)
  const aiFlowParam = pickSingle(searchParams.aiFlow)
  const aiDecisionModeParam = pickSingle(searchParams.aiDecisionMode)

  return {
    aiRange: aiRangeParam === '7d' ? '7d' : '30d',
    aiFlow: aiFlowParam?.trim() ? aiFlowParam : null,
    aiDecisionMode: aiDecisionModeParam?.trim() ? aiDecisionModeParam : null,
  }
}

export default async function AdminAnalyticsPage({ searchParams }: AdminAnalyticsPageProps) {
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

  return <AnalyticsDashboard filters={resolveFilters(resolvedSearchParams)} />
}
