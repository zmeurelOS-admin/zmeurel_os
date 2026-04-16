import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { destructiveActionScopes } from '@/lib/auth/destructive-action-step-up-contract'
import { requireDestructiveActionStepUp } from '@/lib/auth/destructive-action-step-up'
import { captureApiError } from '@/lib/monitoring/sentry'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  deleteTenantScopedData,
  TENANT_DESTRUCTIVE_CLEANUP_SCOPES,
} from '@/lib/tenant/destructive-cleanup'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

export const runtime = 'nodejs'

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

    const stepUpError = requireDestructiveActionStepUp(request, {
      userId: user.id,
      scope: destructiveActionScopes.gdprFarmDelete,
    })
    if (stepUpError) {
      return stepUpError
    }

    const admin = getSupabaseAdmin()
    const supabase = await createClient()
    const tenantId = tenant.id
    const cleanupResult = await deleteTenantScopedData(admin, tenantId, {
      scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.gdprFarmDelete,
      verifyCriticalTables: true,
    })
    const nonCriticalFailures = cleanupResult.steps.filter(
      (step) => step.status === 'failed' && !step.critical
    )
    if (nonCriticalFailures.length > 0) {
      console.warn('[gdpr-farm] cleanup completed with non-critical failures', {
        tenantId,
        failedTargets: nonCriticalFailures.map((step) => step.target),
      })
    }

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
