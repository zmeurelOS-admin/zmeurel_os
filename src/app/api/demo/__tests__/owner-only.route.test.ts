/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const TENANT_ID = '30f98cbf-33ef-4b4a-8629-1d2f58fd0c68'

const mocks = vi.hoisted(() => ({
  isFarmOwner: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
  reload: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ deletedRows: 3, seedId: 'seed-1', summary: {} })),
  remove: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({ deletedRows: 3 })),
  seed: vi.fn<(...args: unknown[]) => Promise<unknown>>(async () => ({
    status: 'seeded',
    seedId: 'seed-1',
    summary: {},
    errors: [],
  })),
}))

vi.mock('@/lib/monitoring/report-error', () => ({ captureApiError: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1', user_metadata: {} } }, error: null }) },
  }),
}))
vi.mock('@/lib/supabase/admin', () => ({ createServiceRoleClient: () => ({}) }))
vi.mock('@/lib/auth/ensure-tenant', () => ({
  ensureTenantForUser: vi.fn(),
  normalizeFarmName: (value: string | null | undefined) => value ?? 'Ferma mea',
}))
vi.mock('@/lib/tenant/account-deletion', () => ({
  isFarmOwner: (...args: unknown[]) => mocks.isFarmOwner(...args),
}))
// Ferma rezolvată din sesiune: pentru un operator e ferma în care lucrează.
vi.mock('@/lib/demo/demo-seed-service', () => ({
  getTenantDemoContext: async () => ({ id: TENANT_ID, demo_seeded: true, demo_seed_id: 'seed-0' }),
  reloadDemoDataForTenant: (...args: unknown[]) => mocks.reload(...args),
  deleteDemoDataForTenant: (...args: unknown[]) => mocks.remove(...args),
  seedDemoDataForTenant: (...args: unknown[]) => mocks.seed(...args),
}))

const post = (path: string) => createSameOriginRequest(path, { method: 'POST', json: {} })

describe('rutele demo ating doar ferma proprietarului', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isFarmOwner.mockResolvedValue(true)
  })

  it('un operator nu poate reîncărca datele demo în ferma în care lucrează', async () => {
    mocks.isFarmOwner.mockResolvedValue(false)
    const { POST } = await import('@/app/api/demo/reload/route')
    const response = await POST(post('/api/demo/reload'))
    expect(response.status).toBe(403)
    expect(mocks.isFarmOwner).toHaveBeenCalledWith(expect.anything(), TENANT_ID, 'user-1')
    expect(mocks.reload).not.toHaveBeenCalled()
  })

  it('un operator nu poate șterge datele demo din ferma în care lucrează', async () => {
    mocks.isFarmOwner.mockResolvedValue(false)
    const { POST } = await import('@/app/api/demo/reset/route')
    const response = await POST(post('/api/demo/reset'))
    expect(response.status).toBe(403)
    expect(mocks.remove).not.toHaveBeenCalled()
  })

  it('un operator nu poate pune date demo în ferma în care lucrează', async () => {
    mocks.isFarmOwner.mockResolvedValue(false)
    const { POST } = await import('@/app/api/demo/seed/route')
    const response = await POST(post('/api/demo/seed'))
    expect(response.status).toBe(403)
    expect(mocks.seed).not.toHaveBeenCalled()
  })

  it('proprietarul le poate folosi pe toate trei', async () => {
    const reload = await import('@/app/api/demo/reload/route')
    const reset = await import('@/app/api/demo/reset/route')
    const seed = await import('@/app/api/demo/seed/route')
    expect((await reload.POST(post('/api/demo/reload'))).status).toBe(200)
    expect((await reset.POST(post('/api/demo/reset'))).status).toBe(200)
    expect((await seed.POST(post('/api/demo/seed'))).status).toBe(200)
    expect(mocks.reload).toHaveBeenCalledTimes(1)
    expect(mocks.remove).toHaveBeenCalledTimes(1)
    expect(mocks.seed).toHaveBeenCalledTimes(1)
  })
})
