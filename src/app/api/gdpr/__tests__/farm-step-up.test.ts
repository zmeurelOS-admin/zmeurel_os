import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DELETE } from '@/app/api/gdpr/farm/route'
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
  getSupabaseAdmin: vi.fn(),
  getTenantIdByUserId: vi.fn(),
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

const USER_ID = '4b4d7be0-36eb-4f6e-bcb5-bfb85cbf4cb4'
const TENANT_ID = 'b6acccca-122e-4d0d-9c43-b4836605f4cc'

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

describe('DELETE /api/gdpr/farm step-up guard', () => {
  beforeEach(() => {
    process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET =
      'test-step-up-secret-value-with-at-least-thirty-two-bytes'
    __resetDestructiveActionStepUpForTests()
    vi.clearAllMocks()

    mocks.createClient.mockResolvedValue(makeServerClient())
    mocks.getTenantIdByUserId.mockResolvedValue(TENANT_ID)
    mocks.getSupabaseAdmin.mockReturnValue(makeAdminClient())
  })

  it('respinge request fără step-up token', async () => {
    const req = createSameOriginRequest('/api/gdpr/farm', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(403)
  })

  it('acceptă request cu step-up token valid', async () => {
    const issued = issueDestructiveActionStepUpToken({
      userId: USER_ID,
      scope: destructiveActionScopes.gdprFarmDelete,
    })
    expect(issued).not.toBeNull()

    const req = createSameOriginRequest('/api/gdpr/farm', {
      method: 'DELETE',
      headers: {
        [DESTRUCTIVE_STEP_UP_HEADER]: issued!.token,
      },
    })
    const res = await DELETE(req)
    expect(res.status).toBe(200)
    const payload = (await res.json()) as { ok: boolean }
    expect(payload.ok).toBe(true)
  })
})
