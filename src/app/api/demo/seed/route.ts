import { NextResponse } from 'next/server'

import { ensureTenantForUser, normalizeFarmName } from '@/lib/auth/ensure-tenant'
import { validateSameOriginMutation } from '@/lib/api/route-security'
import { getTenantDemoContext, seedDemoDataForTenant } from '@/lib/demo/demo-seed-service'
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

    const body = (await request.json().catch(() => null)) as { demo_type?: unknown } | null
    const requestedDemoType = body?.demo_type
    const demoType =
      requestedDemoType === undefined || requestedDemoType === 'berries'
        ? 'berries'
        : requestedDemoType === 'solar'
          ? 'solar'
          : null

    if (!demoType) {
      return NextResponse.json({ error: 'invalid_demo_type' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id

    let tenant = await getTenantDemoContext(supabase, user.id)
    if (!tenant?.id) {
      const admin = createServiceRoleClient()
      await ensureTenantForUser({
        supabase: admin,
        userId: user.id,
        fallbackFarmName: normalizeFarmName(user.user_metadata?.farm_name as string | null | undefined),
      })
      tenant = await getTenantDemoContext(supabase, user.id)
    }

    if (!tenant?.id) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }
    tenantIdForSentry = tenant.id

    const admin = createServiceRoleClient()
    const result = await seedDemoDataForTenant(admin, tenant.id, demoType)

    return NextResponse.json({
      success: true,
      status: result.status,
      demo_type: demoType,
      demo_seed_id: result.seedId,
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/demo/seed',
      userId,
      tenantId: tenantIdForSentry,
    })
    console.error('Demo seed failed:', error)
    return NextResponse.json({ error: 'demo_seed_failed' }, { status: 500 })
  }
}
