import { beforeEach, describe, expect, it, vi } from 'vitest'

import { DELETE } from '@/app/api/gdpr/account/route'
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
  isSuperAdmin: vi.fn(),
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

vi.mock('@/lib/auth/isSuperAdmin', () => ({
  isSuperAdmin: (...args: unknown[]) => mocks.isSuperAdmin(...args),
}))

const USER_ID = 'ea1e59c2-335a-47c5-9f87-3f3402d85fe4'
const TENANT_ID = 'f7446f76-a177-4d5f-a9cf-d19adbaed7ba'

function makeAdminClient() {
  const eq = vi.fn().mockResolvedValue({ error: null })
  return {
    from: vi.fn(() => ({
      delete: () => ({
        eq,
      }),
    })),
    auth: {
      admin: {
        deleteUser: vi.fn().mockResolvedValue({ error: null }),
      },
    },
  }
}

describe('DELETE /api/gdpr/account step-up guard', () => {
  beforeEach(() => {
    process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET =
      'test-step-up-secret-value-with-at-least-thirty-two-bytes'
    __resetDestructiveActionStepUpForTests()
    vi.clearAllMocks()

    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: USER_ID, email: 'owner@example.com' } }, error: null }),
      },
    })
    mocks.getTenantIdByUserId.mockResolvedValue(TENANT_ID)
    mocks.getSupabaseAdmin.mockReturnValue(makeAdminClient())
    mocks.isSuperAdmin.mockResolvedValue(false)
  })

  it('respinge request fără step-up token', async () => {
    const req = createSameOriginRequest('/api/gdpr/account', { method: 'DELETE' })
    const res = await DELETE(req)
    expect(res.status).toBe(403)
  })

  it('acceptă request cu step-up token valid', async () => {
    const issued = issueDestructiveActionStepUpToken({
      userId: USER_ID,
      scope: destructiveActionScopes.gdprAccountDelete,
    })
    expect(issued).not.toBeNull()

    const req = createSameOriginRequest('/api/gdpr/account', {
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

  it('blochează ștergerea contului pentru superadmin chiar cu step-up valid', async () => {
    mocks.isSuperAdmin.mockResolvedValue(true)
    const issued = issueDestructiveActionStepUpToken({
      userId: USER_ID,
      scope: destructiveActionScopes.gdprAccountDelete,
    })
    expect(issued).not.toBeNull()

    const req = createSameOriginRequest('/api/gdpr/account', {
      method: 'DELETE',
      headers: {
        [DESTRUCTIVE_STEP_UP_HEADER]: issued!.token,
      },
    })

    const res = await DELETE(req)
    expect(res.status).toBe(403)
    const payload = (await res.json()) as {
      ok?: boolean
      error?: {
        code?: string
      }
    }
    expect(payload.error?.code).toBe('ACCOUNT_PROTECTED')
  })
})
