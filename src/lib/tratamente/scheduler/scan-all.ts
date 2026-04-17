import { getSupabaseAdmin } from '@/lib/supabase/admin'

import { scanAplicariPentruNotificari } from './scan'
import type { SchedulerResult } from './types'

const PAGE_SIZE = 50

type TenantRow = {
  id: string
}

/**
 * Scanează toți tenantii non-demo în loturi de 50 și pregătește payload-urile de notificare.
 * Exemplu: `scanAllTenants()`
 */
export async function scanAllTenants(): Promise<SchedulerResult[]> {
  const admin = getSupabaseAdmin()
  const results: SchedulerResult[] = []
  let offset = 0

  while (true) {
    const { data, error } = await admin
      .from('tenants')
      .select('id')
      .eq('is_demo', false)
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new Error(`Failed to load tenants for treatment scan: ${error.message}`)
    }

    const tenants = (data ?? []) as TenantRow[]
    if (tenants.length === 0) {
      break
    }

    for (const tenant of tenants) {
      try {
        const result = await scanAplicariPentruNotificari(tenant.id)
        results.push(result)
      } catch (error) {
        console.error('Failed to scan treatment notifications for tenant', tenant.id, error)
      }
    }

    if (tenants.length < PAGE_SIZE) {
      break
    }

    offset += PAGE_SIZE
  }

  return results
}

