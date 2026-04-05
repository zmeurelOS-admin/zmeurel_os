import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createNotificationForTenantOwner, NOTIFICATION_TYPES } from '@/lib/notifications/create'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { COMENZI_STATUSES, type ComandaStatus } from '@/lib/supabase/queries/comenzi'
import { createClient } from '@/lib/supabase/server'
export const runtime = 'nodejs'

const MAGAZIN_ASOCIATIE = 'magazin_asociatie'

const statusEnum = COMENZI_STATUSES as unknown as [string, ...string[]]

const patchBodySchema = z
  .object({
    orderId: z.string().uuid(),
    status: z.enum(statusEnum).optional(),
    note_interne: z.string().max(2000).nullable().optional(),
  })
  .refine((body) => body.status !== undefined || body.note_interne !== undefined, {
    message: 'Trimite un status sau o notă internă.',
  })

function normalizeInternalNote(value: string | null | undefined): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function applyNullableFilter<
  T extends {
    is: (column: string, value: null) => T
    eq: (column: string, value: string) => T
  },
>(
  query: T,
  column: string,
  value: string | null | undefined,
): T {
  if (value == null) return query.is(column, null)
  return query.eq(column, value)
}

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
    const noteInterne = normalizeInternalNote(parsed.data.note_interne)
    orderIdForSentry = orderId
    const admin = getSupabaseAdmin()

    const { data, error: fetchErr } = await admin
      .from('comenzi')
      .select(
        'id, data_origin, tenant_id, status, telefon, data_comanda, client_nume_manual, locatie_livrare, note_interne',
      )
      .eq('id', orderId)
      .maybeSingle()

    const row = data as
      | {
          id: string
          data_origin: string | null
          tenant_id: string | null
          status: string
          telefon: string | null
          data_comanda: string
          client_nume_manual: string | null
          locatie_livrare: string | null
          note_interne: string | null
        }
      | null

    if (fetchErr || !row) {
      return apiError(404, 'NOT_FOUND', 'Comanda nu a fost găsită.')
    }

    if (row.data_origin !== MAGAZIN_ASOCIATIE) {
      return apiError(403, 'FORBIDDEN', 'Comanda nu este din magazinul asociației.')
    }

    const updatePayload: {
      status?: ComandaStatus
      note_interne?: string | null
      updated_at: string
    } = {
      updated_at: new Date().toISOString(),
    }

    if (status !== undefined) {
      updatePayload.status = status as ComandaStatus
    }
    if (noteInterne !== undefined) {
      updatePayload.note_interne = noteInterne
    }

    let updateQuery = admin
      .from('comenzi')
      .update(updatePayload)
      .eq('data_origin', MAGAZIN_ASOCIATIE)
      .eq('data_comanda', row.data_comanda)

    updateQuery = applyNullableFilter(updateQuery, 'telefon', row.telefon)
    updateQuery = applyNullableFilter(updateQuery, 'client_nume_manual', row.client_nume_manual)
    updateQuery = applyNullableFilter(updateQuery, 'locatie_livrare', row.locatie_livrare)

    const { data: updatedRows, error: upErr } = await updateQuery.select('id')

    if (upErr || !updatedRows?.length) {
      return apiError(400, 'UPDATE_FAILED', 'Nu am putut actualiza statusul.')
    }

    if (status !== undefined && row.status !== status && row.tenant_id) {
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
      data: {
        id: orderId,
        status: status ?? row.status,
        note_interne: noteInterne !== undefined ? noteInterne : row.note_interne ?? null,
        updated_at: updatePayload.updated_at,
      },
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
