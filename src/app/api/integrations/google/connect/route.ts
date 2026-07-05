import { randomUUID } from 'node:crypto'

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { GOOGLE_CONTACTS_TENANT_ID } from '@/lib/integrations/google-contacts-sync'
import { GOOGLE_OAUTH_STATE_COOKIE } from '@/lib/integrations/google-oauth-state-cookie'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'

export const runtime = 'nodejs'

const GOOGLE_CONTACTS_SCOPE = 'https://www.googleapis.com/auth/contacts'

function getRequiredEnv(name: 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET') {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Lipsește variabila server-only ${name}.`)
  }
  return value
}

function resolveRedirectUri(origin: string): string {
  return process.env.GOOGLE_REDIRECT_URI?.trim() || `${origin}/api/integrations/google/callback`
}

function buildGoogleOauthUrl(redirectUri: string, state: string): string {
  const clientId = getRequiredEnv('GOOGLE_CLIENT_ID')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    scope: `openid email ${GOOGLE_CONTACTS_SCOPE}`,
    state,
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Neautorizat' }, { status: 401 })
  }

  const tenantId = await getTenantIdByUserIdOrNull(supabase, user.id)
  if (tenantId !== GOOGLE_CONTACTS_TENANT_ID) {
    return NextResponse.json({ error: 'Interzis' }, { status: 403 })
  }

  try {
    const url = new URL(request.url)
    const origin = process.env.APP_BASE_URL?.trim() || url.origin
    const redirectUri = resolveRedirectUri(origin)

    const state = randomUUID()
    const cookieStore = await cookies()
    cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, {
      httpOnly: true,
      sameSite: 'lax',
      secure: true,
      path: '/',
      maxAge: 600,
    })

    return NextResponse.redirect(buildGoogleOauthUrl(redirectUri, state))
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Configurare Google OAuth invalidă.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
