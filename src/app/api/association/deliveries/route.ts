import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { getAssociationOrders } from '@/lib/association/queries'
import { loadAssociationSettings } from '@/lib/association/public-settings'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createNotificationForTenantOwner, NOTIFICATION_TYPES } from '@/lib/notifications/create'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAGAZIN_ASOCIATIE = 'magazin_asociatie'

const patchSchema = z.object({
  action: z.literal('start_all'),
  groups: z
    .array(
      z.object({
        orderId: z.string().uuid(),
        lineIds: z.array(z.string().uuid()).min(1),
      }),
    )
    .min(1),
})

async function requireAssociationStaff() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user?.id) {
    return { userId: null, error: apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.') }
  }

  const role = await getAssociationRole(user.id)
  if (!role) {
    return { userId: user.id, error: apiError(403, 'FORBIDDEN', 'Nu ai acces în workspace-ul asociației.') }
  }

  return { userId: user.id, error: null }
}

export async function GET() {
  let userId: string | null = null
  try {
    const access = await requireAssociationStaff()
    if (access.error) return access.error
    userId = access.userId

    const [orders, settings] = await Promise.all([getAssociationOrders(), loadAssociationSettings()])
    const activeOrders = orders.filter((order) => order.status === 'confirmata' || order.status === 'in_livrare')

    return NextResponse.json({
      ok: true,
      data: {
        orders: activeOrders,
        settings,
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/deliveries',
      userId,
      tags: { http_method: 'GET' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut încărca livrările.')
  }
}

export async function PATCH(request: Request) {
  let userId: string | null = null
  try {
    const invalidOrigin = validateSameOriginMutation(request)
    if (invalidOrigin) return invalidOrigin

    const access = await requireAssociationStaff()
    if (access.error) return access.error
    userId = access.userId

    const json = await request.json()
    const parsed = patchSchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const lineIds = [...new Set(parsed.data.groups.flatMap((group) => group.lineIds))]
    const orderIds = new Set(parsed.data.groups.map((group) => group.orderId))

    const admin = getSupabaseAdmin()
    const { data, error } = await admin
      .from('comenzi')
      .select('id, tenant_id, status, data_origin')
      .in('id', lineIds)

    const rows = (data ?? []) as Array<{
      id: string
      tenant_id: string | null
      status: string
      data_origin: string | null
    }>

    if (error || rows.length !== lineIds.length) {
      return apiError(404, 'NOT_FOUND', 'Nu am putut încărca toate liniile comenzii.')
    }

    if (parsed.data.groups.some((group) => !group.lineIds.includes(group.orderId))) {
      return apiError(400, 'INVALID_ORDER_GROUP', 'Grupul trimis este invalid.')
    }

    if (rows.some((row) => row.data_origin !== MAGAZIN_ASOCIATIE)) {
      return apiError(403, 'FORBIDDEN', 'Ai selectat linii care nu aparțin magazinului asociației.')
    }

    const confirmataIds = rows
      .filter((row) => row.status === 'confirmata' && orderIds.size > 0)
      .map((row) => row.id)

    if (confirmataIds.length > 0) {
      const { error: updateError, data: updatedRows } = await admin
        .from('comenzi')
        .update({
          status: 'in_livrare',
          updated_at: new Date().toISOString(),
        })
        .in('id', confirmataIds)
        .eq('data_origin', MAGAZIN_ASOCIATIE)
        .select('tenant_id')

      if (updateError || !updatedRows || updatedRows.length !== confirmataIds.length) {
        return apiError(400, 'UPDATE_FAILED', 'Nu am putut porni livrarea pentru toate comenzile.')
      }

      const tenantIds = [
        ...new Set(
          (updatedRows as Array<{ tenant_id: string | null }>)
            .map((row) => row.tenant_id)
            .filter((value): value is string => Boolean(value)),
        ),
      ]

      for (const tenantId of tenantIds) {
        void createNotificationForTenantOwner(
          tenantId,
          NOTIFICATION_TYPES.order_status_changed,
          'Comandă în livrare',
          'Asociația a pornit livrarea pentru una sau mai multe comenzi.',
          { newStatus: 'in_livrare', channel: 'association_delivery' },
          'order',
          null,
        )
      }
    }

    return NextResponse.json({
      ok: true,
      data: {
        startedCount: confirmataIds.length,
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/deliveries',
      userId,
      tags: { http_method: 'PATCH' },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut porni livrările.')
  }
}
