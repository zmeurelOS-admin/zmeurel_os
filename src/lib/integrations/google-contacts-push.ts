'use server'

import 'server-only'

import { OAuth2Client } from 'google-auth-library'
import { google, type people_v1 } from 'googleapis'

import { decodeTokenSecret } from '@/lib/integrations/token-secret-crypto'
import { toSafeErrorContext } from '@/lib/logging/redaction'
import { createServiceRoleClient } from '@/lib/supabase/admin'

const GOOGLE_CONTACT_FIELDS = 'names,phoneNumbers,emailAddresses,metadata'
const GOOGLE_CONTACT_UPDATE_FIELDS = 'names,phoneNumbers,emailAddresses'
const GOOGLE_REQUEST_TIMEOUT_MS = 9_000

type ClientContactRow = {
  id: string
  nume_client: string
  telefon: string | null
  email: string | null
  google_resource_name: string | null
  google_etag: string | null
}

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

export async function pushClientToGoogle(
  clientId: string,
  tenantId: string,
): Promise<void> {
  try {
    const admin = createServiceRoleClient()
    const { data: client, error: clientError } = await admin
      .from('clienti')
      .select(
        'id,nume_client,telefon,email,google_resource_name,google_etag',
      )
      .eq('id', clientId)
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (clientError) throw clientError
    if (!client) return

    const { data: integration, error: integrationError } = await admin
      .from('integrations_google_contacts')
      .select('refresh_token,sync_enabled')
      .eq('tenant_id', tenantId)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (integrationError) throw integrationError
    if (!integration?.sync_enabled || !integration.refresh_token) return

    const decodedRefreshToken = decodeTokenSecret(integration.refresh_token)
    if (!decodedRefreshToken.value) return

    const { clientId: googleClientId, clientSecret } = getGoogleCredentials()
    const oauth2Client = new OAuth2Client(googleClientId, clientSecret)
    oauth2Client.setCredentials({
      refresh_token: decodedRefreshToken.value,
    })
    const accessToken = await oauth2Client.getAccessToken()
    if (!accessToken.token) {
      throw new Error('Google nu a returnat un access token.')
    }

    const people = google.people({ version: 'v1', auth: oauth2Client })
    const contact = buildGoogleContact(client)

    if (client.google_resource_name) {
      const currentContact = await people.people.get(
        {
          resourceName: client.google_resource_name,
          personFields: 'metadata',
        },
        { timeout: GOOGLE_REQUEST_TIMEOUT_MS },
      )
      const updatedContact = await people.people.updateContact(
        {
          resourceName: client.google_resource_name,
          updatePersonFields: GOOGLE_CONTACT_UPDATE_FIELDS,
          personFields: GOOGLE_CONTACT_FIELDS,
          requestBody: {
            ...contact,
            resourceName: client.google_resource_name,
            etag: currentContact.data.etag ?? client.google_etag ?? undefined,
            metadata: currentContact.data.metadata,
          },
        },
        { timeout: GOOGLE_REQUEST_TIMEOUT_MS },
      )

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
      return
    }

    const createdContact = await people.people.createContact(
      {
        personFields: GOOGLE_CONTACT_FIELDS,
        requestBody: contact,
      },
      { timeout: GOOGLE_REQUEST_TIMEOUT_MS },
    )
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

    if (updateError) throw updateError
  } catch (error) {
    logPushError(error)
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
