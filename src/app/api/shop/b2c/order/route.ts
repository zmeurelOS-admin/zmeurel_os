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
import { normalizeRomanianMobilePhone, ROMANIAN_PHONE_ERROR } from '@/lib/shop/phone'
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
  campaign_id: z.string().uuid().nullable().optional(),
  idempotencyKey: z.string().uuid().optional(),
  inSuceava: z.boolean().nullable().optional(),
  preferredDeliveryDate: z.string().date().nullable().optional(),
  items: z.array(lineSchema).length(1, 'Coșul trebuie să conțină doar zmeură'),
  total_lei: z.number().int().positive('Total invalid'),
  notes: z.string().trim().max(2000).optional(),
})

const preorderResultSchema = z.object({
  order_id: z.string().uuid(),
  current_count: z.number(),
  hit_milestone: z.boolean().optional().default(false),
  milestone_threshold: z.number().int().nullable().optional(),
  milestone_reward: z.string().nullable().optional(),
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
    campaign_id,
    idempotencyKey,
    inSuceava,
    preferredDeliveryDate,
    items,
    notes,
  } = parsed.data
  const configuredTenantId = process.env.SHOP_TENANT_ID?.trim()
  const item = items[0]
  const normalizedCustomerPhone = normalizeRomanianMobilePhone(customer_phone)

  if (!configuredTenantId) {
    console.error('[shop/b2c/order] SHOP_TENANT_ID missing; order rejected')
    return errorResponse('Magazinul nu este configurat pentru preluarea comenzilor.', 500)
  }

  if (!normalizedCustomerPhone) {
    return errorResponse(ROMANIAN_PHONE_ERROR, 400)
  }

  if (delivery_mode === 'livrare' && !delivery_address?.trim()) {
    return errorResponse('Introdu adresa de livrare', 400)
  }

  if (!item || item.vid !== ZMEURA_PRODUCT_ID) {
    return errorResponse('Magazinul acceptă momentan doar comenzi de zmeură.', 400)
  }

  const totalLei = computeZmeuraTotalLei(item.qty)
  const orderKind = campaign_id ? 'preorder' : 'standard'
  const normalizedItems = [
    {
      ...item,
      price_lei: ZMEURA_CASEROLA_PRICE_LEI,
    },
  ]

  const admin = getSupabaseAdmin()
  let orderId: string
  let milestoneResult: z.infer<typeof preorderResultSchema> | null = null

  if (campaign_id) {
    const preorderRpc = admin.rpc as unknown as (
      name: 'place_preorder_atomic',
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message?: string } | null }>
    const { data, error } = await preorderRpc('place_preorder_atomic', {
      p_campaign_id: campaign_id,
      p_tenant_id: configuredTenantId,
      p_customer_name: customer_name,
      p_customer_phone: normalizedCustomerPhone,
      p_delivery_mode: delivery_mode,
      p_delivery_address: (delivery_address?.trim() || null) as unknown as string,
      p_delivery_city: (delivery_city?.trim() || null) as unknown as string,
      p_items: normalizedItems as Json,
      p_total_lei: totalLei,
      p_notes: (notes?.trim() || null) as unknown as string,
      p_idempotency_key: idempotencyKey ?? null,
      ...(delivery_mode === 'livrare' ? { p_in_suceava: inSuceava ?? null } : {}),
      p_preferred_delivery_date:
        delivery_mode === 'livrare' ? preferredDeliveryDate ?? null : null,
    })
    const parsedResult = preorderResultSchema.safeParse(data)

    if (error || !parsedResult.success) {
      if (error?.message?.startsWith('Comanda minimă pentru livrare')) {
        return errorResponse(error.message, 400)
      }

      console.error(
        '[shop/b2c/order] preorder RPC failed',
        sanitizeForLog(
          toSafeErrorContext(
            error ?? {
              message: 'invalid place_preorder_atomic response',
              issues: parsedResult.success ? undefined : parsedResult.error.issues,
            },
          ),
        ),
      )
      return errorResponse('Nu am putut salva precomanda. Încearcă din nou.', 500)
    }

    milestoneResult = parsedResult.data
    orderId = milestoneResult.order_id
  } else {
    const { data, error } = await admin
      .from('shop_orders')
      .insert({
        tenant_id: configuredTenantId,
        customer_name,
        customer_phone: normalizedCustomerPhone,
        delivery_mode,
        delivery_address: delivery_address?.trim() || null,
        delivery_city: delivery_city?.trim() || null,
        delivery_date: delivery_mode === 'livrare' ? preferredDeliveryDate ?? null : null,
        items: normalizedItems as Json,
        total_lei: totalLei,
        notes: notes?.trim() || null,
        order_kind: orderKind,
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

    orderId = data.id
  }

  const notificationItems = normalizedItems.map(({ qty, label }) => ({ qty, label }))
  const notificationTitle =
    orderKind === 'preorder' ? 'Precomandă magazin 🍓' : 'Comandă magazin 🍓'
  const quantityLabel = item.qty === 1 ? '1 caserolă' : `${item.qty} caserole`
  const quantityKg = item.qty * 0.5
  const quantityKgLabel =
    quantityKg % 1 === 0 ? `${quantityKg}` : quantityKg.toFixed(1).replace('.', ',')
  const customerDetails =
    delivery_mode === 'ridicare'
      ? `${customer_name}, ${normalizedCustomerPhone} — ridicare`
      : delivery_city?.trim()
        ? `${customer_name}, ${normalizedCustomerPhone}, ${delivery_city.trim()}`
        : `${customer_name}, ${normalizedCustomerPhone}`
  const notificationBody = `${quantityLabel} (${quantityKgLabel} kg) · ${totalLei} lei\n${customerDetails}`
  const extra = {
    orderId,
    tenantId: configuredTenantId,
    clientName: customer_name,
    customerPhone: normalizedCustomerPhone,
    totalLei,
    items: notificationItems,
    orderKind,
    channel: 'farm_shop',
    icon: '/shop-icon-192.png',
  }

  try {
    await createNotificationForTenantOwner(
      configuredTenantId,
      NOTIFICATION_TYPES.order_new,
      notificationTitle,
      notificationBody,
      extra,
      'order',
      orderId,
    )
  } catch (notificationError) {
    console.error(
      '[shop/b2c/order] notification dispatch failed',
      sanitizeForLog(
        toSafeErrorContext({
          error: notificationError,
          orderId,
          tenantId: configuredTenantId,
        }),
      ),
    )
  }

  try {
    await upsertShopCustomer({
      tenantId: configuredTenantId,
      phone: normalizedCustomerPhone,
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
          orderId,
          tenantId: configuredTenantId,
        }),
      ),
    )
  }

  return NextResponse.json({
    success: true,
    order_id: orderId,
    total_lei: totalLei,
    ...(milestoneResult
      ? {
          current_count: milestoneResult.current_count,
          hit_milestone: milestoneResult.hit_milestone,
          milestone_threshold: milestoneResult.milestone_threshold ?? null,
          milestone_reward: milestoneResult.milestone_reward ?? null,
        }
      : {}),
  })
}
