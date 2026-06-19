import { NextResponse } from 'next/server'
import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { acceptFarmInviteForUser, validateFarmInviteToken } from '@/lib/farm-members/invite-accept'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

const bodySchema = z.object({
  token: z.string().trim().uuid(),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8),
})

function errorResponse(error: string, status = 400) {
  return NextResponse.json({ success: false, error }, { status })
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

  const invite = await validateFarmInviteToken(parsed.data.token)
  if (!invite.valid) {
    return errorResponse(invite.reason, invite.reason === 'expired' || invite.reason === 'used' ? 410 : 400)
  }

  const admin = createServiceRoleClient()
  const email = parsed.data.email.toLowerCase()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: parsed.data.password,
    email_confirm: true,
    user_metadata: {
      full_name: parsed.data.name,
      invite_operator: true,
    },
  })

  if (error) {
    const message = (error.message ?? '').toLowerCase()
    if (message.includes('already')) {
      return errorResponse('email_already_registered', 409)
    }
    return errorResponse('signup_failed', 400)
  }

  if (!data.user?.id) {
    return errorResponse('signup_failed', 500)
  }

  const accepted = await acceptFarmInviteForUser({
    token: parsed.data.token,
    userId: data.user.id,
    name: parsed.data.name,
  })

  if (!accepted.ok) {
    return errorResponse(accepted.error, accepted.error === 'expired' || accepted.error === 'used' ? 410 : 400)
  }

  const supabase = await createClient()
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password: parsed.data.password,
  })

  if (signInError) {
    return errorResponse('signin_failed', 500)
  }

  return NextResponse.json({
    success: true,
    redirect_to: accepted.redirectTo,
  })
}
