import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { normalizeShopCustomerPhone } from '@/lib/shop/b2c-customers'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const bodySchema = z.object({
  phone: z.string().trim().min(1),
  name: z.string().trim().max(120).optional(),
  product_name: z.string().trim().min(1).max(160),
})

export async function POST(request: Request) {
  const originCheck = validateSameOriginMutation(request, { statusKey: 'ok' })
  if (originCheck) return originCheck

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return NextResponse.json({ ok: true })
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return NextResponse.json({ ok: true })
  }

  const tenantId = process.env.SHOP_TENANT_ID?.trim()
  const phone = normalizeShopCustomerPhone(parsed.data.phone)
  if (!tenantId || phone.length < 9) {
    return NextResponse.json({ ok: true })
  }

  try {
    const admin = getSupabaseAdmin()
    const { error } = await admin.from('shop_interest_list').upsert(
      {
        tenant_id: tenantId,
        phone,
        name: parsed.data.name?.trim() || null,
        product_name: parsed.data.product_name,
      },
      {
        onConflict: 'tenant_id,phone,product_name',
        ignoreDuplicates: true,
      },
    )

    if (error) throw error
  } catch (error) {
    console.error(
      '[shop/b2c/interest] insert failed',
      sanitizeForLog({
        error: toSafeErrorContext(error),
      }),
    )
  }

  return NextResponse.json({ ok: true })
}
