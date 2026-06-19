import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import {
  FARM_MEMBER_ACCESS_LEVELS,
  FARM_MEMBER_MODULES,
  normalizeFarmMemberAccess,
} from '@/lib/farm-members/access'
import { getFarmOwnerContext } from '@/lib/farm-members/owner-auth'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const moduleSchema = z.object({
  module: z.enum(FARM_MEMBER_MODULES),
  level: z.enum(FARM_MEMBER_ACCESS_LEVELS),
})

const bodySchema = z.object({
  modules: z.array(moduleSchema).min(1),
})

type RouteContext = {
  params: Promise<{ id: string }>
}

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
}

export async function PATCH(request: Request, context: RouteContext) {
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
    return errorResponse('invalid_modules', 400)
  }

  const modules = normalizeFarmMemberAccess(parsed.data.modules)
  if (modules.length === 0) {
    return errorResponse('invalid_modules', 400)
  }

  const { id } = await context.params
  const admin = getSupabaseAdmin()
  const { data: member, error: memberError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .select('id, role')
    .eq('id', id)
    .eq('tenant_id', owner.tenantId)
    .eq('is_active', true)
    .maybeSingle()

  if (memberError) {
    return errorResponse('lookup_failed', 500)
  }

  if (!member) {
    return errorResponse('not_found', 404)
  }

  if ((member as { role?: string }).role !== 'operator') {
    return errorResponse('not_operator', 400)
  }

  const { error: updateError } = await admin
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .from('farm_members' as any)
    .update({ modules_access: modules })
    .eq('id', id)
    .eq('tenant_id', owner.tenantId)

  if (updateError) {
    return errorResponse('update_failed', 500)
  }

  return NextResponse.json({ success: true, modules })
}
