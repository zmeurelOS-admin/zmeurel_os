/* @vitest-environment node */

import { describe, expect, it } from 'vitest'

import {
  isExpiredGoogleSyncTokenError,
  mapGooglePersonToClient,
  normalizeGooglePhone,
} from '@/lib/integrations/google-contacts-sync'

describe('Google Contacts sync helpers', () => {
  it('normalizează telefonul fără să elimine prefixul internațional', () => {
    expect(normalizeGooglePhone('+40 (722) 123-456')).toBe('+40722123456')
  })

  it('mapează contactul Google pe schema clienti', () => {
    expect(
      mapGooglePersonToClient({
        resourceName: 'people/c1234567890',
        etag: 'etag-1',
        names: [{ displayName: 'Maria Popescu' }],
        phoneNumbers: [{ value: '+40 722 123 456' }],
        emailAddresses: [{ value: 'maria@example.test' }],
      }),
    ).toEqual({
      tenant_id: '99485d6b-f186-49db-a379-bb9a12d34968',
      id_client: 'google_c1234567890',
      nume_client: 'Maria Popescu',
      telefon: '+40722123456',
      email: 'maria@example.test',
      google_resource_name: 'people/c1234567890',
      google_etag: 'etag-1',
      data_origin: 'google_contacts',
    })
  })

  it('sare contactele fără resourceName sau telefon', () => {
    expect(
      mapGooglePersonToClient({
        phoneNumbers: [{ value: '0722123456' }],
      }),
    ).toBeNull()

    expect(
      mapGooglePersonToClient({
        resourceName: 'people/c123',
      }),
    ).toBeNull()
  })

  it('detectează răspunsul 410 pentru sync token expirat', () => {
    expect(isExpiredGoogleSyncTokenError({ response: { status: 410 } })).toBe(true)
    expect(isExpiredGoogleSyncTokenError({ code: 410 })).toBe(true)
    expect(isExpiredGoogleSyncTokenError({ response: { status: 500 } })).toBe(false)
  })
})
