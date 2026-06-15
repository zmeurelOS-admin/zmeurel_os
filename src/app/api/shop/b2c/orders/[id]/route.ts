import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { todayBucharestDate } from '@/lib/shop/b2c-order-helpers'
import { upsertClientFromShopOrder } from '@/lib/shop/clienti-sync'
import { normalizeRomanianMobilePhone, ROMANIAN_PHONE_ERROR } from '@/lib/shop/phone'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'
import type { Json } from '@/types/supabase'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const orderItemSchema = z.object({
  vid: z.string().trim().min(1),
  label: z.string().trim().min(1),
  qty: z.number().int().positive(),
  price_lei: z.number().int().nonnegative(),
})

const patchBodySchema = z
  .object({
    status: z.enum(['noua', 'confirmata', 'in_livrare', 'livrata', 'anulata']).optional(),
    notified_wa: z.boolean().optional(),
    delivery_date: z.string().date().nullable().optional(),
    delivery_address: z.string().trim().max(500).optional(),
    delivery_city: z.string().trim().max(120).optional(),
    customer_name: z.string().trim().min(1).max(200).optional(),
    customer_phone: z.string().trim().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    delivery_mode: z.enum(['livrare', 'ridicare']).optional(),
    items: z.array(orderItemSchema).min(1).optional(),
  })
  .refine(
    (body) =>
      body.status !== undefined ||
      body.notified_wa !== undefined ||
      body.delivery_date !== undefined ||
      body.delivery_address !== undefined ||
      body.delivery_city !== undefined ||
      body.customer_name !== undefined ||
      body.customer_phone !== undefined ||
      body.notes !== undefined ||
      body.delivery_mode !== undefined ||
      body.items !== undefined,
    {
      message: 'Trimite cel puțin un câmp pentru actualizare.',
    },
  )
  .refine((body) => body.status !== 'livrata' || body.notified_wa === undefined, {
    message: 'Livrarea și notificarea WhatsApp se actualizează separat.',
  })
  .refine((body) => body.status !== 'livrata' || body.delivery_date === undefined, {
    message: 'Livrarea și data programată se actualizează separat.',
  })
  .refine(
    (body) =>
      body.status !== 'livrata' ||
      (body.customer_name === undefined &&
        body.customer_phone === undefined &&
        body.notes === undefined &&
        body.delivery_mode === undefined &&
        body.delivery_address === undefined &&
        body.delivery_city === undefined &&
        body.items === undefined),
    {
      message: 'Livrarea se marchează separat de editarea comenzii.',
    },
  )

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

  const normalizedCustomerPhone =
    parsed.data.customer_phone === undefined
      ? undefined
      : normalizeRomanianMobilePhone(parsed.data.customer_phone)
  if (parsed.data.customer_phone !== undefined && !normalizedCustomerPhone) {
    return errorResponse(ROMANIAN_PHONE_ERROR, 400)
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
    customer_name?: string
    customer_phone?: string
    notes?: string | null
    delivery_mode?: 'livrare' | 'ridicare'
    items?: Json
    total_lei?: number
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
  if (parsed.data.customer_name !== undefined) {
    updates.customer_name = parsed.data.customer_name
  }
  if (normalizedCustomerPhone != null) {
    updates.customer_phone = normalizedCustomerPhone
  }
  if (parsed.data.notes !== undefined) {
    updates.notes = parsed.data.notes?.trim() || null
  }
  if (parsed.data.delivery_mode !== undefined) {
    updates.delivery_mode = parsed.data.delivery_mode
  }
  if (parsed.data.items !== undefined) {
    const totalLei = parsed.data.items.reduce(
      (total, item) => total + item.qty * item.price_lei,
      0,
    )
    if (totalLei <= 0) {
      return errorResponse('Totalul comenzii trebuie să fie mai mare decât 0.', 400)
    }
    updates.items = parsed.data.items as Json
    updates.total_lei = totalLei
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
  const hasClientSyncUpdate =
    hasAddressUpdate ||
    parsed.data.customer_name !== undefined ||
    parsed.data.customer_phone !== undefined

  const { data, error } = await admin
    .from('shop_orders')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select(
      hasClientSyncUpdate
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

  if (hasClientSyncUpdate) {
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
        explicitAddressOverride: hasAddressUpdate,
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
