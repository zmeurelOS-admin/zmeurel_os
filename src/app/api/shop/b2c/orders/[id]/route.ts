import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { todayBucharestDate } from '@/lib/shop/b2c-order-helpers'
import { upsertClientFromShopOrder } from '@/lib/shop/clienti-sync'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const patchBodySchema = z
  .object({
    status: z.enum(['noua', 'confirmata', 'in_livrare', 'livrata', 'anulata']).optional(),
    notified_wa: z.boolean().optional(),
    delivery_date: z.string().date().nullable().optional(),
    delivery_address: z.string().trim().max(500).optional(),
    delivery_city: z.string().trim().max(120).optional(),
  })
  .refine(
    (body) =>
      body.status !== undefined ||
      body.notified_wa !== undefined ||
      body.delivery_date !== undefined ||
      body.delivery_address !== undefined ||
      body.delivery_city !== undefined,
    {
      message: 'Trimite status, notified_wa, delivery_date, delivery_address sau delivery_city.',
    },
  )
  .refine((body) => body.status !== 'livrata' || body.notified_wa === undefined, {
    message: 'Livrarea și notificarea WhatsApp se actualizează separat.',
  })
  .refine((body) => body.status !== 'livrata' || body.delivery_date === undefined, {
    message: 'Livrarea și data programată se actualizează separat.',
  })

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const originCheck = validateSameOriginMutation(request, { statusKey: 'success' })
  if (originCheck) return originCheck

  const { id } = await context.params
  if (!UUID_RE.test(id)) {
    return errorResponse('ID invalid', 400)
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return errorResponse('Trebuie să fii autentificat.', 401)
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return errorResponse('JSON invalid', 400)
  }

  const parsed = patchBodySchema.safeParse(json)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Date invalide'
    return errorResponse(first, 400)
  }

  if (parsed.data.status === 'livrata') {
    const { data, error } = await supabase.rpc('deliver_shop_order_atomic', {
      p_shop_order_id: id,
      p_payment_status: 'platit',
    })

    if (error) {
      console.error(
        '[shop/b2c/orders] atomic delivery failed',
        sanitizeForLog(toSafeErrorContext({ id, ...error })),
      )
      return errorResponse(error.message || 'Nu am putut marca livrarea.', 409)
    }

    return NextResponse.json({ success: true, delivery: data })
  }

  const updates: {
    status?: string
    notified_wa?: boolean
    delivery_date?: string | null
    delivery_address?: string | null
    delivery_city?: string | null
  } = {}
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.notified_wa !== undefined) updates.notified_wa = parsed.data.notified_wa
  if (parsed.data.delivery_date !== undefined) updates.delivery_date = parsed.data.delivery_date
  if (parsed.data.delivery_address !== undefined) {
    updates.delivery_address = parsed.data.delivery_address.trim() || null
  }
  if (parsed.data.delivery_city !== undefined) {
    updates.delivery_city = parsed.data.delivery_city.trim() || null
  }

  let tenantId: string
  try {
    tenantId = await getTenantIdByUserId(supabase, user.id)
  } catch (tenantError) {
    console.error(
      '[shop/b2c/orders] tenant resolution failed',
      sanitizeForLog(toSafeErrorContext(tenantError)),
    )
    return errorResponse('Tenant indisponibil pentru utilizatorul curent.', 403)
  }

  const admin = getSupabaseAdmin()
  if (parsed.data.status === 'in_livrare' && parsed.data.delivery_date === undefined) {
    const { data: currentOrder, error: currentOrderError } = await admin
      .from('shop_orders')
      .select('delivery_date')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (currentOrderError) {
      console.error(
        '[shop/b2c/orders] delivery date lookup failed',
        sanitizeForLog(toSafeErrorContext({ id, ...currentOrderError })),
      )
      return errorResponse('Nu am putut pregăti comanda pentru livrare.', 500)
    }

    if (!currentOrder) {
      return errorResponse('Comanda nu a fost găsită.', 404)
    }

    updates.delivery_date = currentOrder.delivery_date ?? todayBucharestDate()
  }

  const hasAddressUpdate =
    parsed.data.delivery_address !== undefined || parsed.data.delivery_city !== undefined

  const { data, error } = await admin
    .from('shop_orders')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(
      hasAddressUpdate
        ? 'id, customer_name, customer_phone, delivery_address, delivery_city'
        : 'id',
    )

  if (error) {
    console.error(
      '[shop/b2c/orders] patch failed',
      sanitizeForLog(toSafeErrorContext({ id, ...error })),
    )
    return errorResponse('Nu am putut actualiza comanda.', 500)
  }

  if (!data?.length) {
    return errorResponse('Comanda nu a fost găsită.', 404)
  }

  if (hasAddressUpdate) {
    const updatedOrder = data[0] as {
      customer_name?: string | null
      customer_phone?: string | null
      delivery_address?: string | null
      delivery_city?: string | null
    }

    try {
      await upsertClientFromShopOrder({
        tenantId,
        phone: updatedOrder.customer_phone ?? '',
        name: updatedOrder.customer_name ?? 'Client shop',
        deliveryAddress: updatedOrder.delivery_address ?? null,
        deliveryCity: updatedOrder.delivery_city ?? null,
        explicitAddressOverride: true,
      })
    } catch (clientSyncError) {
      console.error(
        '[shop/b2c/orders] clienti sync failed',
        sanitizeForLog(
          toSafeErrorContext({
            error: clientSyncError,
            id,
            tenantId,
          }),
        ),
      )
    }
  }

  return NextResponse.json({ success: true })
}
