import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import {
  FARM_MEMBER_ACCESS_LEVELS,
  FARM_MEMBER_MODULES,
  normalizeFarmMemberAccess,
  toStoredFarmMemberAccess,
} from '@/lib/farm-members/access'
import { farmOperatorInviteUrl, getFarmOwnerContext } from '@/lib/farm-members/owner-auth'
import { isMissingColumnError } from '@/lib/farm-members/operator-link-server'
import { getSupabaseAdmin } from '@/lib/supabase/admin'

const moduleSchema = z.object({
  module: z.enum(FARM_MEMBER_MODULES),
  level: z.enum(FARM_MEMBER_ACCESS_LEVELS),
})

const bodySchema = z.object({
  modules: z.array(moduleSchema).min(1),
  /** Numele omului (contul ascuns îl primește ca `full_name`; ferma îl vede în Echipa). */
  name: z.string().trim().min(2).max(80).optional(),
  phone: z.string().trim().max(40).optional(),
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
    return errorResponse('invalid_modules', 400)
  }

  const modules = normalizeFarmMemberAccess(parsed.data.modules)
  if (modules.length === 0) {
    return errorResponse('invalid_modules', 400)
  }

  const token = crypto.randomUUID()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const admin = getSupabaseAdmin()

  const base = {
    tenant_id: owner.tenantId,
    token,
    modules_access: toStoredFarmMemberAccess(modules),
    created_by: owner.userId,
    expires_at: expiresAt,
  }
  const invitee = {
    invitee_name: parsed.data.name?.replace(/\s+/g, ' ') || null,
    invitee_phone: parsed.data.phone || null,
  }
  const insert = (row: Record<string, unknown>) =>
    admin
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .from('farm_invites' as any)
      .insert(row)
      .select('id')
      .single()

  let { data, error } = await insert({ ...base, ...invitee })
  // Fără migrarea `20261121200000` (coloanele `invitee_*`), invitația pleacă fără nume: contul se numește „Operator”.
  if (error && isMissingColumnError(error)) {
    ;({ data, error } = await insert(base))
  }

  if (error || !(data as { id?: string } | null)?.id) {
    return errorResponse('insert_failed', 500)
  }

  return NextResponse.json({
    success: true,
    invite_url: farmOperatorInviteUrl(token),
    expires_at: expiresAt,
  })
}
