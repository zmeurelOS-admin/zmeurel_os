import { createClient as createSupabaseClient } from '@supabase/supabase-js'

import { apiError, validateSameOriginMutation } from '@/lib/api/route-security'
import {
  destructiveActionScopes,
  isDestructiveActionScope,
  type DestructiveActionScope,
} from '@/lib/auth/destructive-action-step-up-contract'
import { issueDestructiveActionStepUpToken } from '@/lib/auth/destructive-action-step-up'
import { extractClientIpFromHeaders } from '@/lib/api/public-write-guard'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

function createPublicAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('SUPABASE_AUTH_CONFIG_MISSING')
  }

  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}

async function verifyPassword(email: string, password: string) {
  const client = createPublicAuthClient()
  const { data, error } = await client.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !data.session) {
    return false
  }

  await client.auth.signOut()
  return true
}

function readBody(payload: unknown): { password: string; scope: DestructiveActionScope } | null {
  if (!payload || typeof payload !== 'object') return null
  const candidate = payload as { password?: unknown; scope?: unknown }
  const password = typeof candidate.password === 'string' ? candidate.password : ''
  const scope = candidate.scope
  if (!isDestructiveActionScope(scope)) return null
  return { password, scope }
}

export async function POST(request: Request) {
  try {
    const invalidOriginResponse = validateSameOriginMutation(request)
    if (invalidOriginResponse) return invalidOriginResponse

    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user?.id || !user.email) {
      return apiError(401, 'UNAUTHORIZED', 'Trebuie să fii autentificat.')
    }

    const ip = extractClientIpFromHeaders(request.headers)
    const attemptKey = `${user.id}:${ip}`
    if (!checkRateLimit(attemptKey, 8, 5 * 60_000)) {
      return apiError(429, 'TOO_MANY_ATTEMPTS', 'Prea multe încercări. Încearcă din nou în câteva minute.')
    }

    const parsed = readBody(await request.json().catch(() => null))
    if (!parsed) {
      return apiError(400, 'INVALID_BODY', 'Datele trimise sunt invalide.')
    }

    if (parsed.password.trim().length < 8) {
      return apiError(401, 'STEP_UP_FAILED', 'Confirmarea suplimentară a eșuat.')
    }

    const passwordOk = await verifyPassword(user.email, parsed.password)
    if (!passwordOk) {
      return apiError(401, 'STEP_UP_FAILED', 'Confirmarea suplimentară a eșuat.')
    }

    const issued = issueDestructiveActionStepUpToken({
      userId: user.id,
      scope: parsed.scope,
    })

    if (!issued) {
      return apiError(503, 'STEP_UP_UNAVAILABLE', 'Confirmarea suplimentară nu este disponibilă momentan.')
    }

    return Response.json({
      ok: true,
      scope: parsed.scope,
      stepUpToken: issued.token,
      expiresInSeconds: Math.max(1, Math.ceil((issued.expiresAt - Date.now()) / 1000)),
      availableScopes: Object.values(destructiveActionScopes),
    })
  } catch {
    return apiError(500, 'INTERNAL_ERROR', 'Nu am putut valida confirmarea suplimentară.')
  }
}
