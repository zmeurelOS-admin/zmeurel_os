import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createNotificationForTenantOwner, NOTIFICATION_TYPES } from '@/lib/notifications/create'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const deliverSchema = z.object({
  orderId: z.string().uuid(),
  lineIds: z.array(z.string().uuid()).min(1),
  clientName: z.string().max(200).optional(),
  orderLabel: z.string().max(80).optional(),
})

async function requireAssociationStaff() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.id) {
    return { supabase, userId: null, error: apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.') }
  }

  const role = await getAssociationRole(user.id)
  if (!role) {
    return {
      supabase,
      userId: user.id,
      error: apiError(403, 'FORBIDDEN', 'Nu ai acces în workspace-ul asociației.'),
    }
  }

  return { supabase, userId: user.id, error: null }
}

export async function POST(request: Request) {
  let userId: string | null = null
  let orderId: string | null = null
  try {
    const invalidOrigin = validateSameOriginMutation(request)
    if (invalidOrigin) return invalidOrigin

    const access = await requireAssociationStaff()
    if (access.error) return access.error
    userId = access.userId

    const json = await request.json()
    const parsed = deliverSchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { orderId: parsedOrderId, lineIds, clientName, orderLabel } = parsed.data
    orderId = parsedOrderId

    const { data, error } = await access.supabase.rpc('mark_association_order_delivered_atomic', {
      p_order_id: parsedOrderId,
      p_line_ids: lineIds,
    })

    if (error) {
      const message = error.message?.trim() || 'Nu am putut marca livrarea.'
      return apiError(400, 'DELIVERY_FAILED', message)
    }

    const payload = (data ?? {}) as {
      tenant_ids?: string[]
      warnings?: string[]
      updated_count?: number
    }

    const tenantIds = Array.isArray(payload.tenant_ids)
      ? payload.tenant_ids.filter((value): value is string => typeof value === 'string' && value.length > 0)
      : []

    for (const tenantId of new Set(tenantIds)) {
      void createNotificationForTenantOwner(
        tenantId,
        NOTIFICATION_TYPES.order_status_changed,
        'Comandă livrată',
        clientName
          ? `Comanda ${orderLabel ?? ''} pentru ${clientName} a fost marcată ca livrată.`
          : 'O comandă din magazinul asociației a fost marcată ca livrată.',
        { newStatus: 'livrata', channel: 'association_delivery', warnings: payload.warnings ?? [] },
        'order',
        parsedOrderId,
      )
    }

    return NextResponse.json({
      ok: true,
      data: {
        warnings: payload.warnings ?? [],
        updatedCount: typeof payload.updated_count === 'number' ? payload.updated_count : lineIds.length,
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/deliveries/deliver',
      userId,
      extra: { orderId },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut finaliza livrarea.')
  }
}
