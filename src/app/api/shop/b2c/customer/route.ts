import { NextResponse } from 'next/server'

import {
  consumeFixedWindowLimit,
  extractClientIpFromHeaders,
} from '@/lib/api/public-write-guard'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { lookupShopCustomer } from '@/lib/shop/b2c-customers'
import { normalizeRomanianMobilePhone } from '@/lib/shop/phone'

const CUSTOMER_LOOKUP_RATE_LIMIT = { limit: 5, windowMs: 60_000 } as const

function notFoundResponse() {
  return NextResponse.json({ found: false })
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const phone = url.searchParams.get('phone')?.trim() ?? ''
  const normalizedPhone = normalizeRomanianMobilePhone(phone)

  if (!normalizedPhone) {
    return NextResponse.json({ found: false, error: 'Telefon invalid' }, { status: 400 })
  }

  const ip = extractClientIpFromHeaders(request.headers)
  const rateLimit = consumeFixedWindowLimit(`shop-customer-lookup:${ip}`, CUSTOMER_LOOKUP_RATE_LIMIT)
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
    console.warn('[shop/b2c/customer] SHOP_TENANT_ID missing; lookup skipped')
    return notFoundResponse()
  }

  try {
    const customer = await lookupShopCustomer({ tenantId, phone: normalizedPhone })
    if (!customer.found) return notFoundResponse()

    return NextResponse.json({
      found: true,
      name: customer.name ?? '',
      delivery_address: customer.delivery_address ?? '',
      delivery_city: customer.delivery_city ?? '',
      delivery_mode: customer.delivery_mode ?? '',
    })
  } catch (error) {
    console.error(
      '[shop/b2c/customer] lookup failed',
      sanitizeForLog({
        error: toSafeErrorContext(error),
      }),
    )
    return notFoundResponse()
  }
}
