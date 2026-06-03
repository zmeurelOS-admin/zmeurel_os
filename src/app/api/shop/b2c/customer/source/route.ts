import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { normalizeShopCustomerPhone } from '@/lib/shop/b2c-customers'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const sourceSchema = z.enum(['facebook', 'instagram', 'recomandare', 'google', 'altceva'])

const bodySchema = z.object({
  phone: z.string().trim().min(1),
  source: sourceSchema,
})

export async function PATCH(request: Request) {
  const originCheck = validateSameOriginMutation(request, { statusKey: 'ok' })
  if (originCheck) return originCheck

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON invalid' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'Date invalide' }, { status: 400 })
  }

  const tenantId = process.env.SHOP_TENANT_ID?.trim()
  const phone = normalizeShopCustomerPhone(parsed.data.phone)
  if (!tenantId || phone.length < 9) {
    return NextResponse.json({ ok: true })
  }

  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.rpc('set_shop_customer_acquisition_source_once', {
      p_tenant_id: tenantId,
      p_phone: phone,
      p_source: parsed.data.source,
    })

    if (error) throw error
  } catch (error) {
    console.error(
      '[shop/b2c/customer/source] source save failed',
      sanitizeForLog({
        error: toSafeErrorContext(error),
      }),
    )
  }

  return NextResponse.json({ ok: true })
}
