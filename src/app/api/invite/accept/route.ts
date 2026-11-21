import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { isHiddenOperatorEmail } from '@/lib/farm-members/operator-link'
import {
  claimOperatorLink,
  createHiddenOperatorUser,
  deleteFreshHiddenUser,
  firstRouteForMember,
  getAuthUserEmail,
  linkUserToFarm,
  loadOperatorLink,
  markOperatorLinkUser,
  releaseOperatorLink,
  removeAutoCreatedTenants,
  startSessionWithoutPassword,
  turnIntoReconnectLink,
} from '@/lib/farm-members/operator-link-server'
import { createClient } from '@/lib/supabase/server'

/**
 * „Intră în fermă”: operatorul intră doar din link, fără email și parolă.
 * Corpul are DOAR tokenul; ferma și drepturile vin din invitație (niciun `tenant_id` din cerere).
 */
const bodySchema = z.object({
  token: z.string().trim().uuid(),
})

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

function linkProblemStatus(reason: string): number {
  return reason === 'expired' || reason === 'used' || reason === 'inactive' ? 410 : 400
}

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const originCheck = validateSameOriginMutation(request, { statusKey: 'success' })
  if (originCheck) return originCheck

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

  const link = await loadOperatorLink(parsed.data.token)
  if (!link.state.ok || !link.row) {
    return errorResponse(link.state.ok ? 'not_found' : link.state.reason, link.state.ok ? 400 : linkProblemStatus(link.state.reason))
  }
  const row = link.row
  const state = link.state

  const supabase = await createClient()
  const {
    data: { user: currentUser },
  } = await supabase.auth.getUser()

  // Nu schimbăm contul pe tăcute: cine e logat în alt cont iese întâi (pagina arată „Ești logat ca …”).
  if (currentUser) {
    if (state.kind === 'reconectare' && currentUser.id === state.userId) {
      if (!(await claimOperatorLink(row, state.userId))) return errorResponse('used', 410)
      return NextResponse.json({ success: true, redirect_to: await firstRouteForMember(row.tenant_id, state.userId) })
    }
    return errorResponse('signed_in_as_other', 409)
  }

  if (state.kind === 'reconectare') {
    const email = await getAuthUserEmail(state.userId)
    if (!email || !isHiddenOperatorEmail(email)) return errorResponse('inactive', 410)
    if (!(await claimOperatorLink(row, state.userId))) return errorResponse('used', 410)

    if (!(await startSessionWithoutPassword(supabase, email))) {
      await turnIntoReconnectLink(row.id, state.userId)
      return errorResponse('signin_failed', 500)
    }
    // Telefonul vechi (sau pierdut) iese: rămâne doar sesiunea de acum.
    await supabase.auth.signOut({ scope: 'others' }).catch(() => undefined)
    return NextResponse.json({ success: true, redirect_to: await firstRouteForMember(row.tenant_id, state.userId) })
  }

  // Prima invitație: întâi linkul se marchează folosit (atomic), abia apoi se creează contul.
  if (!(await claimOperatorLink(row, null))) return errorResponse('used', 410)

  const name = row.invitee_name?.trim() || 'Operator'
  const created = await createHiddenOperatorUser(name)
  if (!created) {
    await releaseOperatorLink(row.id)
    return errorResponse('signup_failed', 500)
  }

  await removeAutoCreatedTenants(created.id)
  const linked = await linkUserToFarm({
    tenantId: row.tenant_id,
    userId: created.id,
    name,
    phone: row.invitee_phone ?? null,
    modules: link.modules,
    createdBy: row.created_by,
  })
  if (!linked.ok) {
    await deleteFreshHiddenUser(created.id)
    await releaseOperatorLink(row.id)
    return errorResponse(linked.error, 500)
  }
  await markOperatorLinkUser(row.id, created.id)

  if (!(await startSessionWithoutPassword(supabase, created.email))) {
    // Contul și legătura există: același link intră în el la reîncercare, fără un al doilea cont.
    await turnIntoReconnectLink(row.id, created.id)
    return errorResponse('signin_failed', 500)
  }

  return NextResponse.json({ success: true, redirect_to: await firstRouteForMember(row.tenant_id, created.id) })
}
