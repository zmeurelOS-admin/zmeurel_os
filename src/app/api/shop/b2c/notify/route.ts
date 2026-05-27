import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const bodySchema = z.object({
  customer_name: z.string().trim().min(1, 'Introdu numele'),
  customer_phone: z.string().trim().min(1, 'Introdu telefonul'),
  product_id: z.string().trim().min(1, 'Produs invalid'),
  product_name: z.string().trim().min(1, 'Produs invalid'),
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

  const { customer_name, customer_phone, product_id, product_name } = parsed.data

  const admin = getSupabaseAdmin()
  const { error } = await admin.from('shop_notify_requests').insert({
    customer_name,
    customer_phone,
    product_id,
    product_name,
  })

  if (error) {
    console.error(
      '[shop/b2c/notify] insert failed',
      sanitizeForLog(toSafeErrorContext(error)),
    )
    return errorResponse('Nu am putut înregistra cererea. Încearcă din nou.', 500)
  }

  return NextResponse.json({ success: true })
}
