import { validateSameOriginMutation } from '@/lib/api/route-security'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { getTenantIdByUserIdOrNull } from '@/lib/tenant/get-tenant'

const GOOGLE_CONTACTS_TENANT_ID = '99485d6b-f186-49db-a379-bb9a12d34968'
const DEFAULT_APP_URL = 'https://www.zmeurel.ro'

type CronSyncResult = {
  synced: number
  skipped: number
  errors: number
  mode: 'full' | 'incremental'
}

export const runtime = 'nodejs'
export const maxDuration = 30

function isCronSyncResult(value: unknown): value is CronSyncResult {
  if (!value || typeof value !== 'object') return false

  const candidate = value as Partial<CronSyncResult>
  return (
    Number.isInteger(candidate.synced) &&
    Number.isInteger(candidate.skipped) &&
    Number.isInteger(candidate.errors) &&
    (candidate.mode === 'full' || candidate.mode === 'incremental')
  )
}

function getCronUrl(): URL {
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    DEFAULT_APP_URL

  return new URL('/api/cron/sync-google-contacts', baseUrl)
}

function syncUnavailableResponse() {
  return Response.json(
    { error: 'Sincronizarea a eșuat' },
    { status: 503 },
  )
}

export async function POST(request: Request): Promise<Response> {
  const requestedWith = request.headers.get('x-requested-with')
  if (requestedWith !== 'XMLHttpRequest') {
    const originError = validateSameOriginMutation(request)
    if (originError) return originError
  }

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return Response.json({ error: 'Neautorizat' }, { status: 401 })
  }

  const tenantId = await getTenantIdByUserIdOrNull(supabase, user.id)
  if (tenantId !== GOOGLE_CONTACTS_TENANT_ID) {
    return Response.json({ error: 'Interzis' }, { status: 403 })
  }

  const admin = createServiceRoleClient()
  const { data: integration, error: integrationError } = await admin
    .from('integrations_google_contacts')
    .select('sync_enabled')
    .eq('tenant_id', GOOGLE_CONTACTS_TENANT_ID)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (integrationError) return syncUnavailableResponse()
  if (!integration?.sync_enabled) {
    return Response.json(
      { error: 'Sincronizarea Google nu este activată' },
      { status: 400 },
    )
  }

  const cronSecret = process.env.CRON_SECRET?.trim()
  if (!cronSecret) return syncUnavailableResponse()

  try {
    const cronResponse = await fetch(getCronUrl(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${cronSecret}`,
      },
      cache: 'no-store',
    })
    const cronResult: unknown = await cronResponse.json().catch(() => null)

    if (!cronResponse.ok || !isCronSyncResult(cronResult)) {
      return syncUnavailableResponse()
    }

    const { data: refreshedIntegration, error: refreshError } = await admin
      .from('integrations_google_contacts')
      .select('last_sync_at')
      .eq('tenant_id', GOOGLE_CONTACTS_TENANT_ID)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (refreshError || !refreshedIntegration?.last_sync_at) {
      return syncUnavailableResponse()
    }

    return Response.json({
      ...cronResult,
      lastSyncAt: refreshedIntegration.last_sync_at,
    })
  } catch {
    return syncUnavailableResponse()
  }
}
