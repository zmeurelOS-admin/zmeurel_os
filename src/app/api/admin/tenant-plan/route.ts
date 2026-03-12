import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { BETA_MODE } from '@/lib/config/beta'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const ALLOWED_PLANS = new Set(['freemium', 'pro', 'enterprise'])

export async function PATCH(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie sa fii autentificat.')
    }
    userId = user.id

    const superadmin = await isSuperAdmin(supabase, user.id)
    if (!superadmin) {
      return apiError(403, 'FORBIDDEN', 'Nu ai permisiunea pentru aceasta operatie.')
    }

    if (BETA_MODE) {
      return apiError(409, 'PLAN_MANAGEMENT_DISABLED_DURING_BETA', 'Gestionarea planurilor este dezactivata in beta.')
    }

    const body = (await request.json()) as { tenantId?: string; plan?: string }
    const tenantId = (body.tenantId ?? '').trim()
    tenantIdForSentry = tenantId || null
    const plan = (body.plan ?? '').trim().toLowerCase()

    if (!tenantId) {
      return apiError(400, 'TENANT_ID_REQUIRED', 'Tenant invalid.')
    }

    if (!ALLOWED_PLANS.has(plan)) {
      return apiError(400, 'INVALID_PLAN', 'Plan invalid.')
    }

    const { data, error } = await supabase
      .from('tenants')
      .update({
        plan,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select('id,plan,updated_at')
      .single()

    if (error) {
      return apiError(400, 'TENANT_PLAN_UPDATE_FAILED', 'Nu am putut actualiza planul.')
    }

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/tenant-plan',
      userId,
      tenantId: tenantIdForSentry,
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut actualiza planul.')
  }
}
