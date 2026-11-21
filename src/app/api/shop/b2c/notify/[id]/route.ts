import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { isSuperAdmin } from '@/lib/auth/isSuperAdmin'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const patchBodySchema = z.object({
  notified_at: z.string().datetime({ message: 'Dată invalidă' }),
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

  // Scrierea de mai jos e cu service role. `shop_notify_requests` n-are fermă pe rând, iar politica ei RLS
  // lasă citirea și schimbarea doar superadminului: aceeași regulă aici, altfel orice cont logat putea marca
  // orice cerere.
  if (!(await isSuperAdmin(supabase, user.id))) {
    return errorResponse('Nu ai voie să schimbi cererea.', 403)
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

  const admin = getSupabaseAdmin()
  const { error } = await admin
    .from('shop_notify_requests')
    .update({ notified_at: parsed.data.notified_at })
    .eq('id', id)

  if (error) {
    console.error(
      '[shop/b2c/notify] patch failed',
      sanitizeForLog(toSafeErrorContext({ id, ...error })),
    )
    return errorResponse('Nu am putut actualiza cererea.', 500)
  }

  return NextResponse.json({ success: true })
}
