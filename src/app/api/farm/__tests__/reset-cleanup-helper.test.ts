import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/farm/reset/route'
import { TENANT_DESTRUCTIVE_CLEANUP_SCOPES } from '@/lib/tenant/destructive-cleanup'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))
vi.mock('@/lib/auth/destructive-action-step-up', () => ({
  requireDestructiveActionStepUp: vi.fn(() => null),
}))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
  getTenantId: vi.fn(),
  deleteTenantScopedData: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: () => mocks.createServiceRoleClient(),
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantId: (...args: unknown[]) => mocks.getTenantId(...args),
}))

vi.mock('@/lib/tenant/destructive-cleanup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant/destructive-cleanup')>()
  return {
    ...actual,
    deleteTenantScopedData: (...args: unknown[]) => mocks.deleteTenantScopedData(...args),
  }
})

const USER_ID = '82f7e2a4-40ee-4cb6-a31b-ce576273e8f5'
const TENANT_ID = 'db730f80-0081-4d7b-b075-4867ded31e5b'

function makeServerClient() {
  return {
    auth: {
      getUser: async () => ({ data: { user: { id: USER_ID, email: 'owner@example.com' } }, error: null }),
    },
    from: vi.fn((table: string) => {
      if (table === 'tenants') {
        return {
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        }
      }
      throw new Error(`unexpected table ${table}`)
    }),
  }
}

describe('POST /api/farm/reset uses canonical cleanup helper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue(makeServerClient())
    mocks.createServiceRoleClient.mockReturnValue({ from: vi.fn() })
    mocks.getTenantId.mockResolvedValue(TENANT_ID)
    mocks.deleteTenantScopedData.mockResolvedValue({
      tenantId: TENANT_ID,
      scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset,
      steps: [],
      verification: [],
      complete: true,
      criticalFailure: false,
      nonCriticalFailure: false,
    })
  })

  it('apelează helperul canonic cu scope-ul farm_reset', async () => {
    const req = createSameOriginRequest('/api/farm/reset', { method: 'POST' })
    const res = await POST(req)

    expect(res.status).toBe(200)
    expect(mocks.deleteTenantScopedData).toHaveBeenCalledTimes(1)
    expect(mocks.deleteTenantScopedData).toHaveBeenCalledWith(
      expect.anything(),
      TENANT_ID,
      expect.objectContaining({
        scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.farmReset,
        verifyCriticalTables: true,
      }),
    )
  })
})
