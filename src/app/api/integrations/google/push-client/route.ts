import { z } from 'zod'

import { validateSameOriginMutation } from '@/lib/api/route-security'
import { pushClientToGoogle } from '@/lib/integrations/google-contacts-push'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'

const requestSchema = z
  .object({
    clientId: z.string().uuid(),
    tenantId: z.string().uuid(),
  })
  .strict()

export const maxDuration = 10

export async function POST(request: Request): Promise<Response> {
  const originError = validateSameOriginMutation(request)
  if (originError) return originError

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ ok: false, error: 'Neautorizat' }, { status: 401 })
  }

  const parsedBody = requestSchema.safeParse(
    await request.json().catch(() => null),
  )
  if (!parsedBody.success) {
    return Response.json(
      { ok: false, error: 'Payload invalid' },
      { status: 400 },
    )
  }

  const effectiveTenantId = await getTenantIdByUserIdOrNull(supabase, user.id)
  if (!effectiveTenantId || effectiveTenantId !== parsedBody.data.tenantId) {
    return Response.json({ ok: false, error: 'Interzis' }, { status: 403 })
  }

  await pushClientToGoogle(
    parsedBody.data.clientId,
    parsedBody.data.tenantId,
  )

  return Response.json({ ok: true })
}
