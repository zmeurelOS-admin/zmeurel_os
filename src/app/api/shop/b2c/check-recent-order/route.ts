import { NextResponse } from 'next/server'
import { z } from 'zod'

import {
  consumeFixedWindowLimit,
  extractClientIpFromHeaders,
} from '@/lib/api/public-write-guard'
import { validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { normalizeRomanianMobilePhone, ROMANIAN_PHONE_ERROR } from '@/lib/shop/phone'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const CHECK_RECENT_ORDER_RATE_LIMIT = { limit: 5, windowMs: 60_000 } as const

const bodySchema = z.object({
  phone: z.string().trim().min(1),
  campaignId: z.string().uuid().nullable().optional(),
})

function notFoundResponse() {
  return NextResponse.json({ found: false })
}

export async function POST(request: Request) {
  const originCheck = validateSameOriginMutation(request, { statusKey: 'success' })
  if (originCheck) return originCheck

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ found: false, error: 'JSON invalid' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ found: false, error: 'Date invalide' }, { status: 400 })
  }

  const normalizedPhone = normalizeRomanianMobilePhone(parsed.data.phone)
  if (!normalizedPhone) {
    return NextResponse.json({ found: false, error: ROMANIAN_PHONE_ERROR }, { status: 400 })
  }

  const ip = extractClientIpFromHeaders(request.headers)
  const rateLimit = consumeFixedWindowLimit(`shop-check-recent-order:${ip}`, CHECK_RECENT_ORDER_RATE_LIMIT)
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
    console.warn('[shop/b2c/check-recent-order] SHOP_TENANT_ID missing; lookup skipped')
    return notFoundResponse()
  }

  try {
    const admin = getSupabaseAdmin()
    const checkRecentOrderRpc = admin.rpc as unknown as (
      name: 'check_recent_shop_order',
      args: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: unknown }>
    const { data, error } = await checkRecentOrderRpc('check_recent_shop_order', {
      p_tenant_id: tenantId,
      p_customer_phone: normalizedPhone,
      p_campaign_id: parsed.data.campaignId ?? null,
      p_minutes: 10,
    })

    if (error) throw error
    if (!data || typeof data !== 'object' || Array.isArray(data)) return notFoundResponse()

    return NextResponse.json(data)
  } catch (error) {
    console.error(
      '[shop/b2c/check-recent-order] lookup failed',
      sanitizeForLog({
        error: toSafeErrorContext(error),
      }),
    )
    return notFoundResponse()
  }
}
