import { NextResponse } from 'next/server'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { isHiddenOperatorEmail } from '@/lib/farm-members/operator-link'
import { createReconnectLink, getAuthUserEmail, revokeAllSessions } from '@/lib/farm-members/operator-link-server'
import { farmMemberInviteUrl, farmOperatorInviteUrl, getFarmOwnerContext } from '@/lib/farm-members/owner-auth'
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
    .select('id, role, user_id, is_active')
    .eq('id', id)
    .eq('tenant_id', owner.tenantId)
    .maybeSingle()

  if (memberError) {
    return errorResponse('lookup_failed', 500)
  }

  if (!member) {
    return errorResponse('not_found', 404)
  }

  const row = member as { role?: string; user_id?: string | null; is_active?: boolean }

  // Operatorul din link (cont ascuns): link nou de reconectare, în același utilizator; sesiunile vechi se închid.
  if (row.role === 'operator') {
    if (!row.is_active || !row.user_id) {
      return errorResponse('not_found', 404)
    }
    const email = await getAuthUserEmail(row.user_id)
    if (!isHiddenOperatorEmail(email)) {
      return errorResponse('not_link_operator', 400)
    }
    const link = await createReconnectLink({ tenantId: owner.tenantId, userId: row.user_id, createdBy: owner.userId })
    if (!link) {
      return errorResponse('update_failed', 500)
    }
    const sessionsClosed = email ? await revokeAllSessions(email) : false
    if (!sessionsClosed) {
      console.warn('[farm-members] reconnect: sesiunile vechi nu s-au putut închide', { memberId: id })
    }
    return NextResponse.json({
      success: true,
      invite_url: farmOperatorInviteUrl(link.token),
      expires_at: link.expiresAt,
      sessions_closed: sessionsClosed,
    })
  }

  if (row.role !== 'livrator') {
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
