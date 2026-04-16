import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { destructiveActionScopes } from '@/lib/auth/destructive-action-step-up-contract'
import { requireDestructiveActionStepUp } from '@/lib/auth/destructive-action-step-up'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import {
  deleteTenantScopedData,
  TENANT_DESTRUCTIVE_CLEANUP_SCOPES,
} from '@/lib/tenant/destructive-cleanup'
import { getTenantId } from '@/lib/tenant/get-tenant'

export const runtime = 'nodejs'

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

    const stepUpError = requireDestructiveActionStepUp(request, {
      userId: user.id,
      scope: destructiveActionScopes.farmReset,
      statusKey: 'success',
    })
    if (stepUpError) {
      return stepUpError
    }

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
    console.info('[farm-reset] start', { userId: user.id, tenantId })
    const cleanupResult = await deleteTenantScopedData(admin, tenantId, {
      scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset,
      verifyCriticalTables: true,
    })
    const nonCriticalFailures = cleanupResult.steps.filter(
      (step) => step.status === 'failed' && !step.critical
    )
    if (nonCriticalFailures.length > 0) {
      console.warn('[farm-reset] cleanup completed with non-critical failures', {
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
