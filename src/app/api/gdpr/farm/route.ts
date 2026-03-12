import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { captureApiError } from '@/lib/monitoring/sentry'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

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

async function getOwnerContext() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user?.id) {
    throw new Error('UNAUTHORIZED')
  }

  try {
    const tenantId = await getTenantIdByUserId(supabase, user.id)
    return { user, tenant: { id: tenantId } }
  } catch (error) {
    captureApiError(error, {
      route: '/api/gdpr/farm:getOwnerContext',
      userId: user.id,
    })
    const message = error instanceof Error ? error.message : 'TENANT_LOOKUP_FAILED'
    if (message === 'Tenant indisponibil pentru utilizatorul curent.') {
      throw new Error('TENANT_NOT_FOUND')
    }
    throw error
  }
}

export async function PATCH(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const { user, tenant } = await getOwnerContext()
    userId = user.id
    tenantIdForSentry = tenant.id
    const body = (await request.json()) as { farmName?: string }
    const farmName = (body.farmName ?? '').trim()

    if (farmName.length < 2 || farmName.length > 120) {
      return apiError(400, 'INVALID_FARM_NAME', 'Numele fermei trebuie sa aiba intre 2 si 120 caractere.')
    }

    const supabase = await createClient()
    const { data: updatedTenant, error: updateError } = await supabase
      .from('tenants')
      .update({ nume_ferma: farmName, updated_at: new Date().toISOString() })
      .eq('id', tenant.id)
      .select('id,nume_ferma')
      .single()

    if (!updateError) {
      return NextResponse.json({
        ok: true,
        data: {
          userId: user.id,
          tenantId: updatedTenant?.id ?? tenant.id,
          farmName: updatedTenant?.nume_ferma ?? farmName,
        },
      })
    }

    const code = (updateError as { code?: string } | null)?.code
    const message = ((updateError as { message?: string } | null)?.message ?? '').toLowerCase()
    const canFallbackToAdmin =
      code === '42501' ||
      code === 'PGRST202' ||
      message.includes('permission denied') ||
      message.includes('row-level security') ||
      message.includes('policy')

    if (!canFallbackToAdmin) {
      throw updateError
    }

    const admin = getSupabaseAdmin()
    const { data: fallbackTenant, error: fallbackError } = await admin
      .from('tenants')
      .update({ nume_ferma: farmName, updated_at: new Date().toISOString() })
      .eq('id', tenant.id)
      .select('id,nume_ferma')
      .single()

    if (fallbackError) throw fallbackError

    return NextResponse.json({
      ok: true,
      data: {
        userId: user.id,
        tenantId: fallbackTenant?.id ?? tenant.id,
        farmName: fallbackTenant?.nume_ferma ?? farmName,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'

    if (message === 'UNAUTHORIZED') {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie sa fii autentificat.')
    }

    if (message === 'TENANT_NOT_FOUND') {
      return apiError(404, 'TENANT_NOT_FOUND', 'Tenant-ul nu a fost gasit pentru utilizatorul curent.')
    }

    if (message === 'INVALID_FARM_NAME') {
      return apiError(400, 'INVALID_FARM_NAME', 'Numele fermei trebuie sa aiba intre 2 si 120 caractere.')
    }

    captureApiError(error, {
      route: '/api/gdpr/farm:PATCH',
      userId,
      tenantId: tenantIdForSentry,
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut actualiza numele fermei.')
  }
}

export async function DELETE(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const { user, tenant } = await getOwnerContext()
    userId = user.id
    tenantIdForSentry = tenant.id
    const admin = getSupabaseAdmin()
    const supabase = await createClient()

    const tenantId = tenant.id
    const deleteByTenant = async (table: TenantTable) => {
      const { error } = await admin.from(table).delete().eq('tenant_id', tenantId)
      if (error) throw error
    }

    await deleteByTenant('vanzari_butasi_items')
    await deleteByTenant('miscari_stoc')
    await deleteByTenant('alert_dismissals')
    await deleteByTenant('integrations_google_contacts')
    await deleteByTenant('comenzi')
    const { error: analyticsDeleteError } = await admin
      .from('analytics_events' as unknown as 'alert_dismissals')
      .delete()
      .eq('tenant_id', tenantId)
    if (analyticsDeleteError) throw analyticsDeleteError

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

    if (resetDemoFlagsError) throw resetDemoFlagsError

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status = message === 'UNAUTHORIZED' ? 401 : message === 'TENANT_NOT_FOUND' ? 404 : 500

    if (status >= 500) {
      captureApiError(error, {
        route: '/api/gdpr/farm:DELETE',
        userId,
        tenantId: tenantIdForSentry,
      })
    }

    if (status === 401) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie sa fii autentificat.')
    }

    if (status === 404) {
      return apiError(404, 'TENANT_NOT_FOUND', 'Tenant-ul nu a fost gasit pentru utilizatorul curent.')
    }

    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut sterge datele fermei.')
  }
}
