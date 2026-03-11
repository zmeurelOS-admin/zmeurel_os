'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'

import { BETA_MODE } from '@/lib/config/beta'
import {
  getEffectivePlan,
  normalizeSubscriptionPlan,
  type SubscriptionPlan,
} from '@/lib/subscription/plans'
import { getSupabase } from '@/lib/supabase/client'
import { getTenantIdOrNull } from '@/lib/tenant/get-tenant'
import { queryKeys } from '@/lib/query-keys'

type PlanSource = 'tenant' | 'fallback'

interface TenantPlanResult {
  plan: SubscriptionPlan
  tenantId: string | null
  source: PlanSource
}

async function fetchTenantPlan(): Promise<TenantPlanResult> {
  const supabase = getSupabase()
  const tenantId = await getTenantIdOrNull(supabase)
  if (!tenantId) {
    return {
      plan: 'freemium',
      tenantId: null,
      source: 'fallback',
    }
  }

  const { data, error } = await supabase
    .from('tenants')
    .select('id,plan')
    .eq('id', tenantId)
    .maybeSingle()

  if (error || !data?.id) {
    return {
      plan: 'freemium',
      tenantId: null,
      source: 'fallback',
    }
  }

  return {
    plan: normalizeSubscriptionPlan(data.plan) ?? 'freemium',
    tenantId: data.id,
    source: 'tenant',
  }
}

export function useMockPlan() {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: queryKeys.subscriptionPlanTenant,
    queryFn: fetchTenantPlan,
    staleTime: 60_000,
  })

  const tenantPlan = data?.plan ?? 'freemium'
  const plan = getEffectivePlan(tenantPlan)
  const source: PlanSource = data?.source ?? 'fallback'

  const updatePlan = (nextPlan: SubscriptionPlan) => {
    if (BETA_MODE) return

    void (async () => {
      const tenantId = data?.tenantId
      if (!tenantId) {
        return
      }

      const supabase = getSupabase()
      const { error } = await supabase
        .from('tenants')
        .update({ plan: nextPlan })
        .eq('id', tenantId)

      if (!error) {
        await queryClient.invalidateQueries({ queryKey: queryKeys.subscriptionPlanTenant })
      }
    })()
  }

  return { plan, setPlan: updatePlan, source }
}
