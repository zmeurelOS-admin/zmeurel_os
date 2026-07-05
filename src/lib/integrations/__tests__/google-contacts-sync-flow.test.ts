/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  captureApiError: vi.fn(),
  createServiceRoleClient: vi.fn(),
  getAccessToken: vi.fn(),
  peopleList: vi.fn(),
  setCredentials: vi.fn(),
}))

vi.mock('@/lib/monitoring/report-error', () => ({
  captureApiError: (...args: unknown[]) => mocks.captureApiError(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: () => mocks.createServiceRoleClient(),
}))

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    setCredentials(...args: unknown[]) {
      return mocks.setCredentials(...args)
    }

    getAccessToken() {
      return mocks.getAccessToken()
    }
  },
}))

vi.mock('googleapis', () => ({
  google: {
    people: () => ({
      people: {
        connections: {
          list: (...args: unknown[]) => mocks.peopleList(...args),
        },
      },
    }),
  },
}))

const originalClientId = process.env.GOOGLE_CLIENT_ID
const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET
const originalEncryptionKey = process.env.GOOGLE_TOKENS_ENCRYPTION_KEY

type IntegrationConfig = {
  id: string
  refresh_token: string | null
  sync_token: string | null
}

function createAdminMock(integration: IntegrationConfig | null) {
  const clientInsert = vi.fn().mockResolvedValue({ error: null })
  const clientUpdateEqId = vi.fn().mockResolvedValue({ error: null })
  const clientUpdateEqTenant = vi.fn(() => ({ eq: clientUpdateEqId }))
  const clientUpdate = vi.fn(() => ({ eq: clientUpdateEqTenant }))
  const integrationUpdateEq = vi.fn().mockResolvedValue({ error: null })
  const integrationUpdate = vi.fn(() => ({ eq: integrationUpdateEq }))

  const admin = {
    from: vi.fn((table: string) => {
      if (table === 'integrations_google_contacts') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: integration, error: null }),
                  }),
                }),
              }),
            }),
          }),
          update: integrationUpdate,
        }
      }

      if (table === 'clienti') {
        return {
          select: () => ({
            eq: () => ({
              in: async () => ({ data: [], error: null }),
            }),
          }),
          insert: clientInsert,
          update: clientUpdate,
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return {
    admin,
    clientInsert,
    integrationUpdate,
    integrationUpdateEq,
  }
}

async function loadSyncModule() {
  vi.resetModules()
  return import('@/lib/integrations/google-contacts-sync')
}

describe('syncGoogleContacts', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'
    delete process.env.GOOGLE_TOKENS_ENCRYPTION_KEY

    mocks.captureApiError.mockReset()
    mocks.createServiceRoleClient.mockReset()
    mocks.getAccessToken.mockReset()
    mocks.getAccessToken.mockResolvedValue({ token: 'access-token' })
    mocks.peopleList.mockReset()
    mocks.setCredentials.mockReset()
  })

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = originalClientId

    if (originalClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET
    else process.env.GOOGLE_CLIENT_SECRET = originalClientSecret

    if (originalEncryptionKey === undefined) {
      delete process.env.GOOGLE_TOKENS_ENCRYPTION_KEY
    } else {
      process.env.GOOGLE_TOKENS_ENCRYPTION_KEY = originalEncryptionKey
    }
  })

  it('face full sync, inserează contactele și salvează nextSyncToken', async () => {
    const { admin, clientInsert, integrationUpdate } = createAdminMock({
      id: 'integration-1',
      refresh_token: 'refresh-token',
      sync_token: null,
    })
    mocks.createServiceRoleClient.mockReturnValue(admin)
    mocks.peopleList.mockResolvedValue({
      data: {
        connections: [
          {
            resourceName: 'people/c123',
            names: [{ displayName: 'Maria Popescu' }],
            phoneNumbers: [{ value: '0722 123 456' }],
          },
          {
            resourceName: 'people/no-phone',
            names: [{ displayName: 'Fără telefon' }],
          },
        ],
        nextSyncToken: 'sync-token-1',
      },
    })

    const { syncGoogleContacts } = await loadSyncModule()
    const result = await syncGoogleContacts()

    expect(result).toEqual({
      synced: 1,
      skipped: 1,
      errors: 0,
      mode: 'full',
    })
    expect(mocks.peopleList).toHaveBeenCalledWith(
      expect.objectContaining({
        requestSyncToken: true,
        resourceName: 'people/me',
      }),
    )
    expect(clientInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        google_resource_name: 'people/c123',
        telefon: '0722123456',
      }),
    )
    expect(integrationUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        sync_token: 'sync-token-1',
        last_sync_at: expect.any(String),
      }),
    )
  })

  it('resetează un sync token expirat și reia full sync în același apel', async () => {
    const { admin, integrationUpdate } = createAdminMock({
      id: 'integration-2',
      refresh_token: 'refresh-token',
      sync_token: 'expired-sync-token',
    })
    mocks.createServiceRoleClient.mockReturnValue(admin)
    mocks.peopleList
      .mockRejectedValueOnce({ response: { status: 410 } })
      .mockResolvedValueOnce({
        data: {
          connections: [],
          nextSyncToken: 'fresh-sync-token',
        },
      })

    const { syncGoogleContacts } = await loadSyncModule()
    const result = await syncGoogleContacts()

    expect(result).toEqual({
      synced: 0,
      skipped: 0,
      errors: 0,
      mode: 'full',
    })
    expect(mocks.peopleList).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ syncToken: 'expired-sync-token' }),
    )
    expect(mocks.peopleList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ requestSyncToken: true }),
    )
    expect(integrationUpdate).toHaveBeenNthCalledWith(1, { sync_token: null })
    expect(integrationUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ sync_token: 'fresh-sync-token' }),
    )
  })

  it('face fallback la full sync și pentru 400 cu mesaj de sync token expirat', async () => {
    const { admin, integrationUpdate } = createAdminMock({
      id: 'integration-3',
      refresh_token: 'refresh-token',
      sync_token: 'expired-sync-token',
    })
    mocks.createServiceRoleClient.mockReturnValue(admin)
    mocks.peopleList
      .mockRejectedValueOnce({
        code: '400',
        message:
          'Sync token is expired. Clear local cache and retry call without the sync token.',
      })
      .mockResolvedValueOnce({
        data: {
          connections: [],
          nextSyncToken: 'fresh-sync-token-400',
        },
      })

    const { syncGoogleContacts } = await loadSyncModule()
    const result = await syncGoogleContacts()

    expect(result).toEqual({
      synced: 0,
      skipped: 0,
      errors: 0,
      mode: 'full',
    })
    expect(mocks.peopleList).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ syncToken: 'expired-sync-token' }),
    )
    expect(mocks.peopleList).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ requestSyncToken: true }),
    )
    expect(integrationUpdate).toHaveBeenNthCalledWith(1, { sync_token: null })
    expect(integrationUpdate).toHaveBeenLastCalledWith(
      expect.objectContaining({ sync_token: 'fresh-sync-token-400' }),
    )
  })
})
