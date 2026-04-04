import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { captureApiError } from '@/lib/monitoring/sentry'
import {
  deleteNotification,
  getNotifications,
  getUnreadCount,
  markAllAsRead,
  markAsRead,
} from '@/lib/notifications/queries'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const patchBodySchema = z.union([
  z.object({ markAll: z.literal(true) }),
  z.object({ notificationId: z.string().uuid() }),
])

const deleteBodySchema = z.object({
  notificationId: z.string().uuid(),
})

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Autentificare necesară.')
    }

    const url = new URL(request.url)
    const limit = Math.min(Math.max(Number(url.searchParams.get('limit')) || 30, 1), 100)
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)
    const unreadOnly = url.searchParams.get('unread_only') === 'true'

    const [notifications, unreadCount] = await Promise.all([
      getNotifications(supabase, { limit, offset, unreadOnly }),
      getUnreadCount(supabase),
    ])

    return NextResponse.json({
      ok: true,
      notifications,
      unreadCount,
    })
  } catch (error) {
    captureApiError(error, { route: '/api/notifications', tags: { http_method: 'GET' } })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut încărca notificările.')
  }
}

export async function PATCH(request: Request) {
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

    const parsed = patchBodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    if ('markAll' in parsed.data && parsed.data.markAll) {
      await markAllAsRead(supabase)
    } else if ('notificationId' in parsed.data) {
      await markAsRead(supabase, parsed.data.notificationId)
    }

    const unreadCount = await getUnreadCount(supabase)
    return NextResponse.json({ ok: true, unreadCount })
  } catch (error) {
    captureApiError(error, { route: '/api/notifications', tags: { http_method: 'PATCH' }, userId })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut actualiza notificările.')
  }
}

export async function DELETE(request: Request) {
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

    const parsed = deleteBodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    await deleteNotification(supabase, parsed.data.notificationId)
    const unreadCount = await getUnreadCount(supabase)
    return NextResponse.json({ ok: true, unreadCount })
  } catch (error) {
    captureApiError(error, { route: '/api/notifications', tags: { http_method: 'DELETE' }, userId })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut șterge notificarea.')
  }
}
