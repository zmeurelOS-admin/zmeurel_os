import { NextResponse } from 'next/server'
import { z } from 'zod'

import { getActiveLivratorByToken, markShopOrderLivrata } from '@/lib/livrator/access'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'

const bodySchema = z.object({
  order_id: z.string().uuid('ID comandă invalid'),
  token: z.string().trim().min(1, 'Token lipsă'),
})

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status })
}

export async function POST(request: Request) {
  let json: unknown
  try {
    json = await request.json()
  } catch {
    return errorResponse('JSON invalid', 400)
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return errorResponse(parsed.error.issues[0]?.message ?? 'Date invalide', 400)
  }

  const member = await getActiveLivratorByToken(parsed.data.token)
  if (!member) {
    return errorResponse('Link invalid sau expirat.', 401)
  }

  try {
    await markShopOrderLivrata(parsed.data.order_id)
  } catch (error) {
    console.error(
      '[livrator/deliver] update failed',
      sanitizeForLog(toSafeErrorContext(error)),
    )
    return errorResponse('Nu am putut marca livrarea.', 500)
  }

  return NextResponse.json({ success: true })
}
