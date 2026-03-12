import { NextResponse } from 'next/server'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { deleteDemoDataForTenant, getTenantDemoContext } from '@/lib/demo/demo-seed-service'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
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

    const tenant = await getTenantDemoContext(supabase, user.id)
    if (!tenant?.id) {
      return apiError(404, 'TENANT_NOT_FOUND', 'Tenant-ul nu a fost gasit pentru utilizatorul curent.')
    }
    tenantIdForSentry = tenant.id

    const admin = createServiceRoleClient()
    const result = await deleteDemoDataForTenant(admin, tenant.id)

    console.info('[demo-seed] delete success', {
      userId: user.id,
      tenantId: tenant.id,
      deletedRows: result.deletedRows,
    })

    return NextResponse.json({
      ok: true,
      status: 'deleted',
      deletedRows: result.deletedRows,
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/demo/reset',
      userId,
      tenantId: tenantIdForSentry,
    })
    const message = error instanceof Error ? error.message : 'Unexpected error'
    console.error('[demo-seed] delete failure', { message })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut sterge datele demo.')
  }
}
