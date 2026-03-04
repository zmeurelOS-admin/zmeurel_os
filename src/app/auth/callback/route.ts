import * as Sentry from '@sentry/nextjs'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

type ServerSupabase = ReturnType<typeof createServerClient>
type CallbackUser = {
  id: string
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}

type TenantEnsureResult = {
  id: string
  created: boolean
}

function errorCode(error: unknown): string | null {
  return (error as { code?: string } | null)?.code ?? null
}

function errorStatus(error: unknown): number | null {
  return (error as { status?: number } | null)?.status ?? null
}

function errorDetails(error: unknown): string | null {
  return (error as { details?: string } | null)?.details ?? null
}

function errorHint(error: unknown): string | null {
  return (error as { hint?: string } | null)?.hint ?? null
}

function logInfo(step: string, payload: Record<string, unknown>) {
  console.info('[auth-callback]', step, payload)
}

function logError(step: string, payload: Record<string, unknown>) {
  console.error('[auth-callback]', step, payload)
}

function addBreadcrumb(step: string, payload: Record<string, unknown>) {
  Sentry.addBreadcrumb({
    category: 'auth.callback',
    level: 'info',
    message: step,
    data: payload,
  })
}

function captureException(error: unknown, payload: Record<string, unknown>) {
  Sentry.captureException(error, {
    tags: {
      module: 'auth-callback',
    },
    extra: payload,
  })
}

function normalizeBaseUrl(candidate: string | undefined, fallbackOrigin: string): string {
  const trimmed = candidate?.trim()
  if (!trimmed) return fallbackOrigin

  const noTrailingSlash = trimmed.replace(/\/+$/, '')
  try {
    return new URL(noTrailingSlash).origin
  } catch {
    try {
      return new URL(`https://${noTrailingSlash}`).origin
    } catch {
      return fallbackOrigin
    }
  }
}

function resolveBaseUrl(requestOrigin: string) {
  const configured =
    process.env.SITE_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ''

  const baseUrl = normalizeBaseUrl(configured, requestOrigin)
  const source = configured.trim().length > 0 ? 'env' : 'request_origin'
  return { baseUrl, source }
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

function toLoginErrorRedirect(baseUrl: string, errorValue: string) {
  return buildRedirect(baseUrl, '/login', { error: errorValue })
}

async function ensureTenantForUser(
  supabase: ServerSupabase,
  user: CallbackUser
): Promise<TenantEnsureResult> {
  const { data: existingTenant, error: existingTenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('owner_user_id', user.id)
    .maybeSingle()

  if (existingTenantError) {
    throw new Error(`[tenant] read failed: ${existingTenantError.message}`)
  }

  if (existingTenant?.id) {
    return {
      id: existingTenant.id,
      created: false,
    }
  }

  const farmNameRaw = user.user_metadata?.farm_name
  const farmName =
    typeof farmNameRaw === 'string' && farmNameRaw.trim().length > 0
      ? farmNameRaw.trim()
      : 'Ferma mea'

  const { data: insertedTenant, error: insertTenantError } = await supabase
    .from('tenants')
    .insert({
      nume_ferma: farmName,
      owner_user_id: user.id,
    })
    .select('id')
    .maybeSingle()

  if (insertTenantError) {
    if (errorCode(insertTenantError) === '23505') {
      const { data: concurrentTenant, error: concurrentReadError } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_user_id', user.id)
        .maybeSingle()

      if (concurrentReadError) {
        throw new Error(`[tenant] race read failed: ${concurrentReadError.message}`)
      }

      if (concurrentTenant?.id) {
        return {
          id: concurrentTenant.id,
          created: false,
        }
      }
    }

    throw new Error(`[tenant] insert failed: ${insertTenantError.message}`)
  }

  if (!insertedTenant?.id) {
    throw new Error('[tenant] insert returned null tenant id')
  }

  return {
    id: insertedTenant.id,
    created: true,
  }
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
  let tenant: TenantEnsureResult

  try {
    tenant = await ensureTenantForUser(supabase, user)
    logInfo('tenant.ensure_success', {
      userId: user.id,
      tenantId: tenant.id,
      created: tenant.created,
    })
  } catch (error) {
    logError('tenant.ensure_failed', {
      userId: user.id,
      message: (error as Error).message,
    })
    captureException(error, {
      step: 'tenant.ensure',
      userId: user.id,
    })
    return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'tenant_create_failed'))
  }

  if (!tenant.id) {
    logError('tenant.missing_id', {
      userId: user.id,
    })
    return NextResponse.redirect(toLoginErrorRedirect(baseUrl, 'tenant_create_failed'))
  }

  return null
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const { searchParams } = requestUrl
  const tokenHash = searchParams.get('token_hash')
  const code = searchParams.get('code')
  const type = searchParams.get('type')
  const nextParam = searchParams.get('next')
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

      if (user && (type === 'email' || type === 'signup')) {
        const onboardingRedirect = await completeOnboardingForUser(supabase, user, baseUrl)
        if (onboardingRedirect) return onboardingRedirect
      }

      if (type === 'recovery') {
        const recoveryRedirect = buildRedirect(baseUrl, '/update-password')
        logInfo('redirect.final', {
          target: recoveryRedirect,
          reason: 'recovery',
        })
        return NextResponse.redirect(recoveryRedirect)
      }

      const otpTarget = buildRedirect(baseUrl, safeNext ?? '/dashboard')
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

      const onboardingRedirect = await completeOnboardingForUser(supabase, user, baseUrl)
      if (onboardingRedirect) return onboardingRedirect

      const oauthTarget = buildRedirect(baseUrl, safeNext ?? '/dashboard')
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
