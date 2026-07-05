/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const GOOGLE_CONTACTS_TENANT_ID = '99485d6b-f186-49db-a379-bb9a12d34968'
const OTHER_TENANT_ID = '33333333-3333-4333-8333-333333333333'
const SAVED_STATE = 'saved-state-value'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  getTenantIdByUserIdOrNull: vi.fn(),
  cookieGet: vi.fn(),
  cookieDelete: vi.fn(),
  getToken: vi.fn(),
  encryptTokenSecret: vi.fn(),
  createServiceRoleClient: vi.fn(),
  captureApiError: vi.fn(),
  fetch: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantIdByUserIdOrNull: (...args: unknown[]) =>
    mocks.getTenantIdByUserIdOrNull(...args),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    get: mocks.cookieGet,
    delete: mocks.cookieDelete,
  }),
}))

vi.mock('google-auth-library', () => ({
  OAuth2Client: class {
    getToken(...args: unknown[]) {
      return mocks.getToken(...args)
    }
  },
}))

vi.mock('@/lib/integrations/token-secret-crypto', () => ({
  encryptTokenSecret: (...args: unknown[]) => mocks.encryptTokenSecret(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: () => mocks.createServiceRoleClient(),
}))

vi.mock('@/lib/monitoring/report-error', () => ({
  captureApiError: (...args: unknown[]) => mocks.captureApiError(...args),
}))

const originalClientId = process.env.GOOGLE_CLIENT_ID
const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET
const originalRedirectUri = process.env.GOOGLE_REDIRECT_URI
const originalFetch = global.fetch

async function loadRouteModule() {
  vi.resetModules()
  return import('@/app/api/integrations/google/callback/route')
}

function createRequest(query: string) {
  return new Request(
    `http://localhost:3000/api/integrations/google/callback${query}`,
  ) as unknown as NextRequest
}

function createUpsertMock() {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const admin = {
    from: vi.fn(() => ({ upsert })),
  }
  return { admin, upsert }
}

describe('GET /api/integrations/google/callback', () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_CLIENT_SECRET = 'test-client-secret'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/integrations/google/callback'

    mocks.createClient.mockReset()
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } })
    mocks.getUser.mockReset()
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1', email: 'andrei@example.com' } }, error: null })
    mocks.getTenantIdByUserIdOrNull.mockReset()
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(GOOGLE_CONTACTS_TENANT_ID)
    mocks.cookieGet.mockReset()
    mocks.cookieGet.mockReturnValue({ value: SAVED_STATE })
    mocks.cookieDelete.mockReset()
    mocks.getToken.mockReset()
    mocks.encryptTokenSecret.mockReset()
    mocks.encryptTokenSecret.mockImplementation((value: string) => `enc:${value}`)
    mocks.createServiceRoleClient.mockReset()
    mocks.captureApiError.mockReset()
    global.fetch = mocks.fetch
    mocks.fetch.mockReset()
    mocks.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ email: 'Contact.Owner@Gmail.com' }),
    })
  })

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = originalClientId

    if (originalClientSecret === undefined) delete process.env.GOOGLE_CLIENT_SECRET
    else process.env.GOOGLE_CLIENT_SECRET = originalClientSecret

    if (originalRedirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI
    else process.env.GOOGLE_REDIRECT_URI = originalRedirectUri

    global.fetch = originalFetch
  })

  it('redirecționează cu eroare când Google întoarce parametrul error', async () => {
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest('?error=access_denied'))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('google_contacts=error_denied')
  })

  it('redirecționează cu eroare când lipsesc code sau state', async () => {
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest(''))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('google_contacts=error_missing_code')
  })

  it('redirecționează cu eroare când state-ul nu se potrivește cu cookie-ul salvat', async () => {
    mocks.cookieGet.mockReturnValue({ value: 'other-state' })
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest('?code=auth-code&state=' + SAVED_STATE))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('google_contacts=error_state')
    expect(mocks.getToken).not.toHaveBeenCalled()
  })

  it('redirecționează cu eroare pentru un tenant diferit de cel al integrării', async () => {
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(OTHER_TENANT_ID)
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest(`?code=auth-code&state=${SAVED_STATE}`))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('google_contacts=error_forbidden')
    expect(mocks.getToken).not.toHaveBeenCalled()
  })

  it('redirecționează cu eroare când Google nu întoarce refresh_token', async () => {
    mocks.getToken.mockResolvedValue({ tokens: { access_token: 'access-token' } })
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest(`?code=auth-code&state=${SAVED_STATE}`))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('google_contacts=error_no_refresh_token')
  })

  it('face schimbul code -> tokens, criptează refresh_token și salvează integrarea activă', async () => {
    mocks.getToken.mockResolvedValue({
      tokens: {
        access_token: 'access-token',
        refresh_token: 'raw-refresh-token',
        scope: 'https://www.googleapis.com/auth/contacts',
        expiry_date: Date.parse('2026-08-01T00:00:00.000Z'),
      },
    })
    const { admin, upsert } = createUpsertMock()
    mocks.createServiceRoleClient.mockReturnValue(admin)

    const { GET } = await loadRouteModule()
    const response = await GET(createRequest(`?code=auth-code&state=${SAVED_STATE}`))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('google_contacts=connected')

    expect(mocks.cookieDelete).toHaveBeenCalledWith('gc_oauth_state')
    expect(mocks.encryptTokenSecret).toHaveBeenCalledWith('raw-refresh-token')

    expect(admin.from).toHaveBeenCalledWith('integrations_google_contacts')
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: GOOGLE_CONTACTS_TENANT_ID,
        user_id: 'user-1',
        user_email: 'andrei@example.com',
        connected_email: 'contact.owner@gmail.com',
        refresh_token: 'enc:raw-refresh-token',
        scope: 'https://www.googleapis.com/auth/contacts',
        sync_token: null,
        sync_enabled: true,
      }),
      { onConflict: 'user_id' },
    )
  })

  it('redirecționează cu eroare generică și loghează dacă upsert-ul eșuează', async () => {
    mocks.getToken.mockResolvedValue({
      tokens: { access_token: 'access-token', refresh_token: 'raw-refresh-token' },
    })
    const admin = {
      from: vi.fn(() => ({
        upsert: vi.fn().mockResolvedValue({ error: { code: '23505', message: 'boom' } }),
      })),
    }
    mocks.createServiceRoleClient.mockReturnValue(admin)

    const { GET } = await loadRouteModule()
    const response = await GET(createRequest(`?code=auth-code&state=${SAVED_STATE}`))

    expect(response.status).toBe(307)
    expect(response.headers.get('location')).toContain('google_contacts=error')
    expect(mocks.captureApiError).toHaveBeenCalledWith(
      expect.objectContaining({ code: '23505' }),
      expect.objectContaining({ route: '/api/integrations/google/callback' }),
    )
  })
})
