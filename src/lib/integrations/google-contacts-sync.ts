import { OAuth2Client } from 'google-auth-library'
import { google, type people_v1 } from 'googleapis'

import {
  decodeTokenSecret,
  encryptTokenSecret,
  GOOGLE_TOKEN_ENCRYPTION_ENV,
} from '@/lib/integrations/token-secret-crypto'
import { captureApiError } from '@/lib/monitoring/report-error'
import { createServiceRoleClient } from '@/lib/supabase/admin'
import { normalizePhoneNumber } from '@/lib/utils/normalize-phone'
import type { Database } from '@/types/supabase'

export const GOOGLE_CONTACTS_TENANT_ID = '99485d6b-f186-49db-a379-bb9a12d34968'
const GOOGLE_CONTACTS_ORIGIN = 'google_contacts'
const GOOGLE_CONTACTS_BATCH_SIZE = 50
const GOOGLE_CONTACTS_PAGE_SIZE = 1000
const GOOGLE_CONTACTS_PERSON_FIELDS =
  'names,phoneNumbers,emailAddresses,metadata'

type IntegrationRow = Pick<
  Database['public']['Tables']['integrations_google_contacts']['Row'],
  'id' | 'refresh_token' | 'sync_token'
>

type ClientInsert =
  Database['public']['Tables']['clienti']['Insert']

type ExistingGoogleClient = Pick<
  Database['public']['Tables']['clienti']['Row'],
  'id' | 'google_resource_name'
>

type ContactsPage = {
  contacts: people_v1.Schema$Person[]
  nextSyncToken: string
}

export type GoogleContactsSyncResult =
  | { status: 'sync disabled' }
  | { status: 'needs_reauth' }
  | {
      synced: number
      skipped: number
      errors: number
      mode: 'full' | 'incremental'
    }

function getRequiredEnv(name: 'GOOGLE_CLIENT_ID' | 'GOOGLE_CLIENT_SECRET') {
  const value = process.env[name]?.trim()
  if (!value) {
    throw new Error(`Lipsește variabila server-only ${name}.`)
  }
  return value
}

/**
 * @deprecated Delegă la `normalizePhoneNumber` (canonicalizare completă,
 * inclusiv codul de țară) — păstrat doar pentru compatibilitate cu apelurile
 * existente/testele care importă acest nume.
 */
export function normalizeGooglePhone(value: string): string {
  return normalizePhoneNumber(value)
}

export function mapGooglePersonToClient(
  person: people_v1.Schema$Person,
): ClientInsert | null {
  const resourceName = person.resourceName?.trim()
  if (!resourceName) return null

  const resourceSegment = resourceName.split('/').filter(Boolean).at(-1)
  if (!resourceSegment) return null

  const rawPhone = person.phoneNumbers?.[0]?.value?.trim()
  const phone = rawPhone ? normalizePhoneNumber(rawPhone) : ''
  if (!phone) return null

  const displayName = person.names?.[0]?.displayName?.trim()
  const email = person.emailAddresses?.[0]?.value?.trim()

  return {
    tenant_id: GOOGLE_CONTACTS_TENANT_ID,
    id_client: `google_${resourceSegment}`,
    nume_client: displayName || 'Contact Google',
    telefon: phone,
    email: email || null,
    google_resource_name: resourceName,
    google_etag: person.etag ?? null,
    data_origin: GOOGLE_CONTACTS_ORIGIN,
  }
}

export function isExpiredGoogleSyncTokenError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    code?: number | string
    status?: number
    message?: string
    response?: { status?: number }
    errors?: Array<{ message?: string; reason?: string }>
  }

  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  const nestedMessages = Array.isArray(candidate.errors)
    ? candidate.errors
        .map((entry) => {
          if (typeof entry?.message === 'string') return entry.message
          if (typeof entry?.reason === 'string') return entry.reason
          return ''
        })
        .join(' ')
        .toLowerCase()
    : ''

  const mentionsExpiredSyncToken =
    message.includes('sync token is expired') ||
    nestedMessages.includes('sync token is expired') ||
    nestedMessages.includes('expired sync token')

  return (
    Number(candidate.code) === 410 ||
    Number(candidate.code) === 400 && mentionsExpiredSyncToken ||
    candidate.status === 410 ||
    candidate.response?.status === 410 ||
    candidate.response?.status === 400 && mentionsExpiredSyncToken
  )
}

export function isInvalidGrantGoogleAuthError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const candidate = error as {
    message?: string
    response?: { data?: { error?: string } }
  }

  const message = typeof candidate.message === 'string' ? candidate.message.toLowerCase() : ''
  const nestedMessage =
    typeof candidate.response?.data?.error === 'string'
      ? candidate.response.data.error.toLowerCase()
      : ''

  return message.includes('invalid_grant') || nestedMessage.includes('invalid_grant')
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

async function loadEnabledIntegration(
  admin: ReturnType<typeof createServiceRoleClient>,
): Promise<IntegrationRow | null> {
  const { data, error } = await admin
    .from('integrations_google_contacts')
    .select('id,refresh_token,sync_token')
    .eq('tenant_id', GOOGLE_CONTACTS_TENANT_ID)
    .eq('sync_enabled', true)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new Error(`Nu am putut citi configurarea Google Contacts: ${error.code}`)
  }

  return data
}

async function fetchAllGoogleContacts(
  oauth2Client: OAuth2Client,
  syncToken: string | null,
): Promise<ContactsPage> {
  const people = google.people({ version: 'v1', auth: oauth2Client })
  const contacts: people_v1.Schema$Person[] = []
  let pageToken: string | undefined
  let nextSyncToken: string | undefined

  do {
    const response = await people.people.connections.list({
      resourceName: 'people/me',
      personFields: GOOGLE_CONTACTS_PERSON_FIELDS,
      pageSize: GOOGLE_CONTACTS_PAGE_SIZE,
      pageToken,
      ...(syncToken
        ? { syncToken }
        : { requestSyncToken: true }),
    })

    contacts.push(...(response.data.connections ?? []))
    pageToken = response.data.nextPageToken ?? undefined
    nextSyncToken = response.data.nextSyncToken ?? nextSyncToken
  } while (pageToken)

  if (!nextSyncToken) {
    throw new Error('Google People API nu a returnat nextSyncToken.')
  }

  return { contacts, nextSyncToken }
}

async function resetExpiredSyncToken(
  admin: ReturnType<typeof createServiceRoleClient>,
  integrationId: string,
) {
  const { error } = await admin
    .from('integrations_google_contacts')
    .update({ sync_token: null })
    .eq('id', integrationId)

  if (error) {
    throw new Error(`Nu am putut reseta sync_token expirat: ${error.code}`)
  }
}

async function disableIntegrationForReauth(
  admin: ReturnType<typeof createServiceRoleClient>,
  integrationId: string,
) {
  const { error } = await admin
    .from('integrations_google_contacts')
    .update({ sync_enabled: false })
    .eq('id', integrationId)

  if (error) {
    throw new Error(`Nu am putut dezactiva integrarea Google Contacts: ${error.code}`)
  }
}

async function syncClientBatch(
  admin: ReturnType<typeof createServiceRoleClient>,
  rows: ClientInsert[],
): Promise<{ synced: number; errors: number }> {
  const resourceNames = rows
    .map((row) => row.google_resource_name)
    .filter((value): value is string => Boolean(value))

  const { data, error: existingError } = await admin
    .from('clienti')
    .select('id,google_resource_name')
    .eq('tenant_id', GOOGLE_CONTACTS_TENANT_ID)
    .in('google_resource_name', resourceNames)

  if (existingError) {
    captureApiError(existingError, {
      route: '/api/cron/sync-google-contacts',
      tenantId: GOOGLE_CONTACTS_TENANT_ID,
      tags: { stage: 'load_existing_clients', batch_size: rows.length },
    })
    return { synced: 0, errors: rows.length }
  }

  const existingByResourceName = new Map(
    ((data ?? []) as ExistingGoogleClient[])
      .filter((row) => Boolean(row.google_resource_name))
      .map((row) => [row.google_resource_name as string, row.id]),
  )

  const results = await Promise.all(
    rows.map(async (row) => {
      const resourceName = row.google_resource_name as string
      const existingId = existingByResourceName.get(resourceName)

      const operation = existingId
        ? admin
            .from('clienti')
            .update({
              nume_client: row.nume_client,
              telefon: row.telefon,
              email: row.email,
              google_etag: row.google_etag,
              updated_at: new Date().toISOString(),
            })
            .eq('tenant_id', GOOGLE_CONTACTS_TENANT_ID)
            .eq('id', existingId)
        : admin.from('clienti').insert(row)

      const { error } = await operation
      if (error) {
        captureApiError(error, {
          route: '/api/cron/sync-google-contacts',
          tenantId: GOOGLE_CONTACTS_TENANT_ID,
          tags: { stage: existingId ? 'update_client' : 'insert_client' },
        })
        return false
      }

      return true
    }),
  )

  const synced = results.filter(Boolean).length
  return { synced, errors: rows.length - synced }
}

async function persistIntegrationState(
  admin: ReturnType<typeof createServiceRoleClient>,
  integration: IntegrationRow,
  nextSyncToken: string,
  decodedRefreshToken: ReturnType<typeof decodeTokenSecret>,
) {
  const update: Database['public']['Tables']['integrations_google_contacts']['Update'] = {
    sync_token: nextSyncToken,
    last_sync_at: new Date().toISOString(),
  }

  if (
    decodedRefreshToken.format === 'legacy' &&
    process.env[GOOGLE_TOKEN_ENCRYPTION_ENV]?.trim()
  ) {
    update.refresh_token = encryptTokenSecret(decodedRefreshToken.value)
  }

  const { error } = await admin
    .from('integrations_google_contacts')
    .update(update)
    .eq('id', integration.id)

  if (error) {
    throw new Error(`Nu am putut salva starea sincronizării: ${error.code}`)
  }
}

export async function syncGoogleContacts(): Promise<GoogleContactsSyncResult> {
  const admin = createServiceRoleClient()
  const integration = await loadEnabledIntegration(admin)

  if (!integration) {
    return { status: 'sync disabled' }
  }

  const decodedRefreshToken = decodeTokenSecret(integration.refresh_token)
  if (!decodedRefreshToken.value) {
    throw new Error('Configurarea Google Contacts nu conține refresh_token.')
  }

  const oauth2Client = new OAuth2Client(
    getRequiredEnv('GOOGLE_CLIENT_ID'),
    getRequiredEnv('GOOGLE_CLIENT_SECRET'),
  )
  oauth2Client.setCredentials({ refresh_token: decodedRefreshToken.value })

  let accessToken: { token?: string | null }
  try {
    accessToken = await oauth2Client.getAccessToken()
  } catch (error) {
    if (!isInvalidGrantGoogleAuthError(error)) {
      throw error
    }

    await disableIntegrationForReauth(admin, integration.id)
    captureApiError(error, {
      route: 'google-contacts-sync',
      tenantId: GOOGLE_CONTACTS_TENANT_ID,
      tags: { stage: 'refresh_token_invalid_grant' },
    })
    return { status: 'needs_reauth' }
  }

  if (!accessToken.token) {
    throw new Error('Google OAuth nu a returnat access_token.')
  }

  let mode: 'full' | 'incremental' = integration.sync_token
    ? 'incremental'
    : 'full'
  let page: ContactsPage

  try {
    page = await fetchAllGoogleContacts(
      oauth2Client,
      integration.sync_token,
    )
  } catch (error) {
    if (!integration.sync_token || !isExpiredGoogleSyncTokenError(error)) {
      throw error
    }

    await resetExpiredSyncToken(admin, integration.id)
    mode = 'full'
    page = await fetchAllGoogleContacts(oauth2Client, null)
  }

  let skipped = 0
  const clientsByResourceName = new Map<string, ClientInsert>()

  for (const person of page.contacts) {
    const row = mapGooglePersonToClient(person)
    if (!row || !row.google_resource_name) {
      skipped += 1
      continue
    }

    if (clientsByResourceName.has(row.google_resource_name)) {
      skipped += 1
    }
    clientsByResourceName.set(row.google_resource_name, row)
  }

  let synced = 0
  let errors = 0
  const clientRows = Array.from(clientsByResourceName.values())

  for (const rows of chunk(clientRows, GOOGLE_CONTACTS_BATCH_SIZE)) {
    const result = await syncClientBatch(admin, rows)
    synced += result.synced
    errors += result.errors
  }

  await persistIntegrationState(
    admin,
    integration,
    page.nextSyncToken,
    decodedRefreshToken,
  )

  return { synced, skipped, errors, mode }
}
