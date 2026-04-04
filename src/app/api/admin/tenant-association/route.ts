import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

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

    const body = (await request.json()) as { tenantId?: string; isAssociationApproved?: boolean }
    const tenantId = (body.tenantId ?? '').trim()
    tenantIdForSentry = tenantId || null
    const isAssociationApproved = body.isAssociationApproved

    if (!tenantId) {
      return apiError(400, 'TENANT_ID_REQUIRED', 'Tenant invalid.')
    }

    if (typeof isAssociationApproved !== 'boolean') {
      return apiError(400, 'INVALID_BODY', 'Valoare invalida pentru magazin asociatie.')
    }

    const { data, error } = await supabase
      .from('tenants')
      .update({
        is_association_approved: isAssociationApproved,
        updated_at: new Date().toISOString(),
      })
      .eq('id', tenantId)
      .select('id,is_association_approved,updated_at')
      .single()

    if (error) {
      return apiError(400, 'TENANT_UPDATE_FAILED', 'Nu am putut actualiza setarea.')
    }

    return NextResponse.json({ ok: true, data })
  } catch (error) {
    captureApiError(error, {
      route: '/api/admin/tenant-association',
      userId,
      tenantId: tenantIdForSentry,
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut actualiza setarea.')
  }
}
