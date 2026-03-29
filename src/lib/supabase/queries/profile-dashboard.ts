import { getSupabase } from '@/lib/supabase/client'
import type { DashboardLayoutConfig } from '@/lib/dashboard/layout'
import type { Json } from '@/types/supabase'

export interface DashboardProfilePreferences {
  hideOnboarding: boolean
  dashboardLayout: Json | null
}

export async function getDashboardProfilePreferences(userId: string): Promise<DashboardProfilePreferences> {
  const supabase = getSupabase()

  const { data, error } = await supabase
    .from('profiles')
    .select('hide_onboarding,dashboard_layout')
    .eq('id', userId)
    .maybeSingle()

  if (error) throw error

  return {
    hideOnboarding: data?.hide_onboarding ?? false,
    dashboardLayout: data?.dashboard_layout ?? null,
  }
}

export async function dismissDashboardOnboarding(userId: string): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase.from('profiles').update({ hide_onboarding: true }).eq('id', userId)
  if (error) throw error
}

export async function updateDashboardLayout(userId: string, layout: DashboardLayoutConfig): Promise<void> {
  const supabase = getSupabase()
  const { error } = await supabase
    .from('profiles')
    .update({ dashboard_layout: layout as unknown as Json })
    .eq('id', userId)

  if (error) throw error
}
