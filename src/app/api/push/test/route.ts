import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { captureApiError } from '@/lib/monitoring/sentry'
import { sendPushToUser } from '@/lib/notifications/send-push'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const bodySchema = z
  .object({
    title: z.string().trim().min(1).max(80).optional(),
    body: z.string().trim().min(1).max(200).optional(),
  })
  .optional()

export async function POST(request: Request) {
  let userId: string | null = null
  try {
    const badOrigin = validateSameOriginMutation(request)
    if (badOrigin) return badOrigin

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Autentificare necesară.')
    }
    userId = user.id

    let json: unknown = {}
    try {
      json = await request.json()
    } catch {
      json = {}
    }

    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide pentru notificarea de test.')
    }

    const result = await sendPushToUser(
      user.id,
      parsed.data?.title ?? 'Test notificări push',
      parsed.data?.body ?? 'Dacă vezi acest mesaj, fluxul Web Push funcționează.',
      { type: 'system', urlPath: '/settings' },
    )

    if (result.skippedReason === 'not_configured') {
      return apiError(503, 'PUSH_NOT_CONFIGURED', 'Cheile VAPID nu sunt configurate pe server.')
    }

    if (result.skippedReason === 'no_subscriptions') {
      return apiError(409, 'NO_SUBSCRIPTIONS', 'Nu există nicio subscriere salvată pentru acest utilizator.')
    }

    if (result.sent < 1) {
      return apiError(502, 'PUSH_SEND_FAILED', 'Notificarea de test nu a putut fi trimisă.')
    }

    console.info('[push/test] sent', sanitizeForLog({ userId: user.id, result }))
    return NextResponse.json({ ok: true, result })
  } catch (error) {
    console.error(
      '[push/test] failed',
      sanitizeForLog({
        userId,
        error: toSafeErrorContext(error),
      }),
    )
    captureApiError(error, { route: '/api/push/test', tags: { http_method: 'POST' }, userId })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la trimiterea notificării de test.')
  }
}
