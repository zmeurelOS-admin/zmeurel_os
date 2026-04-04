import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const bodySchema = z.object({
  endpoint: z.string().min(1),
})

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
      return apiError(400, 'INVALID_BODY', 'Endpoint lipsă.')
    }

    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)
      .eq('endpoint', parsed.data.endpoint)

    if (error) {
      console.error('[push/unsubscribe]', error)
      return apiError(500, 'INTERNAL_ERROR', 'Nu am putut șterge subscrierea.')
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    captureApiError(error, { route: '/api/push/unsubscribe', tags: { http_method: 'POST' }, userId })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la dezabonare push.')
  }
}
