import { NextResponse } from 'next/server'
import { z } from 'zod'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import { getAssociationRole } from '@/lib/association/auth'
import { captureApiError } from '@/lib/monitoring/sentry'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

const MAGAZIN_ASOCIATIE = 'magazin_asociatie'

const bodySchema = z.object({
  orderId: z.string().uuid(),
  produsId: z.string().uuid(),
  cantitate: z.number().positive().max(50_000),
  pretUnitar: z.number().positive().max(1_000_000),
})

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100
}

function shortOrderId(id: string): string {
  return id.replace(/-/g, '').slice(0, 8).toUpperCase()
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

export async function POST(request: Request) {
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
      return apiError(403, 'FORBIDDEN', 'Doar administratorii și moderatorii pot modifica comenzile.')
    }

    const parsed = bodySchema.safeParse(await request.json())
    if (!parsed.success) {
      return apiError(400, 'INVALID_BODY', 'Date invalide.')
    }

    const { orderId, produsId, cantitate, pretUnitar } = parsed.data
    orderIdForSentry = orderId
    const admin = getSupabaseAdmin()

    const { data: originalOrderData, error: orderError } = await admin
      .from('comenzi')
      .select(
        'id, numar_comanda_scurt, data_origin, status, data_comanda, data_livrare, client_id, client_nume_manual, telefon, locatie_livrare, note_interne, canal_confirmare, customer_snapshot, whatsapp_consent',
      )
      .eq('id', orderId)
      .maybeSingle()

    const originalOrder = originalOrderData as
      | {
          id: string
          numar_comanda_scurt: string | null
          data_origin: string | null
          status: string
          data_comanda: string
          data_livrare: string | null
          client_id: string | null
          client_nume_manual: string | null
          telefon: string | null
          locatie_livrare: string | null
          note_interne: string | null
          canal_confirmare: 'whatsapp' | 'sms' | 'apel' | null
          customer_snapshot?: unknown
          whatsapp_consent?: boolean | null
        }
      | null

    if (orderError || !originalOrder) {
      return apiError(404, 'NOT_FOUND', 'Comanda originală nu a fost găsită.')
    }

    if (originalOrder.data_origin !== MAGAZIN_ASOCIATIE) {
      return apiError(403, 'FORBIDDEN', 'Poți extinde doar comenzile din magazinul asociației.')
    }

    const { data: productData, error: productError } = await admin
      .from('produse')
      .select(
        `
        id,
        tenant_id,
        nume,
        association_listed,
        association_price,
        pret_unitar,
        unitate_vanzare,
        status,
        tenants!inner (
          nume_ferma,
          is_association_approved,
          is_demo
        )
      `,
      )
      .eq('id', produsId)
      .single()

    const product = productData as
      | {
          id: string
          tenant_id: string
          nume: string
          association_listed: boolean | null
          association_price: number | null
          pret_unitar: number | null
          unitate_vanzare: string
          status: string
          tenants:
            | {
                nume_ferma: string | null
                is_association_approved: boolean | null
                is_demo: boolean | null
              }
            | Array<{
                nume_ferma: string | null
                is_association_approved: boolean | null
                is_demo: boolean | null
              }>
            | null
        }
      | null

    if (productError || !product) {
      return apiError(404, 'NOT_FOUND', 'Produsul selectat nu a fost găsit.')
    }

    const tenantEmbed = product.tenants as
      | { nume_ferma: string | null; is_association_approved: boolean | null; is_demo: boolean | null }
      | Array<{ nume_ferma: string | null; is_association_approved: boolean | null; is_demo: boolean | null }>
      | null
    const tenant = Array.isArray(tenantEmbed) ? tenantEmbed[0] : tenantEmbed
    if (product.status !== 'activ' || !product.association_listed || !tenant?.is_association_approved || tenant.is_demo === true) {
      return apiError(400, 'INVALID_PRODUCT', 'Produsul selectat nu este disponibil în magazinul asociației.')
    }
    if (!product.tenant_id) {
      return apiError(400, 'INVALID_PRODUCT', 'Produsul selectat nu are tenant asociat.')
    }

    const qty = round2(cantitate)
    const unitPrice = round2(pretUnitar)
    const lineTotal = round2(qty * unitPrice)
    const manualNote = `Adăugat manual de admin la comanda #${originalOrder.numar_comanda_scurt || shortOrderId(orderId)}`

    const { data: inserted, error: insertError } = await admin
      .from('comenzi')
      .insert({
        tenant_id: product.tenant_id,
        ...(originalOrder.client_id ? { client_id: originalOrder.client_id } : {}),
        ...(originalOrder.client_nume_manual ? { client_nume_manual: originalOrder.client_nume_manual } : {}),
        ...(originalOrder.telefon ? { telefon: originalOrder.telefon } : {}),
        ...(originalOrder.locatie_livrare ? { locatie_livrare: originalOrder.locatie_livrare } : {}),
        data_comanda: originalOrder.data_comanda,
        data_livrare: originalOrder.data_livrare ?? originalOrder.data_comanda,
        cantitate_kg: qty,
        pret_per_kg: unitPrice,
        total: lineTotal,
        cost_livrare: 0,
        status: originalOrder.status,
        observatii: manualNote,
        data_origin: MAGAZIN_ASOCIATIE,
        produs_id: product.id,
        ...(originalOrder.note_interne ? { note_interne: originalOrder.note_interne } : {}),
        ...(originalOrder.canal_confirmare ? { canal_confirmare: originalOrder.canal_confirmare } : {}),
        ...(originalOrder.customer_snapshot ? { customer_snapshot: originalOrder.customer_snapshot } : {}),
        whatsapp_consent: originalOrder.whatsapp_consent ?? false,
      })
      .select('id')
      .single()

    if (insertError || !inserted) {
      return apiError(400, 'INSERT_FAILED', 'Nu am putut adăuga produsul la comandă.')
    }

    let groupQuery = admin
      .from('comenzi')
      .select('id, total, cost_livrare')
      .eq('data_origin', MAGAZIN_ASOCIATIE)
      .eq('data_comanda', originalOrder.data_comanda)
    groupQuery = applyNullableFilter(groupQuery, 'telefon', originalOrder.telefon)
    groupQuery = applyNullableFilter(groupQuery, 'client_nume_manual', originalOrder.client_nume_manual)
    groupQuery = applyNullableFilter(groupQuery, 'locatie_livrare', originalOrder.locatie_livrare)

    const { data: groupedRows, error: groupedError } = await groupQuery
    if (groupedError) {
      return apiError(500, 'GROUP_FETCH_FAILED', 'Produsul a fost adăugat, dar totalul nu a putut fi recalculat.')
    }

    const grouped = (groupedRows ?? []) as Array<{ total: number | null; cost_livrare: number | null }>
    const subtotalLei = round2(
      grouped.reduce((sum: number, row) => sum + Number(row.total || 0), 0),
    )
    const deliveryFeeLei = round2(
      grouped.reduce((sum: number, row) => sum + Number(row.cost_livrare || 0), 0),
    )

    return NextResponse.json({
      ok: true,
      data: {
        insertedOrderId: inserted.id,
        subtotalLei,
        deliveryFeeLei,
        totalLei: round2(subtotalLei + deliveryFeeLei),
        line: {
          id: inserted.id,
          productName: product.nume,
          qtyKg: qty,
          unitPriceLei: unitPrice,
          lineTotalLei: lineTotal,
          farmName: tenant?.nume_ferma ?? null,
          sourceLabel: 'Adăugat manual de admin',
        },
      },
    })
  } catch (error) {
    captureApiError(error, {
      route: '/api/association/orders/add-line',
      userId,
      extra: { order_id: orderIdForSentry },
    })
    return apiError(500, 'INTERNAL_ERROR', 'Eroare la adăugarea produsului.')
  }
}
