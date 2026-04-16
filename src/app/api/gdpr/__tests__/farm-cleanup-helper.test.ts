import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DELETE } from '@/app/api/gdpr/farm/route'
import { TENANT_DESTRUCTIVE_CLEANUP_SCOPES } from '@/lib/tenant/destructive-cleanup'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))
vi.mock('@/lib/auth/destructive-action-step-up', () => ({
  requireDestructiveActionStepUp: vi.fn(() => null),
}))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  getTenantIdByUserId: vi.fn(),
  deleteTenantScopedData: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mocks.createClient(),
}))

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => mocks.getSupabaseAdmin(),
}))

vi.mock('@/lib/tenant/get-tenant', () => ({
  getTenantIdByUserId: (...args: unknown[]) => mocks.getTenantIdByUserId(...args),
}))

vi.mock('@/lib/tenant/destructive-cleanup', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/tenant/destructive-cleanup')>()
  return {
    ...actual,
    deleteTenantScopedData: (...args: unknown[]) => mocks.deleteTenantScopedData(...args),
  }
})

const USER_ID = '55c8f14a-18f0-49fd-b2f4-c7f7e33e52df'
const TENANT_ID = '2f70e60f-bc84-4ce7-a184-7f43384bf6e5'

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

describe('DELETE /api/gdpr/farm uses canonical cleanup helper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue(makeServerClient())
    mocks.getTenantIdByUserId.mockResolvedValue(TENANT_ID)
    mocks.getSupabaseAdmin.mockReturnValue({ from: vi.fn() })
    mocks.deleteTenantScopedData.mockResolvedValue({
      tenantId: TENANT_ID,
      scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.gdprFarmDelete,
      steps: [],
      verification: [],
      complete: true,
      criticalFailure: false,
      nonCriticalFailure: false,
    })
  })

  it('apelează helperul canonic cu scope-ul gdpr_farm_delete', async () => {
    const req = createSameOriginRequest('/api/gdpr/farm', { method: 'DELETE' })
    const res = await DELETE(req)

    expect(res.status).toBe(200)
    expect(mocks.deleteTenantScopedData).toHaveBeenCalledTimes(1)
    expect(mocks.deleteTenantScopedData).toHaveBeenCalledWith(
      expect.anything(),
      TENANT_ID,
      expect.objectContaining({
        scope: TENANT_DESTRUCTIVE_CLEANUP_SCOPES.gdprFarmDelete,
        verifyCriticalTables: true,
      }),
    )
  })
})
