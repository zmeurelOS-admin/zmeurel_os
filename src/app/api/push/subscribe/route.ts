import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const bodySchema = z.object({
  subscription: z.object({
    endpoint: z.string().min(1),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
  }),
})

function getEndpointHost(endpoint: string): string {
  try {
    return new URL(endpoint).hostname
  } catch {
    return 'invalid-endpoint'
  }
}

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

    let json: unknown
    try {
      json = await request.json()
    } catch {
      return apiError(400, 'INVALID_BODY', 'JSON invalid.')
    }

    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date subscription invalide.')
    }

    const sub = parsed.data.subscription
    const endpointHost = getEndpointHost(sub.endpoint)

    const { data: existingRow, error: existingError } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .eq('endpoint', sub.endpoint)
      .limit(1)
      .maybeSingle()

    if (existingError) {
      console.error(
        '[push/subscribe] lookup failed',
        sanitizeForLog({
          userId: user.id,
          endpointHost,
          error: toSafeErrorContext(existingError),
        }),
      )
      return apiError(500, 'INTERNAL_ERROR', 'Nu am putut verifica subscrierea existentă.')
    }

    if (existingRow?.id) {
      const { error } = await supabase
        .from('push_subscriptions')
        .update({
          keys_p256dh: sub.keys.p256dh,
          keys_auth: sub.keys.auth,
        })
        .eq('id', existingRow.id)

      if (error) {
        console.error(
          '[push/subscribe] update failed',
          sanitizeForLog({
            userId: user.id,
            endpointHost,
            subscriptionId: existingRow.id,
            error: toSafeErrorContext(error),
          }),
        )
        return apiError(500, 'INTERNAL_ERROR', 'Nu am putut actualiza subscrierea.')
      }

      console.info('[push/subscribe] updated', sanitizeForLog({ userId: user.id, endpointHost }))
      return NextResponse.json({ ok: true, mode: 'updated' })
    }

    const { error } = await supabase.from('push_subscriptions').insert({
      user_id: user.id,
      endpoint: sub.endpoint,
      keys_p256dh: sub.keys.p256dh,
      keys_auth: sub.keys.auth,
    })

    if (error) {
      if (String((error as { code?: unknown })?.code ?? '') === '23505') {
        const { error: retryError } = await supabase
          .from('push_subscriptions')
          .update({
            keys_p256dh: sub.keys.p256dh,
            keys_auth: sub.keys.auth,
          })
          .eq('user_id', user.id)
          .eq('endpoint', sub.endpoint)

        if (!retryError) {
          console.info(
            '[push/subscribe] updated after duplicate insert race',
            sanitizeForLog({ userId: user.id, endpointHost }),
          )
          return NextResponse.json({ ok: true, mode: 'updated' })
        }

        console.error(
          '[push/subscribe] retry update after duplicate failed',
          sanitizeForLog({
            userId: user.id,
            endpointHost,
            error: toSafeErrorContext(retryError),
          }),
        )
        return apiError(500, 'INTERNAL_ERROR', 'Nu am putut salva subscrierea după retry.')
      }

      console.error(
        '[push/subscribe] insert failed',
        sanitizeForLog({
          userId: user.id,
          endpointHost,
          error: toSafeErrorContext(error),
        }),
      )
      return apiError(500, 'INTERNAL_ERROR', 'Nu am putut salva subscrierea.')
    }

    console.info('[push/subscribe] inserted', sanitizeForLog({ userId: user.id, endpointHost }))
    return NextResponse.json({ ok: true, mode: 'inserted' })
  } catch (error) {
    captureApiError(error, { route: '/api/push/subscribe', tags: { http_method: 'POST' }, userId })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la subscriere push.')
  }
}
