/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  createContact: vi.fn(),
  createServiceRoleClient: vi.fn(),
  getAccessToken: vi.fn(),
  getContact: vi.fn(),
  setCredentials: vi.fn(),
  updateContact: vi.fn(),
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
        createContact: (...args: unknown[]) => mocks.createContact(...args),
        get: (...args: unknown[]) => mocks.getContact(...args),
        updateContact: (...args: unknown[]) => mocks.updateContact(...args),
      },
    }),
  },
}))

const originalClientId = process.env.GOOGLE_CLIENT_ID
const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET

type ClientState = {
  id: string
  nume_client: string
  telefon: string | null
  email: string | null
  google_resource_name: string | null
  google_etag: string | null
}

function createAdminMock(options?: { syncEnabled?: boolean }) {
  const clientState: ClientState = {
    id: '11111111-1111-4111-8111-111111111111',
    nume_client: 'Maria Popescu',
    telefon: '0722 123-456',
    email: 'maria@example.test',
    google_resource_name: null,
    google_etag: null,
  }
  const clientUpdate = vi.fn((values: Partial<ClientState>) => ({
    eq: () => ({
      eq: async () => {
        Object.assign(clientState, values)
        return { error: null }
      },
    }),
  }))

  const admin = {
    from: vi.fn((table: string) => {
      if (table === 'clienti') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({
                  data: { ...clientState },
                  error: null,
                }),
              }),
            }),
          }),
          update: clientUpdate,
        }
      }

      if (table === 'integrations_google_contacts') {
        return {
          select: () => ({
            eq: () => ({
              order: () => ({
                limit: () => ({
                  maybeSingle: async () => ({
                    data: {
                      refresh_token: 'refresh-token',
                      sync_enabled: options?.syncEnabled ?? true,
                    },
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }
      }

      throw new Error(`Unexpected table: ${table}`)
    }),
  }

  return { admin, clientState, clientUpdate }
}

async function loadPushModule() {
  vi.resetModules()
  return import('@/lib/integrations/google-contacts-push')
}

describe('pushClientToGoogle', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'google-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'google-client-secret'

    mocks.createContact.mockReset()
    mocks.createServiceRoleClient.mockReset()
    mocks.getAccessToken.mockReset()
    mocks.getAccessToken.mockResolvedValue({ token: 'access-token' })
    mocks.getContact.mockReset()
    mocks.setCredentials.mockReset()
    mocks.updateContact.mockReset()
  })

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = originalClientId

    if (originalClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET
    else process.env.GOOGLE_CLIENT_SECRET = originalClientSecret
  })

  it('creează o singură dată, apoi actualizează contactul existent', async () => {
    const { admin, clientState, clientUpdate } = createAdminMock()
    mocks.createServiceRoleClient.mockReturnValue(admin)
    mocks.createContact.mockResolvedValue({
      data: { resourceName: 'people/c123', etag: 'etag-created' },
    })
    mocks.getContact.mockResolvedValue({
      data: {
        etag: 'etag-current',
        metadata: { sources: [{ etag: 'source-etag', type: 'CONTACT' }] },
      },
    })
    mocks.updateContact.mockResolvedValue({
      data: { etag: 'etag-updated' },
    })

    const { pushClientToGoogle } = await loadPushModule()
    await pushClientToGoogle(clientState.id, '22222222-2222-4222-8222-222222222222')
    await pushClientToGoogle(clientState.id, '22222222-2222-4222-8222-222222222222')

    expect(mocks.createContact).toHaveBeenCalledTimes(1)
    expect(mocks.createContact).toHaveBeenCalledWith(
      expect.objectContaining({
        requestBody: expect.objectContaining({
          names: [{ givenName: 'Maria Popescu' }],
          phoneNumbers: [{ value: '0722123456', type: 'mobile' }],
        }),
      }),
      { timeout: 9_000 },
    )
    expect(mocks.updateContact).toHaveBeenCalledTimes(1)
    expect(mocks.updateContact).toHaveBeenCalledWith(
      expect.objectContaining({
        resourceName: 'people/c123',
        requestBody: expect.objectContaining({
          etag: 'etag-current',
          metadata: expect.objectContaining({
            sources: expect.any(Array),
          }),
        }),
      }),
      { timeout: 9_000 },
    )
    expect(clientState).toMatchObject({
      google_resource_name: 'people/c123',
      google_etag: 'etag-updated',
    })
    expect(clientUpdate).toHaveBeenCalledTimes(2)
  })

  it('iese silențios când sincronizarea este dezactivată', async () => {
    const { admin, clientState } = createAdminMock({ syncEnabled: false })
    mocks.createServiceRoleClient.mockReturnValue(admin)

    const { pushClientToGoogle } = await loadPushModule()
    await pushClientToGoogle(clientState.id, '22222222-2222-4222-8222-222222222222')

    expect(mocks.getAccessToken).not.toHaveBeenCalled()
    expect(mocks.createContact).not.toHaveBeenCalled()
    expect(mocks.updateContact).not.toHaveBeenCalled()
  })
})
