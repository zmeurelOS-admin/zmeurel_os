import type { SupabaseClient } from '@supabase/supabase-js'

import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'
import type { Database } from '@/types/supabase'

export type FarmRoutingState = {
  tenantId: string | null
  parcelsCount: number
}

export async function getFarmRoutingState(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<FarmRoutingState> {
  let tenantId: string | null
  try {
    tenantId = await getTenantIdByUserIdOrNull(supabase, userId)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    throw new Error(`Tenant lookup failed: ${message}`)
  }

  if (!tenantId) {
    return { tenantId: null, parcelsCount: 0 }
  }

  const { count, error: parcelsError } = await supabase
    .from('parcele')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)

  if (parcelsError) {
    throw new Error(`Parcele count failed: ${parcelsError.message}`)
  }

  return {
    tenantId,
    parcelsCount: count ?? 0,
  }
}
