import { NextResponse } from 'next/server'

import { InvalidDemoTypeError, runDemoSeed } from '@/lib/demo/demo-seed'
import { getTenantDemoContext } from '@/lib/demo/demo-seed-service'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let userId: string | null = null
  let tenantIdForSentry: string | null = null

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    userId = user.id

    const tenant = await getTenantDemoContext(supabase, user.id)
    if (!tenant?.id) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 })
    }
    tenantIdForSentry = tenant.id

    const result = await runDemoSeed({
      request,
      tenant,
      userId: user.id,
    })

    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof InvalidDemoTypeError) {
      return NextResponse.json({ error: 'invalid_demo_type' }, { status: 400 })
    }

    captureApiError(error, {
      route: '/api/demo/seed',
      userId,
      tenantId: tenantIdForSentry,
    })
    console.error('Demo seed failed:', error)
    return NextResponse.json({ error: 'demo_seed_failed' }, { status: 500 })
  }
}
