import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/farm/reset/route'
import {
  DESTRUCTIVE_STEP_UP_HEADER,
  destructiveActionScopes,
} from '@/lib/auth/destructive-action-step-up-contract'
import {
  __resetDestructiveActionStepUpForTests,
  issueDestructiveActionStepUpToken,
} from '@/lib/auth/destructive-action-step-up'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/sentry', () => ({ captureApiError: vi.fn() }))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  createServiceRoleClient: vi.fn(),
  getTenantId: vi.fn(),
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

const USER_ID = 'f6ea9135-7b7b-4553-87b8-c27e7319c66d'
const TENANT_ID = '30f98cbf-33ef-4b4a-8629-1d2f58fd0c68'

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

function makeAdminClient() {
  return {
    from: vi.fn(() => ({
      delete: () => ({
        eq: async () => ({ error: null }),
      }),
      select: () => ({
        eq: async () => ({ count: 0, error: null }),
      }),
    })),
  }
}

describe('POST /api/farm/reset step-up guard', () => {
  beforeEach(() => {
    process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET =
      'test-step-up-secret-value-with-at-least-thirty-two-bytes'
    __resetDestructiveActionStepUpForTests()
    vi.clearAllMocks()

    mocks.createClient.mockResolvedValue(makeServerClient())
    mocks.getTenantId.mockResolvedValue(TENANT_ID)
    mocks.createServiceRoleClient.mockReturnValue(makeAdminClient())
  })

  it('respinge request fără step-up token', async () => {
    const req = createSameOriginRequest('/api/farm/reset', { method: 'POST' })
    const res = await POST(req)
    expect(res.status).toBe(403)
    const payload = (await res.json()) as { success: boolean; error?: { code?: string } }
    expect(payload.success).toBe(false)
  })

  it('respinge request cu token expirat', async () => {
    const issued = issueDestructiveActionStepUpToken({
      userId: USER_ID,
      scope: destructiveActionScopes.farmReset,
      now: 1,
      ttlMs: 30_000,
    })
    expect(issued).not.toBeNull()

    const req = createSameOriginRequest('/api/farm/reset', {
      method: 'POST',
      headers: {
        [DESTRUCTIVE_STEP_UP_HEADER]: issued!.token,
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(403)
  })

  it('acceptă request cu step-up token valid', async () => {
    const issued = issueDestructiveActionStepUpToken({
      userId: USER_ID,
      scope: destructiveActionScopes.farmReset,
    })
    expect(issued).not.toBeNull()

    const req = createSameOriginRequest('/api/farm/reset', {
      method: 'POST',
      headers: {
        [DESTRUCTIVE_STEP_UP_HEADER]: issued!.token,
      },
    })
    const res = await POST(req)
    expect(res.status).toBe(200)
    const payload = (await res.json()) as { success: boolean }
    expect(payload.success).toBe(true)
  })
})
