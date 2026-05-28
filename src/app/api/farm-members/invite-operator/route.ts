import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { resolveAuthUserIdByEmail } from '@/lib/association/resolve-auth-user-by-email'
import { getFarmOwnerContext } from '@/lib/farm-members/owner-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const bodySchema = z.object({
  email: z.string().trim().email(),
})

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function POST(request: Request) {
  const originCheck = validateSameOriginMutation(request, { statusKey: 'success' })
  if (originCheck) return originCheck

  const owner = await getFarmOwnerContext()
  if (!owner) {
    return errorResponse('forbidden', 403)
  }

  let json: unknown
  try {
    json = await request.json()
  } catch {
    return errorResponse('invalid_json', 400)
  }

  const parsed = bodySchema.safeParse(json)
  if (!parsed.success) {
    return errorResponse('invalid_email', 400)
  }

  const admin = getSupabaseAdmin()
  const resolved = await resolveAuthUserIdByEmail(admin, parsed.data.email)
  if (!resolved) {
    return errorResponse('no_account', 404)
  }

  const { data: existing, error: existingError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .select('id')
    .eq('tenant_id', owner.tenantId)
    .eq('user_id', resolved.id)
    .eq('is_active', true)
    .maybeSingle()

  if (existingError) {
    return errorResponse('lookup_failed', 500)
  }

  if (existing) {
    return errorResponse('already_member', 409)
  }

  const { data: inserted, error: insertError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .insert({
      tenant_id: owner.tenantId,
      user_id: resolved.id,
      role: 'operator',
      name: resolved.email,
      created_by: owner.userId,
    })
    .select('id')
    .single()

  const insertedRow = inserted as unknown as { id?: string } | null
  if (insertError || !insertedRow?.id) {
    return errorResponse('insert_failed', 500)
  }

  return NextResponse.json({ success: true, member_id: insertedRow.id })
}
