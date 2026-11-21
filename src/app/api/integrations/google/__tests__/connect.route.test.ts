/* @vitest-environment node */

import { beforeAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const GOOGLE_CONTACTS_TENANT_ID = '99485d6b-f186-49db-a379-bb9a12d34968'
const OTHER_TENANT_ID = '33333333-3333-4333-8333-333333333333'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getUser: vi.fn(),
  getTenantIdByUserIdOrNull: vi.fn(),
  cookieSet: vi.fn(),
}))

const owner = vi.hoisted(() => ({ isFarmOwner: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true) }))

vi.mock('@/lib/tenant/account-deletion', () => ({
  isFarmOwner: (...args: unknown[]) => owner.isFarmOwner(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => ({}) }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantIdByUserIdOrNull: (...args: unknown[]) =>
    mocks.getTenantIdByUserIdOrNull(...args),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({
    set: mocks.cookieSet,
  }),
}))

const originalClientId = process.env.GOOGLE_CLIENT_ID
const originalRedirectUri = process.env.GOOGLE_REDIRECT_URI

async function loadRouteModule() {
  vi.resetModules()
  return import('@/app/api/integrations/google/connect/route')
}

function createRequest() {
  return new Request('http://localhost:3000/api/integrations/google/connect')
}

describe('GET /api/integrations/google/connect', () => {
  // Prima încărcare a rutei (transformarea modulelor) durează sub încărcare mai mult decât timeout-ul de 5 s
  // al unui test. O facem o dată aici, cu timp suficient; `loadRouteModule` o refolosește din cache.
  beforeAll(async () => {
    await import('@/app/api/integrations/google/connect/route')
  }, 60_000)

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = 'test-client-id'
    process.env.GOOGLE_REDIRECT_URI = 'http://localhost:3000/api/integrations/google/callback'

    mocks.createClient.mockReset()
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } })
    mocks.getUser.mockReset()
    mocks.getTenantIdByUserIdOrNull.mockReset()
    mocks.cookieSet.mockReset()
    owner.isFarmOwner.mockReset()
    owner.isFarmOwner.mockResolvedValue(true)
  })

  afterEach(() => {
    if (originalClientId === undefined) delete process.env.GOOGLE_CLIENT_ID
    else process.env.GOOGLE_CLIENT_ID = originalClientId

    if (originalRedirectUri === undefined) delete process.env.GOOGLE_REDIRECT_URI
    else process.env.GOOGLE_REDIRECT_URI = originalRedirectUri
  })

  it('returnează 401 fără sesiune autentificată', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null }, error: null })
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest())

    expect(response.status).toBe(401)
    expect(mocks.cookieSet).not.toHaveBeenCalled()
  })

  it('returnează 403 pentru un tenant diferit de cel al integrării Google Contacts', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(OTHER_TENANT_ID)
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest())

    expect(response.status).toBe(403)
    expect(mocks.cookieSet).not.toHaveBeenCalled()
  })

  it('returnează 403 pentru un operator al fermei (nu proprietarul)', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'operator-1' } }, error: null })
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(GOOGLE_CONTACTS_TENANT_ID)
    owner.isFarmOwner.mockResolvedValue(false)
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest())

    expect(response.status).toBe(403)
    expect(owner.isFarmOwner).toHaveBeenCalledWith(expect.anything(), GOOGLE_CONTACTS_TENANT_ID, 'operator-1')
    expect(mocks.cookieSet).not.toHaveBeenCalled()
  })

  it('generează URL-ul de autorizare Google cu access_type offline și prompt consent', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(GOOGLE_CONTACTS_TENANT_ID)
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest())

    expect(response.status).toBe(307)
    const location = response.headers.get('location')
    expect(location).toBeTruthy()

    const redirectUrl = new URL(location as string)
    expect(redirectUrl.origin).toBe('https://accounts.google.com')
    expect(redirectUrl.searchParams.get('client_id')).toBe('test-client-id')
    expect(redirectUrl.searchParams.get('redirect_uri')).toBe(
      'http://localhost:3000/api/integrations/google/callback',
    )
    expect(redirectUrl.searchParams.get('access_type')).toBe('offline')
    expect(redirectUrl.searchParams.get('prompt')).toBe('consent')
    expect(redirectUrl.searchParams.get('scope')).toContain(
      'https://www.googleapis.com/auth/contacts',
    )

    expect(mocks.cookieSet).toHaveBeenCalledTimes(1)
    const [cookieName, cookieValue, cookieOptions] = mocks.cookieSet.mock.calls[0]
    expect(cookieName).toBe('gc_oauth_state')
    expect(cookieOptions).toMatchObject({ httpOnly: true, sameSite: 'lax' })
    expect(redirectUrl.searchParams.get('state')).toBe(cookieValue)
  })

  it('returnează 500 dacă GOOGLE_CLIENT_ID lipsește', async () => {
    delete process.env.GOOGLE_CLIENT_ID
    mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null })
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(GOOGLE_CONTACTS_TENANT_ID)
    const { GET } = await loadRouteModule()

    const response = await GET(createRequest())

    expect(response.status).toBe(500)
  })
})
