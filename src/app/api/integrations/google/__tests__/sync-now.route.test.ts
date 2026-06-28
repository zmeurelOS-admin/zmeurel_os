/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
  fetch: vi.fn(),
  getTenantIdByUserIdOrNull: vi.fn(),
  getUser: vi.fn(),
  readIntegration: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: () => mocks.createServiceRoleClient(),
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantIdByUserIdOrNull: (...args: unknown[]) =>
    mocks.getTenantIdByUserIdOrNull(...args),
}))

const tenantId = '99485d6b-f186-49db-a379-bb9a12d34968'
const originalCronSecret = process.env.CRON_SECRET
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL
const originalSiteUrl = process.env.SITE_URL

function createAdminMock() {
  return {
    from: vi.fn(() => ({
      select: (columns: string) => ({
        eq: () => ({
          order: () => ({
            limit: () => ({
              maybeSingle: () => mocks.readIntegration(columns),
            }),
          }),
        }),
      }),
    })),
  }
}

function createRequest() {
  return createSameOriginRequest('/api/integrations/google/sync-now', {
    method: 'POST',
  })
}

async function loadRouteModule() {
  vi.resetModules()
  return import('@/app/api/integrations/google/sync-now/route')
}

describe('POST /api/integrations/google/sync-now', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret'
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.example.test'
    delete process.env.SITE_URL

    mocks.createClient.mockReset()
    mocks.createClient.mockResolvedValue({ auth: { getUser: mocks.getUser } })
    mocks.createServiceRoleClient.mockReset()
    mocks.createServiceRoleClient.mockReturnValue(createAdminMock())
    mocks.fetch.mockReset()
    mocks.getTenantIdByUserIdOrNull.mockReset()
    mocks.getUser.mockReset()
    mocks.readIntegration.mockReset()
    vi.stubGlobal('fetch', mocks.fetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()

    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret

    if (originalAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
    else process.env.NEXT_PUBLIC_APP_URL = originalAppUrl

    if (originalSiteUrl === undefined) delete process.env.SITE_URL
    else process.env.SITE_URL = originalSiteUrl
  })

  it('returnează 401 fără sesiune autentificată', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    })
    const { POST } = await loadRouteModule()

    const response = await POST(createRequest())

    expect(response.status).toBe(401)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('returnează 403 pentru alt tenant', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(
      '33333333-3333-4333-8333-333333333333',
    )
    const { POST } = await loadRouteModule()

    const response = await POST(createRequest())

    expect(response.status).toBe(403)
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('returnează 400 când sincronizarea nu este activată', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(tenantId)
    mocks.readIntegration.mockResolvedValue({
      data: { sync_enabled: false },
      error: null,
    })
    const { POST } = await loadRouteModule()

    const response = await POST(createRequest())

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toEqual({
      error: 'Sincronizarea Google nu este activată',
    })
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('returnează 503 când endpointul cron eșuează', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(tenantId)
    mocks.readIntegration.mockResolvedValue({
      data: { sync_enabled: true },
      error: null,
    })
    mocks.fetch.mockResolvedValue(
      Response.json({ error: 'cron failed' }, { status: 500 }),
    )
    const { POST } = await loadRouteModule()

    const response = await POST(createRequest())

    expect(response.status).toBe(503)
    await expect(response.json()).resolves.toEqual({
      error: 'Sincronizarea a eșuat',
    })
  })

  it('apelează cronul cu secretul server-side și întoarce starea actualizată', async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
      error: null,
    })
    mocks.getTenantIdByUserIdOrNull.mockResolvedValue(tenantId)
    mocks.readIntegration.mockImplementation(async (columns: string) => {
      if (columns === 'sync_enabled') {
        return { data: { sync_enabled: true }, error: null }
      }

      return {
        data: { last_sync_at: '2026-06-28T07:11:42.967Z' },
        error: null,
      }
    })
    mocks.fetch.mockResolvedValue(
      Response.json({
        synced: 12,
        skipped: 3,
        errors: 0,
        mode: 'incremental',
      }),
    )
    const { POST, maxDuration } = await loadRouteModule()

    const response = await POST(createRequest())

    expect(maxDuration).toBe(30)
    expect(mocks.fetch).toHaveBeenCalledWith(
      new URL(
        'https://app.example.test/api/cron/sync-google-contacts',
      ),
      {
        method: 'GET',
        headers: { Authorization: 'Bearer cron-secret' },
        cache: 'no-store',
      },
    )
    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({
      synced: 12,
      skipped: 3,
      errors: 0,
      mode: 'incremental',
      lastSyncAt: '2026-06-28T07:11:42.967Z',
    })
  })
})
