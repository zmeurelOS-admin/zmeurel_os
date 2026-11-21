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
import { TREATMENT_CHAIN_DELETE_ORDER } from '@/lib/tenant/destructive-cleanup'
import { createSameOriginRequest } from '@/test/helpers/api-origin-request'

vi.mock('@/lib/monitoring/report-error', () => ({ captureApiError: vi.fn() }))

const mocks = vi.hoisted(() => ({
  createClient: vi.fn(),
  getSupabaseAdmin: vi.fn(),
  ownedTenantIdForDeletion: vi.fn(),
  deleteFarmMemberships: vi.fn(),
  isSuperAdmin: vi.fn(),
}))

vi.mock('@/lib/supabase/server', () => ({ createClient: () => mocks.createClient() }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => mocks.getSupabaseAdmin() }))
vi.mock('@/lib/tenant/account-deletion', () => ({
  ownedTenantIdForDeletion: (...args: unknown[]) => mocks.ownedTenantIdForDeletion(...args),
  deleteFarmMemberships: (...args: unknown[]) => mocks.deleteFarmMemberships(...args),
}))
vi.mock('@/lib/auth/isSuperAdmin', () => ({
  isSuperAdmin: (...args: unknown[]) => mocks.isSuperAdmin(...args),
}))

const USER_ID = 'ea1e59c2-335a-47c5-9f87-3f3402d85fe4'
const TENANT_ID = 'f7446f76-a177-4d5f-a9cf-d19adbaed7ba'

/** Client simulat: notează fiecare ștergere, în ordine. `failOn` = tabelul la care ștergerea dă eroare. */
function makeRecordingAdmin(failOn: string | null = null) {
  const calls: string[] = []
  const admin = {
    from: vi.fn((table: string) => ({
      delete: () => ({
        eq: vi.fn(async () => {
          calls.push(`delete:${table}`)
          return { error: table === failOn ? { message: `boom ${table}`, code: '23503' } : null }
        }),
      }),
      select: () => ({
        eq: vi.fn(async () => ({ count: 0, error: null })),
      }),
    })),
    auth: {
      admin: {
        deleteUser: vi.fn(async (_id: string, soft?: boolean) => {
          calls.push(soft ? 'auth.softDeleteUser' : 'auth.deleteUser')
          return { error: !soft && failOn === 'auth.deleteUser' ? { message: 'fk', code: '23503' } : null }
        }),
      },
    },
  }
  return { admin, calls }
}

function requestWithStepUp() {
  const issued = issueDestructiveActionStepUpToken({
    userId: USER_ID,
    scope: destructiveActionScopes.gdprAccountDelete,
  })
  return createSameOriginRequest('/api/gdpr/account', {
    method: 'DELETE',
    headers: { [DESTRUCTIVE_STEP_UP_HEADER]: issued!.token },
  })
}

describe('DELETE /api/gdpr/account: curățarea fermei înainte de cont', () => {
  beforeEach(() => {
    process.env.DESTRUCTIVE_ACTION_STEP_UP_SECRET = 'test-step-up-secret-value-with-at-least-thirty-two-bytes'
    __resetDestructiveActionStepUpForTests()
    vi.clearAllMocks()
    mocks.createClient.mockResolvedValue({
      auth: {
        getUser: async () => ({ data: { user: { id: USER_ID, email: 'owner@example.com' } }, error: null }),
      },
    })
    mocks.ownedTenantIdForDeletion.mockResolvedValue(TENANT_ID)
    mocks.deleteFarmMemberships.mockResolvedValue(undefined)
    mocks.isSuperAdmin.mockResolvedValue(false)
  })

  it('șterge lanțul de tratamente și parcelele înainte de tenants, profiles și utilizatorul din auth', async () => {
    const { admin, calls } = makeRecordingAdmin()
    mocks.getSupabaseAdmin.mockReturnValue(admin)

    const res = await DELETE(requestWithStepUp())
    expect(res.status).toBe(200)

    const index = (name: string) => calls.indexOf(name)
    // Lanțul de tratamente, copil → părinte, primul.
    expect(calls.slice(0, TREATMENT_CHAIN_DELETE_ORDER.length)).toEqual(
      TREATMENT_CHAIN_DELETE_ORDER.map((table) => `delete:${table}`),
    )
    expect(index('delete:aplicari_tratament')).toBeLessThan(index('delete:parcele'))
    expect(index('delete:parcele')).toBeLessThan(index('delete:tenants'))
    expect(index('delete:ai_conversations')).toBeLessThan(index('delete:tenants'))
    expect(index('delete:tenants')).toBeLessThan(index('delete:profiles'))
    expect(calls[calls.length - 1]).toBe('auth.deleteUser')
  })

  it('se oprește la prima eroare critică: nu atinge tenants, profiles sau contul', async () => {
    const { admin, calls } = makeRecordingAdmin('aplicari_tratament')
    mocks.getSupabaseAdmin.mockReturnValue(admin)

    const res = await DELETE(requestWithStepUp())
    expect(res.status).toBe(500)
    expect(calls).toContain('delete:aplicari_tratament')
    expect(calls).not.toContain('delete:parcele')
    expect(calls).not.toContain('delete:tenants')
    expect(calls).not.toContain('delete:profiles')
    expect(calls).not.toContain('auth.deleteUser')
  })

  it('contul protejat nu ajunge la nicio ștergere', async () => {
    mocks.isSuperAdmin.mockResolvedValue(true)
    const { admin, calls } = makeRecordingAdmin()
    mocks.getSupabaseAdmin.mockReturnValue(admin)

    const res = await DELETE(requestWithStepUp())
    expect(res.status).toBe(403)
    expect(calls).toEqual([])
  })

  it('operatorul (fără fermă proprie) nu atinge ferma în care lucrează: doar legătura, profilul și contul', async () => {
    mocks.ownedTenantIdForDeletion.mockResolvedValue(null)
    mocks.deleteFarmMemberships.mockImplementation(async () => {
      calls.push('farm_members:user')
    })
    const { admin, calls } = makeRecordingAdmin()
    mocks.getSupabaseAdmin.mockReturnValue(admin)

    const res = await DELETE(requestWithStepUp())
    expect(res.status).toBe(200)
    expect(calls).not.toContain('delete:tenants')
    expect(calls).not.toContain('delete:parcele')
    expect(calls).not.toContain('delete:analytics_events')
    expect(calls).toEqual(['delete:ai_conversations', 'farm_members:user', 'delete:profiles', 'auth.deleteUser'])
  })

  it('operatorul care a scris în ferma altcuiva: contul se șterge soft, istoricul fermei rămâne', async () => {
    mocks.ownedTenantIdForDeletion.mockResolvedValue(null)
    const { admin, calls } = makeRecordingAdmin('auth.deleteUser')
    mocks.getSupabaseAdmin.mockReturnValue(admin)

    const res = await DELETE(requestWithStepUp())
    expect(res.status).toBe(200)
    expect(calls).not.toContain('delete:tenants')
    expect(calls.slice(-2)).toEqual(['auth.deleteUser', 'auth.softDeleteUser'])
  })
})
