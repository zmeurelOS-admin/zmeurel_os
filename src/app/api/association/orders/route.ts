import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import {
  ASSOCIATION_ORDER_STATUSES,
  canTransitionAssociationOrderStatus,
  getAllowedAssociationOrderTransitions,
  isAssociationOrderStatus,
  type AssociationOrderStatus,
} from '@/lib/association/order-status'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { createNotificationForTenantOwner, NOTIFICATION_TYPES } from '@/lib/notifications/create'
import { createClient } from '@/lib/supabase/server'
export const runtime = 'nodejs'

const MAGAZIN_ASOCIATIE = 'magazin_asociatie'

const statusEnum = ASSOCIATION_ORDER_STATUSES as unknown as [string, ...string[]]

const patchBodySchema = z
  .object({
    orderId: z.string().uuid(),
    lineIds: z.array(z.string().uuid()).min(1, 'Trimite liniile comenzii.'),
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

    const { orderId, lineIds, status } = parsed.data
    const noteInterne = normalizeInternalNote(parsed.data.note_interne)
    orderIdForSentry = orderId

    const { data, error: fetchErr } = await supabase
      .from('comenzi')
      .select(
        'id, data_origin, tenant_id, status, telefon, data_comanda, client_nume_manual, locatie_livrare, note_interne',
      )
      .in('id', lineIds)

    const rows = (data ?? []) as Array<{
      id: string
      data_origin: string | null
      tenant_id: string | null
      status: string
      telefon: string | null
      data_comanda: string
      client_nume_manual: string | null
      locatie_livrare: string | null
      note_interne: string | null
    }>

    if (fetchErr || rows.length === 0) {
      return apiError(404, 'NOT_FOUND', 'Comanda nu a fost găsită.')
    }

    if (!rows.some((row) => row.id === orderId)) {
      return apiError(400, 'INVALID_ORDER_GROUP', 'Comanda trimisă nu corespunde liniilor selectate.')
    }

    if (rows.length !== new Set(lineIds).size) {
      return apiError(400, 'INVALID_ORDER_GROUP', 'Nu am putut încărca toate liniile comenzii.')
    }

    if (rows.some((row) => row.data_origin !== MAGAZIN_ASOCIATIE)) {
      return apiError(403, 'FORBIDDEN', 'Comanda nu este din magazinul asociației.')
    }

    const distinctStatuses = [...new Set(rows.map((row) => row.status))]
    // Use the status of the representative row (orderId) as canonical.
    // This avoids MIXED_STATUS errors from legacy data — the update will normalize all lines.
    const representativeRow = rows.find((row) => row.id === orderId)
    const currentStatus = representativeRow?.status ?? distinctStatuses[0] ?? null

    const updatePayload: {
      status?: AssociationOrderStatus
      note_interne?: string | null
      updated_at: string
    } = {
      updated_at: new Date().toISOString(),
    }

    if (status !== undefined) {
      if (!isAssociationOrderStatus(currentStatus)) {
        return apiError(409, 'INVALID_CURRENT_STATUS', 'Comanda are un status vechi. Reîncarcă lista și încearcă din nou.')
      }
      if (!canTransitionAssociationOrderStatus(currentStatus, status)) {
        const allowed = getAllowedAssociationOrderTransitions(currentStatus)
        const nextSteps =
          allowed.length > 0 ? ` Poți trece doar la: ${allowed.join(', ')}.` : ' Comanda este deja într-o stare finală.'
        return apiError(400, 'INVALID_STATUS_TRANSITION', `Tranziție invalidă din „${currentStatus}” în „${status}”.${nextSteps}`)
      }
      updatePayload.status = status as AssociationOrderStatus
    }
    if (noteInterne !== undefined) {
      updatePayload.note_interne = noteInterne
    }

    const updateQuery = supabase
      .from('comenzi')
      .update(updatePayload)
      .in('id', lineIds)
      .eq('data_origin', MAGAZIN_ASOCIATIE)

    const { data: updatedRows, error: upErr } = await updateQuery.select('id, tenant_id')

    if (upErr || !updatedRows?.length || updatedRows.length !== rows.length) {
      return apiError(400, 'UPDATE_FAILED', 'Nu am putut actualiza statusul.')
    }

    if (status !== undefined && currentStatus !== status) {
      for (const tenantId of new Set(updatedRows.map((row) => row.tenant_id).filter((value): value is string => Boolean(value)))) {
        try {
          void createNotificationForTenantOwner(
            tenantId,
            NOTIFICATION_TYPES.order_status_changed,
            'Status comandă actualizat',
            `Comanda a fost marcată ca „${status}”.`,
            {
              orderId,
              previousStatus: currentStatus,
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
    }

    return NextResponse.json({
      ok: true,
      data: {
        id: orderId,
        status: status ?? currentStatus,
        note_interne: noteInterne !== undefined ? noteInterne : rows.find((row) => row.id === orderId)?.note_interne ?? null,
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

const addLineBodySchema = z.object({
  orderId: z.string().uuid(),
  productId: z.string().uuid(),
  quantity: z.number().int().min(1).max(9999),
})

export async function POST(request: Request) {
  let userId: string | null = null

  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) return invalidOriginResponse

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id) return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
    userId = user.id

    const role = await getAssociationRole(user.id)
    if (role !== 'admin' && role !== 'moderator') {
      return apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot adăuga produse.')
    }

    const json = await request.json()
    const parsed = addLineBodySchema.safeParse(json)
    if (!parsed.success) return apiError(400, 'INVALID_BODY', 'Date invalide.')

    const { orderId, productId, quantity } = parsed.data

    // Fetch the representative order row for group metadata
    const { data: orderRow, error: orderErr } = await supabase
      .from('comenzi')
      .select(
        'id, data_comanda, telefon, client_id, locatie_livrare, client_nume_manual, numar_comanda_scurt, status, canal_confirmare, tenant_id',
      )
      .eq('id', orderId)
      .eq('data_origin', MAGAZIN_ASOCIATIE)
      .single()

    if (orderErr || !orderRow) return apiError(404, 'NOT_FOUND', 'Comanda nu a fost găsită.')

    const currentStatus = orderRow.status as string
    if (currentStatus === 'livrata' || currentStatus === 'anulata') {
      return apiError(409, 'FINAL_STATUS', 'Nu poți adăuga produse la o comandă finalizată.')
    }

    // Fetch the product
    const { data: product, error: productErr } = await supabase
      .from('produse')
      .select('id, nume, pret_unitar, unitate_vanzare, tenant_id, status, association_listed')
      .eq('id', productId)
      .single()

    if (productErr || !product) return apiError(404, 'PRODUCT_NOT_FOUND', 'Produsul nu a fost găsit.')
    if (product.status !== 'activ') return apiError(409, 'PRODUCT_INACTIVE', 'Produsul nu este activ.')

    const unitPrice = Number(product.pret_unitar || 0)
    const lineTotal = Number((unitPrice * quantity).toFixed(2))

    const { data: inserted, error: insertErr } = await supabase
      .from('comenzi')
      .insert({
        data_origin: MAGAZIN_ASOCIATIE,
        data_comanda: orderRow.data_comanda,
        telefon: orderRow.telefon,
        client_id: orderRow.client_id,
        locatie_livrare: orderRow.locatie_livrare,
        client_nume_manual: orderRow.client_nume_manual,
        numar_comanda_scurt: orderRow.numar_comanda_scurt,
        status: orderRow.status,
        canal_confirmare: orderRow.canal_confirmare,
        produs_id: productId,
        tenant_id: product.tenant_id ?? orderRow.tenant_id,
        cantitate_kg: quantity,
        pret_per_kg: unitPrice,
        total: lineTotal,
        cost_livrare: 0,
        observatii: 'Adăugat manual de admin',
      })
      .select('id')
      .single()

    if (insertErr || !inserted) {
      captureApiError(insertErr, { route: '/api/association/orders POST', userId })
      return apiError(500, 'INSERT_FAILED', 'Nu am putut adăuga produsul.')
    }

    return NextResponse.json({ ok: true, data: { lineId: inserted.id } })
  } catch (error) {
    captureApiError(error, { route: '/api/association/orders POST', userId })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la adăugare produs.')
  }
}
