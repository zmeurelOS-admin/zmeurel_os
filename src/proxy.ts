import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { buildLoginUrl } from '@/lib/auth/redirects'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'
import type { Database } from '@/types/supabase'

function clearStaleSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  const authCookieRegex = /^sb-.*-auth-token(?:\.\d+)?$/
  const codeVerifierRegex = /^sb-.*-auth-token-code-verifier$/

  request.cookies.getAll().forEach(({ name }) => {
    if (!authCookieRegex.test(name) && !codeVerifierRegex.test(name)) {
      return
    }

    request.cookies.delete(name)
    response.cookies.delete(name)
  })
}

function redirectTo(request: NextRequest, pathname: string) {
  const redirectUrl = request.nextUrl.clone()
  redirectUrl.pathname = pathname
  redirectUrl.search = ''
  return NextResponse.redirect(redirectUrl)
}

function redirectToLogin(request: NextRequest) {
  const next = `${request.nextUrl.pathname}${request.nextUrl.search}`
  return NextResponse.redirect(new URL(buildLoginUrl({ next }), request.url))
}

export async function proxy(request: NextRequest) {
  const requestHeaders = new Headers(request.headers)

  let supabaseResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request: {
              headers: requestHeaders,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { pathname } = request.nextUrl

  const isApiRoute = pathname.startsWith('/api/')
  const isPublicAssetRoute =
    pathname === '/manifest.webmanifest' ||
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/service-worker.js' ||
    pathname === '/favicon.ico' ||
    pathname.startsWith('/icons/')

  // Public routes that should NOT require authentication
  const isPublicRoute =
    pathname === '/' ||
    pathname === '/start' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/termeni' ||
    pathname === '/confidentialitate' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/reset-password') ||
    pathname.startsWith('/update-password') ||
    pathname === '/api/auth/beta-signup' ||
    pathname === '/api/auth/beta-guest' ||
    pathname.startsWith('/api/cron/') ||
    isPublicAssetRoute

  const isAuthCallbackRoute =
    pathname === '/auth/callback' ||
    pathname === '/auth/callback/'

  // Never touch auth cookies on callback routes; PKCE exchange depends on code_verifier.
  if (isAuthCallbackRoute) {
    return supabaseResponse
  }

  // Get the current user session
  let user = null
  let authErrorCode: string | null = null

  try {
    const {
      data: { user: currentUser },
      error,
    } = await supabase.auth.getUser()

    user = currentUser
    authErrorCode = (error as { code?: string } | null)?.code ?? null
  } catch (error) {
    authErrorCode = (error as { code?: string } | null)?.code ?? null
  }

  if (authErrorCode === 'refresh_token_not_found') {
    clearStaleSupabaseAuthCookies(request, supabaseResponse)
    user = null
  }

  // If user is NOT authenticated
  if (!user) {
    // Allow access to public routes
    if (isPublicRoute) {
      return supabaseResponse
    }

    // Redirect to login for protected routes
    return redirectToLogin(request)
  }

  // Landing is always visible, even for authenticated users.
  if (pathname === '/') {
    return supabaseResponse
  }

  const needsTenantGuard =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname === '/reset-password-request' ||
    pathname === '/start' ||
    (!isPublicRoute && !isApiRoute)

  if (!needsTenantGuard) {
    return supabaseResponse
  }

  let tenantId: string | null = null

  try {
    tenantId = await getTenantIdByUserIdOrNull(supabase, user.id)
  } catch (error) {
    console.error('[proxy] tenant lookup failed', {
      pathname,
      userId: user.id,
      message: error instanceof Error ? error.message : 'unknown',
    })
    return supabaseResponse
  }

  requestHeaders.set('x-zmeurel-user-id', user.id)
  if (user.email) {
    requestHeaders.set('x-zmeurel-user-email', user.email)
  } else {
    requestHeaders.delete('x-zmeurel-user-email')
  }

  if (tenantId) {
    requestHeaders.set('x-zmeurel-tenant-id', tenantId)
  } else {
    requestHeaders.delete('x-zmeurel-tenant-id')
  }

  if (pathname === '/login' || pathname === '/register' || pathname === '/reset-password-request') {
    return redirectTo(request, tenantId ? '/dashboard' : '/start')
  }

  if (pathname === '/start') {
    return supabaseResponse
  }

  if (!tenantId && !isPublicRoute && !isApiRoute) {
    return redirectTo(request, '/start')
  }

  // User is authenticated, allow access to protected routes
  return supabaseResponse
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest + service worker assets
     * - icons directory
     * - public files (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest\\.webmanifest|manifest\\.json|sw\\.js|service-worker\\.js|icons/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
