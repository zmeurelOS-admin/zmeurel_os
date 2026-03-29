import * as Sentry from '@sentry/nextjs'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Tables, TablesInsert, TablesUpdate } from '@/types/supabase'
import { buildAnalyticsPayload } from '@/lib/analytics/schema'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_PEOPLE_API_URL = 'https://people.googleapis.com/v1/people/me/connections'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'

type GoogleIntegrationRow = Tables<'integrations_google_contacts'>
type ClientRow = Tables<'clienti'>

interface GoogleApiPerson {
  resourceName?: string
  etag?: string
  names?: Array<{ displayName?: string }>
  emailAddresses?: Array<{ value?: string }>
  phoneNumbers?: Array<{ value?: string }>
  biographies?: Array<{ value?: string }>
}

interface GoogleConnectionsResponse {
  connections?: GoogleApiPerson[]
  nextPageToken?: string
  nextSyncToken?: string
}

interface GoogleTokenResponse {
  access_token: string
  expires_in?: number
  scope?: string
  token_type?: string
  refresh_token?: string
}

interface SyncCounters {
  contacts_fetched: number
  clients_upserted: number
  clients_inserted: number
  clients_updated: number
}

export interface SyncContactsResult extends SyncCounters {
  sync_token: string | null
  last_sync_at: string
  full_sync: boolean
}

interface FetchContactsPagedInput {
  accessToken: string
  syncToken?: string | null
  fullSync?: boolean
}

interface FetchContactsPagedResult {
  contacts: GoogleApiPerson[]
  nextSyncToken: string | null
  fullSync: boolean
}

interface SyncContactsInput {
  supabase: SupabaseClient<Database>
  integration: GoogleIntegrationRow
  forceFullSync?: boolean
}

interface RefreshAccessTokenInput {
  supabase: SupabaseClient<Database>
  integration: GoogleIntegrationRow
}

function parseJwtExpiry(accessToken?: string | null): Date | null {
  if (!accessToken) return null
  const parts = accessToken.split('.')
  if (parts.length < 2) return null

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8')) as { exp?: number }
    if (!payload.exp) return null
    return new Date(payload.exp * 1000)
  } catch {
    return null
  }
}

function normalizeEmail(value?: string | null): string | null {
  if (!value) return null
  const normalized = value.trim().toLowerCase()
  return normalized.length > 0 ? normalized : null
}

function normalizePhone(value?: string | null): string | null {
  if (!value) return null
  let normalized = value.replace(/[^\d+]/g, '')
  if (normalized.startsWith('00')) {
    normalized = `+${normalized.slice(2)}`
  }
  if (!normalized.startsWith('+') && normalized.startsWith('0')) {
    normalized = `+4${normalized}`
  }
  if (!normalized.startsWith('+') && normalized.length > 0) {
    normalized = `+${normalized}`
  }
  return normalized.length > 1 ? normalized : null
}

function selectPrimaryContact(person: GoogleApiPerson) {
  const name = person.names?.[0]?.displayName?.trim() || 'Contact Google'
  const email = normalizeEmail(person.emailAddresses?.[0]?.value)
  const phone = normalizePhone(person.phoneNumbers?.[0]?.value)
  const notes = person.biographies?.[0]?.value?.trim() || null

  return { name, email, phone, notes }
}

async function trackIntegrationEvent(
  supabase: SupabaseClient<Database>,
  payload: {
    tenantId: string
    userId: string
    event: string
    metadata?: Record<string, unknown>
  }
) {
  const { tenantId, userId, event, metadata = {} } = payload
  await supabase.from('analytics_events').insert({
    tenant_id: tenantId,
    user_id: userId,
    event_name: event,
    module: 'integrations',
    event_data: buildAnalyticsPayload(metadata),
  })
}

async function fetchGoogleUserEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) return null
  const data = (await response.json()) as { email?: string }
  return normalizeEmail(data.email)
}

export async function refreshAccessTokenIfNeeded({
  supabase,
  integration,
}: RefreshAccessTokenInput): Promise<GoogleIntegrationRow> {
  const now = new Date()
  const expiry = integration.token_expires_at ? new Date(integration.token_expires_at) : parseJwtExpiry(integration.access_token)
  const tokenIsValid = integration.access_token && expiry && expiry.getTime() - now.getTime() > 60_000

  if (tokenIsValid) {
    return integration
  }

  if (!integration.refresh_token) {
    throw new Error('Google refresh token missing')
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('Google OAuth environment variables are missing')
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: integration.refresh_token,
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google refresh token failed: ${body}`)
  }

  const tokenData = (await response.json()) as GoogleTokenResponse
  const tokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : integration.token_expires_at

  const { data, error } = await supabase
    .from('integrations_google_contacts')
    .update({
      access_token: tokenData.access_token,
      token_expires_at: tokenExpiresAt,
      scope: tokenData.scope ?? integration.scope,
      updated_at: new Date().toISOString(),
    })
    .eq('id', integration.id)
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function fetchContactsPaged({
  accessToken,
  syncToken,
  fullSync = false,
}: FetchContactsPagedInput): Promise<FetchContactsPagedResult> {
  const contacts: GoogleApiPerson[] = []
  let pageToken: string | undefined
  let nextSyncToken: string | null = null

  while (true) {
    const params = new URLSearchParams({
      personFields: 'names,emailAddresses,phoneNumbers,biographies',
      pageSize: '500',
    })

    if (pageToken) params.set('pageToken', pageToken)
    if (syncToken && !fullSync) {
      params.set('syncToken', syncToken)
    }
    if (fullSync) {
      params.set('requestSyncToken', 'true')
    }

    const response = await fetch(`${GOOGLE_PEOPLE_API_URL}?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      if (response.status === 410 || errorText.toLowerCase().includes('synctoken')) {
        const error = new Error('Google sync token expired')
        ;(error as { code?: string }).code = 'SYNC_TOKEN_EXPIRED'
        throw error
      }
      throw new Error(`Google contacts fetch failed: ${errorText}`)
    }

    const data = (await response.json()) as GoogleConnectionsResponse
    if (data.connections?.length) {
      contacts.push(...data.connections)
    }

    if (data.nextSyncToken) {
      nextSyncToken = data.nextSyncToken
    }

    if (!data.nextPageToken) break
    pageToken = data.nextPageToken
  }

  return {
    contacts,
    nextSyncToken,
    fullSync,
  }
}

async function createClientIdGenerator(
  supabase: SupabaseClient<Database>,
  tenantId: string
): Promise<() => string> {
  const { data, error } = await supabase
    .from('clienti')
    .select('id_client')
    .eq('tenant_id', tenantId)

  if (error) throw error

  const maxNumeric = (data ?? [])
    .map((row) => row.id_client)
    .filter((id): id is string => typeof id === 'string' && /^C\d+$/.test(id))
    .map((id) => Number.parseInt(id.slice(1), 10))
    .reduce((max, value) => (value > max ? value : max), 0)

  let cursor = maxNumeric
  return () => {
    cursor += 1
    return `C${String(cursor).padStart(3, '0')}`
  }
}

async function findMatchingClient(
  supabase: SupabaseClient<Database>,
  tenantId: string,
  resourceName: string | null,
  email: string | null,
  phone: string | null
): Promise<ClientRow | null> {
  if (resourceName) {
    const { data, error } = await supabase
      .from('clienti')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('google_resource_name', resourceName)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  if (email) {
    const { data, error } = await supabase
      .from('clienti')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('email', email)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  if (phone) {
    const { data, error } = await supabase
      .from('clienti')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('telefon', phone)
      .maybeSingle()
    if (error) throw error
    if (data) return data
  }

  return null
}

export async function syncContacts({
  supabase,
  integration,
  forceFullSync = false,
}: SyncContactsInput): Promise<SyncContactsResult> {
  let liveIntegration = await refreshAccessTokenIfNeeded({ supabase, integration })
  let fullSync = forceFullSync || !liveIntegration.sync_token
  let fetchResult: FetchContactsPagedResult

  try {
    fetchResult = await fetchContactsPaged({
      accessToken: liveIntegration.access_token ?? '',
      syncToken: liveIntegration.sync_token,
      fullSync,
    })
  } catch (error) {
    const syncCode = (error as { code?: string }).code
    if (syncCode === 'SYNC_TOKEN_EXPIRED') {
      fetchResult = await fetchContactsPaged({
        accessToken: liveIntegration.access_token ?? '',
        syncToken: null,
        fullSync: true,
      })
      fullSync = true
    } else {
      throw error
    }
  }

  const nextId = await createClientIdGenerator(supabase, liveIntegration.tenant_id)
  const counters: SyncCounters = {
    contacts_fetched: fetchResult.contacts.length,
    clients_inserted: 0,
    clients_updated: 0,
    clients_upserted: 0,
  }

  for (const person of fetchResult.contacts) {
    const resourceName = person.resourceName ?? null
    const etag = person.etag ?? null
    const mapped = selectPrimaryContact(person)
    const existing = await findMatchingClient(
      supabase,
      liveIntegration.tenant_id,
      resourceName,
      mapped.email,
      mapped.phone
    )

    if (existing) {
      const updatePayload: TablesUpdate<'clienti'> = {
        nume_client: mapped.name || existing.nume_client,
        email: mapped.email ?? existing.email,
        telefon: mapped.phone ?? existing.telefon,
        observatii: mapped.notes ?? existing.observatii,
        google_resource_name: resourceName ?? existing.google_resource_name,
        google_etag: etag ?? existing.google_etag,
        updated_at: new Date().toISOString(),
      }

      const { error } = await supabase.from('clienti').update(updatePayload).eq('id', existing.id)
      if (error) throw error
      counters.clients_updated += 1
      counters.clients_upserted += 1
      continue
    }

    const insertPayload: TablesInsert<'clienti'> = {
      id_client: nextId(),
      tenant_id: liveIntegration.tenant_id,
      nume_client: mapped.name,
      email: mapped.email,
      telefon: mapped.phone,
      observatii: mapped.notes,
      google_resource_name: resourceName,
      google_etag: etag,
    }

    const { error } = await supabase.from('clienti').insert(insertPayload)
    if (error) throw error
    counters.clients_inserted += 1
    counters.clients_upserted += 1
  }

  const lastSyncAt = new Date().toISOString()
  const { data: updatedIntegration, error: integrationError } = await supabase
    .from('integrations_google_contacts')
    .update({
      sync_token: fetchResult.nextSyncToken ?? liveIntegration.sync_token,
      last_sync_at: lastSyncAt,
      updated_at: lastSyncAt,
    })
    .eq('id', liveIntegration.id)
    .select('*')
    .single()

  if (integrationError) throw integrationError
  liveIntegration = updatedIntegration

  return {
    ...counters,
    sync_token: liveIntegration.sync_token,
    last_sync_at: lastSyncAt,
    full_sync: fullSync,
  }
}

export async function exchangeGoogleCodeForTokens(code: string): Promise<GoogleTokenResponse> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  const redirectUri = process.env.GOOGLE_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error('Google OAuth configuration is missing')
  }

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Google token exchange failed: ${body}`)
  }

  return (await response.json()) as GoogleTokenResponse
}

export async function upsertGoogleIntegration(args: {
  supabase: SupabaseClient<Database>
  tenantId: string
  userId: string
  userEmail: string
  tokenData: GoogleTokenResponse
}): Promise<GoogleIntegrationRow> {
  const { supabase, tenantId, userId, userEmail, tokenData } = args
  const tokenExpiresAt = tokenData.expires_in
    ? new Date(Date.now() + tokenData.expires_in * 1000).toISOString()
    : null
  const connectedEmail = tokenData.access_token ? await fetchGoogleUserEmail(tokenData.access_token) : null

  const payload: TablesInsert<'integrations_google_contacts'> = {
    tenant_id: tenantId,
    user_id: userId,
    user_email: userEmail,
    connected_email: connectedEmail,
    access_token: tokenData.access_token ?? null,
    // TODO: encrypt refresh_token at rest once a project-wide crypto utility is available.
    refresh_token: tokenData.refresh_token ?? null,
    token_expires_at: tokenExpiresAt,
    scope: tokenData.scope ?? null,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('integrations_google_contacts')
    .upsert(payload, { onConflict: 'user_id' })
    .select('*')
    .single()

  if (error) throw error
  return data
}

export async function captureIntegrationError(error: unknown, context: Record<string, unknown>) {
  Sentry.captureException(error, {
    tags: {
      module: 'integrations',
      integration: 'google_contacts',
    },
    extra: context,
  })
}

export async function safeTrackSyncEvent(args: {
  supabase: SupabaseClient<Database>
  tenantId: string
  userId: string
  event: string
  metadata?: Record<string, unknown>
}) {
  try {
    await trackIntegrationEvent(args.supabase, {
      tenantId: args.tenantId,
      userId: args.userId,
      event: args.event,
      metadata: args.metadata,
    })
  } catch {
    // analytics must never block integrations
  }
}
