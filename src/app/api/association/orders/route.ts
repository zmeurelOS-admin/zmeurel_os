import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createNotificationForTenantOwner, NOTIFICATION_TYPES } from '@/lib/notifications/create'
import { COMENZI_STATUSES, type ComandaStatus } from '@/lib/supabase/queries/comenzi'
import { createClient } from '@/lib/supabase/server'
export const runtime = 'nodejs'

const MAGAZIN_ASOCIATIE = 'magazin_asociatie'

const statusEnum = COMENZI_STATUSES as unknown as [string, ...string[]]

const patchBodySchema = z.object({
  orderId: z.string().uuid(),
  status: z.enum(statusEnum),
})

export async function PATCH(request: Request) {
  let userId: string | null = null
  let orderIdForSentry: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) {
      return invalidOriginResponse
    }

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
    }
    userId = user.id

    const role = await getAssociationRole(user.id)
    if (role !== 'admin' && role !== 'moderator') {
      return apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot actualiza comenzile.')
    }

    const json = await request.json()
    const parsed = patchBodySchema.safeParse(json)
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { orderId, status } = parsed.data
    orderIdForSentry = orderId

    const { data: row, error: fetchErr } = await supabase
      .from('comenzi')
      .select('id, data_origin, tenant_id, status')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchErr || !row) {
      return apiError(404, 'NOT_FOUND', 'Comanda nu a fost găsită.')
    }

    if (row.data_origin !== MAGAZIN_ASOCIATIE) {
      return apiError(403, 'FORBIDDEN', 'Comanda nu este din magazinul asociației.')
    }

    const { data: updated, error: upErr } = await supabase
      .from('comenzi')
      .update({
        status: status as ComandaStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .eq('data_origin', MAGAZIN_ASOCIATIE)
      .select('id, status, updated_at')
      .single()

    if (upErr || !updated) {
      return apiError(400, 'UPDATE_FAILED', 'Nu am putut actualiza statusul.')
    }

    if (row.status !== status && row.tenant_id) {
      try {
        void createNotificationForTenantOwner(
          row.tenant_id,
          NOTIFICATION_TYPES.order_status_changed,
          'Status comandă actualizat',
          `Comanda a fost marcată ca „${status}”.`,
          {
            orderId,
            previousStatus: row.status,
            newStatus: status,
            channel: 'farm_shop',
          },
          'order',
          orderId,
        )
      } catch (e) {
        console.error('[association/orders] notification', e)
      }
    }

    return NextResponse.json({
      ok: true,
      data: updated,
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/orders',
      userId,
      extra: { order_id: orderIdForSentry },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la actualizare.')
  }
}
