import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { captureApiError } from '@/lib/monitoring/sentry'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

export const runtime = 'nodejs'
const PROTECTED_SUPERADMIN_EMAIL = 'popa.andrei.sv@gmail.com'

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
      route: '/api/gdpr/account:getOwnerContext',
      userId: user.id,
    })
    const message = error instanceof Error ? error.message : 'TENANT_LOOKUP_FAILED'
    if (message === 'Tenant indisponibil pentru utilizatorul curent.') {
      throw new Error('TENANT_NOT_FOUND')
    }
    throw error
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

    if ((user.email ?? '').toLowerCase() === PROTECTED_SUPERADMIN_EMAIL) {
      return apiError(403, 'ACCOUNT_PROTECTED', 'Cont protejat. Acest cont nu poate fi sters.')
    }

    const admin = getSupabaseAdmin()
    const tenantId = tenant.id

    const { error: analyticsDeleteError } = await admin
      .from('analytics_events' as unknown as 'alert_dismissals')
      .delete()
      .eq('tenant_id', tenantId)

    if (analyticsDeleteError) throw analyticsDeleteError

    const { error: aiConversationsDeleteError } = await admin
      .from('ai_conversations' as unknown as 'alert_dismissals')
      .delete()
      .eq('user_id', user.id)

    if (aiConversationsDeleteError) throw aiConversationsDeleteError

    const { error: deleteTenantError } = await admin
      .from('tenants')
      .delete()
      .eq('id', tenantId)

    if (deleteTenantError) throw deleteTenantError

    const { error: deleteProfileError } = await admin
      .from('profiles')
      .delete()
      .eq('id', user.id)

    if (deleteProfileError) throw deleteProfileError

    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id)
    if (deleteUserError) throw deleteUserError

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unexpected error'
    const status =
      message === 'UNAUTHORIZED'
        ? 401
        : message === 'TENANT_NOT_FOUND'
          ? 404
          : 500

    if (status >= 500) {
      captureApiError(error, {
        route: '/api/gdpr/account',
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

    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut sterge contul.')
  }
}
