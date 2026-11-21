/* @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

const TENANT_ID = '30f98cbf-33ef-4b4a-8629-1d2f58fd0c68'

const mocks = vi.hoisted(() => ({
  isFarmOwner: vi.fn<(...args: unknown[]) => Promise<boolean>>(async () => true),
  upsert: vi.fn(),
  upload: vi.fn(),
  getTenantLegalDocs: vi.fn(),
}))

vi.mock('@/lib/monitoring/report-error', () => ({ captureApiError: vi.fn() }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => ({}) }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'operator-1' } }, error: null }) },
    from: () => ({ upsert: (...args: unknown[]) => mocks.upsert(...args) }),
    storage: { from: () => ({ upload: (...args: unknown[]) => mocks.upload(...args) }) },
  }),
}))
// Pentru un operator, ferma rezolvată din sesiune e cea în care lucrează.
vi.mock('@/lib/tenant/get-tenant', () => ({ getTenantIdByUserId: async () => TENANT_ID }))
vi.mock('@/lib/tenant/account-deletion', () => ({
  isFarmOwner: (...args: unknown[]) => mocks.isFarmOwner(...args),
}))
vi.mock('@/lib/legal-docs/server', () => ({
  getTenantLegalDocs: (...args: unknown[]) => mocks.getTenantLegalDocs(...args),
  createLegalDocSignedUrl: async () => null,
}))

describe('actele fermei: doar proprietarul', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.isFarmOwner.mockResolvedValue(false)
  })

  it('un operator nu le poate citi', async () => {
    const { GET } = await import('@/app/api/legal-docs/route')
    const response = await GET()
    expect(response.status).toBe(403)
    expect(mocks.isFarmOwner).toHaveBeenCalledWith(expect.anything(), TENANT_ID, 'operator-1')
    expect(mocks.getTenantLegalDocs).not.toHaveBeenCalled()
  })

  it('un operator nu le poate schimba', async () => {
    const { PUT } = await import('@/app/api/legal-docs/route')
    const response = await PUT(
      createSameOriginRequest('/api/legal-docs', { method: 'PUT', json: { full_name: 'Alt nume' } }),
    )
    expect(response.status).toBe(403)
    expect(mocks.upsert).not.toHaveBeenCalled()
  })

  it('un operator nu poate urca o poză de act', async () => {
    const { POST } = await import('@/app/api/legal-docs/upload/route')
    const form = new FormData()
    form.set('file', new File(['x'], 'act.png', { type: 'image/png' }))
    const response = await POST(createSameOriginRequest('/api/legal-docs/upload', { method: 'POST', body: form }))
    expect(response.status).toBe(403)
    expect(mocks.upload).not.toHaveBeenCalled()
  })

  it('proprietarul le citește', async () => {
    mocks.isFarmOwner.mockResolvedValue(true)
    mocks.getTenantLegalDocs.mockResolvedValue({ doc: null, status: { complete: false, missing: [] } })
    const { GET } = await import('@/app/api/legal-docs/route')
    const response = await GET()
    expect(mocks.getTenantLegalDocs).toHaveBeenCalledTimes(1)
    expect(response.status).not.toBe(403)
  })
})
