import { OAuth2Client } from 'google-auth-library'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

import { GOOGLE_CONTACTS_TENANT_ID } from '@/lib/integrations/google-contacts-sync'
import { GOOGLE_OAUTH_STATE_COOKIE } from '@/lib/integrations/google-oauth-state-cookie'
import { encryptTokenSecret } from '@/lib/integrations/token-secret-crypto'
import { captureApiError } from '@/lib/monitoring/report-error'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'

export const runtime = 'nodejs'

const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

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

async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  try {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
    if (!response.ok) return null

    const data = (await response.json()) as { email?: string }
    return data.email?.trim().toLowerCase() || null
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const origin = process.env.APP_BASE_URL?.trim() || url.origin
  const oauthError = url.searchParams.get('error')
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')

  if (oauthError) {
    return NextResponse.redirect(`${origin}/clienti?google_contacts=error_denied`)
  }

  if (!code || !state) {
    return NextResponse.redirect(`${origin}/clienti?google_contacts=error_missing_code`)
  }

  const cookieStore = await cookies()
  const savedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value
  cookieStore.delete(GOOGLE_OAUTH_STATE_COOKIE)

  if (!savedState || savedState !== state) {
    return NextResponse.redirect(`${origin}/clienti?google_contacts=error_state`)
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.redirect(`${origin}/login`)
  }

  const tenantId = await getTenantIdByUserIdOrNull(supabase, user.id)
  if (tenantId !== GOOGLE_CONTACTS_TENANT_ID) {
    return NextResponse.redirect(`${origin}/clienti?google_contacts=error_forbidden`)
  }

  try {
    const oauth2Client = new OAuth2Client(
      getRequiredEnv('GOOGLE_CLIENT_ID'),
      getRequiredEnv('GOOGLE_CLIENT_SECRET'),
      resolveRedirectUri(origin),
    )

    const { tokens } = await oauth2Client.getToken(code)
    if (!tokens.refresh_token) {
      return NextResponse.redirect(`${origin}/clienti?google_contacts=error_no_refresh_token`)
    }

    const connectedEmail = tokens.access_token
      ? await fetchGoogleUserEmail(tokens.access_token)
      : null

    const admin = createServiceRoleClient()
    const { error: upsertError } = await admin
      .from('integrations_google_contacts')
      .upsert(
        {
          tenant_id: tenantId,
          user_id: user.id,
          user_email: user.email ?? '',
          connected_email: connectedEmail,
          refresh_token: encryptTokenSecret(tokens.refresh_token),
          token_expires_at: tokens.expiry_date
            ? new Date(tokens.expiry_date).toISOString()
            : null,
          scope: tokens.scope ?? null,
          sync_token: null,
          sync_enabled: true,
        },
        { onConflict: 'user_id' },
      )

    if (upsertError) {
      throw upsertError
    }

    return NextResponse.redirect(`${origin}/clienti?google_contacts=connected`)
  } catch (error) {
    captureApiError(error, {
      route: '/api/integrations/google/callback',
      tenantId,
    })
    return NextResponse.redirect(`${origin}/clienti?google_contacts=error`)
  }
}
