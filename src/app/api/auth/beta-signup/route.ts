import { NextResponse } from 'next/server'

import { ensureTenantForUser, normalizeFarmName } from '@/lib/auth/ensure-tenant'
import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createServiceRoleClient } from '@/lib/supabase/admin'

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function readString(value: unknown) {
  return typeof value === 'string' ? value.trim() : ''
}

export const runtime = 'nodejs'

export async function POST(request: Request) {
  let email = ''
  let userId: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const body = (await request.json().catch(() => null)) as {
      email?: unknown
      password?: unknown
      farmName?: unknown
    } | null

    email = readString(body?.email).toLowerCase()
    const password = typeof body?.password === 'string' ? body.password : ''
    const farmNameInput = readString(body?.farmName)

    if (!EMAIL_REGEX.test(email)) {
      return apiError(400, 'INVALID_EMAIL', 'Email invalid.')
    }

    if (password.length < 8) {
      return apiError(400, 'INVALID_PASSWORD', 'Parola trebuie sa aiba minimum 8 caractere.')
    }

    if (farmNameInput.length === 1) {
      return apiError(400, 'INVALID_FARM_NAME', 'Numele fermei trebuie sa aiba minimum 2 caractere sau sa ramana gol.')
    }

    const farmName = normalizeFarmName(farmNameInput)
    const admin = createServiceRoleClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        farm_name: farmName,
      },
    })

    if (error) {
      const message = error.message ?? 'Nu am putut crea contul.'
      const normalizedMessage = message.toLowerCase()
      if (normalizedMessage.includes('already been registered') || normalizedMessage.includes('already registered')) {
        return apiError(409, 'EMAIL_ALREADY_REGISTERED', 'Există deja un cont cu acest email.')
      }

      return apiError(400, 'SIGNUP_FAILED', message)
    }

    if (!data.user?.id) {
      return apiError(500, 'SIGNUP_FAILED', 'Contul a fost creat incomplet.')
    }
    userId = data.user.id

    await ensureTenantForUser({
      supabase: admin,
      userId: data.user.id,
      fallbackFarmName: farmName,
    })

    return NextResponse.json({
      ok: true,
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/auth/beta-signup',
      userId,
      extra: {
        email,
      },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut crea contul pentru beta.')
  }
}
