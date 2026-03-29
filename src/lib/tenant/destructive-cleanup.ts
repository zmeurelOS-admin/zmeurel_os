import type { SupabaseClient } from '@supabase/supabase-js'

import type { Database } from '@/types/supabase'

export const TENANT_SCOPED_DELETE_ORDER = [
  'vanzari_butasi_items',
  'miscari_stoc',
  'alert_dismissals',
  'integrations_google_contacts',
  'comenzi',
  'culture_stage_logs',
  'solar_climate_logs',
  'activitati_extra_season',
  'vanzari_butasi',
  'vanzari',
  'recoltari',
  'cheltuieli_diverse',
  'activitati_agricole',
  'culturi',
  'investitii',
  'nomenclatoare',
  'clienti',
  'culegatori',
  'crop_varieties',
  'crops',
  'parcele',
] as const

export type TenantScopedDeleteTable = (typeof TENANT_SCOPED_DELETE_ORDER)[number]

type AdminClient = SupabaseClient<Database>

async function deleteAnalyticsEventsByTenant(admin: AdminClient, tenantId: string) {
  const { error } = await admin
    .from('analytics_events')
    .delete()
    .eq('tenant_id', tenantId)

  if (error) {
    throw new Error(`Delete failed for analytics_events: ${error.message ?? 'Unknown error'}`)
  }
}

async function deleteAnalyticsEventsByTenantIds(admin: AdminClient, tenantIds: string[]) {
  const { error } = await admin
    .from('analytics_events')
    .delete()
    .in('tenant_id', tenantIds)

  if (error) {
    throw new Error(`Delete failed for analytics_events: ${error.message ?? 'Unknown error'}`)
  }
}

export async function deleteTenantScopedData(admin: AdminClient, tenantId: string) {
  for (const table of TENANT_SCOPED_DELETE_ORDER) {
    const { error } = await admin.from(table).delete().eq('tenant_id', tenantId)
    if (error) {
      throw new Error(`Delete failed for ${table}: ${error.message ?? 'Unknown error'}`)
    }
  }

  await deleteAnalyticsEventsByTenant(admin, tenantId)
}

export async function deleteTenantScopedDataBatch(
  admin: AdminClient,
  tenantIds: string[],
  onError?: (table: TenantScopedDeleteTable | 'analytics_events', error: Error) => void
) {
  if (tenantIds.length === 0) return

  for (const table of TENANT_SCOPED_DELETE_ORDER) {
    try {
      const { error } = await admin.from(table).delete().in('tenant_id', tenantIds)
      if (error) {
        throw new Error(error.message ?? 'Unknown error')
      }
    } catch (error) {
      onError?.(table, error instanceof Error ? error : new Error('Unknown error'))
    }
  }

  try {
    await deleteAnalyticsEventsByTenantIds(admin, tenantIds)
  } catch (error) {
    onError?.('analytics_events', error instanceof Error ? error : new Error('Unknown error'))
  }
}
