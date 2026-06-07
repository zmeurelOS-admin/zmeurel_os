import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  order_ids: z.array(z.string().uuid()).min(1).max(200),
})

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(request: Request) {
  const originCheck = validateSameOriginMutation(request, { statusKey: 'success' })
  if (originCheck) return originCheck

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
    return errorResponse('JSON invalid.', 400)
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Ordine invalidă.', 400)
  }

  const uniqueIds = new Set(parsed.data.order_ids)
  if (uniqueIds.size !== parsed.data.order_ids.length) {
    return errorResponse('Lista livrărilor conține duplicate.', 400)
  }

  const { data, error } = await supabase.rpc('reorder_shop_deliveries_today', {
    p_order_ids: parsed.data.order_ids,
  })

  if (error) {
    console.error(
      '[shop/b2c/orders/reorder] rpc failed',
      sanitizeForLog(toSafeErrorContext(error)),
    )
    return errorResponse(error.message?.trim() || 'Nu am putut salva ordinea livrărilor.', 400)
  }

  return NextResponse.json({
    success: true,
    updated_count: data ?? parsed.data.order_ids.length,
  })
}
