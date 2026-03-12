import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantId } from '@/lib/tenant/get-tenant'

export const runtime = 'nodejs'

type TenantTable =
  | 'activitati_agricole'
  | 'cheltuieli_diverse'
  | 'vanzari'
  | 'recoltari'
  | 'clienti'
  | 'parcele'
  | 'culegatori'
  | 'investitii'
  | 'vanzari_butasi'
  | 'vanzari_butasi_items'
  | 'comenzi'
  | 'miscari_stoc'
  | 'alert_dismissals'
  | 'integrations_google_contacts'

export async function POST(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request, {
      statusKey: 'success',
    })
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie sa fii autentificat.', {
        statusKey: 'success',
      })
    }
    userId = user.id

    let tenantId: string
    try {
      tenantId = await getTenantId(supabase)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Tenant lookup failed'
      if (message === 'Tenant indisponibil pentru utilizatorul curent.') {
        return apiError(404, 'TENANT_NOT_FOUND', 'Tenant-ul nu a fost gasit pentru utilizatorul curent.', {
          statusKey: 'success',
        })
      }
      captureApiError(error, {
        route: '/api/farm/reset:getTenantId',
        userId,
      })
      return apiError(500, 'TENANT_FETCH_FAILED', 'Nu am putut citi tenant-ul.', {
        statusKey: 'success',
      })
    }
    tenantIdForSentry = tenantId
    const admin = createServiceRoleClient()

    const deleteByTenant = async (table: TenantTable) => {
      const { error } = await admin.from(table).delete().eq('tenant_id', tenantId)
      if (error) {
        throw new Error(`Delete failed for ${table}: ${error.message ?? 'Unknown error'}`)
      }
    }

    console.info('[farm-reset] start', { userId: user.id, tenantId })

    // Child rows first, then parents, to avoid FK conflicts.
    await deleteByTenant('vanzari_butasi_items')
    await deleteByTenant('miscari_stoc')
    await deleteByTenant('alert_dismissals')
    await deleteByTenant('integrations_google_contacts')
    await deleteByTenant('comenzi')

    const { error: analyticsDeleteError } = await admin
      .from('analytics_events' as unknown as 'alert_dismissals')
      .delete()
      .eq('tenant_id', tenantId)
    if (analyticsDeleteError) {
      throw new Error(`Delete failed for analytics_events: ${analyticsDeleteError.message ?? 'Unknown error'}`)
    }

    await deleteByTenant('vanzari_butasi')
    await deleteByTenant('vanzari')
    await deleteByTenant('recoltari')
    await deleteByTenant('cheltuieli_diverse')
    await deleteByTenant('activitati_agricole')
    await deleteByTenant('investitii')
    await deleteByTenant('clienti')
    await deleteByTenant('culegatori')
    await deleteByTenant('parcele')

    const { error: resetDemoFlagsError } = await supabase
      .from('tenants')
      .update({
        demo_seeded: false,
        demo_seeded_at: null,
        demo_seed_id: null,
      })
      .eq('id', tenantId)

    if (resetDemoFlagsError) {
      throw new Error(`Tenant flag reset failed: ${resetDemoFlagsError.message ?? 'Unknown error'}`)
    }

    console.info('[farm-reset] success', { userId: user.id, tenantId })
    return NextResponse.json({ success: true })
  } catch (error) {
    captureApiError(error, {
      route: '/api/farm/reset',
      userId,
      tenantId: tenantIdForSentry,
    })
    const message = error instanceof Error ? error.message : 'Unexpected error'
    console.error('[farm-reset] failure', { message })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut reseta datele fermei.', {
      statusKey: 'success',
    })
  }
}
