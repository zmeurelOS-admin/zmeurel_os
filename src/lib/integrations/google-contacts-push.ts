import 'server-only'

import { randomUUID } from 'node:crypto'

import { OAuth2Client } from 'google-auth-library'
import { google, type people_v1 } from 'googleapis'

import { decodeTokenSecret } from '@/lib/integrations/token-secret-crypto'
import { toSafeErrorContext } from '@/lib/logging/redaction'
import { createServiceRoleClient } from '@/lib/supabase/admin'

const GOOGLE_CONTACT_FIELDS = 'names,phoneNumbers,emailAddresses,metadata'
const GOOGLE_CONTACT_UPDATE_FIELDS = 'names,phoneNumbers,emailAddresses'
const GOOGLE_PUSH_TIMEOUT_MS = 8_000
const GOOGLE_CREATE_CLAIM_PREFIX = 'zmeurel-google-push-pending:'
const CLIENT_CONTACT_FIELDS =
  'id,nume_client,telefon,email,google_resource_name,google_etag'

type ClientContactRow = {
  id: string
  nume_client: string
  telefon: string | null
  email: string | null
  google_resource_name: string | null
  google_etag: string | null
}

type AdminClient = ReturnType<typeof createServiceRoleClient>
type PeopleClient = ReturnType<typeof google.people>

function normalizePhone(value: string): string {
  return value.replace(/[\s\-\.\(\)]/g, '')
}

function buildGoogleContact(client: ClientContactRow): people_v1.Schema$Person {
  const phone = client.telefon?.trim()
  const email = client.email?.trim()

  return {
    // displayName este output-only în People API; givenName produce displayName-ul dorit.
    names: [{ givenName: client.nume_client.trim() }],
    phoneNumbers: phone
      ? [{ value: normalizePhone(phone), type: 'mobile' }]
      : [],
    emailAddresses: email ? [{ value: email, type: 'work' }] : [],
  }
}

function getGoogleCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    throw new Error('Lipsesc credențialele Google OAuth.')
  }

  return { clientId, clientSecret }
}

function logPushError(error: unknown): void {
  console.error('[google-push]', toSafeErrorContext(error))
}

function hasGoogleErrorResponse(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false

  const response = (error as { response?: { status?: unknown } }).response
  return typeof response?.status === 'number'
}

function isPendingGoogleCreate(resourceName: string | null): boolean {
  return resourceName?.startsWith(GOOGLE_CREATE_CLAIM_PREFIX) ?? false
}

function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) {
    throw new DOMException('Google push timed out.', 'AbortError')
  }
}

function withAbort<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException('Google push timed out.', 'AbortError'))
  }

  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException('Google push timed out.', 'AbortError'))
    }

    signal.addEventListener('abort', onAbort, { once: true })
    promise.then(resolve, reject).finally(() => {
      signal.removeEventListener('abort', onAbort)
    })
  })
}

async function updateGoogleContact(
  admin: AdminClient,
  people: PeopleClient,
  client: ClientContactRow,
  tenantId: string,
  signal: AbortSignal,
): Promise<void> {
  if (!client.google_resource_name) return
  if (isPendingGoogleCreate(client.google_resource_name)) return

  throwIfAborted(signal)
  const currentContact = await people.people.get(
    {
      resourceName: client.google_resource_name,
      personFields: 'metadata',
    },
    { timeout: GOOGLE_PUSH_TIMEOUT_MS, signal },
  )
  throwIfAborted(signal)

  const updatedContact = await people.people.updateContact(
    {
      resourceName: client.google_resource_name,
      updatePersonFields: GOOGLE_CONTACT_UPDATE_FIELDS,
      personFields: GOOGLE_CONTACT_FIELDS,
      requestBody: {
        ...buildGoogleContact(client),
        resourceName: client.google_resource_name,
        etag: currentContact.data.etag ?? client.google_etag ?? undefined,
        metadata: currentContact.data.metadata,
      },
    },
    { timeout: GOOGLE_PUSH_TIMEOUT_MS, signal },
  )
  throwIfAborted(signal)

  const { error: updateError } = await admin
    .from('clienti')
    .update({
      google_etag:
        updatedContact.data.etag ??
        currentContact.data.etag ??
        client.google_etag,
    })
    .eq('id', client.id)
    .eq('tenant_id', tenantId)

  if (updateError) throw updateError
}

type GoogleCreateClaim =
  | { status: 'claimed'; client: ClientContactRow; claim: string }
  | { status: 'existing'; client: ClientContactRow }
  | { status: 'busy' }

async function claimClientForGoogleCreate(
  admin: AdminClient,
  client: ClientContactRow,
  tenantId: string,
): Promise<GoogleCreateClaim> {
  const claim = `${GOOGLE_CREATE_CLAIM_PREFIX}${randomUUID()}`

  // PostgREST nu poate menține FOR UPDATE pe durata apelului Google.
  // Update-ul condiționat este un compare-and-set atomic pe același rând.
  const { data: claimedClient, error: claimError } = await admin
    .from('clienti')
    .update({ google_resource_name: claim })
    .eq('id', client.id)
    .eq('tenant_id', tenantId)
    .is('google_resource_name', null)
    .select(CLIENT_CONTACT_FIELDS)
    .maybeSingle()

  if (claimError) throw claimError
  if (claimedClient) {
    return {
      status: 'claimed',
      client: claimedClient,
      claim,
    }
  }

  const { data: latestClient, error: latestClientError } = await admin
    .from('clienti')
    .select(CLIENT_CONTACT_FIELDS)
    .eq('id', client.id)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (latestClientError) throw latestClientError
  if (!latestClient?.google_resource_name) return { status: 'busy' }
  if (isPendingGoogleCreate(latestClient.google_resource_name)) {
    return { status: 'busy' }
  }

  return { status: 'existing', client: latestClient }
}

async function executeGooglePush(
  clientId: string,
  tenantId: string,
  signal: AbortSignal,
): Promise<void> {
  const admin = createServiceRoleClient()
  const { data: client, error: clientError } = await admin
    .from('clienti')
    .select(CLIENT_CONTACT_FIELDS)
    .eq('id', clientId)
    .eq('tenant_id', tenantId)
    .maybeSingle()

  if (clientError) throw clientError
  if (!client) return
  if (isPendingGoogleCreate(client.google_resource_name)) return
  throwIfAborted(signal)

  const { data: integration, error: integrationError } = await admin
    .from('integrations_google_contacts')
    .select('refresh_token,sync_enabled')
    .eq('tenant_id', tenantId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (integrationError) throw integrationError
  if (!integration?.sync_enabled || !integration.refresh_token) return
  throwIfAborted(signal)

  const decodedRefreshToken = decodeTokenSecret(integration.refresh_token)
  if (!decodedRefreshToken.value) return

  const { clientId: googleClientId, clientSecret } = getGoogleCredentials()
  const oauth2Client = new OAuth2Client(googleClientId, clientSecret)
  oauth2Client.setCredentials({
    refresh_token: decodedRefreshToken.value,
  })
  const accessToken = await withAbort(oauth2Client.getAccessToken(), signal)
  if (!accessToken.token) {
    throw new Error('Google nu a returnat un access token.')
  }
  throwIfAborted(signal)

  const people = google.people({ version: 'v1', auth: oauth2Client })
  if (client.google_resource_name) {
    await updateGoogleContact(admin, people, client, tenantId, signal)
    return
  }

  const claimResult = await claimClientForGoogleCreate(admin, client, tenantId)
  if (claimResult.status === 'busy') return
  if (claimResult.status === 'existing') {
    await updateGoogleContact(
      admin,
      people,
      claimResult.client,
      tenantId,
      signal,
    )
    return
  }

  let shouldReleaseClaim = true
  try {
    throwIfAborted(signal)
    let createdContact
    try {
      createdContact = await people.people.createContact(
        {
          personFields: GOOGLE_CONTACT_FIELDS,
          requestBody: buildGoogleContact(claimResult.client),
        },
        { timeout: GOOGLE_PUSH_TIMEOUT_MS, signal },
      )
      // Din acest punct contactul există în Google; claim-ul trebuie păstrat
      // până când resourceName-ul real este legat în DB.
      shouldReleaseClaim = false
    } catch (error) {
      // Un răspuns HTTP non-2xx confirmă că Google nu a creat contactul.
      // Timeout/network fără răspuns are rezultat incert, deci păstrăm claim-ul.
      shouldReleaseClaim = hasGoogleErrorResponse(error)
      throw error
    }
    throwIfAborted(signal)

    const resourceName = createdContact.data.resourceName
    if (!resourceName) {
      throw new Error('Google nu a returnat resourceName pentru contact.')
    }

    const { error: updateError } = await admin
      .from('clienti')
      .update({
        google_resource_name: resourceName,
        google_etag: createdContact.data.etag ?? null,
      })
      .eq('id', client.id)
      .eq('tenant_id', tenantId)
      .eq('google_resource_name', claimResult.claim)

    if (updateError) throw updateError
  } finally {
    if (shouldReleaseClaim) {
      await admin
        .from('clienti')
        .update({ google_resource_name: null })
        .eq('id', client.id)
        .eq('tenant_id', tenantId)
        .eq('google_resource_name', claimResult.claim)
    }
  }
}

export async function pushClientToGoogle(
  clientId: string,
  tenantId: string,
): Promise<void> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), GOOGLE_PUSH_TIMEOUT_MS)

  try {
    await executeGooglePush(clientId, tenantId, controller.signal)
  } catch (error) {
    if (
      controller.signal.aborted ||
      (error instanceof Error && error.name === 'AbortError')
    ) {
      console.error('[google-push] timeout')
      return
    }

    logPushError(error)
  } finally {
    clearTimeout(timeout)
  }
}

export async function pushClientDeleteToGoogle(
  resourceName: string,
  tenantId: string,
): Promise<void> {
  void resourceName
  void tenantId
  console.info('[google-push] delete not implemented')
}
