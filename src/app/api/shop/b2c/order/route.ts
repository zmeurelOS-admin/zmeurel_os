import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import {
  createNotificationForTenantOwner,
  NOTIFICATION_TYPES,
} from '@/lib/notifications/create'
import { upsertShopCustomer } from '@/lib/shop/b2c-customers'
import {
  computeZmeuraTotalLei,
  ZMEURA_CASEROLA_PRICE_LEI,
  ZMEURA_PRODUCT_ID,
} from '@/lib/shop/pricing'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Json } from '@/types/supabase'

const lineSchema = z.object({
  vid: z.string().trim().min(1),
  label: z.string().trim().min(1),
  qty: z.number().int().positive(),
  price_lei: z.number().int().nonnegative(),
})

const bodySchema = z.object({
  customer_name: z.string().trim().min(1, 'Introdu numele'),
  customer_phone: z.string().trim().min(1, 'Introdu telefonul'),
  delivery_mode: z.enum(['livrare', 'ridicare']),
  delivery_address: z.string().trim().max(500).optional(),
  delivery_city: z.string().trim().max(120).optional(),
  items: z.array(lineSchema).length(1, 'Coșul trebuie să conțină doar zmeură'),
  total_lei: z.number().int().positive('Total invalid'),
  notes: z.string().trim().max(2000).optional(),
})

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(request: Request) {
  const originCheck = validateSameOriginMutation(request, { statusKey: 'success' })
  if (originCheck) return originCheck

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return errorResponse('JSON invalid', 400)
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors
    const first =
      Object.values(fieldErrors).flat()[0] ?? parsed.error.issues[0]?.message ?? 'Date invalide'
    return errorResponse(first, 400)
  }

  const {
    customer_name,
    customer_phone,
    delivery_mode,
    delivery_address,
    delivery_city,
    items,
    notes,
  } = parsed.data
  const configuredTenantId = process.env.SHOP_TENANT_ID?.trim() || null
  const item = items[0]

  if (delivery_mode === 'livrare' && !delivery_address?.trim()) {
    return errorResponse('Introdu adresa de livrare', 400)
  }

  if (!item || item.vid !== ZMEURA_PRODUCT_ID) {
    return errorResponse('Magazinul acceptă momentan doar comenzi de zmeură.', 400)
  }

  const totalLei = computeZmeuraTotalLei(item.qty)
  const normalizedItems = [
    {
      ...item,
      price_lei: ZMEURA_CASEROLA_PRICE_LEI,
    },
  ]

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('shop_orders')
    .insert({
      tenant_id: configuredTenantId,
      customer_name,
      customer_phone,
      delivery_mode,
      delivery_address: delivery_address?.trim() || null,
      delivery_city: delivery_city?.trim() || null,
      items: normalizedItems as Json,
      total_lei: totalLei,
      notes: notes?.trim() || null,
    })
    .select('id')
    .single()

  if (error || !data?.id) {
    console.error(
      '[shop/b2c/order] insert failed',
      sanitizeForLog(toSafeErrorContext(error ?? { message: 'missing id' })),
    )
    return errorResponse('Nu am putut salva comanda. Încearcă din nou.', 500)
  }

  if (!configuredTenantId) {
    console.warn(
      '[shop/b2c/order] SHOP_TENANT_ID missing; created order without tenant notification',
      sanitizeForLog({ orderId: data.id }),
    )
    return NextResponse.json({ success: true, order_id: data.id, total_lei: totalLei })
  }

  const productSummary = normalizedItems.map((orderItem) => orderItem.label).join(', ')
  const extra = {
    orderId: data.id,
    tenantId: configuredTenantId,
    clientName: customer_name,
    totalLei,
    lineCount: normalizedItems.length,
    channel: 'farm_shop',
  }

  try {
    await createNotificationForTenantOwner(
      configuredTenantId,
      NOTIFICATION_TYPES.order_new,
      'Comandă nouă din magazin',
      `${customer_name} a comandat: ${productSummary}`,
      extra,
      'order',
      data.id,
    )
  } catch (notificationError) {
    console.error(
      '[shop/b2c/order] notification dispatch failed',
      sanitizeForLog(
        toSafeErrorContext({
          error: notificationError,
          orderId: data.id,
          tenantId: configuredTenantId,
        }),
      ),
    )
  }

  try {
    await upsertShopCustomer({
      tenantId: configuredTenantId,
      phone: customer_phone,
      name: customer_name,
      deliveryAddress: delivery_address?.trim() || null,
      deliveryCity: delivery_city?.trim() || null,
      deliveryMode: delivery_mode,
    })
  } catch (customerError) {
    console.error(
      '[shop/b2c/order] customer upsert failed',
      sanitizeForLog(
        toSafeErrorContext({
          error: customerError,
          orderId: data.id,
          tenantId: configuredTenantId,
        }),
      ),
    )
  }

  return NextResponse.json({ success: true, order_id: data.id, total_lei: totalLei })
}
