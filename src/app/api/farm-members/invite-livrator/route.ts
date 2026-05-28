import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { farmMemberInviteUrl, getFarmOwnerContext } from '@/lib/farm-members/owner-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const bodySchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
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
    return errorResponse('invalid_body', 400)
  }

  const token = crypto.randomUUID()
  const admin = getSupabaseAdmin()
  const { data: inserted, error: insertError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .insert({
      tenant_id: owner.tenantId,
      role: 'livrator',
      name: parsed.data.name,
      phone: parsed.data.phone?.trim() || null,
      invite_token: token,
      created_by: owner.userId,
    })
    .select('id')
    .single()

  const insertedRow = inserted as unknown as { id?: string } | null
  if (insertError || !insertedRow?.id) {
    return errorResponse('insert_failed', 500)
  }

  return NextResponse.json({
    success: true,
    token,
    invite_url: farmMemberInviteUrl(token),
  })
}
