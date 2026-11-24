import type { SupabaseClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

import { RUTA_FERMA_NOUA, esteFermaNoua } from '@/lib/auth/cont-nou'
import { DEFAULT_APP_URL, originValida, primaOrigineValida } from '@/lib/brand'
import { ensureTenantForUser, normalizeFarmName } from '@/lib/auth/ensure-tenant'
import { acceptFarmInviteForUser } from '@/lib/farm-members/invite-accept'
import { sanitizeForLog, toSafeErrorContext } from '@/lib/logging/redaction'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'
import type { Database } from '@/types/supabase'

type ServerSupabase = ReturnType<typeof createServerClient>
type CallbackUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

function asDbClient(client: ServerSupabase): SupabaseClient<Database> {
  return client as unknown as SupabaseClient<Database>
}

function errorCode(error: unknown): string | null {
  return (error as { code?: string } | null)?.code ?? null
}

function errorStatus(error: unknown): number | null {
  return (error as { status?: number } | null)?.status ?? null
}

function logInfo(step: string, payload: Record<string, unknown>) {
  void step
  void payload
}

function logError(step: string, payload: Record<string, unknown>) {
  console.error('[auth-callback]', {
    step,
    payload: sanitizeForLog(payload, { redactTextFields: true }),
  })
}

function addBreadcrumb(step: string, payload: Record<string, unknown>) {
  void step
  void payload
}

function captureException(error: unknown, payload: Record<string, unknown>) {
  const tenantId =
    (typeof payload.tenantId === 'string' && payload.tenantId) ||
    (typeof payload.tenant_id === 'string' && payload.tenant_id) ||
    null

  console.error('[auth-callback] exception', {
    error: toSafeErrorContext(error),
    context: sanitizeForLog(
      {
        module: 'auth-callback',
        tenant_id: tenantId,
        extra: payload,
      },
      { redactTextFields: true },
    ),
  })
}



/**
 * Unde întoarcem omul după login: `SITE_URL`, apoi `NEXT_PUBLIC_SITE_URL`, dacă trec regula din `originValida`
 * (promptul 33); altfel originea cererii, dacă trece și ea; altfel adresa platformei.
 */
function resolveBaseUrl(requestOrigin: string) {
  const configured = primaOrigineValida([process.env.SITE_URL, process.env.NEXT_PUBLIC_SITE_URL])
  if (configured) return { baseUrl: configured, source: 'env' }
  return { baseUrl: originValida(requestOrigin) ?? DEFAULT_APP_URL, source: 'request_origin' }
}

function safeNextPath(nextParam: string | null): string | null {
  if (!nextParam) return null
  if (!nextParam.startsWith('/')) return null
  if (nextParam.startsWith('//')) return null
  return nextParam
}

function buildRedirect(baseUrl: string, path: string, query?: Record<string, string>) {
  const target = new URL(path, baseUrl)
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      target.searchParams.set(key, value)
    }
  }
  return target.toString()
}

function buildInviteDisplayName(user: CallbackUser): string {
  const metadataName =
    typeof user.user_metadata?.full_name === 'string'
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === 'string'
        ? user.user_metadata.name
        : null
  return (metadataName?.trim() || user.email || 'Operator').slice(0, 120)
}

function toLoginErrorRedirect(baseUrl: string, errorValue: string) {
  return buildRedirect(baseUrl, '/login', { error: errorValue })
}

async function buildSupabaseClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )
}

async function completeOnboardingForUser(
  supabase: ServerSupabase,
  user: CallbackUser,
  baseUrl: string
) {
  let tenantId: string | null

  try {
    tenantId = await ensureTenantForUser({
      supabase: asDbClient(supabase),
      userId: user.id,
      fallbackFarmName: normalizeFarmName(
        typeof user.user_metadata?.farm_name === 'string'
          ? user.user_metadata.farm_name
          : typeof user.user_metadata?.full_name === 'string'
            ? `${user.user_metadata.full_name}'s Farm`
            : null
      ),
    })
    logInfo('tenant.assignment_resolved', {
      userId: user.id,
      tenantId,
    })
  } catch (error) {
    logError('tenant.assignment_failed', {
      userId: user.id,
      message: (error as Error).message,
    })
    captureException(error, {
      step: 'tenant.assignment',
      userId: user.id,
    })
    return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'tenant_lookup_failed'))
  }

  if (!tenantId) {
    logError('tenant.missing_after_repair', {
      userId: user.id,
    })
    return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'tenant_lookup_failed'))
  }

  return null
}

/** Ferma creată acum câteva minute, încă fără localitate. La orice eroare: nu (intră direct în aplicație). */
async function fermaTocmaiCreata(supabase: ServerSupabase, tenantId: string): Promise<boolean> {
  try {
    const { data } = await asDbClient(supabase).from('tenants').select('created_at, localitate').eq('id', tenantId).maybeSingle()
    return data ? esteFermaNoua(data) : false
  } catch {
    return false
  }
}

async function resolvePostLoginPath(
  supabase: ServerSupabase,
  userId: string,
  safeNext: string | null,
  resolvedTenantId?: string | null
): Promise<string> {
  if (safeNext && safeNext !== '/dashboard' && safeNext !== '/start') return safeNext

  if (resolvedTenantId !== undefined) {
    // Contul nou (Google, prima intrare): întâi întrebarea cu numele și locul fermei (promptul 31).
    if (resolvedTenantId && (await fermaTocmaiCreata(supabase, resolvedTenantId))) return RUTA_FERMA_NOUA
    return '/dashboard'
  }

  try {
    await getTenantIdByUserIdOrNull(asDbClient(supabase), userId)
    return '/dashboard'
  } catch (error) {
    const message = error instanceof Error ? error.message : 'unknown'
    throw new Error(`[tenant] read for redirect failed: ${message}`)
  }
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const { searchParams } = requestUrl
  const tokenHash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const nextParam = searchParams.get('next')
  const inviteToken = searchParams.get('invite_token')
  const oauthError = searchParams.get('error')
  const oauthErrorCode = searchParams.get('error_code')
  const oauthErrorDescription = searchParams.get('error_description')
  const safeNext = safeNextPath(nextParam)
  const { baseUrl, source: baseUrlSource } = resolveBaseUrl(requestUrl.origin)

  const requestSummary = {
    callbackUrl: `${requestUrl.origin}${requestUrl.pathname}`,
    queryKeys: Array.from(searchParams.keys()),
    hasCode: Boolean(code),
    hasTokenHash: Boolean(tokenHash),
    hasOAuthErrorParams: Boolean(oauthError || oauthErrorCode || oauthErrorDescription),
    type: type ?? null,
    next: safeNext ?? null,
    redirectBaseUrl: baseUrl,
    redirectBaseSource: baseUrlSource,
  }

  logInfo('start', requestSummary)
  addBreadcrumb('start', requestSummary)

  // Historically, thrown onboarding errors bubbled from this route and produced HTTP 500.
  // This handler now converts all expected onboarding failures to explicit redirects.
  try {
    if (oauthError || oauthErrorCode) {
      logError('provider_error', {
        oauthError: oauthError ?? null,
        oauthErrorCode: oauthErrorCode ?? null,
        hasErrorDescription: Boolean(oauthErrorDescription),
      })
      return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'oauth_provider_error'))
    }

    const supabase = await buildSupabaseClient()

    if (tokenHash && type) {
      logInfo('verify_otp.start', {
        type,
        hasTokenHash: true,
      })

      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as 'recovery' | 'email' | 'signup',
      })

      if (error) {
        logError('verify_otp.failed', {
          type,
          message: error.message,
          code: errorCode(error),
          status: errorStatus(error),
        })
        return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'verify_otp_failed'))
      }

      logInfo('verify_otp.success', { type })

      const {
        data: { user },
      } = await supabase.auth.getUser()

      logInfo('user.loaded_after_verify_otp', {
        hasUser: Boolean(user),
        userId: user?.id ?? null,
        email: user?.email ?? null,
      })

      let resolvedTenantId: string | null = null
      if (user && (type === 'email' || type === 'signup')) {
        if (inviteToken) {
          const accepted = await acceptFarmInviteForUser({
            token: inviteToken,
            userId: user.id,
            name: buildInviteDisplayName(user),
          })
          if (!accepted.ok) {
            return NextResponse.redirect(buildRedirect(baseUrl, `/invite/${encodeURIComponent(inviteToken)}`))
          }
          return NextResponse.redirect(buildRedirect(baseUrl, accepted.redirectTo))
        }
        const onboardingRedirect = await completeOnboardingForUser(supabase, user, baseUrl)
        if (onboardingRedirect) return onboardingRedirect
        resolvedTenantId = await getTenantIdByUserIdOrNull(asDbClient(supabase), user.id)
      }

      if (type === 'recovery') {
        const recoveryRedirect = buildRedirect(baseUrl, '/update-password')
        logInfo('redirect.final', {
          target: recoveryRedirect,
          reason: 'recovery',
        })
        return NextResponse.redirect(recoveryRedirect)
      }

      const otpPath = user
        ? await resolvePostLoginPath(supabase, user.id, safeNext, resolvedTenantId)
        : safeNext ?? '/dashboard'
      const otpTarget = buildRedirect(baseUrl, otpPath)
      logInfo('redirect.final', {
        target: otpTarget,
        reason: 'verify_otp',
      })
      return NextResponse.redirect(otpTarget)
    }

    if (code) {
      logInfo('exchange.start', {
        hasCode: true,
      })

      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (error) {
        logError('exchange.failed', {
          message: error.message,
          code: errorCode(error),
          status: errorStatus(error),
        })
        return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'oauth_callback_failed'))
      }

      logInfo('exchange.success', {
        hasCode: true,
      })

      const {
        data: { user },
      } = await supabase.auth.getUser()

      logInfo('user.loaded_after_exchange', {
        hasUser: Boolean(user),
        userId: user?.id ?? null,
        email: user?.email ?? null,
      })

      if (!user) {
        logError('exchange.user_missing', {
          hasUser: false,
        })
        return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'oauth_callback_failed'))
      }

      if (inviteToken) {
        const accepted = await acceptFarmInviteForUser({
          token: inviteToken,
          userId: user.id,
          name: buildInviteDisplayName(user),
        })
        if (!accepted.ok) {
          return NextResponse.redirect(buildRedirect(baseUrl, `/invite/${encodeURIComponent(inviteToken)}`))
        }
        const inviteTarget = buildRedirect(baseUrl, accepted.redirectTo)
        logInfo('redirect.final', {
          target: inviteTarget,
          reason: 'invite_oauth_code_flow',
        })
        return NextResponse.redirect(inviteTarget)
      }

      const onboardingRedirect = await completeOnboardingForUser(supabase, user, baseUrl)
      if (onboardingRedirect) return onboardingRedirect

      const resolvedTenantId = await getTenantIdByUserIdOrNull(asDbClient(supabase), user.id)
      const oauthPath = await resolvePostLoginPath(supabase, user.id, safeNext, resolvedTenantId)
      const oauthTarget = buildRedirect(baseUrl, oauthPath)
      logInfo('redirect.final', {
        target: oauthTarget,
        reason: 'oauth_code_flow',
      })
      return NextResponse.redirect(oauthTarget)
    }

    logError('missing_callback_params', {
      hasCode: Boolean(code),
      hasTokenHash: Boolean(tokenHash),
      type: type ?? null,
    })
    return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'missing_callback_params'))
  } catch (error) {
    logError('unhandled', {
      message: (error as Error).message,
      code: errorCode(error),
      status: errorStatus(error),
    })
    captureException(error, {
      step: 'unhandled',
      callbackUrl: `${requestUrl.origin}${requestUrl.pathname}`,
    })
    return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'oauth_callback_failed'))
  }
}

export async function POST(request: NextRequest) {
  return GET(request)
}
