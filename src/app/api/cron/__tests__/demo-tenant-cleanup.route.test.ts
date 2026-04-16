/* @vitest-environment node */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const mocks = vi.hoisted(() => ({
  createServiceRoleClient: vi.fn(),
  deleteTenantScopedData: vi.fn(),
  isProtectedDemoCleanupOwnerUserId: vi.fn(),
}))

const originalCronSecret = process.env.CRON_SECRET
const originalProtectedOwnerIds = process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS

vi.mock('@/lib/supabase/admin', () => ({
  createServiceRoleClient: () => mocks.createServiceRoleClient(),
}))

vi.mock('@/lib/auth/protected-account', () => ({
  isProtectedDemoCleanupOwnerUserId: (...args: unknown[]) =>
    mocks.isProtectedDemoCleanupOwnerUserId(...args),
}))

vi.mock('@/lib/tenant/destructive-cleanup', () => ({
  TENANT_DESTRUCTIVE_CLEANUP_SCOPES: {
    demoTenantCleanup: 'demo_tenant_cleanup',
  },
  deleteTenantScopedData: (...args: unknown[]) => mocks.deleteTenantScopedData(...args),
}))

function createRequest(secret: string) {
  return new Request('http://localhost:3000/api/cron/demo-tenant-cleanup', {
    method: 'GET',
    headers: {
      authorization: `Bearer ${secret}`,
    },
  })
}

async function loadRouteModule() {
  vi.resetModules()
  return import('@/app/api/cron/demo-tenant-cleanup/route')
}

describe('GET /api/cron/demo-tenant-cleanup', () => {
  beforeEach(() => {
    mocks.createServiceRoleClient.mockReset()
    mocks.deleteTenantScopedData.mockReset()
    mocks.isProtectedDemoCleanupOwnerUserId.mockReset()
    mocks.isProtectedDemoCleanupOwnerUserId.mockReturnValue(false)
    process.env.CRON_SECRET = 'cron-secret'
    delete process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS
  })

  afterEach(() => {
    if (originalCronSecret === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = originalCronSecret
    }

    if (originalProtectedOwnerIds === undefined) {
      delete process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS
    } else {
      process.env.DEMO_CLEANUP_PROTECTED_OWNER_USER_IDS = originalProtectedOwnerIds
    }
  })

  it('respinge request fără secret valid', async () => {
    const { GET } = await loadRouteModule()
    const response = await GET(createRequest('invalid'))
    expect(response.status).toBe(401)
  })

  it('nu șterge owner-ii superadmin din cleanup', async () => {
    const deleteIn = vi.fn().mockResolvedValue({ error: null })
    const deleteEq = vi.fn().mockResolvedValue({ error: null })
    const deleteUser = vi.fn().mockResolvedValue({ error: null })

    const adminMock = {
      from: (table: string) => {
        if (table === 'profiles') {
          return {
            select: () => ({
              eq: async () => ({
                data: [{ id: 'owner-superadmin' }],
                error: null,
              }),
            }),
          }
        }

        if (table === 'tenants') {
          return {
            select: () => ({
              eq: () => ({
                lt: async () => ({
                  data: [
                    { id: 'tenant-superadmin', owner_user_id: 'owner-superadmin' },
                    { id: 'tenant-normal', owner_user_id: 'owner-normal' },
                  ],
                  error: null,
                }),
              }),
            }),
            delete: () => ({
              in: deleteIn,
            }),
          }
        }

        return {
          delete: () => ({
            eq: deleteEq,
          }),
        }
      },
      auth: {
        admin: {
          deleteUser,
        },
      },
    }

    mocks.createServiceRoleClient.mockReturnValue(adminMock)
    mocks.deleteTenantScopedData.mockImplementation(async (_admin: unknown, tenantId: string) => ({
      tenantId,
      completed: true,
      steps: [],
    }))

    const { GET } = await loadRouteModule()
    const response = await GET(createRequest('cron-secret'))
    const payload = (await response.json()) as {
      ok: boolean
      deletedTenants: number
      deletedUsers: number
    }

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.deletedTenants).toBe(1)
    expect(payload.deletedUsers).toBe(1)
    expect(mocks.deleteTenantScopedData).toHaveBeenCalledTimes(1)
    expect(mocks.deleteTenantScopedData).toHaveBeenCalledWith(
      adminMock,
      'tenant-normal',
      expect.objectContaining({ scope: 'demo_tenant_cleanup' }),
    )
    expect(deleteIn).toHaveBeenCalledWith('id', ['tenant-normal'])
    expect(deleteUser).toHaveBeenCalledWith('owner-normal')
  })
})
