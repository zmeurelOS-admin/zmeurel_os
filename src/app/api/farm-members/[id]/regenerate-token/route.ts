import { NextResponse } from 'next/server'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { farmMemberInviteUrl, getFarmOwnerContext } from '@/lib/farm-members/owner-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

type RouteContext = {
  params: Promise<{ id: string }>
}

export async function POST(request: Request, context: RouteContext) {
  const originCheck = validateSameOriginMutation(request, { statusKey: 'success' })
  if (originCheck) return originCheck

  const owner = await getFarmOwnerContext()
  if (!owner) {
    return errorResponse('forbidden', 403)
  }

  const { id } = await context.params
  const admin = getSupabaseAdmin()
  const { data: member, error: memberError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .select('id, role')
    .eq('id', id)
    .eq('tenant_id', owner.tenantId)
    .maybeSingle()

  if (memberError) {
    return errorResponse('lookup_failed', 500)
  }

  if (!member) {
    return errorResponse('not_found', 404)
  }

  if ((member as { role?: string }).role !== 'livrator') {
    return errorResponse('not_livrator', 400)
  }

  const token = crypto.randomUUID()
  const { error: updateError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .update({ invite_token: token, invite_used_at: null })
    .eq('id', id)
    .eq('tenant_id', owner.tenantId)

  if (updateError) {
    return errorResponse('update_failed', 500)
  }

  return NextResponse.json({
    success: true,
    token,
    invite_url: farmMemberInviteUrl(token),
  })
}
