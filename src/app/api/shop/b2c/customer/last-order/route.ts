import { NextResponse } from 'next/server'

import {
  consumeFixedWindowLimit,
  extractClientIpFromHeaders,
} from '@/lib/api/public-write-guard'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { normalizeShopCustomerPhone } from '@/lib/shop/b2c-customers'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import type { Json } from '@/types/supabase'

const LAST_ORDER_RATE_LIMIT = { limit: 5, windowMs: 60_000 } as const

type LastOrderItem = {
  product_id: string
  name: string
  quantity: number
  unit_label: string
  price_lei: number
}

function notFoundResponse() {
  return NextResponse.json({ found: false })
}

function phoneVariants(phone: string): string[] {
  const normalized = normalizeShopCustomerPhone(phone)
  if (normalized.length < 9) return []

  return Array.from(new Set([normalized, `0${normalized}`, `40${normalized}`]))
}

function parseOrderItems(items: Json): LastOrderItem[] {
  if (!Array.isArray(items)) return []

  return items
    .map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null

      const row = item as Record<string, Json | undefined>
      const label = typeof row.label === 'string' ? row.label : ''
      const [namePart, unitPart] = label.split('—').map((value) => value?.trim() ?? '')
      const productId = typeof row.vid === 'string' ? row.vid : ''
      const quantity = typeof row.qty === 'number' ? row.qty : 0
      const priceLei = typeof row.price_lei === 'number' ? row.price_lei : 0

      if (!productId || !namePart || quantity <= 0) return null

      return {
        product_id: productId,
        name: namePart,
        quantity,
        unit_label: unitPart,
        price_lei: priceLei,
      }
    })
    .filter((item): item is LastOrderItem => Boolean(item))
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const phone = url.searchParams.get('phone')?.trim() ?? ''
  const variants = phoneVariants(phone)

  if (phone.length < 10 || variants.length === 0) {
    return NextResponse.json({ found: false, error: 'Telefon invalid' }, { status: 400 })
  }

  const ip = extractClientIpFromHeaders(request.headers)
  const rateLimit = consumeFixedWindowLimit(`shop-customer-last-order:${ip}`, LAST_ORDER_RATE_LIMIT)
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { found: false, error: 'Prea multe încercări. Reîncearcă în câteva secunde.' },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    )
  }

  const tenantId = process.env.SHOP_TENANT_ID?.trim()
  if (!tenantId) {
    console.warn('[shop/b2c/customer/last-order] SHOP_TENANT_ID missing; lookup skipped')
    return notFoundResponse()
  }

  try {
    const admin = getSupabaseAdmin()
    const phoneFilter = variants.map((variant) => `customer_phone.eq.${variant}`).join(',')
    const { data, error } = await admin
      .from('shop_orders')
      .select('items,total_lei,created_at')
      .eq('tenant_id', tenantId)
      .or(phoneFilter)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (error) throw error
    if (!data) return notFoundResponse()

    return NextResponse.json({
      found: true,
      items: parseOrderItems(data.items),
      total_lei: data.total_lei,
      created_at: data.created_at,
    })
  } catch (error) {
    console.error(
      '[shop/b2c/customer/last-order] lookup failed',
      sanitizeForLog({
        error: toSafeErrorContext(error),
      }),
    )
    return notFoundResponse()
  }
}
