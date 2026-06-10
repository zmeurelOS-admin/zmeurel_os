import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserId } from '@/lib/tenant/get-tenant'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const patchBodySchema = z
  .object({
    status: z.enum(['noua', 'confirmata', 'in_livrare', 'livrata', 'anulata']).optional(),
    notified_wa: z.boolean().optional(),
  })
  .refine((body) => body.status !== undefined || body.notified_wa !== undefined, {
    message: 'Trimite status sau notified_wa.',
  })
  .refine((body) => body.status !== 'livrata' || body.notified_wa === undefined, {
    message: 'Livrarea și notificarea WhatsApp se actualizează separat.',
  })

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status })
}

type RouteContext = { params: Promise<{ id: string }> }

export async function PATCH(request: Request, context: RouteContext) {
  const originCheck = validateSameOriginMutation(request, { statusKey: 'success' })
  if (originCheck) return originCheck

  const { id } = await context.params
  if (!UUID_RE.test(id)) {
    return errorResponse('ID invalid', 400)
  }

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
    return errorResponse('JSON invalid', 400)
  }

  const parsed = patchBodySchema.safeParse(json)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? 'Date invalide'
    return errorResponse(first, 400)
  }

  if (parsed.data.status === 'livrata') {
    const { data, error } = await supabase.rpc('deliver_shop_order_atomic', {
      p_shop_order_id: id,
      p_payment_status: 'platit',
    })

    if (error) {
      console.error(
        '[shop/b2c/orders] atomic delivery failed',
        sanitizeForLog(toSafeErrorContext({ id, ...error })),
      )
      return errorResponse(error.message || 'Nu am putut marca livrarea.', 409)
    }

    return NextResponse.json({ success: true, delivery: data })
  }

  const updates: { status?: string; notified_wa?: boolean } = {}
  if (parsed.data.status !== undefined) updates.status = parsed.data.status
  if (parsed.data.notified_wa !== undefined) updates.notified_wa = parsed.data.notified_wa

  let tenantId: string
  try {
    tenantId = await getTenantIdByUserId(supabase, user.id)
  } catch (tenantError) {
    console.error(
      '[shop/b2c/orders] tenant resolution failed',
      sanitizeForLog(toSafeErrorContext(tenantError)),
    )
    return errorResponse('Tenant indisponibil pentru utilizatorul curent.', 403)
  }

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('shop_orders')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id')

  if (error) {
    console.error(
      '[shop/b2c/orders] patch failed',
      sanitizeForLog(toSafeErrorContext({ id, ...error })),
    )
    return errorResponse('Nu am putut actualiza comanda.', 500)
  }

  if (!data?.length) {
    return errorResponse('Comanda nu a fost găsită.', 404)
  }

  return NextResponse.json({ success: true })
}
