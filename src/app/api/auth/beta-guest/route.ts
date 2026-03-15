import { randomUUID } from 'node:crypto'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { ensureTenantForUser } from '@/lib/auth/ensure-tenant'
import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import type { Database } from '@/types/supabase'

function buildGuestIdentity() {
  const token = randomUUID().replace(/-/g, '')
  return {
    email: `guest+${token}@demo.zmeurel.local`,
    password: `${randomUUID()}${randomUUID()}`,
    farmName: `tenant_demo_${token.slice(0, 8)}`,
  }
}

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let userId: string | null = null
  let email: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const guest = buildGuestIdentity()
    email = guest.email

    const admin = createServiceRoleClient()
    const { data, error } = await admin.auth.admin.createUser({
      email: guest.email,
      password: guest.password,
      email_confirm: true,
      user_metadata: {
        farm_name: guest.farmName,
        guest_mode: true,
      },
    })

    if (error) {
      return apiError(400, 'GUEST_SIGNUP_FAILED', error.message ?? 'Nu am putut porni demo-ul.')
    }

    if (!data.user?.id) {
      return apiError(500, 'GUEST_SIGNUP_FAILED', 'Contul demo a fost creat incomplet.')
    }
    userId = data.user.id

    await ensureTenantForUser({
      supabase: admin,
      userId: data.user.id,
      fallbackFarmName: guest.farmName,
      isDemo: true,
    })

    const publicClient = createSupabaseClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: sessionData, error: sessionError } = await publicClient.auth.signInWithPassword({
      email: guest.email,
      password: guest.password,
    })

    if (sessionError || !sessionData.session?.access_token || !sessionData.session.refresh_token) {
      return apiError(500, 'GUEST_SESSION_FAILED', sessionError?.message ?? 'Nu am putut porni sesiunea demo.')
    }

    return NextResponse.json({
      ok: true,
      email: guest.email,
      farmName: guest.farmName,
      accessToken: sessionData.session.access_token,
      refreshToken: sessionData.session.refresh_token,
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/auth/beta-guest',
      userId,
      extra: {
        email,
      },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut porni demo-ul.')
  }
}
